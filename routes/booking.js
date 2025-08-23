const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateBookingCreation, validateBookingUpdate, validateOTPVerification } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all booking routes
router.use(authenticateToken);

// Public booking routes (available to all authenticated users)

/**
 * @route GET /api/bookings/health
 * @desc Health check for booking service
 * @access Private
 */
router.get('/health', bookingController.healthCheck);

/**
 * @route GET /api/bookings/search
 * @desc Search bookings
 * @access Private
 * @query {string} q - Search query (minimum 2 characters)
 * @query {string} filter - Filter type (all, vehicle, pallet, otp, customer, phone)
 */
router.get('/search', bookingController.searchBookings);

/**
 * @route GET /api/bookings/active
 * @desc Get active bookings
 * @access Private
 */
router.get('/active', bookingController.getActiveBookings);

/**
 * @route GET /api/bookings/stats
 * @desc Get booking statistics
 * @access Private
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 */
router.get('/stats', bookingController.getBookingStats);

/**
 * @route POST /api/bookings/verify-otp
 * @desc Verify OTP and retrieve vehicle information
 * @access Private
 * @body {string} otp - 6-digit OTP code
 */
router.post('/verify-otp', validateOTPVerification, bookingController.verifyOTP);

/**
 * @route GET /api/bookings/machine/:machineNumber
 * @desc Get bookings by machine
 * @access Private
 * @param {string} machineNumber - Machine number (e.g., M001)
 * @query {string} status - Booking status filter (optional)
 */
router.get('/machine/:machineNumber', bookingController.getBookingsByMachine);

/**
 * @route GET /api/bookings/vehicle/:vehicleNumber
 * @desc Get bookings by vehicle
 * @access Private
 * @param {string} vehicleNumber - Vehicle number
 */
router.get('/vehicle/:vehicleNumber', bookingController.getBookingsByVehicle);

/**
 * @route GET /api/bookings
 * @desc Get bookings with filters and pagination
 * @access Private
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @query {string} sortBy - Sort field (default: startTime)
 * @query {string} sortOrder - Sort order (asc/desc, default: desc)
 * @query {string} status - Filter by status
 * @query {string} machineNumber - Filter by machine
 * @query {string} vehicleNumber - Filter by vehicle
 * @query {string} search - General search term
 * @query {string} dateFrom - Filter from date
 * @query {string} dateTo - Filter to date
 */
router.get('/', bookingController.getBookings);

/**
 * @route GET /api/bookings/:id
 * @desc Get booking by ID
 * @access Private
 * @param {string} id - Booking ID
 */
router.get('/:id', bookingController.getBookingById);

/**
 * @route POST /api/bookings
 * @desc Create new booking
 * @access Private (Operators and above)
 * @body {string} customerName - Customer full name
 * @body {string} phoneNumber - Customer phone number
 * @body {string} vehicleNumber - Vehicle registration number
 * @body {string} vehicleType - Vehicle type (two-wheeler/four-wheeler)
 * @body {string} machineNumber - Machine number (e.g., M001)
 * @body {number} palletNumber - Pallet number (1-8)
 * @body {string} email - Customer email (optional)
 * @body {string} notes - Additional notes (optional)
 * @body {string} specialInstructions - Special instructions (optional)
 */
router.post('/', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validateBookingCreation, 
  bookingController.createBooking
);

/**
 * @route PUT /api/bookings/:id
 * @desc Update booking
 * @access Private (Operators and above)
 * @param {string} id - Booking ID
 * @body {string} notes - Additional notes (optional)
 * @body {string} specialInstructions - Special instructions (optional)
 * @body {string} vehicleType - Vehicle type (optional)
 */
router.put('/:id', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  validateBookingUpdate, 
  bookingController.updateBooking
);

/**
 * @route POST /api/bookings/:id/complete
 * @desc Complete booking with payment
 * @access Private (Operators and above)
 * @param {string} id - Booking ID
 * @body {number} amount - Payment amount
 * @body {string} method - Payment method (cash, card, upi, membership)
 * @body {string} transactionId - Transaction ID (optional)
 */
router.post('/:id/complete', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  bookingController.completeBooking
);

/**
 * @route DELETE /api/bookings/:id
 * @desc Delete booking
 * @access Private (Operators and above)
 * @param {string} id - Booking ID
 * @body {string} reason - Deletion reason (optional)
 */
router.delete('/:id', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  bookingController.cancelBooking
);

/**
 * @route POST /api/bookings/:id/regenerate-otp
 * @desc Generate new OTP for booking
 * @access Private (Operators and above)
 * @param {string} id - Booking ID
 */
router.post('/:id/regenerate-otp', 
  authorizeRoles('operator', 'supervisor', 'admin'),
  bookingController.generateNewOTP
);

/**
 * @route POST /api/bookings/:id/extend
 * @desc Extend booking time
 * @access Private (Supervisors and above)
 * @param {string} id - Booking ID
 * @body {number} hours - Hours to extend (optional, default: 0)
 * @body {number} minutes - Minutes to extend (optional, default: 0)
 * @body {string} reason - Extension reason (optional)
 */
router.post('/:id/extend', 
  authorizeRoles('supervisor', 'admin'),
  bookingController.extendBooking
);

module.exports = router;