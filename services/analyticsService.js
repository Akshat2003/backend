const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Machine = require('../models/Machine');
const Site = require('../models/Site');
const User = require('../models/User');
const logger = require('../utils/logger');

class AnalyticsService {
  /**
   * Get dashboard analytics data
   */
  async getDashboardAnalytics({ dateFrom, dateTo, siteId }) {
    try {
      // Set default date range (last 30 days)
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Build base filter
      const dateFilter = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (siteId) {
        dateFilter.siteId = siteId;
      }

      // Get parallel analytics data
      const [
        totalBookings,
        activeBookings,
        completedBookings,
        totalRevenue,
        totalCustomers,
        newCustomers,
        activeMemberships,
        totalMachines,
        activeMachines,
        recentBookings,
        topCustomers,
        machineUtilization
      ] = await Promise.all([
        // Total bookings in period
        Booking.countDocuments(dateFilter),
        
        // Active bookings
        Booking.countDocuments({ ...dateFilter, status: 'active' }),
        
        // Completed bookings
        Booking.countDocuments({ ...dateFilter, status: 'completed' }),
        
        // Total revenue
        this.calculateTotalRevenue(dateFilter),
        
        // Total customers
        Customer.countDocuments({ isActive: true }),
        
        // New customers in period
        Customer.countDocuments({ ...dateFilter, isActive: true }),
        
        // Active memberships
        Customer.countDocuments({ 
          'membership.isActive': true,
          'membership.expiryDate': { $gte: new Date() }
        }),
        
        // Total machines
        Machine.countDocuments({ isActive: true }),
        
        // Active machines
        Machine.countDocuments({ isActive: true, status: 'online' }),
        
        // Recent bookings
        Booking.find(dateFilter)
          .populate('customer', 'firstName lastName phoneNumber')
          .populate('siteId', 'siteName')
          .sort({ createdAt: -1 })
          .limit(10),
        
        // Top customers by booking count
        this.getTopCustomers(dateFilter),
        
        // Machine utilization
        this.getMachineUtilization(dateFilter)
      ]);

      // Calculate growth rates
      const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPeriodFilter = {
        createdAt: { $gte: previousPeriodStart, $lte: startDate },
        ...(siteId && { siteId })
      };

      const [previousBookings, previousRevenue, previousCustomers] = await Promise.all([
        Booking.countDocuments(previousPeriodFilter),
        this.calculateTotalRevenue(previousPeriodFilter),
        Customer.countDocuments(previousPeriodFilter)
      ]);

      // Calculate percentage changes
      const bookingGrowth = this.calculateGrowthRate(totalBookings, previousBookings);
      const revenueGrowth = this.calculateGrowthRate(totalRevenue, previousRevenue);
      const customerGrowth = this.calculateGrowthRate(newCustomers, previousCustomers);

      return {
        summary: {
          totalBookings,
          activeBookings,
          completedBookings,
          totalRevenue,
          totalCustomers,
          newCustomers,
          activeMemberships,
          totalMachines,
          activeMachines,
          bookingGrowth,
          revenueGrowth,
          customerGrowth
        },
        recentActivity: {
          recentBookings: recentBookings.map(booking => ({
            id: booking._id,
            customerName: booking.customer ? `${booking.customer.firstName} ${booking.customer.lastName}` : booking.customerName || 'Unknown',
            phoneNumber: booking.customer?.phoneNumber || booking.phoneNumber,
            vehicleNumber: booking.vehicleNumber,
            status: booking.status,
            amount: booking.payment?.amount || 0,
            createdAt: booking.createdAt
          }))
        },
        insights: {
          topCustomers,
          machineUtilization: machineUtilization.slice(0, 5),
          utilizationRate: this.calculateOverallUtilization(machineUtilization),
          averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0
        },
        dateRange: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      logger.error('Error getting dashboard analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics({ dateFrom, dateTo, period, siteId }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const baseFilter = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      };

      if (siteId) {
        baseFilter.siteId = siteId;
      }

      // Group by period
      const groupFormat = this.getGroupFormat(period);
      
      const revenueByPeriod = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: '$createdAt'
              }
            },
            totalRevenue: { $sum: '$payment.amount' },
            totalBookings: { $sum: 1 },
            averageValue: { $avg: '$payment.amount' },
            cashPayments: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'cash'] }, '$payment.amount', 0]
              }
            },
            cardPayments: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'card'] }, '$payment.amount', 0]
              }
            },
            upiPayments: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'upi'] }, '$payment.amount', 0]
              }
            },
            membershipPayments: {
              $sum: {
                $cond: [{ $eq: ['$payment.method', 'membership'] }, '$payment.amount', 0]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get payment method distribution
      const paymentMethodDistribution = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$payment.method',
            count: { $sum: 1 },
            totalAmount: { $sum: '$payment.amount' }
          }
        }
      ]);

      // Get top revenue generating machines
      const topMachines = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$machineNumber',
            totalRevenue: { $sum: '$payment.amount' },
            totalBookings: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'machines',
            localField: '_id',
            foreignField: 'machineNumber',
            as: 'machine'
          }
        },
        { $unwind: { path: '$machine', preserveNullAndEmptyArrays: true } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 }
      ]);

      const totalRevenue = revenueByPeriod.reduce((sum, item) => sum + item.totalRevenue, 0);

      return {
        summary: {
          totalRevenue,
          totalBookings: revenueByPeriod.reduce((sum, item) => sum + item.totalBookings, 0),
          averageBookingValue: totalRevenue / (revenueByPeriod.reduce((sum, item) => sum + item.totalBookings, 0) || 1),
          period: {
            startDate,
            endDate,
            grouping: period
          }
        },
        revenueByPeriod: revenueByPeriod.map(item => ({
          period: item._id,
          totalRevenue: item.totalRevenue,
          totalBookings: item.totalBookings,
          averageValue: item.averageValue,
          paymentBreakdown: {
            cash: item.cashPayments,
            card: item.cardPayments,
            upi: item.upiPayments,
            membership: item.membershipPayments
          }
        })),
        paymentMethodDistribution: paymentMethodDistribution.map(method => ({
          method: method._id || 'unknown',
          count: method.count,
          totalAmount: method.totalAmount,
          percentage: (method.totalAmount / totalRevenue) * 100
        })),
        topMachines: topMachines.map(machine => ({
          machineNumber: machine._id,
          machineName: machine.machine?.machineName || 'Unknown Machine',
          totalRevenue: machine.totalRevenue,
          totalBookings: machine.totalBookings,
          averageValue: machine.totalRevenue / machine.totalBookings
        }))
      };
    } catch (error) {
      logger.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get booking analytics
   */
  async getBookingAnalytics({ dateFrom, dateTo, period, siteId, machineId }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const baseFilter = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (siteId) baseFilter.siteId = siteId;
      if (machineId) baseFilter.machineId = machineId;

      // Bookings by period
      const groupFormat = this.getGroupFormat(period);
      
      const bookingsByPeriod = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              period: {
                $dateToString: {
                  format: groupFormat,
                  date: '$createdAt'
                }
              },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.period',
            statuses: {
              $push: {
                status: '$_id.status',
                count: '$count'
              }
            },
            totalBookings: { $sum: '$count' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Booking status distribution
      const statusDistribution = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Peak hours analysis
      const peakHours = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Average booking duration
      const avgDuration = await Booking.aggregate([
        { 
          $match: { 
            ...baseFilter, 
            status: 'completed',
            endTime: { $exists: true }
          } 
        },
        {
          $project: {
            duration: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                1000 * 60 // Convert to minutes
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' },
            minDuration: { $min: '$duration' },
            maxDuration: { $max: '$duration' }
          }
        }
      ]);

      return {
        summary: {
          totalBookings: statusDistribution.reduce((sum, item) => sum + item.count, 0),
          completedBookings: statusDistribution.find(s => s._id === 'completed')?.count || 0,
          activeBookings: statusDistribution.find(s => s._id === 'active')?.count || 0,
          cancelledBookings: statusDistribution.find(s => s._id === 'cancelled')?.count || 0,
          averageDuration: avgDuration[0]?.avgDuration || 0,
          period: { startDate, endDate, grouping: period }
        },
        bookingsByPeriod: bookingsByPeriod.map(item => ({
          period: item._id,
          totalBookings: item.totalBookings,
          statusBreakdown: item.statuses.reduce((acc, status) => {
            acc[status.status] = status.count;
            return acc;
          }, {})
        })),
        statusDistribution: statusDistribution.map(status => ({
          status: status._id,
          count: status.count,
          percentage: (status.count / statusDistribution.reduce((sum, item) => sum + item.count, 0)) * 100
        })),
        peakHours: peakHours.map(hour => ({
          hour: hour._id,
          count: hour.count
        })),
        durationStats: avgDuration[0] || { avgDuration: 0, minDuration: 0, maxDuration: 0 }
      };
    } catch (error) {
      logger.error('Error getting booking analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics({ dateFrom, dateTo, siteId }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const baseFilter = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      // Customer growth over time
      const customerGrowth = await Customer.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            newCustomers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Customer retention (customers with multiple bookings)
      const customerRetention = await Booking.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$customer',
            bookingCount: { $sum: 1 },
            totalSpent: { $sum: '$payment.amount' },
            firstBooking: { $min: '$createdAt' },
            lastBooking: { $max: '$createdAt' }
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$bookingCount', 1] }, 'one-time',
                { $cond: [
                  { $lte: ['$bookingCount', 3] }, 'occasional',
                  { $cond: [
                    { $lte: ['$bookingCount', 10] }, 'regular',
                    'frequent'
                  ]}
                ]}
              ]
            },
            customerCount: { $sum: 1 },
            averageSpent: { $avg: '$totalSpent' }
          }
        }
      ]);

      // Top customers by spending
      const topCustomers = await this.getTopCustomers({
        createdAt: { $gte: startDate, $lte: endDate }
      }, 20);

      // Membership statistics
      const membershipStats = await Customer.aggregate([
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            activeMemberships: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$membership.isActive', true] },
                      { $gte: ['$membership.expiryDate', new Date()] }
                    ]
                  },
                  1, 0
                ]
              }
            },
            membershipTypes: {
              $push: {
                $cond: [
                  { $eq: ['$membership.isActive', true] },
                  '$membership.membershipType',
                  null
                ]
              }
            }
          }
        }
      ]);

      return {
        summary: {
          totalCustomers: await Customer.countDocuments({ isActive: true }),
          newCustomers: await Customer.countDocuments(baseFilter),
          activeMemberships: membershipStats[0]?.activeMemberships || 0,
          membershipConversionRate: membershipStats[0] ? 
            (membershipStats[0].activeMemberships / membershipStats[0].totalCustomers * 100) : 0,
          period: { startDate, endDate }
        },
        customerGrowth: customerGrowth.map(item => ({
          date: item._id,
          newCustomers: item.newCustomers
        })),
        customerRetention: customerRetention.map(segment => ({
          segment: segment._id,
          customerCount: segment.customerCount,
          averageSpent: segment.averageSpent
        })),
        topCustomers,
        membershipDistribution: this.getMembershipDistribution(membershipStats[0]?.membershipTypes || [])
      };
    } catch (error) {
      logger.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get machine utilization analytics
   */
  async getMachineAnalytics({ dateFrom, dateTo, siteId, machineType }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const baseFilter = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (siteId) baseFilter.siteId = siteId;

      // Machine utilization
      const machineUtilization = await this.getMachineUtilization(baseFilter);

      // Machine performance over time
      const machinePerformance = await Booking.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              machineNumber: '$machineNumber',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt'
                }
              }
            },
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$payment.amount' }
          }
        },
        {
          $lookup: {
            from: 'machines',
            localField: '_id.machineId',
            foreignField: 'machineNumber',
            as: 'machine'
          }
        },
        { $unwind: { path: '$machine', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$_id.date',
            machines: {
              $push: {
                machineNumber: '$machine.machineNumber',
                bookingCount: '$bookingCount',
                revenue: '$revenue'
              }
            },
            totalBookings: { $sum: '$bookingCount' },
            totalRevenue: { $sum: '$revenue' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Machine status distribution
      const machineStatusDistribution = await Machine.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        summary: {
          totalMachines: await Machine.countDocuments({ isActive: true }),
          onlineMachines: await Machine.countDocuments({ isActive: true, status: 'online' }),
          averageUtilization: this.calculateOverallUtilization(machineUtilization),
          period: { startDate, endDate }
        },
        machineUtilization: machineUtilization.map(machine => ({
          machineNumber: machine._id,
          machineName: machine.machine?.machineName || 'Unknown Machine',
          utilizationRate: machine.utilizationRate,
          totalBookings: machine.totalBookings,
          totalRevenue: machine.totalRevenue,
          averageSessionTime: machine.averageSessionTime
        })),
        machinePerformance: machinePerformance.map(day => ({
          date: day._id,
          totalBookings: day.totalBookings,
          totalRevenue: day.totalRevenue,
          machines: day.machines
        })),
        statusDistribution: machineStatusDistribution.map(status => ({
          status: status._id,
          count: status.count
        }))
      };
    } catch (error) {
      logger.error('Error getting machine analytics:', error);
      throw error;
    }
  }

  /**
   * Get site performance analytics
   */
  async getSiteAnalytics({ dateFrom, dateTo, sortBy, sortOrder }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const sitePerformance = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$siteId',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$payment.amount' },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'sites',
            localField: '_id',
            foreignField: 'machineNumber',
            as: 'site'
          }
        },
        { $unwind: '$site' },
        {
          $lookup: {
            from: 'machines',
            localField: '_id',
            foreignField: 'siteId',
            as: 'machines'
          }
        },
        {
          $project: {
            siteId: '$_id',
            siteName: '$site.siteName',
            location: '$site.location',
            totalBookings: 1,
            totalRevenue: 1,
            completedBookings: 1,
            cancelledBookings: 1,
            completionRate: {
              $cond: [
                { $gt: ['$totalBookings', 0] },
                { $multiply: [{ $divide: ['$completedBookings', '$totalBookings'] }, 100] },
                0
              ]
            },
            averageBookingValue: {
              $cond: [
                { $gt: ['$totalBookings', 0] },
                { $divide: ['$totalRevenue', '$totalBookings'] },
                0
              ]
            },
            totalMachines: { $size: '$machines' },
            activeMachines: {
              $size: {
                $filter: {
                  input: '$machines',
                  cond: { $eq: ['$$this.status', 'online'] }
                }
              }
            }
          }
        }
      ]);

      // Sort results
      const sortField = sortBy === 'revenue' ? 'totalRevenue' : 
                       sortBy === 'bookings' ? 'totalBookings' : 
                       'totalRevenue';
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      
      sitePerformance.sort((a, b) => {
        return sortDirection * (a[sortField] - b[sortField]);
      });

      return {
        summary: {
          totalSites: await Site.countDocuments({ isActive: true }),
          period: { startDate, endDate },
          sortBy,
          sortOrder
        },
        sitePerformance: sitePerformance.map(site => ({
          siteId: site.siteId,
          siteName: site.siteName,
          location: `${site.location.city}, ${site.location.state}`,
          totalBookings: site.totalBookings,
          totalRevenue: site.totalRevenue,
          completedBookings: site.completedBookings,
          cancelledBookings: site.cancelledBookings,
          completionRate: site.completionRate,
          averageBookingValue: site.averageBookingValue,
          totalMachines: site.totalMachines,
          activeMachines: site.activeMachines,
          utilizationRate: site.totalMachines > 0 ? (site.activeMachines / site.totalMachines * 100) : 0
        }))
      };
    } catch (error) {
      logger.error('Error getting site analytics:', error);
      throw error;
    }
  }

  /**
   * Get membership analytics
   */
  async getMembershipAnalytics({ dateFrom, dateTo, siteId }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Membership creation trends
      const membershipTrends = await Customer.aggregate([
        {
          $match: {
            'membership.issuedDate': { $gte: startDate, $lte: endDate },
            'membership.isActive': true
          }
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$membership.issuedDate'
                }
              },
              type: '$membership.membershipType'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            memberships: {
              $push: {
                type: '$_id.type',
                count: '$count'
              }
            },
            totalCreated: { $sum: '$count' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Membership usage in bookings
      const membershipUsage = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            'payment.method': 'membership'
          }
        },
        {
          $group: {
            _id: null,
            totalMembershipBookings: { $sum: 1 },
            totalMembershipRevenue: { $sum: '$payment.amount' },
            totalSavings: { $sum: '$payment.membershipDiscount' }
          }
        }
      ]);

      // Membership type distribution
      const membershipDistribution = await Customer.aggregate([
        {
          $match: {
            'membership.isActive': true,
            'membership.expiryDate': { $gte: new Date() }
          }
        },
        {
          $group: {
            _id: '$membership.membershipType',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$membership.totalSpent' }
          }
        }
      ]);

      // Expiring memberships
      const expiringMemberships = await Customer.aggregate([
        {
          $match: {
            'membership.isActive': true,
            'membership.expiryDate': {
              $gte: new Date(),
              $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
            }
          }
        },
        {
          $group: {
            _id: '$membership.membershipType',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalActiveMemberships = await Customer.countDocuments({
        'membership.isActive': true,
        'membership.expiryDate': { $gte: new Date() }
      });

      const totalCustomers = await Customer.countDocuments({ isActive: true });

      return {
        summary: {
          totalActiveMemberships,
          totalCustomers,
          membershipPenetration: (totalActiveMemberships / totalCustomers * 100),
          newMemberships: membershipTrends.reduce((sum, day) => sum + day.totalCreated, 0),
          membershipBookings: membershipUsage[0]?.totalMembershipBookings || 0,
          membershipRevenue: membershipUsage[0]?.totalMembershipRevenue || 0,
          totalSavings: membershipUsage[0]?.totalSavings || 0,
          expiringCount: expiringMemberships.reduce((sum, type) => sum + type.count, 0),
          period: { startDate, endDate }
        },
        membershipTrends: membershipTrends.map(day => ({
          date: day._id,
          totalCreated: day.totalCreated,
          typeBreakdown: day.memberships.reduce((acc, membership) => {
            acc[membership.type] = membership.count;
            return acc;
          }, {})
        })),
        membershipDistribution: membershipDistribution.map(type => ({
          type: type._id,
          count: type.count,
          percentage: (type.count / totalActiveMemberships * 100),
          averageRevenue: type.totalRevenue / type.count
        })),
        expiringMemberships: expiringMemberships.map(type => ({
          type: type._id,
          count: type.count
        }))
      };
    } catch (error) {
      logger.error('Error getting membership analytics:', error);
      throw error;
    }
  }

  /**
   * Get system performance analytics
   */
  async getPerformanceAnalytics({ dateFrom, dateTo, metric }) {
    try {
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // This would typically integrate with monitoring systems
      // For now, return mock performance data
      const performanceData = {
        systemUptime: 99.8,
        averageResponseTime: 245, // milliseconds
        errorRate: 0.2, // percentage
        apiCallsPerHour: 1250,
        activeConnections: 45,
        memoryUsage: 68.5, // percentage
        cpuUsage: 23.4, // percentage
        diskUsage: 45.2, // percentage
        period: { startDate, endDate }
      };

      return {
        summary: performanceData,
        metrics: [
          { name: 'Response Time', value: performanceData.averageResponseTime, unit: 'ms', status: 'good' },
          { name: 'Error Rate', value: performanceData.errorRate, unit: '%', status: 'good' },
          { name: 'Uptime', value: performanceData.systemUptime, unit: '%', status: 'excellent' },
          { name: 'Memory Usage', value: performanceData.memoryUsage, unit: '%', status: 'warning' },
          { name: 'CPU Usage', value: performanceData.cpuUsage, unit: '%', status: 'good' }
        ]
      };
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  // Helper methods
  async calculateTotalRevenue(filter) {
    // Debug: Log the filter being used
    logger.info('Calculating total revenue with filter:', filter);
    
    // First check all completed bookings
    const completedBookings = await Booking.find({ ...filter, status: 'completed' })
      .select('payment.amount payment.status vehicleNumber createdAt');
    
    logger.info('Found completed bookings for revenue calculation:', {
      count: completedBookings.length,
      bookings: completedBookings.map(b => ({
        id: b._id,
        vehicleNumber: b.vehicleNumber,
        paymentAmount: b.payment?.amount,
        paymentStatus: b.payment?.status,
        createdAt: b.createdAt
      }))
    });
    
    const result = await Booking.aggregate([
      { $match: { ...filter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$payment.amount' } } }
    ]);
    
    const totalRevenue = result[0]?.total || 0;
    logger.info('Total revenue calculated:', { totalRevenue, aggregateResult: result });
    
    return totalRevenue;
  }

  async getTopCustomers(filter, limit = 10) {
    return Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$customer',
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$payment.amount' },
          lastBooking: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
      {
        $project: {
          customer: '$_id',
          customerName: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
          phoneNumber: '$customer.phoneNumber',
          totalBookings: 1,
          totalSpent: 1,
          lastBooking: 1,
          averageSpent: { $divide: ['$totalSpent', '$totalBookings'] },
          hasMembership: '$customer.hasMembership'
        }
      }
    ]);
  }

  async getMachineUtilization(filter) {
    return Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$machineId',
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$payment.amount' },
          totalDuration: {
            $sum: {
              $cond: [
                { $and: ['$startTime', '$endTime'] },
                { $subtract: ['$endTime', '$startTime'] },
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'machines',
          localField: '_id',
          foreignField: '_id',
          as: 'machine'
        }
      },
      { $unwind: '$machine' },
      {
        $project: {
          machineNumber: '$machine.machineNumber',
          machineName: '$machine.machineName',
          totalBookings: 1,
          totalRevenue: 1,
          averageSessionTime: {
            $cond: [
              { $gt: ['$totalBookings', 0] },
              { $divide: ['$totalDuration', '$totalBookings'] },
              0
            ]
          },
          utilizationRate: {
            $cond: [
              { $gt: ['$machine.capacity.totalPallets', 0] },
              { $multiply: [{ $divide: ['$totalBookings', '$machine.capacity.totalPallets'] }, 10] }, // Simplified calculation
              0
            ]
          }
        }
      },
      { $sort: { utilizationRate: -1 } }
    ]);
  }

  calculateGrowthRate(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  calculateOverallUtilization(machineUtilization) {
    if (machineUtilization.length === 0) return 0;
    const totalUtilization = machineUtilization.reduce((sum, machine) => sum + machine.utilizationRate, 0);
    return totalUtilization / machineUtilization.length;
  }

  getGroupFormat(period) {
    switch (period) {
      case 'hour': return '%Y-%m-%d %H:00';
      case 'day': return '%Y-%m-%d';
      case 'week': return '%Y-W%U';
      case 'month': return '%Y-%m';
      case 'year': return '%Y';
      default: return '%Y-%m-%d';
    }
  }

  getMembershipDistribution(membershipTypes) {
    const distribution = {};
    membershipTypes.filter(type => type !== null).forEach(type => {
      distribution[type] = (distribution[type] || 0) + 1;
    });
    
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(distribution).map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? (count / total * 100) : 0
    }));
  }
}

module.exports = new AnalyticsService();