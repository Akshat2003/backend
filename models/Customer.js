const mongoose = require('mongoose');
const { VALIDATION_RULES } = require('../utils/constants');

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    unique: true,
    sparse: true, // Allow null values to be non-unique
    trim: true,
    uppercase: true
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

  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true, // Allow null values to be non-unique
    maxlength: [VALIDATION_RULES.EMAIL_MAX_LENGTH, 'Email must not exceed 255 characters'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },

  vehicles: [{
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/, 'Invalid vehicle number format']
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ['two-wheeler', 'four-wheeler']
    },
    vehicleModel: {
      type: String,
      trim: true,
      maxlength: [50, 'Vehicle model must not exceed 50 characters']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Membership information
  membership: {
    membershipNumber: {
      type: String,
      sparse: true,
      trim: true,
      uppercase: true
    },
    membershipType: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'premium'],
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },

  // Address information
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address must not exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City must not exceed 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State must not exceed 50 characters']
    },
    pincode: {
      type: String,
      match: [/^[1-9][0-9]{5}$/, 'Please provide a valid pincode']
    }
  },

  // Usage statistics
  totalBookings: {
    type: Number,
    default: 0,
    min: 0
  },

  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  lastBookingDate: {
    type: Date,
    default: null
  },

  // Customer status
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },

  // Notes and preferences
  notes: {
    type: String,
    maxlength: [500, 'Notes must not exceed 500 characters']
  },

  preferences: {
    preferredPaymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'membership', 'wallet'],
      default: null
    },
    smsNotifications: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: false
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

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for active vehicles
customerSchema.virtual('activeVehicles').get(function() {
  return this.vehicles.filter(vehicle => vehicle.isActive);
});

// Virtual for membership status
customerSchema.virtual('hasMembership').get(function() {
  return this.membership.isActive && this.membership.expiryDate > new Date();
});

// Indexes for better query performance
customerSchema.index({ phoneNumber: 1 }, { unique: true });
customerSchema.index({ customerId: 1 }, { sparse: true });
customerSchema.index({ 'vehicles.vehicleNumber': 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ lastBookingDate: -1 });
customerSchema.index({ 'membership.membershipNumber': 1 }, { sparse: true });

// Compound indexes
customerSchema.index({ firstName: 1, lastName: 1 });
customerSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
customerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate customer ID if not provided
  if (this.isNew && !this.customerId) {
    const timestamp = Date.now().toString().slice(-6);
    this.customerId = `CUST${timestamp}`;
  }
  
  next();
});

// Instance methods
customerSchema.methods.addVehicle = function(vehicleData) {
  // Check if vehicle already exists
  const existingVehicle = this.vehicles.find(v => 
    v.vehicleNumber === vehicleData.vehicleNumber.toUpperCase()
  );
  
  if (existingVehicle) {
    throw new Error('Vehicle number already registered for this customer');
  }
  
  this.vehicles.push({
    ...vehicleData,
    vehicleNumber: vehicleData.vehicleNumber.toUpperCase()
  });
  
  return this.save();
};

customerSchema.methods.removeVehicle = function(vehicleNumber) {
  this.vehicles = this.vehicles.filter(v => 
    v.vehicleNumber !== vehicleNumber.toUpperCase()
  );
  return this.save();
};

customerSchema.methods.updateBookingStats = function(amount) {
  this.totalBookings += 1;
  this.totalAmount += amount;
  this.lastBookingDate = new Date();
  return this.save();
};

// Static methods
customerSchema.statics.findByPhone = function(phoneNumber) {
  return this.findOne({ phoneNumber, status: 'active' });
};

customerSchema.statics.findByVehicle = function(vehicleNumber) {
  return this.findOne({
    'vehicles.vehicleNumber': vehicleNumber.toUpperCase(),
    'vehicles.isActive': true,
    status: 'active'
  });
};

customerSchema.statics.findByMembership = function(membershipNumber) {
  return this.findOne({
    'membership.membershipNumber': membershipNumber.toUpperCase(),
    'membership.isActive': true,
    status: 'active'
  });
};

customerSchema.statics.getActiveCustomers = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

// Create and export model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;