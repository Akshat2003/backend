const { body, param, query, validationResult } = require('express-validator');
const responseHandler = require('../utils/responseHandler');
const validator = require('../utils/validator');
const { VALIDATION_RULES, VEHICLE_TYPES, PAYMENT_METHODS } = require('../utils/constants');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return responseHandler.validationError(res, formattedErrors);
  }
  
  next();
};

/**
 * Authentication validation rules
 */
const validateLogin = [
  body('operatorId')
    .trim()
    .notEmpty()
    .withMessage('Operator ID is required')
    .isLength({ min: VALIDATION_RULES.OPERATOR_ID_MIN_LENGTH })
    .withMessage(`Operator ID must be at least ${VALIDATION_RULES.OPERATOR_ID_MIN_LENGTH} characters`)
    .custom((value) => {
      if (!validator.isValidOperatorId(value)) {
        throw new Error('Invalid operator ID format');
      }
      return true;
    }),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: VALIDATION_RULES.PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} characters`),
    
  handleValidationErrors
];

/**
 * User registration validation rules
 */
const validateRegistration = [
  body('operatorId')
    .trim()
    .notEmpty()
    .withMessage('Operator ID is required')
    .custom((value) => {
      if (!validator.isValidOperatorId(value)) {
        throw new Error('Invalid operator ID format (e.g., OP001, OP0001)');
      }
      return true;
    }),
    
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: VALIDATION_RULES.EMAIL_MAX_LENGTH })
    .withMessage(`Email must not exceed ${VALIDATION_RULES.EMAIL_MAX_LENGTH} characters`),
    
  body('password')
    .isLength({ min: VALIDATION_RULES.PASSWORD_MIN_LENGTH, max: VALIDATION_RULES.PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} and ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: VALIDATION_RULES.NAME_MAX_LENGTH })
    .withMessage(`First name must not exceed ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name must contain only letters and spaces'),
    
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: VALIDATION_RULES.NAME_MAX_LENGTH })
    .withMessage(`Last name must not exceed ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name must contain only letters and spaces'),
    
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!validator.isValidPhone(value)) {
        throw new Error('Please provide a valid Indian phone number');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * Password reset request validation
 */
const validatePasswordResetRequest = [
  body('operatorId')
    .trim()
    .notEmpty()
    .withMessage('Operator ID is required')
    .custom((value) => {
      if (!validator.isValidOperatorId(value)) {
        throw new Error('Invalid operator ID format');
      }
      return true;
    }),
    
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
    
  handleValidationErrors
];

/**
 * Password reset validation
 */
const validatePasswordReset = [
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: VALIDATION_RULES.OTP_LENGTH, max: VALIDATION_RULES.OTP_LENGTH })
    .withMessage(`OTP must be ${VALIDATION_RULES.OTP_LENGTH} digits`)
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
    
  body('newPassword')
    .isLength({ min: VALIDATION_RULES.PASSWORD_MIN_LENGTH, max: VALIDATION_RULES.PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} and ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} characters`),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * Sanitize input middleware
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.sanitizeString(req.body[key]);
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = validator.sanitizeString(req.query[key]);
      }
    });
  }
  
  next();
};

/**
 * Booking creation validation rules
 */
