const mongoose = require('mongoose');
const Site = require('../models/Site');
const User = require('../models/User');
const Machine = require('../models/Machine');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');

// Helper function to create errors
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

class SiteService {
  /**
   * Create new site
   */
  async createSite(siteData, createdBy) {
    try {
      // Check if site ID already exists
      const existingSite = await Site.findOne({ siteId: siteData.siteId });
      if (existingSite) {
        throw createError('Site ID already exists', 409);
      }

      const site = new Site({
        ...siteData,
        createdBy
      });

      await site.save();

      logger.info('Site created successfully', {
        siteId: site.siteId,
        createdBy
      });

      return site;

    } catch (error) {
      logger.error('Site creation failed:', error);
      throw error;
    }
  }

  /**
   * Get sites with filters and pagination
   */
  async getSites(filters = {}, pagination = {}, sorting = {}) {
    try {
      const {
        search,
        status,
        city,
        state,
        userSites
      } = filters;

      const {
        page = 1,
        limit = 20
      } = pagination;

      const {
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = sorting;

      // Build query
      let query = {};

      // Filter by user's assigned sites (for non-admin users)
      if (userSites && userSites.length > 0) {
        query._id = { $in: userSites };
      }

      // Search filter
      if (search) {
        query.$or = [
          { siteName: { $regex: search, $options: 'i' } },
          { siteId: { $regex: search, $options: 'i' } },
          { 'location.address.city': { $regex: search, $options: 'i' } },
          { 'location.address.state': { $regex: search, $options: 'i' } }
        ];
      }

      // Status filter
      if (status) {
        query.status = status;
      }

      // City filter
      if (city) {
        query['location.address.city'] = { $regex: city, $options: 'i' };
      }

      // State filter
      if (state) {
        query['location.address.state'] = { $regex: state, $options: 'i' };
      }

      // Execute query with pagination
      const sortObject = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [sites, totalItems] = await Promise.all([
        Site.find(query)
          .sort(sortObject)
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .populate('createdBy', 'operatorId fullName')
          .populate('updatedBy', 'operatorId fullName'),
        Site.countDocuments(query)
      ]);

      // Pagination info
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        sites,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage
        }
      };

    } catch (error) {
      logger.error('Get sites failed:', error);
      throw error;
    }
  }

  /**
   * Get site by ID
   */
  async getSiteById(siteId) {
    try {
      // Validate siteId format
      if (!siteId || !mongoose.isValidObjectId(siteId)) {
        throw createError('Invalid site ID format', 400);
      }

      const site = await Site.findById(siteId)
        .populate('createdBy', 'operatorId fullName')
        .populate('updatedBy', 'operatorId fullName');

      if (!site) {
        throw createError('Site not found', 404);
      }

      // Get additional site data
      const [machineCount, userCount, todayBookings] = await Promise.all([
        Machine.countDocuments({ siteId }),
        User.countDocuments({ 'assignedSites.site': siteId }),
        Booking.countDocuments({ 
          siteId,
          createdAt: { 
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        })
      ]);

      return {
        ...site.toObject(),
        machineCount,
        userCount,
        todayBookings
      };

    } catch (error) {
      logger.error('Get site by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update site
   */
  async updateSite(siteId, updateData, updatedBy) {
    try {
      // Validate siteId format
      if (!siteId || !mongoose.isValidObjectId(siteId)) {
        throw createError('Invalid site ID format', 400);
      }

      const site = await Site.findById(siteId);

      if (!site) {
        throw createError('Site not found', 404);
      }

      // Update site data
      Object.assign(site, updateData, { updatedBy });

      await site.save();

      logger.info('Site updated successfully', {
        siteId: site.siteId,
        updatedBy
      });

      return site;

    } catch (error) {
      logger.error('Site update failed:', error);
      throw error;
    }
  }

  /**
   * Deactivate site
   */
  async deactivateSite(siteId, reason, updatedBy) {
    try {
      // Validate siteId format
      if (!siteId || !mongoose.isValidObjectId(siteId)) {
        throw createError('Invalid site ID format', 400);
      }

      const site = await Site.findById(siteId);

      if (!site) {
        throw createError('Site not found', 404);
      }

      // Check if site has active bookings
      const activeBookings = await Booking.countDocuments({
        siteId,
        status: 'active'
      });

      if (activeBookings > 0) {
        throw createError('Cannot deactivate site with active bookings', 400);
      }

      site.status = 'inactive';
      site.updatedBy = updatedBy;
      await site.save();

      // Deactivate all machines in this site
      await Machine.updateMany(
        { siteId },
        { status: 'offline', updatedBy }
      );

      logger.info('Site deactivated successfully', {
        siteId: site.siteId,
        reason,
        updatedBy
      });

      return site;

    } catch (error) {
      logger.error('Site deactivation failed:', error);
      throw error;
    }
  }

  /**
   * Permanently delete site (hard delete)
   */
  async deleteSitePermanently(siteId, reason, force = false, deletedBy) {
    try {
      // Validate siteId format
      if (!siteId || !mongoose.isValidObjectId(siteId)) {
        throw createError('Invalid site ID format', 400);
      }

      const site = await Site.findById(siteId);

      if (!site) {
        throw createError('Site not found', 404);
      }

      // Check if site has any bookings (active or historical)
      const totalBookings = await Booking.countDocuments({ siteId });
      
      if (totalBookings > 0 && !force) {
        throw createError(
          `Cannot permanently delete site with ${totalBookings} booking records. Use force=true to override, or deactivate instead.`,
          400
        );
      }

      // Check if site has active bookings
      const activeBookings = await Booking.countDocuments({
        siteId,
        status: 'active'
      });

      if (activeBookings > 0 && !force) {
        throw createError('Cannot delete site with active bookings. Complete or cancel all active bookings first, or use force=true to override.', 400);
      }

      // Check if site has machines
      const machineCount = await Machine.countDocuments({ siteId });
      
      if (machineCount > 0 && !force) {
        throw createError(
          `Cannot permanently delete site with ${machineCount} machines. Use force=true to override, or deactivate instead.`,
          400
        );
      }

      // Start transaction for data integrity
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete all machines in this site (if force is true)
        if (machineCount > 0 && force) {
          await Machine.deleteMany({ siteId }, { session });
          logger.warn('Forced deletion of machines', { siteId: site.siteId, machineCount });
        }

        // Delete all bookings for this site (if force is true)
        if (totalBookings > 0 && force) {
          await Booking.deleteMany({ siteId }, { session });
          logger.warn('Forced deletion of booking records', { siteId: site.siteId, bookingCount: totalBookings });
        }

        // Remove site assignments from all users
        await User.updateMany(
          { 'assignedSites.site': siteId },
          { 
            $pull: { assignedSites: { site: siteId } },
            $unset: { primarySite: 1 }
          },
          { session }
        );

        // Permanently delete the site
        await Site.findByIdAndDelete(siteId, { session });

        // Commit transaction
        await session.commitTransaction();

        logger.info('Site permanently deleted', {
          siteId: site.siteId,
          siteName: site.siteName,
          reason,
          deletedBy,
          force,
          machinesDeleted: machineCount,
          bookingsDeleted: totalBookings
        });

        return {
          message: 'Site permanently deleted',
          siteId: site.siteId,
          siteName: site.siteName,
          deletedData: {
            machines: force ? machineCount : 0,
            bookings: force ? totalBookings : 0
          }
        };

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      logger.error('Permanent site deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get site statistics
   */
  async getSiteStatistics(siteId) {
    try {
      const site = await Site.findById(siteId);
      if (!site) {
        throw createError('Site not found', 404);
      }

      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0));
      const todayEnd = new Date(today.setHours(23, 59, 59, 999));

      const [
        totalMachines,
        activeMachines,
        totalBookings,
        todayBookings,
        totalRevenue,
        todayRevenue,
        activeBookings
      ] = await Promise.all([
        Machine.countDocuments({ siteId }),
        Machine.countDocuments({ siteId, status: 'online' }),
        Booking.countDocuments({ siteId }),
        Booking.countDocuments({ 
          siteId,
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }),
        Booking.aggregate([
          { $match: { siteId: site._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Booking.aggregate([
          { 
            $match: { 
              siteId: site._id,
              status: 'completed',
              createdAt: { $gte: todayStart, $lte: todayEnd }
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Booking.countDocuments({ siteId, status: 'active' })
      ]);

      return {
        machines: {
          total: totalMachines,
          active: activeMachines,
          inactive: totalMachines - activeMachines
        },
        bookings: {
          total: totalBookings,
          today: todayBookings,
          active: activeBookings
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          today: todayRevenue[0]?.total || 0
        },
        occupancyRate: site.statistics.averageOccupancyRate || 0
      };

    } catch (error) {
      logger.error('Get site statistics failed:', error);
      throw error;
    }
  }

  /**
   * Get user's assigned sites
   */
  async getUserSites(userId) {
    try {
      const user = await User.findById(userId)
        .populate({
          path: 'assignedSites.site',
          select: 'siteId siteName location status configuration'
        });

      if (!user) {
        throw createError('User not found', 404);
      }

      return user.assignedSites.map(assignment => ({
        site: assignment.site,
        role: assignment.role,
        permissions: assignment.permissions
      }));

    } catch (error) {
      logger.error('Get user sites failed:', error);
      throw error;
    }
  }

  /**
   * Assign user to site
   */
  async assignUserToSite(siteId, userId, role, permissions, assignedBy) {
    try {
      const [site, user] = await Promise.all([
        Site.findById(siteId),
        User.findById(userId)
      ]);

      if (!site) {
        throw createError('Site not found', 404);
      }

      if (!user) {
        throw createError('User not found', 404);
      }

      // Check if user is already assigned to this site
      const existingAssignment = user.assignedSites.find(
        assignment => assignment.site.toString() === siteId
      );

      if (existingAssignment) {
        // Update existing assignment
        existingAssignment.role = role;
        existingAssignment.permissions = permissions;
      } else {
        // Add new assignment
        user.assignedSites.push({
          site: siteId,
          role,
          permissions
        });

        // Set as primary site if user has no primary site
        if (!user.primarySite) {
          user.primarySite = siteId;
        }
      }

      await user.save();

      logger.info('User assigned to site successfully', {
        userId,
        siteId: site.siteId,
        role,
        assignedBy
      });

      return { user, site };

    } catch (error) {
      logger.error('Assign user to site failed:', error);
      throw error;
    }
  }

  /**
   * Remove user from site
   */
  async removeUserFromSite(siteId, userId, removedBy) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw createError('User not found', 404);
      }

      // Remove site assignment
      user.assignedSites = user.assignedSites.filter(
        assignment => assignment.site.toString() !== siteId
      );

      // Clear primary site if it was this site
      if (user.primarySite && user.primarySite.toString() === siteId) {
        user.primarySite = user.assignedSites.length > 0 ? user.assignedSites[0].site : null;
      }

      await user.save();

      logger.info('User removed from site successfully', {
        userId,
        siteId,
        removedBy
      });

    } catch (error) {
      logger.error('Remove user from site failed:', error);
      throw error;
    }
  }

  /**
   * Get site users
   */
  async getSiteUsers(siteId) {
    try {
      const users = await User.find({
        'assignedSites.site': siteId
      }).select('operatorId firstName lastName email role assignedSites');

      const siteUsers = users.map(user => {
        const siteAssignment = user.assignedSites.find(
          assignment => assignment.site.toString() === siteId
        );

        return {
          _id: user._id,
          operatorId: user.operatorId,
          fullName: user.fullName,
          email: user.email,
          globalRole: user.role,
          siteRole: siteAssignment?.role,
          permissions: siteAssignment?.permissions || []
        };
      });

      return siteUsers;

    } catch (error) {
      logger.error('Get site users failed:', error);
      throw error;
    }
  }
}

module.exports = new SiteService();