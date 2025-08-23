const express = require('express');
const machineController = require('../controllers/machineController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validation = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all machine routes
router.use(authenticateToken);

/**
 * @route GET /api/machines/health
 * @desc Health check for machine service
 * @access Private
 */
router.get('/health', machineController.healthCheck);

/**
 * @route GET /api/machines/available
 * @desc Get available machines for booking
 * @access Private
 * @query {string} vehicleType - Vehicle type (two-wheeler/four-wheeler) - Required
 * @query {string} siteId - Site ID to filter machines (optional)
 */
router.get('/available', machineController.getAvailableMachines);

/**
 * @route GET /api/machines/maintenance-due
 * @desc Get machines needing maintenance
 * @access Private (Supervisors and above)
 * @query {string} siteId - Site ID to filter machines (optional)
 */
router.get('/maintenance-due', 
  authorizeRoles('supervisor', 'admin'),
  machineController.getMaintenanceDue
);

/**
 * @route GET /api/machines
 * @desc Get machines with filters and pagination
 * @access Private
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} sortBy - Sort field (default: createdAt)
 * @query {string} sortOrder - Sort order (asc/desc, default: desc)
 * @query {string} siteId - Filter by site ID
 * @query {string} machineType - Filter by machine type (two-wheeler/four-wheeler)
 * @query {string} status - Filter by status (online/offline/maintenance/error)
 * @query {string} search - General search term
 * @query {string} availability - Filter by availability (available)
 */
router.get('/', machineController.getMachines);

/**
 * @route GET /api/machines/:id
 * @desc Get machine by ID
 * @access Private
 * @param {string} id - Machine ID
 */
router.get('/:id', machineController.getMachineById);

/**
 * @route POST /api/machines
 * @desc Create new machine
 * @access Private (Admin only)
 * @body {string} siteId - Site ID where machine is installed
 * @body {string} machineNumber - Machine number (e.g., M001)
 * @body {string} machineName - Machine display name
 * @body {string} machineType - Machine type (two-wheeler/four-wheeler)
 * @body {string} status - Machine status (optional, default: online)
 * @body {object} capacity - Machine capacity configuration
 * @body {object} specifications - Machine specifications
 * @body {object} location - Machine location details
 * @body {object} operatingHours - Operating hours configuration
 * @body {object} pricing - Pricing configuration
 * @body {object} vendor - Vendor information
 * @body {date} warrantyExpiryDate - Warranty expiry date
 */
router.post('/', 
  authorizeRoles('admin'),
  // validation.validateMachineCreation, // TODO: Add validation middleware
  machineController.createMachine
);

/**
 * @route PUT /api/machines/:id
 * @desc Update machine details
 * @access Private (Admin, Supervisors)
 * @param {string} id - Machine ID
 * @body {string} machineName - Machine display name (optional)
 * @body {string} status - Machine status (optional)
 * @body {object} specifications - Machine specifications (optional)
 * @body {object} location - Machine location details (optional)
 * @body {object} operatingHours - Operating hours configuration (optional)
 * @body {object} pricing - Pricing configuration (optional)
 */
router.put('/:id', 
  authorizeRoles('admin', 'supervisor'),
  // validation.validateMachineUpdate, // TODO: Add validation middleware
  machineController.updateMachine
);

/**
 * @route DELETE /api/machines/:id
 * @desc Deactivate machine
 * @access Private (Admin only)
 * @param {string} id - Machine ID
 * @body {string} reason - Deactivation reason (optional)
 */
router.delete('/:id', 
  authorizeRoles('admin'),
  machineController.deactivateMachine
);

/**
 * @route GET /api/machines/:id/pallets
 * @desc Get machine pallet status
 * @access Private
 * @param {string} id - Machine ID
 */
router.get('/:id/pallets', machineController.getMachinePallets);

/**
 * @route POST /api/machines/:id/pallets/:palletNumber/occupy
 * @desc Occupy pallet with vehicle
 * @access Private (Operators and above)
 * @param {string} id - Machine ID
 * @param {number} palletNumber - Pallet number (1-8)
 * @body {string} bookingId - Booking ID
 * @body {string} vehicleNumber - Vehicle registration number
 * @body {number} position - Position number for two-wheelers (1-6, optional)
 */
router.post('/:id/pallets/:palletNumber/occupy', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  machineController.occupyPallet
);

/**
 * @route POST /api/machines/:id/pallets/:palletNumber/release
 * @desc Release pallet (free all vehicles)
 * @access Private (Operators and above)
 * @param {string} id - Machine ID
 * @param {number} palletNumber - Pallet number (1-8)
 * @body {string} bookingId - Booking ID to release
 */
router.post('/:id/pallets/:palletNumber/release', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  machineController.releasePallet
);

/**
 * @route POST /api/machines/:id/pallets/:palletNumber/release-vehicle
 * @desc Release specific vehicle from pallet
 * @access Private (Operators and above)
 * @param {string} id - Machine ID
 * @param {number} palletNumber - Pallet number (1-8)
 * @body {string} vehicleNumber - Vehicle registration number to release
 */
router.post('/:id/pallets/:palletNumber/release-vehicle', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  machineController.releaseVehicle
);

/**
 * @route POST /api/machines/:id/pallets/:palletNumber/maintenance
 * @desc Set pallet to maintenance mode
 * @access Private (Supervisors and above)
 * @param {string} id - Machine ID
 * @param {number} palletNumber - Pallet number (1-8)
 * @body {string} maintenanceNotes - Maintenance notes (optional)
 */
router.post('/:id/pallets/:palletNumber/maintenance', 
  authorizeRoles('supervisor', 'admin'),
  machineController.setPalletMaintenance
);

/**
 * @route GET /api/machines/:id/statistics
 * @desc Get machine statistics and utilization
 * @access Private
 * @param {string} id - Machine ID
 */
router.get('/:id/statistics', machineController.getMachineStatistics);

/**
 * @route POST /api/machines/:id/heartbeat
 * @desc Update machine heartbeat (from machine controller)
 * @access Private (System/Admin)
 * @param {string} id - Machine ID
 * @body {string} firmwareVersion - Firmware version (optional)
 * @body {object} status - Machine status data (optional)
 */
router.post('/:id/heartbeat', 
  // Note: In production, this should have API key authentication for machine controllers
  authorizeRoles('admin', 'operator', 'supervisor'), // Temporary - should be machine auth
  machineController.updateHeartbeat
);

module.exports = router;