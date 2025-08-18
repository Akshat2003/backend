const jwt = require('../config/jwt');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');
const User = require('../models/User');
const { USER_STATUS } = require('../utils/constants');

/**
 * Extract token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} - JWT token or null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check for token in cookies (optional)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
};

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return responseHandler.unauthorized(res, 'Access token is required');
    }

    // Verify the token
    const decoded = jwt.verifyAccessToken(token);
    
    // Find user in database
    const user = await User.findById(decoded.userId).select('+refreshToken');
    
    if (!user) {
      logger.warn('Authentication failed: User not found', {
        userId: decoded.userId,
        ip: req.ip
      });
      return responseHandler.unauthorized(res, 'User not found');
    }

    // Check if user account is active
    if (user.status !== USER_STATUS.ACTIVE) {
      logger.warn('Authentication failed: User account inactive', {
        userId: user._id,
        status: user.status,
        ip: req.ip
      });
      return responseHandler.unauthorized(res, 'Account is not active');
    }

    // Check if user account is locked
    if (user.isLocked) {
      logger.warn('Authentication failed: User account locked', {
        userId: user._id,
        lockUntil: user.lockUntil,
        ip: req.ip
      });
      return responseHandler.unauthorized(res, 'Account is temporarily locked');
    }

    // Check if password was changed after token was issued
    const tokenIssuedAt = new Date(decoded.iat * 1000);
    if (user.passwordChangedAt && user.passwordChangedAt > tokenIssuedAt) {
      logger.warn('Authentication failed: Password changed after token issuance', {
        userId: user._id,
        tokenIssuedAt,
        passwordChangedAt: user.passwordChangedAt
      });
      return responseHandler.unauthorized(res, 'Token is no longer valid. Please login again.');
    }

    // Attach user to request object
    req.user = user;
    req.token = token;
    
    logger.debug('User authenticated successfully', {
      userId: user._id,
      operatorId: user.operatorId,
      role: user.role
    });
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    if (error.message === 'Access token expired') {
      return responseHandler.unauthorized(res, 'Token has expired. Please login again.');
    } else if (error.message === 'Invalid access token') {
      return responseHandler.unauthorized(res, 'Invalid token provided');
    } else {
      return responseHandler.unauthorized(res, 'Authentication failed');
    }
  }
};

/**
 * Middleware to authorize user roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} - Express middleware function
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Authorization failed: User not authenticated');
      return responseHandler.unauthorized(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles
      });
      return responseHandler.forbidden(res, 'Insufficient permissions');
    }

    logger.debug('User authorized successfully', {
      userId: req.user._id,
      userRole: req.user.role,
      requiredRoles: roles
    });

    next();
  };
};

/**
 * Middleware to check specific permissions
 * @param {...string} permissions - Required permissions
 * @returns {Function} - Express middleware function
 */
const requirePermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Permission check failed: User not authenticated');
      return responseHandler.unauthorized(res, 'Authentication required');
    }

    const hasAllPermissions = permissions.every(permission => 
      req.user.hasPermission(permission)
    );

    if (!hasAllPermissions) {
      logger.warn('Permission check failed: Required permissions not found', {
        userId: req.user._id,
        userPermissions: req.user.permissions,
        requiredPermissions: permissions
      });
      return responseHandler.forbidden(res, 'Required permissions not found');
    }

    logger.debug('Permission check passed', {
      userId: req.user._id,
      requiredPermissions: permissions
    });

    next();
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    
    if (user && user.status === USER_STATUS.ACTIVE && !user.isLocked) {
      req.user = user;
      req.token = token;
    }
    
    next();
  } catch (error) {
    // Silent fail for optional auth
    logger.debug('Optional auth failed:', error.message);
    next();
  }
};

/**
 * Middleware to refresh access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return responseHandler.badRequest(res, 'Refresh token is required');
    }

    const decoded = jwt.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).select('+refreshToken');
    
    if (!user || user.refreshToken !== refreshToken) {
      return responseHandler.unauthorized(res, 'Invalid refresh token');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return responseHandler.unauthorized(res, 'Account is not active');
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user._id,
      operatorId: user.operatorId,
      role: user.role
    };

    const newTokens = jwt.generateTokenPair(tokenPayload);
    
    // Update refresh token in database
    user.refreshToken = newTokens.refreshToken;
    user.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await user.save();

    responseHandler.success(res, {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: {
        id: user._id,
        operatorId: user.operatorId,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    }, 'Tokens refreshed successfully');

  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.message === 'Refresh token expired') {
      return responseHandler.unauthorized(res, 'Refresh token has expired. Please login again.');
    } else {
      return responseHandler.unauthorized(res, 'Invalid refresh token');
    }
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  requirePermissions,
  optionalAuth,
  refreshToken,
  extractToken
};