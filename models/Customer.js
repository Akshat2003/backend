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
      uppercase: true
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ['two-wheeler', 'four-wheeler']
    },
    make: {
      type: String,
      trim: true,
      maxlength: [50, 'Vehicle make must not exceed 50 characters']
    },
    model: {
      type: String,
      trim: true,
      maxlength: [50, 'Vehicle model must not exceed 50 characters']
    },
    color: {
      type: String,
      trim: true,
      maxlength: [30, 'Vehicle color must not exceed 30 characters']
    },
    // Vehicle-specific membership
    membership: {
      membershipNumber: {
        type: String,
        sparse: true,
        trim: true,
        uppercase: true,
        match: [/^[0-9]{6}$/, 'Membership number must be 6 digits']
      },
      pin: {
        type: String,
        trim: true,
        match: [/^[0-9]{4}$/, 'PIN must be 4 digits']
      },
      membershipType: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'premium']
      },
      vehicleTypes: [{
        type: String,
        enum: ['two-wheeler', 'four-wheeler']
      }],
      issuedDate: {
        type: Date,
        default: null
      },
      expiryDate: {
        type: Date,
        default: null
      },
      validityTerm: {
        type: Number, // Term in months
        default: 12
      },
      isActive: {
        type: Boolean,
        default: false
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: null
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Legacy membership information (kept for migration purposes)
  // Will be deprecated after migration to vehicle-based memberships
  legacyMembership: {
    membershipNumber: {
      type: String,
      sparse: true,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{6}$/, 'Membership number must be 6 digits']
    },
    pin: {
      type: String,
      trim: true,
      match: [/^[0-9]{4}$/, 'PIN must be 4 digits']
    },
    membershipType: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'premium']
    },
    issuedDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    validityTerm: {
      type: Number, // Term in months
      default: 12
    },
    isActive: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: null
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
      enum: ['cash', 'upi', 'card', 'membership', 'wallet']
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

  // Soft delete fields
  deletedAt: {
    type: Date,
    default: null
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  deletionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Deletion reason must not exceed 500 characters']
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

// Virtual for membership status (checks if any vehicle has active membership)
customerSchema.virtual('hasMembership').get(function() {
  return this.vehicles.some(vehicle => 
    vehicle.membership &&
    vehicle.membership.isActive && 
    vehicle.membership.membershipNumber && 
    vehicle.membership.pin &&
    vehicle.membership.expiryDate && 
    vehicle.membership.expiryDate > new Date()
  );
});

// Virtual for vehicles with active memberships
customerSchema.virtual('vehiclesWithMembership').get(function() {
  return this.vehicles.filter(vehicle => 
    vehicle.membership &&
    vehicle.membership.isActive && 
    vehicle.membership.membershipNumber && 
    vehicle.membership.expiryDate && 
    vehicle.membership.expiryDate > new Date()
  );
});

// Indexes for better query performance
customerSchema.index({ phoneNumber: 1 }, { unique: true });
customerSchema.index({ customerId: 1 }, { sparse: true });
customerSchema.index({ 'vehicles.vehicleNumber': 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ lastBookingDate: -1 });
customerSchema.index({ 'membership.membershipNumber': 1 }, { sparse: true });

// Text indexes for search functionality
customerSchema.index({
  firstName: 'text',
  lastName: 'text',
  phoneNumber: 'text',
  email: 'text',
  'vehicles.vehicleNumber': 'text'
}, {
  weights: {
    firstName: 10,
    lastName: 10,
    phoneNumber: 8,
    'vehicles.vehicleNumber': 6,
    email: 4
  },
  name: 'customer_search_index'
});

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

// Generate unique membership number
customerSchema.methods.generateMembershipNumber = function() {
  let membershipNumber;
  do {
    membershipNumber = Math.floor(100000 + Math.random() * 900000).toString();
  } while (membershipNumber.startsWith('0')); // Ensure 6 digits, no leading zero
  return membershipNumber;
};

// Generate unique PIN
customerSchema.methods.generatePIN = function() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (pin.startsWith('0')); // Ensure 4 digits, no leading zero
  return pin;
};

// Create membership for a specific vehicle
customerSchema.methods.createVehicleMembership = async function(vehicleNumber, membershipType, validityTerm, createdBy, vehicleTypes = null) {
  const vehicle = this.vehicles.find(v => v.vehicleNumber === vehicleNumber.toUpperCase());
  
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  
  if (vehicle.membership && vehicle.membership.isActive) {
    throw new Error('Vehicle already has an active membership');
  }
  
  const membershipNumber = this.generateMembershipNumber();
  const pin = this.generatePIN();
  
  // Check if membership number is unique across all vehicles
  const existingMembership = await this.constructor.findOne({
    'vehicles.membership.membershipNumber': membershipNumber,
    'vehicles.membership.isActive': true
  });
  
  if (existingMembership) {
    // Regenerate if duplicate found (very rare)
    return this.createVehicleMembership(vehicleNumber, membershipType, validityTerm, createdBy);
  }
  
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + validityTerm);
  
  vehicle.membership = {
    membershipNumber,
    pin,
    membershipType,
    vehicleTypes: vehicleTypes || [vehicle.vehicleType], // Use provided vehicleTypes or default to vehicle's type
    issuedDate: now,
    expiryDate,
    validityTerm,
    isActive: true,
    createdBy,
    createdAt: now
  };
  
  return this.save();
};

// Validate vehicle membership credentials
customerSchema.methods.validateVehicleMembership = function(vehicleNumber, membershipNumber, pin) {
  const vehicle = this.vehicles.find(v => v.vehicleNumber === vehicleNumber.toUpperCase());
  
  if (!vehicle || !vehicle.membership) {
    return false;
  }
  
  return vehicle.membership.isActive &&
         vehicle.membership.membershipNumber === membershipNumber &&
         vehicle.membership.pin === pin &&
         vehicle.membership.expiryDate > new Date();
};

// Deactivate vehicle membership
customerSchema.methods.deactivateVehicleMembership = function(vehicleNumber) {
  const vehicle = this.vehicles.find(v => v.vehicleNumber === vehicleNumber.toUpperCase());
  
  if (!vehicle || !vehicle.membership) {
    throw new Error('Vehicle or membership not found');
  }
  
  vehicle.membership.isActive = false;
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

// Validate vehicle membership credentials
customerSchema.statics.validateVehicleMembershipCredentials = function(membershipNumber, pin) {
  return this.findOne({
    'vehicles.membership.membershipNumber': membershipNumber,
    'vehicles.membership.pin': pin,
    'vehicles.membership.isActive': true,
    'vehicles.membership.expiryDate': { $gt: new Date() },
    status: 'active'
  });
};

// Find customer by vehicle membership
customerSchema.statics.findByVehicleMembership = function(membershipNumber) {
  return this.findOne({
    'vehicles.membership.membershipNumber': membershipNumber.toUpperCase(),
    'vehicles.membership.isActive': true,
    status: 'active'
  });
};

// Create and export model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;