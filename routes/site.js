const express = require('express');
const siteController = require('../controllers/siteController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validation = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all site routes
router.use(authenticateToken);

/**
 * @route GET /api/sites/my-sites
 * @desc Get sites assigned to current user
 * @access Private
 */
router.get('/my-sites', siteController.getMySites);

/**
 * @route GET /api/sites
 * @desc Get sites with filters and pagination
 * @access Private
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} sortBy - Sort field (default: createdAt)
 * @query {string} sortOrder - Sort order (asc/desc, default: desc)
 * @query {string} search - General search term
 * @query {string} status - Filter by status
 * @query {string} city - Filter by city
 * @query {string} state - Filter by state
 */
router.get('/', siteController.getSites);

/**
 * @route GET /api/sites/:id
 * @desc Get site by ID
 * @access Private
 * @param {string} id - Site ID
 */
router.get('/:id', siteController.getSiteById);

/**
 * @route POST /api/sites
 * @desc Create new site
 * @access Private (Admin only)
 * @body {string} siteId - Site ID (SITE001, SITE002, etc.)
 * @body {string} siteName - Site name
 * @body {object} location - Site location details
 * @body {object} siteManager - Site manager details
 * @body {object} configuration - Site configuration
 * @body {object} pricing - Site pricing (optional)
 */
router.post('/', 
  authorizeRoles('admin'),
  // validation.validateSiteCreation, // TODO: Add validation middleware
  siteController.createSite
);

/**
 * @route PUT /api/sites/:id
 * @desc Update site details
 * @access Private (Admin, Site Admin, Supervisor)
 * @param {string} id - Site ID
 * @body {string} siteName - Site name (optional)
 * @body {object} location - Site location details (optional)
 * @body {object} siteManager - Site manager details (optional)
 * @body {object} configuration - Site configuration (optional)
 * @body {object} pricing - Site pricing (optional)
 */
router.put('/:id', 
  authorizeRoles('admin', 'supervisor', 'operator'), // Site-level permissions checked in controller
  // validation.validateSiteUpdate, // TODO: Add validation middleware
  siteController.updateSite
);

/**
 * @route DELETE /api/sites/:id
 * @desc Deactivate site
 * @access Private (Admin only)
 * @param {string} id - Site ID
 * @body {string} reason - Deactivation reason (optional)
 */
router.delete('/:id', 
  authorizeRoles('admin'),
  siteController.deactivateSite
);

/**
 * @route GET /api/sites/:id/statistics
 * @desc Get site statistics
 * @access Private
 * @param {string} id - Site ID
 */
router.get('/:id/statistics', siteController.getSiteStatistics);

/**
 * @route GET /api/sites/:id/users
 * @desc Get site users
 * @access Private (Admin, Site Admin, Supervisor)
 * @param {string} id - Site ID
 */
router.get('/:id/users', siteController.getSiteUsers);

/**
 * @route POST /api/sites/:id/assign-user
 * @desc Assign user to site
 * @access Private (Admin only)
 * @param {string} id - Site ID
 * @body {string} userId - User ID to assign
 * @body {string} role - Site role (operator, supervisor, site-admin)
 * @body {array} permissions - Array of permissions
 */
router.post('/:id/assign-user',
  authorizeRoles('admin'),
  // validation.validateUserAssignment, // TODO: Add validation middleware
  siteController.assignUserToSite
);

/**
 * @route DELETE /api/sites/:id/users/:userId
 * @desc Remove user from site
 * @access Private (Admin only)
 * @param {string} id - Site ID
 * @param {string} userId - User ID to remove
 */
router.delete('/:id/users/:userId',
  authorizeRoles('admin'),
  siteController.removeUserFromSite
);

module.exports = router;