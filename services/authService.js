const User = require('../models/User');
const jwtConfig = require('../config/jwt');
const encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const { MESSAGES, USER_STATUS } = require('../utils/constants');
const { AppError } = require('../middleware/errorHandler');

class AuthService {
  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @param {String} createdBy - ID of user creating this account
   * @returns {Promise<Object>} - Created user and tokens
   */
  async register(userData, createdBy = null) {
    try {
      const {
        operatorId,
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        role = 'operator',
        shift = 'morning',
        department = null
      } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { operatorId: operatorId.toUpperCase() },
          { email: email.toLowerCase() },
          { phoneNumber }
        ]
      });

      if (existingUser) {
        if (existingUser.operatorId === operatorId.toUpperCase()) {
          throw new AppError('Operator ID already exists', 409);
        }
        if (existingUser.email === email.toLowerCase()) {
          throw new AppError('Email already exists', 409);
        }
        if (existingUser.phoneNumber === phoneNumber) {
          throw new AppError('Phone number already exists', 409);
        }
      }

      // Hash password
      const hashedPassword = await encryption.hashPassword(password);

      // Create new user
      const newUser = new User({
        operatorId: operatorId.toUpperCase(),
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        role,
        shift,
        department,
        createdBy,
        status: USER_STATUS.ACTIVE
      });

      const savedUser = await newUser.save();

      // Generate tokens
      const tokenPayload = {
        userId: savedUser._id,
        operatorId: savedUser.operatorId,
        role: savedUser.role
      };

      const tokens = jwtConfig.generateTokenPair(tokenPayload);

      // Save refresh token
      savedUser.refreshToken = tokens.refreshToken;
      savedUser.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await savedUser.save();

      logger.info('User registered successfully', { 
        operatorId: savedUser.operatorId,
        email: savedUser.email 
      });

      return {
        user: this.sanitizeUser(savedUser),
        tokens
      };

    } catch (error) {
      logger.error('Registration failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Registration failed', 500);
    }
  }

  /**
   * Login user
   * @param {String} operatorId - Operator ID
   * @param {String} password - User password
   * @param {String} ipAddress - Client IP address
   * @returns {Promise<Object>} - User data and tokens
   */
  async login(operatorId, password, ipAddress = null) {
    try {
      // Find user by operator ID
      const user = await User.findOne({ 
        operatorId: operatorId.toUpperCase() 
      }).select('+password +loginAttempts +lockUntil');

      if (!user) {
        throw new AppError(MESSAGES.INVALID_CREDENTIALS, 401);
      }

      // Check if account is locked
      if (user.isLocked) {
        throw new AppError(MESSAGES.ACCOUNT_LOCKED, 423);
      }

      // Check if account is active
      if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError('Account is not active', 403);
      }

      // Verify password
      const isPasswordValid = await encryption.comparePassword(password, user.password);
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incrementLoginAttempts();
        throw new AppError(MESSAGES.INVALID_CREDENTIALS, 401);
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      await user.updateLastLogin();

      // Generate tokens
      const tokenPayload = {
        userId: user._id,
        operatorId: user.operatorId,
        role: user.role
      };

      const tokens = jwtConfig.generateTokenPair(tokenPayload);

      // Save refresh token
      user.refreshToken = tokens.refreshToken;
      user.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await user.save();

      logger.info('User logged in successfully', { 
        operatorId: user.operatorId,
        ipAddress 
      });

      return {
        user: this.sanitizeUser(user),
        tokens
      };

    } catch (error) {
      logger.error('Login failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Login failed', 500);
    }
  }

  /**
   * Refresh access token
   * @param {String} refreshToken - Refresh token
   * @returns {Promise<Object>} - New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwtConfig.verifyRefreshToken(refreshToken);

      // Find user and validate refresh token
      const user = await User.findById(decoded.userId).select('+refreshToken +refreshTokenExpiresAt');
      
      if (!user || user.refreshToken !== refreshToken) {
        throw new AppError('Invalid refresh token', 401);
      }

      if (user.refreshTokenExpiresAt < new Date()) {
        throw new AppError('Refresh token expired', 401);
      }

      if (user.status !== USER_STATUS.ACTIVE) {
        throw new AppError('Account is not active', 403);
      }

      // Generate new tokens
      const tokenPayload = {
        userId: user._id,
        operatorId: user.operatorId,
        role: user.role
      };

      const tokens = jwtConfig.generateTokenPair(tokenPayload);

      // Update refresh token
      user.refreshToken = tokens.refreshToken;
      user.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await user.save();

      logger.info('Token refreshed successfully', { 
        operatorId: user.operatorId 
      });

      return tokens;

    } catch (error) {
      logger.error('Token refresh failed:', error.message);
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        throw new AppError('Invalid or expired refresh token', 401);
      }
      throw new AppError('Token refresh failed', 500);
    }
  }

  /**
   * Logout user
   * @param {String} userId - User ID
   * @param {String} refreshToken - Refresh token to invalidate
   * @returns {Promise<void>}
   */
  async logout(userId, refreshToken = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Clear refresh token
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      await user.save();

      logger.info('User logged out successfully', { 
        operatorId: user.operatorId 
      });

    } catch (error) {
      logger.error('Logout failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Logout failed', 500);
    }
  }

  /**
   * Change password
   * @param {String} userId - User ID
   * @param {String} currentPassword - Current password
   * @param {String} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await encryption.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Hash new password
      const hashedNewPassword = await encryption.hashPassword(newPassword);

      // Update password
      user.password = hashedNewPassword;
      user.passwordChangedAt = new Date();
      await user.save();

      logger.info('Password changed successfully', { 
        operatorId: user.operatorId 
      });

    } catch (error) {
      logger.error('Password change failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Password change failed', 500);
    }
  }

  /**
   * Request password reset
   * @param {String} operatorId - Operator ID
   * @param {String} email - User email
   * @returns {Promise<String>} - Reset token
   */
  async requestPasswordReset(operatorId, email) {
    try {
      const user = await User.findOne({
        operatorId: operatorId.toUpperCase(),
        email: email.toLowerCase(),
        status: USER_STATUS.ACTIVE
      });

      if (!user) {
        // Don't reveal if user exists or not
        logger.warn('Password reset requested for non-existent user', { operatorId, email });
        return 'If the account exists, password reset instructions have been sent.';
      }

      // Generate reset token and OTP
      const resetToken = encryption.generateRandomToken(32);
      const otp = encryption.generateOTP(6);
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save reset data
      user.passwordResetToken = encryption.sha256Hash(resetToken);
      user.otp = {
        code: otp,
        expiresAt: otpExpires,
        attempts: 0
      };
      await user.save();

      logger.info('Password reset requested', { 
        operatorId: user.operatorId,
        email: user.email 
      });

      return {
        message: 'Password reset OTP has been sent to your email',
        resetToken, // In production, this should be sent via email
        otp // In production, this should be sent via email/SMS
      };

    } catch (error) {
      logger.error('Password reset request failed:', error.message);
      throw new AppError('Password reset request failed', 500);
    }
  }

  /**
   * Verify OTP for password reset
   * @param {String} resetToken - Reset token
   * @param {String} otp - OTP code
   * @returns {Promise<Boolean>}
   */
  async verifyResetOTP(resetToken, otp) {
    try {
      const hashedToken = encryption.sha256Hash(resetToken);
      const user = await User.findOne({
        passwordResetToken: hashedToken
      }).select('+otp +passwordResetToken');

      if (!user || !user.otp) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      // Check OTP expiration
      if (user.otp.expiresAt < new Date()) {
        throw new AppError(MESSAGES.OTP_EXPIRED, 400);
      }

      // Check attempts
      if (user.otp.attempts >= 5) {
        throw new AppError('Too many OTP attempts. Please request a new reset.', 400);
      }

      // Verify OTP
      if (user.otp.code !== otp) {
        user.otp.attempts += 1;
        await user.save();
        throw new AppError(MESSAGES.INVALID_OTP, 400);
      }

      logger.info('Reset OTP verified successfully', { 
        operatorId: user.operatorId 
      });

      return true;

    } catch (error) {
      logger.error('OTP verification failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('OTP verification failed', 500);
    }
  }

  /**
   * Reset password with token and new password
   * @param {String} resetToken - Reset token
   * @param {String} otp - OTP code
   * @param {String} newPassword - New password
   * @returns {Promise<void>}
   */
  async resetPassword(resetToken, otp, newPassword) {
    try {
      // First verify OTP
      await this.verifyResetOTP(resetToken, otp);

      const hashedToken = encryption.sha256Hash(resetToken);
      const user = await User.findOne({
        passwordResetToken: hashedToken
      }).select('+passwordResetToken +otp');

      if (!user) {
        throw new AppError('Invalid reset token', 400);
      }

      // Hash new password
      const hashedNewPassword = await encryption.hashPassword(newPassword);

      // Update password and clear reset data
      user.password = hashedNewPassword;
      user.passwordChangedAt = new Date();
      user.passwordResetToken = undefined;
      user.otp = undefined;
      await user.save();

      logger.info('Password reset successfully', { 
        operatorId: user.operatorId 
      });

    } catch (error) {
      logger.error('Password reset failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Password reset failed', 500);
    }
  }

  /**
   * Validate JWT token
   * @param {String} token - JWT token
   * @returns {Promise<Object>} - Decoded token data
   */
  async validateToken(token) {
    try {
      const decoded = jwtConfig.verifyAccessToken(token);
      
      const user = await User.findById(decoded.userId);
      if (!user || user.status !== USER_STATUS.ACTIVE) {
        throw new AppError('Invalid token', 401);
      }

      return {
        user: this.sanitizeUser(user),
        decoded
      };

    } catch (error) {
      logger.error('Token validation failed:', error.message);
      if (error.message.includes('expired')) {
        throw new AppError(MESSAGES.TOKEN_EXPIRED, 401);
      }
      throw new AppError(MESSAGES.INVALID_TOKEN, 401);
    }
  }

  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} - Sanitized user object
   */
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    
    // Remove sensitive fields
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.refreshTokenExpiresAt;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpires;
    delete userObj.otp;
    
    return userObj;
  }

  /**
   * Get user profile
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - User profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return this.sanitizeUser(user);

    } catch (error) {
      logger.error('Get user profile failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get user profile', 500);
    }
  }

  /**
   * Update user profile
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated user profile
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'department', 'shift'];
      const updates = {};

      // Filter allowed fields
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        { ...updates, updatedBy: userId },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new AppError('User not found', 404);
      }

      logger.info('User profile updated', { 
        operatorId: user.operatorId 
      });

      return this.sanitizeUser(user);

    } catch (error) {
      logger.error('Update profile failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update profile', 500);
    }
  }
}

module.exports = new AuthService();