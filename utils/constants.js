// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// User Roles
const USER_ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  SUPERVISOR: 'supervisor'
};

// User Status
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
};

// Booking Status
const BOOKING_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

// Vehicle Types
const VEHICLE_TYPES = {
  TWO_WHEELER: 'two-wheeler',
  FOUR_WHEELER: 'four-wheeler'
};

// Payment Methods
const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  MEMBERSHIP: 'membership',
  WALLET: 'wallet'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Machine Status
const MACHINE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  MAINTENANCE: 'maintenance',
  ERROR: 'error'
};

// Pallet Status
const PALLET_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  BLOCKED: 'blocked'
};

// Email Types
const EMAIL_TYPES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_LOCKED: 'account_locked',
  BOOKING_CONFIRMATION: 'booking_confirmation'
};

// SMS Types
const SMS_TYPES = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  OTP: 'otp',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  REMINDER: 'reminder'
};

// API Response Messages
const MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_LOCKED: 'Account is locked',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid token',
  PASSWORD_RESET_SENT: 'Password reset instructions sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',
  OTP_SENT: 'OTP sent successfully',
  OTP_VERIFIED: 'OTP verified successfully',
  OTP_EXPIRED: 'OTP has expired',
  INVALID_OTP: 'Invalid OTP'
};

// Validation Rules
const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  OTP_LENGTH: 6,
  OTP_EXPIRE_MINUTES: 10,
  OPERATOR_ID_MIN_LENGTH: 3,
  OPERATOR_ID_MAX_LENGTH: 20,
  VEHICLE_NUMBER_MIN_LENGTH: 4,
  VEHICLE_NUMBER_MAX_LENGTH: 15,
  PHONE_NUMBER_LENGTH: 10,
  EMAIL_MAX_LENGTH: 255,
  NAME_MAX_LENGTH: 100
};

// Rate Limiting
const RATE_LIMITS = {
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_ATTEMPTS: 5
  },
  API: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  },
  PASSWORD_RESET: {
    WINDOW_MS: 60 * 60 * 1000, // 1 hour
    MAX_ATTEMPTS: 3
  }
};

// File Upload Limits
const FILE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  USER_SESSION: 60 * 60 * 24, // 24 hours
  OTP: 60 * 10, // 10 minutes
  RATE_LIMIT: 60 * 15, // 15 minutes
  ANALYTICS: 60 * 30 // 30 minutes
};

// Database Collections
const COLLECTIONS = {
  USERS: 'users',
  BOOKINGS: 'bookings',
  CUSTOMERS: 'customers',
  MACHINES: 'machines',
  ANALYTICS: 'analytics',
  AUDIT_LOGS: 'audit_logs'
};

// Regex Patterns
const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/,
  VEHICLE_NUMBER: /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/,
  OPERATOR_ID: /^OP[0-9]{3,6}$/,
  OTP: /^[0-9]{6}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
};

// Error Codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  USER_STATUS,
  BOOKING_STATUS,
  VEHICLE_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  MACHINE_STATUS,
  PALLET_STATUS,
  EMAIL_TYPES,
  SMS_TYPES,
  MESSAGES,
  VALIDATION_RULES,
  RATE_LIMITS,
  FILE_LIMITS,
  PAGINATION,
  CACHE_TTL,
  COLLECTIONS,
  REGEX_PATTERNS,
  ERROR_CODES
};