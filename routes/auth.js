const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const validation = require('../middleware/validation');
const { USER_ROLES } = require('../utils/constants');

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', 
  validation.validateLogin,
  authController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (admin only in production)
 * @access  Public (for development) / Admin (for production)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/register',
    validation.validateRegistration,
    authController.register
  );
} else {
  router.post('/register',
    authenticateToken,
    authorizeRoles(USER_ROLES.ADMIN),
    validation.validateRegistration,
    authController.register
  );
}

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  authController.refreshToken
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  validation.validatePasswordResetRequest,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/verify-reset-otp
 * @desc    Verify OTP for password reset
 * @access  Public
 */
router.post('/verify-reset-otp',
  authController.verifyResetOTP
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post('/reset-password',
  validation.validatePasswordReset,
  authController.resetPassword
);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token
 * @access  Public
 */
router.get('/validate',
  authController.validateToken
);

/**
 * @route   GET /api/auth/health
 * @desc    Health check for auth service
 * @access  Public
 */
router.get('/health',
  authController.healthCheck
);

// Protected routes (authentication required)

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  authController.logout
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticateToken,
  validation.sanitizeInput,
  authController.updateProfile
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password',
  authenticateToken,
  authController.changePassword
);

module.exports = router;