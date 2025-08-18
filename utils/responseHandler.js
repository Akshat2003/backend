const { HTTP_STATUS, MESSAGES } = require('./constants');
const logger = require('./logger');

class ResponseHandler {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @param {Object} meta - Additional metadata
   */
  success(res, data = null, message = MESSAGES.SUCCESS, statusCode = HTTP_STATUS.OK, meta = {}) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      ...meta
    };

    logger.info(`Success Response: ${statusCode} - ${message}`);
    return res.status(statusCode).json(response);
  }

  /**
   * Send created response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   */
  created(res, data = null, message = MESSAGES.CREATED) {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {*} errors - Detailed error information
   * @param {string} errorCode - Error code for client handling
   */
  error(res, message = MESSAGES.INTERNAL_ERROR, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null, errorCode = null) {
    const response = {
      success: false,
      message,
      errors,
      errorCode,
      timestamp: new Date().toISOString()
    };

    logger.error(`Error Response: ${statusCode} - ${message}`, errors);
    return res.status(statusCode).json(response);
  }

  /**
   * Send bad request response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {*} errors - Validation errors
   */
  badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, errors, 'BAD_REQUEST');
  }

  /**
   * Send unauthorized response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  unauthorized(res, message = MESSAGES.UNAUTHORIZED) {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED, null, 'UNAUTHORIZED');
  }

  /**
   * Send forbidden response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  forbidden(res, message = MESSAGES.FORBIDDEN) {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN, null, 'FORBIDDEN');
  }

  /**
   * Send not found response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  notFound(res, message = MESSAGES.NOT_FOUND) {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND, null, 'NOT_FOUND');
  }

  /**
   * Send conflict response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  conflict(res, message = 'Resource already exists') {
    return this.error(res, message, HTTP_STATUS.CONFLICT, null, 'CONFLICT');
  }

  /**
   * Send validation error response
   * @param {Object} res - Express response object
   * @param {*} errors - Validation errors
   * @param {string} message - Error message
   */
  validationError(res, errors, message = MESSAGES.VALIDATION_ERROR) {
    return this.error(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors, 'VALIDATION_ERROR');
  }

  /**
   * Send rate limit exceeded response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  rateLimitExceeded(res, message = 'Too many requests') {
    return this.error(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, null, 'RATE_LIMIT_EXCEEDED');
  }

  /**
   * Send paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Response data array
   * @param {Object} pagination - Pagination info
   * @param {string} message - Success message
   */
  paginated(res, data, pagination, message = MESSAGES.SUCCESS) {
    const meta = {
      pagination: {
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        itemsPerPage: pagination.limit,
        hasNextPage: pagination.hasNextPage,
        hasPrevPage: pagination.hasPrevPage
      }
    };

    return this.success(res, data, message, HTTP_STATUS.OK, meta);
  }

  /**
   * Send file response
   * @param {Object} res - Express response object
   * @param {string} filePath - Path to file
   * @param {string} fileName - Name for downloaded file
   * @param {string} contentType - MIME type
   */
  file(res, filePath, fileName, contentType) {
    try {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.sendFile(filePath);
    } catch (error) {
      logger.error('Error sending file:', error);
      return this.error(res, 'File not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  /**
   * Send no content response
   * @param {Object} res - Express response object
   */
  noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Handle async route errors
   * @param {Function} fn - Async route handler
   * @returns {Function} - Wrapped route handler
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create standardized API response format
   * @param {boolean} success - Success status
   * @param {*} data - Response data
   * @param {string} message - Response message
   * @param {*} errors - Error details
   * @param {Object} meta - Additional metadata
   * @returns {Object} - Formatted response object
   */
  formatResponse(success, data = null, message = '', errors = null, meta = {}) {
    return {
      success,
      message,
      data,
      errors,
      timestamp: new Date().toISOString(),
      ...meta
    };
  }

  /**
   * Send custom response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {Object} responseData - Custom response data
   */
  custom(res, statusCode, responseData) {
    logger.info(`Custom Response: ${statusCode}`, responseData);
    return res.status(statusCode).json(responseData);
  }
}

module.exports = new ResponseHandler();