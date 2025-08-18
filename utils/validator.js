const { REGEX_PATTERNS, VALIDATION_RULES } = require('./constants');

class Validator {
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - Validation result
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return REGEX_PATTERNS.EMAIL.test(email.trim().toLowerCase());
  }

  /**
   * Validate phone number (Indian format)
   * @param {string} phone - Phone number to validate
   * @returns {boolean} - Validation result
   */
  isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return REGEX_PATTERNS.PHONE.test(cleanPhone);
  }

  /**
   * Validate operator ID format
   * @param {string} operatorId - Operator ID to validate
   * @returns {boolean} - Validation result
   */
  isValidOperatorId(operatorId) {
    if (!operatorId || typeof operatorId !== 'string') return false;
    return REGEX_PATTERNS.OPERATOR_ID.test(operatorId.trim());
  }

  /**
   * Validate vehicle number format
   * @param {string} vehicleNumber - Vehicle number to validate
   * @returns {boolean} - Validation result
   */
  isValidVehicleNumber(vehicleNumber) {
    if (!vehicleNumber || typeof vehicleNumber !== 'string') return false;
    return REGEX_PATTERNS.VEHICLE_NUMBER.test(vehicleNumber.trim().toUpperCase());
  }

  /**
   * Validate OTP format
   * @param {string} otp - OTP to validate
   * @returns {boolean} - Validation result
   */
  isValidOTP(otp) {
    if (!otp || typeof otp !== 'string') return false;
    return REGEX_PATTERNS.OTP.test(otp.trim());
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result with details
   */
  validatePassword(password) {
    const result = {
      isValid: false,
      errors: []
    };

    if (!password || typeof password !== 'string') {
      result.errors.push('Password is required');
      return result;
    }

    if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
      result.errors.push(`Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters long`);
    }

    if (password.length > VALIDATION_RULES.PASSWORD_MAX_LENGTH) {
      result.errors.push(`Password must not exceed ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`);
    }

    if (!/(?=.*[a-z])/.test(password)) {
      result.errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      result.errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      result.errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      result.errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate string length
   * @param {string} str - String to validate
   * @param {number} min - Minimum length
   * @param {number} max - Maximum length
   * @param {string} fieldName - Field name for error message
   * @returns {Object} - Validation result
   */
  validateStringLength(str, min, max, fieldName) {
    const result = {
      isValid: false,
      error: null
    };

    if (!str || typeof str !== 'string') {
      result.error = `${fieldName} is required`;
      return result;
    }

    const trimmedStr = str.trim();

    if (trimmedStr.length < min) {
      result.error = `${fieldName} must be at least ${min} characters long`;
      return result;
    }

    if (trimmedStr.length > max) {
      result.error = `${fieldName} must not exceed ${max} characters`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate required fields
   * @param {Object} data - Data object to validate
   * @param {Array} requiredFields - Array of required field names
   * @returns {Object} - Validation result
   */
  validateRequiredFields(data, requiredFields) {
    const result = {
      isValid: false,
      errors: []
    };

    if (!data || typeof data !== 'object') {
      result.errors.push('Invalid data provided');
      return result;
    }

    requiredFields.forEach(field => {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        result.errors.push(`${field} is required`);
      }
    });

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Sanitize string input
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate machine number
   * @param {string} machineNumber - Machine number to validate
   * @returns {boolean} - Validation result
   */
  isValidMachineNumber(machineNumber) {
    if (!machineNumber || typeof machineNumber !== 'string') return false;
    return /^M[0-9]{3}$/.test(machineNumber.trim());
  }

  /**
   * Validate pallet number
   * @param {string|number} palletNumber - Pallet number to validate
   * @returns {boolean} - Validation result
   */
  isValidPalletNumber(palletNumber) {
    const num = parseInt(palletNumber);
    return !isNaN(num) && num >= 1 && num <= 20;
  }

  /**
   * Validate date range
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Object} - Validation result
   */
  validateDateRange(startDate, endDate) {
    const result = {
      isValid: false,
      error: null
    };

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      result.error = 'Invalid start date';
      return result;
    }

    if (isNaN(end.getTime())) {
      result.error = 'Invalid end date';
      return result;
    }

    if (start > end) {
      result.error = 'Start date must be before end date';
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate pagination parameters
   * @param {number|string} page - Page number
   * @param {number|string} limit - Items per page
   * @returns {Object} - Validation result with normalized values
   */
  validatePagination(page, limit) {
    const result = {
      isValid: false,
      page: 1,
      limit: 10,
      errors: []
    };

    // Validate page
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      result.page = 1;
    } else {
      result.page = pageNum;
    }

    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1) {
      result.limit = 10;
    } else if (limitNum > 100) {
      result.limit = 100;
    } else {
      result.limit = limitNum;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate array of IDs
   * @param {Array} ids - Array of IDs to validate
   * @returns {Object} - Validation result
   */
  validateIdArray(ids) {
    const result = {
      isValid: false,
      error: null
    };

    if (!Array.isArray(ids)) {
      result.error = 'IDs must be provided as an array';
      return result;
    }

    if (ids.length === 0) {
      result.error = 'At least one ID is required';
      return result;
    }

    const invalidIds = ids.filter(id => !this.isValidObjectId(id));
    if (invalidIds.length > 0) {
      result.error = 'Invalid ID format detected';
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate MongoDB ObjectId
   * @param {string} id - ObjectId to validate
   * @returns {boolean} - Validation result
   */
  isValidObjectId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}

module.exports = new Validator();