const validateBookingCreation = [
  body('customerName')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: VALIDATION_RULES.NAME_MAX_LENGTH })
    .withMessage(`Customer name must not exceed ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Customer name must contain only letters and spaces'),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!validator.isValidPhone(value)) {
        throw new Error('Please provide a valid Indian phone number');
      }
      return true;
    }),

  body('vehicleNumber')
    .trim()
    .notEmpty()
    .withMessage('Vehicle number is required')
    .toUpperCase()
    .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/)
    .withMessage('Invalid vehicle number format'),

  body('vehicleType')
    .notEmpty()
    .withMessage('Vehicle type is required')
    .isIn(Object.values(VEHICLE_TYPES))
    .withMessage('Invalid vehicle type'),

  body('machineNumber')
    .trim()
    .notEmpty()
    .withMessage('Machine number is required')
    .toUpperCase()
    .matches(/^M[0-9]{3}$/)
    .withMessage('Machine number must follow format: M001, M002, etc.'),

  body('palletNumber')
    .isInt({ min: 1, max: 999 })
    .withMessage('Pallet number must be a valid integer'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),

  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special instructions must not exceed 500 characters'),

  handleValidationErrors
];

/**
 * Booking update validation rules
 */
const validateBookingUpdate = [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),

  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special instructions must not exceed 500 characters'),

  body('vehicleType')
    .optional()
    .isIn(Object.values(VEHICLE_TYPES))
    .withMessage('Invalid vehicle type'),

  handleValidationErrors
];

/**
 * OTP verification validation rules
 */
const validateOTPVerification = [
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  handleValidationErrors
];

/**
 * Customer validation rules
 */
const validateCustomerCreation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Invalid phone number format'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('vehicles')
    .optional()
    .isArray()
    .withMessage('Vehicles must be an array'),

  body('vehicles.*.vehicleNumber')
    .if(body('vehicles').exists())
    .trim()
    .notEmpty()
    .withMessage('Vehicle number is required')
    .isLength({ min: 6, max: 15 })
    .withMessage('Vehicle number must be between 6 and 15 characters'),

  body('vehicles.*.vehicleType')
    .if(body('vehicles').exists())
    .isIn(Object.values(VEHICLE_TYPES))
    .withMessage(`Vehicle type must be one of: ${Object.values(VEHICLE_TYPES).join(', ')}`),

  handleValidationErrors
];

const validateCustomerUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  handleValidationErrors
];

const validateVehicleCreation = [
  body('vehicleNumber')
    .trim()
    .notEmpty()
    .withMessage('Vehicle number is required')
    .isLength({ min: 6, max: 15 })
    .withMessage('Vehicle number must be between 6 and 15 characters'),

  body('vehicleType')
    .isIn(Object.values(VEHICLE_TYPES))
    .withMessage(`Vehicle type must be one of: ${Object.values(VEHICLE_TYPES).join(', ')}`),

  body('make')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Make must be at most 50 characters'),

  body('model')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Model must be at most 50 characters'),

  body('color')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Color must be at most 30 characters'),

  handleValidationErrors
];

const validateVehicleUpdate = [
  body('vehicleNumber')
    .optional()
    .trim()
    .isLength({ min: 6, max: 15 })
    .withMessage('Vehicle number must be between 6 and 15 characters'),

  body('vehicleType')
    .optional()
    .isIn(Object.values(VEHICLE_TYPES))
    .withMessage(`Vehicle type must be one of: ${Object.values(VEHICLE_TYPES).join(', ')}`),

  body('make')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Make must be at most 50 characters'),

  body('model')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Model must be at most 50 characters'),

  body('color')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Color must be at most 30 characters'),

  handleValidationErrors
];

/**
 * Membership creation validation rules
 */
const validateMembershipCreation = [
  body('membershipType')
    .notEmpty()
    .withMessage('Membership type is required')
    .isIn(['monthly', 'quarterly', 'yearly', 'premium'])
    .withMessage('Invalid membership type. Must be monthly, quarterly, yearly, or premium'),

  body('validityTerm')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Validity term must be between 1 and 120 months'),

  body('vehicleTypes')
    .optional()
    .isArray()
    .withMessage('Vehicle types must be an array')
    .custom((vehicleTypes) => {
      if (vehicleTypes && vehicleTypes.length > 0) {
        const validTypes = ['two-wheeler', 'four-wheeler'];
        const invalidTypes = vehicleTypes.filter(type => !validTypes.includes(type));
        if (invalidTypes.length > 0) {
          throw new Error(`Invalid vehicle types: ${invalidTypes.join(', ')}. Must be: ${validTypes.join(', ')}`);
        }
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Membership credentials validation rules
 */
const validateMembershipCredentials = [
  body('membershipNumber')
    .notEmpty()
    .withMessage('Membership number is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Membership number must be exactly 6 digits')
    .isNumeric()
    .withMessage('Membership number must contain only numbers'),

  body('pin')
    .notEmpty()
    .withMessage('PIN is required')
    .isLength({ min: 4, max: 4 })
    .withMessage('PIN must be exactly 4 digits')
    .isNumeric()
    .withMessage('PIN must contain only numbers'),

  body('vehicleType')
    .optional()
    .isIn(['two-wheeler', 'four-wheeler'])
    .withMessage('Invalid vehicle type. Must be two-wheeler or four-wheeler'),

  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateRegistration,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateBookingCreation,
  validateBookingUpdate,
  validateOTPVerification,
  validateCustomerCreation,
  validateCustomerUpdate,
  validateVehicleCreation,
  validateVehicleUpdate,
  validateMembershipCreation,
  validateMembershipCredentials,
  sanitizeInput,
  handleValidationErrors
};