const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

/**
 * @route GET /api/analytics/test-access
 * @desc Test role-based access control
 * @access Private (Any authenticated user - for testing)
 */
router.get('/test-access', (req, res) => {
  res.json({
    success: true,
    message: 'Access test successful',
    data: {
      user: {
        operatorId: req.user.operatorId,
        role: req.user.role,
        firstName: req.user.firstName
      },
      canAccessAnalytics: req.user.role === 'admin'
    }
  });
});

// Apply admin-only authorization to all other analytics routes
router.use(authorizeRoles('admin'));

/**
 * @route GET /api/analytics/health
 * @desc Health check for analytics service
 * @access Private (Admin only)
 */
router.get('/health', analyticsController.healthCheck);

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard analytics data
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional, default: 30 days ago)
 * @query {string} dateTo - End date (optional, default: today)
 * @query {string} siteId - Filter by site ID (optional)
 */
router.get('/dashboard', analyticsController.getDashboardAnalytics);

/**
 * @route GET /api/analytics/revenue
 * @desc Get revenue analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} period - Period grouping (day, week, month, year)
 * @query {string} siteId - Filter by site ID (optional)
 */
router.get('/revenue', analyticsController.getRevenueAnalytics);

/**
 * @route GET /api/analytics/bookings
 * @desc Get booking analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} period - Period grouping (day, week, month)
 * @query {string} siteId - Filter by site ID (optional)
 * @query {string} machineId - Filter by machine ID (optional)
 */
router.get('/bookings', analyticsController.getBookingAnalytics);

/**
 * @route GET /api/analytics/customers
 * @desc Get customer analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} siteId - Filter by site ID (optional)
 */
router.get('/customers', analyticsController.getCustomerAnalytics);

/**
 * @route GET /api/analytics/machines
 * @desc Get machine utilization analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} siteId - Filter by site ID (optional)
 * @query {string} machineType - Filter by machine type (optional)
 */
router.get('/machines', analyticsController.getMachineAnalytics);

/**
 * @route GET /api/analytics/sites
 * @desc Get site performance analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} sortBy - Sort by field (revenue, bookings, utilization)
 * @query {string} sortOrder - Sort order (asc, desc)
 */
router.get('/sites', analyticsController.getSiteAnalytics);

/**
 * @route GET /api/analytics/membership
 * @desc Get membership analytics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} siteId - Filter by site ID (optional)
 */
router.get('/membership', analyticsController.getMembershipAnalytics);

/**
 * @route GET /api/analytics/performance
 * @desc Get system performance metrics
 * @access Private (Admin only)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} metric - Specific metric (response_time, error_rate, uptime)
 */
router.get('/performance', analyticsController.getPerformanceAnalytics);

module.exports = router;