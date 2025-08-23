const analyticsService = require('../services/analyticsService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

class AnalyticsController {
  /**
   * Health check for analytics service
   * @route GET /api/analytics/health
   */
  async healthCheck(req, res, next) {
    try {
      const health = {
        service: 'Analytics API',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      responseHandler.success(res, health, 'Analytics service is healthy');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get dashboard analytics data
   * @route GET /api/analytics/dashboard
   */
  async getDashboardAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        siteId
      } = req.query;

      const dashboardData = await analyticsService.getDashboardAnalytics({
        dateFrom,
        dateTo,
        siteId
      });

      responseHandler.success(res, dashboardData, 'Dashboard analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get revenue analytics
   * @route GET /api/analytics/revenue
   */
  async getRevenueAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        period = 'day',
        siteId
      } = req.query;

      const revenueData = await analyticsService.getRevenueAnalytics({
        dateFrom,
        dateTo,
        period,
        siteId
      });

      responseHandler.success(res, revenueData, 'Revenue analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get booking analytics
   * @route GET /api/analytics/bookings
   */
  async getBookingAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        period = 'day',
        siteId,
        machineId
      } = req.query;

      const bookingData = await analyticsService.getBookingAnalytics({
        dateFrom,
        dateTo,
        period,
        siteId,
        machineId
      });

      responseHandler.success(res, bookingData, 'Booking analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer analytics
   * @route GET /api/analytics/customers
   */
  async getCustomerAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        siteId
      } = req.query;

      const customerData = await analyticsService.getCustomerAnalytics({
        dateFrom,
        dateTo,
        siteId
      });

      responseHandler.success(res, customerData, 'Customer analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machine utilization analytics
   * @route GET /api/analytics/machines
   */
  async getMachineAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        siteId,
        machineType
      } = req.query;

      const machineData = await analyticsService.getMachineAnalytics({
        dateFrom,
        dateTo,
        siteId,
        machineType
      });

      responseHandler.success(res, machineData, 'Machine analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get site performance analytics
   * @route GET /api/analytics/sites
   */
  async getSiteAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        sortBy = 'revenue',
        sortOrder = 'desc'
      } = req.query;

      const siteData = await analyticsService.getSiteAnalytics({
        dateFrom,
        dateTo,
        sortBy,
        sortOrder
      });

      responseHandler.success(res, siteData, 'Site analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get membership analytics
   * @route GET /api/analytics/membership
   */
  async getMembershipAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        siteId
      } = req.query;

      const membershipData = await analyticsService.getMembershipAnalytics({
        dateFrom,
        dateTo,
        siteId
      });

      responseHandler.success(res, membershipData, 'Membership analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system performance metrics
   * @route GET /api/analytics/performance
   */
  async getPerformanceAnalytics(req, res, next) {
    try {
      const {
        dateFrom,
        dateTo,
        metric
      } = req.query;

      const performanceData = await analyticsService.getPerformanceAnalytics({
        dateFrom,
        dateTo,
        metric
      });

      responseHandler.success(res, performanceData, 'Performance analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();