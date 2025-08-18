const mongoose = require('mongoose');
const { BOOKING_STATUS, VEHICLE_TYPES, PAYMENT_METHODS, PAYMENT_STATUS } = require('../utils/constants');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },

  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer reference is required']
  },

  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Customer name must not exceed 100 characters']
  },

  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number']
  },

  // Vehicle Information
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/, 'Invalid vehicle number format']
  },

  vehicleType: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: Object.values(VEHICLE_TYPES)
  },

  // Machine and Pallet Information
  machineNumber: {
    type: String,
    required: [true, 'Machine number is required'],
    trim: true,
    uppercase: true,
    match: [/^M[0-9]{3}$/, 'Machine number must follow format: M001, M002, etc.']
  },

  palletNumber: {
    type: Number,
    required: [true, 'Pallet number is required'],
    min: [1, 'Pallet number must be between 1 and 8'],
    max: [8, 'Pallet number must be between 1 and 8']
  },

  // Booking Status and Timing
  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.ACTIVE,
    required: true
  },

  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },

  endTime: {
    type: Date,
    default: null
  },

  duration: {
    hours: {
      type: Number,
      default: 0,
      min: 0
    },
    minutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 59
    }
  },

  // OTP for vehicle retrieval
  otp: {
    code: {
      type: String,
      required: [true, 'OTP is required'],
      match: [/^[0-9]{6}$/, 'OTP must be 6 digits']
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: {
      type: Date,
      default: null
    }
  },

  // Payment Information
  payment: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      default: null
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    transactionId: {
      type: String,
      trim: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    // For membership payments
    membershipNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    // For rate calculations
    baseRate: {
      type: Number,
      default: 0
    },
    additionalCharges: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    }
  },

  // Rate calculation details
  rateDetails: {
    vehicleTypeRate: {
      type: Number,
      default: 0
    },
    durationRate: {
      type: Number,
      default: 0
    },
    peakHourMultiplier: {
      type: Number,
      default: 1
    },
    membershipDiscount: {
      type: Number,
      default: 0
    }
  },

  // Additional services
  services: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notes and special instructions
  notes: {
    type: String,
    maxlength: [500, 'Notes must not exceed 500 characters']
  },

  specialInstructions: {
    type: String,
    maxlength: [500, 'Special instructions must not exceed 500 characters']
  },

  // SMS and notification tracking
  notifications: {
    bookingConfirmation: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    },
    paymentReminder: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    },
    completionConfirmation: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    }
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  completedBy: {
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total duration in minutes
bookingSchema.virtual('totalDurationMinutes').get(function() {
  if (!this.endTime) return 0;
  return Math.floor((this.endTime - this.startTime) / (1000 * 60));
});

// Virtual for formatted duration
bookingSchema.virtual('formattedDuration').get(function() {
  const totalMinutes = this.totalDurationMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
});

// Virtual for booking age
bookingSchema.virtual('bookingAge').get(function() {
  const now = new Date();
  const ageInMinutes = Math.floor((now - this.startTime) / (1000 * 60));
  return ageInMinutes;
});

// Virtual for OTP validity
bookingSchema.virtual('isOTPValid').get(function() {
  return !this.otp.isUsed && this.otp.expiresAt > new Date();
});

// Virtual for payment due amount
bookingSchema.virtual('amountDue').get(function() {
  return this.payment.amount - (this.payment.status === PAYMENT_STATUS.COMPLETED ? this.payment.amount : 0);
});

// Indexes for better query performance
bookingSchema.index({ bookingNumber: 1 }, { unique: true });
bookingSchema.index({ customer: 1 });
bookingSchema.index({ phoneNumber: 1 });
bookingSchema.index({ vehicleNumber: 1 });
bookingSchema.index({ machineNumber: 1, palletNumber: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ startTime: -1 });
bookingSchema.index({ endTime: -1 });
bookingSchema.index({ 'otp.code': 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ createdBy: 1 });

// Compound indexes
bookingSchema.index({ status: 1, startTime: -1 });
bookingSchema.index({ machineNumber: 1, status: 1 });
bookingSchema.index({ createdAt: -1, status: 1 });
bookingSchema.index({ vehicleType: 1, status: 1 });

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate booking number if not provided
  if (this.isNew && !this.bookingNumber) {
    const timestamp = Date.now().toString().slice(-8);
    const prefix = this.vehicleType === VEHICLE_TYPES.TWO_WHEELER ? 'TW' : 'FW';
    this.bookingNumber = `BK${prefix}${timestamp}`;
  }
  
  // Calculate duration if endTime is set
  if (this.endTime && this.startTime) {
    const durationMs = this.endTime - this.startTime;
    const totalMinutes = Math.floor(durationMs / (1000 * 60));
    this.duration.hours = Math.floor(totalMinutes / 60);
    this.duration.minutes = totalMinutes % 60;
  }
  
  next();
});

// Instance methods
bookingSchema.methods.complete = function(completedBy, paymentData = {}) {
  this.status = BOOKING_STATUS.COMPLETED;
  this.endTime = new Date();
  this.completedBy = completedBy;
  
  if (paymentData.amount) {
    this.payment.amount = paymentData.amount;
    this.payment.method = paymentData.method;
    this.payment.status = PAYMENT_STATUS.COMPLETED;
    this.payment.paidAt = new Date();
    this.payment.transactionId = paymentData.transactionId;
  }
  
  return this.save();
};

bookingSchema.methods.cancel = function(reason = null) {
  this.status = BOOKING_STATUS.CANCELLED;
  if (reason) this.notes = reason;
  return this.save();
};

bookingSchema.methods.useOTP = function() {
  if (!this.isOTPValid) {
    throw new Error('OTP is invalid or expired');
  }
  
  this.otp.isUsed = true;
  this.otp.usedAt = new Date();
  return this.save();
};

bookingSchema.methods.generateNewOTP = function() {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 30); // 30 minutes expiry
  
  this.otp = {
    code: otpCode,
    generatedAt: new Date(),
    expiresAt: expiryTime,
    isUsed: false,
    usedAt: null
  };
  
  return this.save();
};

// Static methods
bookingSchema.statics.findActiveBookings = function() {
  return this.find({ status: BOOKING_STATUS.ACTIVE })
    .populate('customer', 'fullName phoneNumber')
    .sort({ startTime: -1 });
};

bookingSchema.statics.findByMachine = function(machineNumber) {
  return this.find({ 
    machineNumber: machineNumber.toUpperCase(),
    status: BOOKING_STATUS.ACTIVE 
  }).sort({ startTime: -1 });
};

bookingSchema.statics.findByVehicle = function(vehicleNumber) {
  return this.find({ 
    vehicleNumber: vehicleNumber.toUpperCase() 
  }).sort({ startTime: -1 });
};

bookingSchema.statics.findByOTP = function(otpCode) {
  return this.findOne({
    'otp.code': otpCode,
    'otp.isUsed': false,
    'otp.expiresAt': { $gt: new Date() },
    status: BOOKING_STATUS.ACTIVE
  });
};

bookingSchema.statics.getBookingsByDateRange = function(startDate, endDate) {
  return this.find({
    startTime: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('customer', 'fullName phoneNumber').sort({ startTime: -1 });
};

bookingSchema.statics.getMachineUtilization = function(machineNumber, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    machineNumber: machineNumber.toUpperCase(),
    startTime: { $gte: startOfDay, $lte: endOfDay }
  });
};

// Create and export model
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;