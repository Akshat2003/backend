const express = require('express');
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validation = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all customer routes
router.use(authenticateToken);

/**
 * @route GET /api/customers/health
 * @desc Health check for customer service
 * @access Private
 */
router.get('/health', customerController.healthCheck);

/**
 * @route GET /api/customers/search
 * @desc Search customers by phone/name/vehicle
 * @access Private
 * @query {string} q - Search query (minimum 2 characters)
 * @query {string} type - Search type (phone, name, vehicle, all)
 */
router.get('/search', customerController.searchCustomers);

/**
 * @route GET /api/customers
 * @desc Get customers with filters and pagination
 * @access Private
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} sortBy - Sort field (default: createdAt)
 * @query {string} sortOrder - Sort order (asc/desc, default: desc)
 * @query {string} search - General search term
 * @query {boolean} isActive - Filter by active status
 */
router.get('/', customerController.getCustomers);

/**
 * @route GET /api/customers/:id
 * @desc Get customer by ID
 * @access Private
 * @param {string} id - Customer ID
 */
router.get('/:id', customerController.getCustomerById);

/**
 * @route POST /api/customers
 * @desc Create new customer
 * @access Private (Operators and above)
 * @body {string} firstName - Customer first name
 * @body {string} lastName - Customer last name
 * @body {string} phoneNumber - Customer phone number
 * @body {string} email - Customer email (optional)
 * @body {Array} vehicles - Customer vehicles (optional)
 */
router.post('/', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validation.validateCustomerCreation,
  customerController.createCustomer
);

/**
 * @route PUT /api/customers/:id
 * @desc Update customer details
 * @access Private (Operators and above)
 * @param {string} id - Customer ID
 * @body {string} firstName - Customer first name (optional)
 * @body {string} lastName - Customer last name (optional)
 * @body {string} email - Customer email (optional)
 */
router.put('/:id', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validation.validateCustomerUpdate,
  customerController.updateCustomer
);

/**
 * @route DELETE /api/customers/:id
 * @desc Soft delete customer
 * @access Private (Supervisors and above)
 * @param {string} id - Customer ID
 * @body {string} reason - Deletion reason (optional)
 */
router.delete('/:id', 
  authorizeRoles('supervisor', 'admin'),
  customerController.deleteCustomer
);

/**
 * @route GET /api/customers/:id/bookings
 * @desc Get customer's booking history
 * @access Private
 * @param {string} id - Customer ID
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} status - Filter by booking status
 */
router.get('/:id/bookings', customerController.getCustomerBookings);

/**
 * @route GET /api/customers/:id/vehicles
 * @desc Get customer's vehicles
 * @access Private
 * @param {string} id - Customer ID
 */
router.get('/:id/vehicles', customerController.getCustomerVehicles);

/**
 * @route POST /api/customers/:id/vehicles
 * @desc Add vehicle to customer
 * @access Private (Operators and above)
 * @param {string} id - Customer ID
 * @body {string} vehicleNumber - Vehicle registration number
 * @body {string} vehicleType - Vehicle type (two-wheeler/four-wheeler)
 * @body {string} make - Vehicle make (optional)
 * @body {string} model - Vehicle model (optional)
 * @body {string} color - Vehicle color (optional)
 */
router.post('/:id/vehicles', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validation.validateVehicleCreation,
  customerController.addCustomerVehicle
);

/**
 * @route PUT /api/customers/:id/vehicles/:vehicleId
 * @desc Update customer vehicle
 * @access Private (Operators and above)
 * @param {string} id - Customer ID
 * @param {string} vehicleId - Vehicle ID
 * @body {string} vehicleNumber - Vehicle registration number (optional)
 * @body {string} vehicleType - Vehicle type (optional)
 * @body {string} make - Vehicle make (optional)
 * @body {string} model - Vehicle model (optional)
 * @body {string} color - Vehicle color (optional)
 */
router.put('/:id/vehicles/:vehicleId', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validation.validateVehicleUpdate,
  customerController.updateCustomerVehicle
);

/**
 * @route DELETE /api/customers/:id/vehicles/:vehicleId
 * @desc Remove vehicle from customer
 * @access Private (Operators and above)
 * @param {string} id - Customer ID
 * @param {string} vehicleId - Vehicle ID
 */
router.delete('/:id/vehicles/:vehicleId', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  customerController.removeCustomerVehicle
);

/**
 * @route POST /api/customers/validate-membership
 * @desc Validate membership credentials
 * @access Private
 * @body {string} membershipNumber - 6-digit membership number
 * @body {string} pin - 4-digit PIN
 */
router.post('/validate-membership', 
  validation.validateMembershipCredentials,
  customerController.validateMembership
);

/**
 * @route POST /api/customers/:id/membership
 * @desc Create membership for customer
 * @access Private (Admin only)
 * @param {string} id - Customer ID
 * @body {string} membershipType - Type of membership (monthly/quarterly/yearly/premium)
 * @body {number} validityTerm - Validity term in months (default: 12)
 */
router.post('/:id/membership', 
  authorizeRoles('admin'),
  validation.validateMembershipCreation,
  customerController.createMembership
);

/**
 * @route DELETE /api/customers/:id/membership
 * @desc Deactivate customer membership
 * @access Private (Admin only)
 * @param {string} id - Customer ID
 */
router.delete('/:id/membership', 
  authorizeRoles('admin'),
  customerController.deactivateMembership
);

module.exports = router;