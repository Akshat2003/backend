const mongoose = require('mongoose');
const { generateUniqueId } = require('../utils/validator');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [30, 'First name must not exceed 30 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [30, 'Last name must not exceed 30 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\d{10}$/, 'Phone number must be 10 digits']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Vehicle information
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
    isActive: {
      type: Boolean,
      default: true
    },
    addedAt: {
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

  // Customer membership (works across ALL vehicles)
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
      trim: true,
      match: [/^\d{6}$/, 'PIN code must be 6 digits']
    }
  },

  // Customer status and metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must not exceed 500 characters']
  },
  lastBookingDate: {
    type: Date
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },

  // Timestamps and audit
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Virtual for membership status
customerSchema.virtual('hasMembership').get(function() {
  return !!(this.membership && 
           this.membership.isActive && 
           this.membership.membershipNumber && 
           this.membership.expiryDate > new Date());
});

// Indexes
customerSchema.index({ phoneNumber: 1 }, { unique: true });
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
});

// Pre-save middleware to update timestamps
customerSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Instance Methods

// Generate unique membership number
customerSchema.methods.generateMembershipNumber = function() {
  let membershipNumber;
  do {
    membershipNumber = Math.floor(100000 + Math.random() * 900000).toString();
  } while (membershipNumber.startsWith('0')); // Ensure 6 digits, no leading zero
  return membershipNumber;
};

// Generate unique 4-digit PIN
customerSchema.methods.generatePIN = function() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (pin.startsWith('0')); // Ensure 4 digits, no leading zero
  return pin;
};

// Create or update membership for customer (works across ALL vehicles)
customerSchema.methods.createMembership = async function(membershipType, validityTerm, createdBy, vehicleTypes = ['two-wheeler', 'four-wheeler']) {
  // If customer has an active membership that is not expired, check if we're adding a new vehicle type
  if (this.membership && this.membership.isActive && this.membership.expiryDate > new Date()) {
    const existingTypes = this.membership.vehicleTypes || [];
    const newTypes = vehicleTypes.filter(type => !existingTypes.includes(type));
    
    if (newTypes.length === 0) {
      // All requested vehicle types are already covered
      throw new Error(`Customer already has an active membership covering ${vehicleTypes.join(' and ')}`);
    }
    
    // Add new vehicle types to existing membership
    this.membership.vehicleTypes = [...new Set([...existingTypes, ...vehicleTypes])];
    // Optionally extend expiry date based on new purchase
    // For now, we'll keep the same expiry date
    return this.save();
  }
  
  const membershipNumber = this.generateMembershipNumber();
  const pin = this.generatePIN();
  
  // Check if membership number is unique across all customers
  const existingMembership = await this.constructor.findOne({
    'membership.membershipNumber': membershipNumber,
    'membership.isActive': true
  });
  
  if (existingMembership) {
    // Regenerate if duplicate found (very rare)
    return this.createMembership(membershipType, validityTerm, createdBy, vehicleTypes);
  }
  
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + validityTerm);
  
  this.membership = {
    membershipNumber,
    pin,
    membershipType,
    vehicleTypes: vehicleTypes, // Array of vehicle types covered by this membership
    issuedDate: now,
    expiryDate,
    validityTerm,
    isActive: true,
    createdBy,
    createdAt: now
  };
  
  return this.save();
};

// Validate membership credentials
customerSchema.methods.validateMembership = function(membershipNumber, pin) {
  if (!this.membership) {
    return false;
  }
  
  return this.membership.isActive &&
         this.membership.membershipNumber === membershipNumber &&
         this.membership.pin === pin &&
         this.membership.expiryDate > new Date();
};

// Deactivate customer membership
customerSchema.methods.deactivateMembership = function() {
  if (!this.membership) {
    throw new Error('Customer does not have a membership');
  }
  
  this.membership.isActive = false;
  return this.save();
};

// Add or update vehicle
customerSchema.methods.addOrUpdateVehicle = function(vehicleData, userId) {
  const existingVehicle = this.vehicles.find(v => 
    v.vehicleNumber === vehicleData.vehicleNumber.toUpperCase()
  );
  
  if (existingVehicle) {
    // Update existing vehicle
    existingVehicle.vehicleType = vehicleData.vehicleType;
    existingVehicle.make = vehicleData.make;
    existingVehicle.model = vehicleData.model;
    existingVehicle.color = vehicleData.color;
    existingVehicle.isActive = true;
    existingVehicle.updatedAt = new Date();
    existingVehicle.updatedBy = userId;
  } else {
    // Add new vehicle
    this.vehicles.push({
      ...vehicleData,
      vehicleNumber: vehicleData.vehicleNumber.toUpperCase(),
      isActive: true,
      addedAt: new Date(),
      createdBy: userId
    });
  }
  
  return this.save();
};

// Static Methods

// Find customer by phone number
customerSchema.statics.findByPhone = function(phoneNumber) {
  return this.findOne({ phoneNumber, status: 'active' });
};

// Find customer by vehicle number
customerSchema.statics.findByVehicle = function(vehicleNumber) {
  return this.findOne({
    'vehicles.vehicleNumber': vehicleNumber.toUpperCase(),
    'vehicles.isActive': true,
    status: 'active'
  });
};

// Validate membership credentials (static method)
customerSchema.statics.validateMembershipCredentials = function(membershipNumber, pin) {
  return this.findOne({
    'membership.membershipNumber': membershipNumber,
    'membership.pin': pin,
    'membership.isActive': true,
    'membership.expiryDate': { $gt: new Date() },
    status: 'active'
  });
};

// Find customer by membership number
customerSchema.statics.findByMembership = function(membershipNumber) {
  return this.findOne({
    'membership.membershipNumber': membershipNumber.toUpperCase(),
    'membership.isActive': true,
    status: 'active'
  });
};

// Get active customers
customerSchema.statics.getActiveCustomers = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

// Create and export model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;