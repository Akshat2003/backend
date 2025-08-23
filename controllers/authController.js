const authService = require('../services/authService');
const responseHandler = require('../utils/responseHandler');
const { MESSAGES } = require('../utils/constants');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Register new user
   * @route POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const {
        operatorId,
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        phoneNumber,
        role,
        shift,
        department
      } = req.body;

      // Validate password confirmation
      if (password !== confirmPassword) {
        return responseHandler.badRequest(res, 'Passwords do not match');
      }

      // Create user
      const result = await authService.register({
        operatorId,
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        role,
        shift,
        department
      }, req.user?.id);

      // Set HTTP-only cookie for refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      responseHandler.created(res, {
        user: result.user,
        accessToken: result.tokens.accessToken
      }, 'User registered successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * @route POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { operatorId, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await authService.login(operatorId, password, ipAddress);

      // Set HTTP-only cookie for refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      responseHandler.success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken
      }, 'Login successful');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * @route POST /api/auth/refresh
   */
  async refreshToken(req, res, next) {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return responseHandler.unauthorized(res, 'Refresh token is required');
      }

      const tokens = await authService.refreshToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      responseHandler.success(res, {
        accessToken: tokens.accessToken
      }, 'Token refreshed successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * @route POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken;
      
      await authService.logout(req.user._id, refreshToken);

      responseHandler.success(res, null, 'Logout successful');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * @route GET /api/auth/profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await authService.getUserProfile(req.user._id);

      responseHandler.success(res, { user }, 'Profile retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * @route PUT /api/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const updates = req.body;
      const user = await authService.updateProfile(req.user._id, updates);

      responseHandler.success(res, { user }, 'Profile updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * @route POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        return responseHandler.badRequest(res, 'New passwords do not match');
      }

      await authService.changePassword(req.user._id, currentPassword, newPassword);

      responseHandler.success(res, null, 'Password changed successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset
   * @route POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { operatorId, email } = req.body;

      const result = await authService.requestPasswordReset(operatorId, email);

      // In development, return the OTP and token for testing
      if (process.env.NODE_ENV === 'development') {
        responseHandler.success(res, {
          message: result.message,
          resetToken: result.resetToken,
          otp: result.otp
        }, 'Password reset requested');
      } else {
        responseHandler.success(res, {
          message: result.message || result
        }, 'Password reset requested');
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP for password reset
   * @route POST /api/auth/verify-reset-otp
   */
  async verifyResetOTP(req, res, next) {
    try {
      const { resetToken, otp } = req.body;

      if (!resetToken || !otp) {
        return responseHandler.badRequest(res, 'Reset token and OTP are required');
      }

      await authService.verifyResetOTP(resetToken, otp);

      responseHandler.success(res, null, MESSAGES.OTP_VERIFIED);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   * @route POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { resetToken, otp, newPassword, confirmPassword } = req.body;

      // Validate required fields
      if (!resetToken || !otp || !newPassword) {
        return responseHandler.badRequest(res, 'Reset token, OTP, and new password are required');
      }

      // Validate password confirmation
      if (newPassword !== confirmPassword) {
        return responseHandler.badRequest(res, 'Passwords do not match');
      }

      await authService.resetPassword(resetToken, otp, newPassword);

      responseHandler.success(res, null, MESSAGES.PASSWORD_RESET_SUCCESS);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate token (for middleware use)
   * @route GET /api/auth/validate
   */
  async validateToken(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return responseHandler.unauthorized(res, 'Access token is required');
      }

      const result = await authService.validateToken(token);

      responseHandler.success(res, result, 'Token is valid');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for auth service
   * @route GET /api/auth/health
   */
  async healthCheck(req, res, next) {
    try {
      responseHandler.success(res, {
        service: 'auth',
        status: 'healthy',
        timestamp: new Date().toISOString()
      }, 'Auth service is healthy');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();