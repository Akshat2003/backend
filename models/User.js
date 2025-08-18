const mongoose = require('mongoose');
const { USER_ROLES, USER_STATUS, VALIDATION_RULES } = require('../utils/constants');

const userSchema = new mongoose.Schema({
  operatorId: {
    type: String,
    required: [true, 'Operator ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [VALIDATION_RULES.OPERATOR_ID_MIN_LENGTH, 'Operator ID must be at least 3 characters'],
    maxlength: [VALIDATION_RULES.OPERATOR_ID_MAX_LENGTH, 'Operator ID must not exceed 20 characters'],
    match: [/^OP[0-9]{3,6}$/, 'Operator ID must follow format: OP001, OP0001, etc.']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [VALIDATION_RULES.EMAIL_MAX_LENGTH, 'Email must not exceed 255 characters'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [VALIDATION_RULES.PASSWORD_MIN_LENGTH, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },

  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [VALIDATION_RULES.NAME_MAX_LENGTH, 'First name must not exceed 100 characters']
  },

  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [VALIDATION_RULES.NAME_MAX_LENGTH, 'Last name must not exceed 100 characters']
  },

  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number']
  },

  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.OPERATOR,
    required: true
  },

  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.ACTIVE,
    required: true
  },

  // Profile Information
  profileImage: {
    type: String,
    default: null
  },

  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department name must not exceed 50 characters']
  },

  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'night', 'rotational'],
    default: 'morning'
  },

  // Authentication & Security
  lastLogin: {
    type: Date,
    default: null
  },

  loginAttempts: {
    type: Number,
    default: 0
  },

  lockUntil: {
    type: Date,
    default: null
  },

  passwordChangedAt: {
    type: Date,
    default: Date.now
  },

  // Password Reset
  passwordResetToken: {
    type: String,
    select: false
  },

  passwordResetExpires: {
    type: Date,
    select: false
  },

  // OTP for various operations
  otp: {
    code: {
      type: String,
      select: false
    },
    expiresAt: {
      type: Date,
      select: false
    },
    attempts: {
      type: Number,
      default: 0,
      select: false
    }
  },

  // Refresh Token
  refreshToken: {
    type: String,
    select: false
  },

  refreshTokenExpiresAt: {
    type: Date,
    select: false
  },

  // Permissions & Access
  permissions: [{
    type: String,
    enum: [
      'create_booking',
      'update_booking',
      'cancel_booking',
      'view_analytics',
      'manage_customers',
      'manage_machines',
      'view_reports',
      'manage_operators'
    ]
  }],

  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.otp;
      delete ret.refreshToken;
      delete ret.refreshTokenExpiresAt;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for better query performance
userSchema.index({ operatorId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Compound indexes
userSchema.index({ status: 1, role: 1 });
userSchema.index({ operatorId: 1, status: 1 });

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Update the updatedAt field
  this.updatedAt = Date.now();
  
  // Set default permissions based on role
  if (this.isNew && (!this.permissions || this.permissions.length === 0)) {
    switch (this.role) {
      case USER_ROLES.ADMIN:
        this.permissions = [
          'create_booking', 'update_booking', 'cancel_booking',
          'view_analytics', 'manage_customers', 'manage_machines',
          'view_reports', 'manage_operators'
        ];
        break;
      case USER_ROLES.SUPERVISOR:
        this.permissions = [
          'create_booking', 'update_booking', 'cancel_booking',
          'view_analytics', 'manage_customers', 'view_reports'
        ];
        break;
      case USER_ROLES.OPERATOR:
        this.permissions = [
          'create_booking', 'update_booking', 'cancel_booking',
          'manage_customers'
        ];
        break;
    }
  }
  
  next();
});

// Instance Methods
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

userSchema.methods.updateLastLogin = function() {
  return this.updateOne({ lastLogin: Date.now() });
};

// Static Methods
userSchema.statics.findByOperatorId = function(operatorId) {
  return this.findOne({ operatorId: operatorId.toUpperCase() });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ status: USER_STATUS.ACTIVE });
};

userSchema.statics.findByRole = function(role) {
  return this.find({ role, status: USER_STATUS.ACTIVE });
};

// Create and export model
const User = mongoose.model('User', userSchema);

module.exports = User;