const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { RATE_LIMITS } = require('../utils/constants');

// General API rate limiter
const general = rateLimit({
  windowMs: RATE_LIMITS.API.WINDOW_MS,
  max: RATE_LIMITS.API.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.API.WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(RATE_LIMITS.API.WINDOW_MS / 1000)
    });
  }
});

// Authentication rate limiter (more restrictive)
const auth = rateLimit({
  windowMs: RATE_LIMITS.AUTH.WINDOW_MS,
  max: RATE_LIMITS.AUTH.MAX_ATTEMPTS,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.AUTH.WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      operatorId: req.body?.operatorId
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(RATE_LIMITS.AUTH.WINDOW_MS / 1000)
    });
  }
});

// Password reset rate limiter
const passwordReset = rateLimit({
  windowMs: RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: RATE_LIMITS.PASSWORD_RESET.MAX_ATTEMPTS,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.PASSWORD_RESET.WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operatorId: req.body?.operatorId,
      email: req.body?.email
    });
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: Math.ceil(RATE_LIMITS.PASSWORD_RESET.WINDOW_MS / 1000)
    });
  }
});

// Create account rate limiter (prevent spam registration)
const createAccount = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 accounts per hour per IP
  message: {
    success: false,
    message: 'Too many account creation attempts, please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Account creation rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operatorId: req.body?.operatorId,
      email: req.body?.email
    });
    res.status(429).json({
      success: false,
      message: 'Too many account creation attempts, please try again later.',
      retryAfter: 3600
    });
  }
});

module.exports = {
  general,
  auth,
  passwordReset,
  createAccount
};