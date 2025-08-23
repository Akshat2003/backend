const logger = require('../utils/logger');
const responseHandler = require('../utils/responseHandler');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/constants');

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
};

/**
 * Handle Mongoose duplicate field error
 */
const handleDuplicateFieldsDB = (err) => {
  const duplicateField = Object.keys(err.keyValue)[0];
  const duplicateValue = err.keyValue[duplicateField];
  
  const message = `${duplicateField} '${duplicateValue}' already exists. Please use another value.`;
  return new AppError(message, HTTP_STATUS.CONFLICT, ERROR_CODES.DUPLICATE_RESOURCE);
};

/**
 * Handle Mongoose validation error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));
  
  const message = 'Invalid input data';
  const error = new AppError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
  error.errors = errors;
  return error;
};

/**
 * Handle JWT invalid token error
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
};

/**
 * Handle JWT expired token error
 */
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
};

/**
 * Handle MongoDB connection errors
 */
const handleMongoError = (err) => {
  let message = 'Database connection error';
  
  if (err.code === 'ENOTFOUND') {
    message = 'Database server not found';
  } else if (err.code === 'ECONNREFUSED') {
    message = 'Database connection refused';
  } else if (err.code === 'ETIMEOUT') {
    message = 'Database connection timeout';
  }
  
  return new AppError(message, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.DATABASE_ERROR);
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, res) => {
  const errorResponse = {
    success: false,
    error: {
      statusCode: err.statusCode,
      message: err.message,
      errorCode: err.errorCode,
      stack: err.stack,
      ...(err.errors && { errors: err.errors })
    },
    timestamp: new Date().toISOString()
  };
  
  logger.error('Development Error:', errorResponse);
  res.status(err.statusCode).json(errorResponse);
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const errorResponse = {
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      ...(err.errors && { errors: err.errors }),
      timestamp: new Date().toISOString()
    };
    
    res.status(err.statusCode).json(errorResponse);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Production Error:', err);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Something went wrong!',
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';
  
  // Log the error
  logger.error('Global Error Handler:', {
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    body: req.body,
    params: req.params,
    query: req.query
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    
    // Handle specific types of errors
    if (error.name === 'CastError') {
      error = handleCastErrorDB(error);
    }
    
    if (error.code === 11000) {
      error = handleDuplicateFieldsDB(error);
    }
    
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }
    
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoNetworkError') {
      error = handleMongoError(error);
    }
    
    sendErrorProd(error, res);
  }
};

/**
 * Handle unhandled routes
 */
const handleNotFound = (req, res, next) => {
  const message = `Can't find ${req.originalUrl} on this server!`;
  const err = new AppError(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
  next(err);
};

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
const handleValidationError = (errors) => {
  const formattedErrors = errors.map(error => ({
    field: error.param || error.path,
    message: error.msg || error.message,
    value: error.value
  }));
  
  const err = new AppError('Validation failed', HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
  err.errors = formattedErrors;
  return err;
};


/**
 * Database connection error handler
 */
const handleDatabaseError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    const dbError = new AppError(
      'Database service temporarily unavailable',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.DATABASE_ERROR
    );
    return next(dbError);
  }
  next(err);
};

/**
 * Process exit handler for uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
  process.exit(1);
});

/**
 * Process exit handler for unhandled promise rejections
 */
process.on('unhandledRejection', (err, promise) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    error: err,
    promise: promise
  });
  
  // Close server gracefully
  if (global.server) {
    global.server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

/**
 * SIGTERM handler for graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  
  if (global.server) {
    global.server.close(() => {
      logger.info('💥 Process terminated!');
    });
  }
});

module.exports = {
  AppError,
  globalErrorHandler,
  handleNotFound,
  asyncHandler,
  handleValidationError,
  handleDatabaseError,
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleValidationErrorDB,
  handleJWTError,
  handleJWTExpiredError,
  handleMongoError
};