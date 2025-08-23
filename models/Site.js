const mongoose = require('mongoose');
const { VALIDATION_RULES } = require('../utils/constants');

const siteSchema = new mongoose.Schema({
  siteId: {
    type: String,
    required: [true, 'Site ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^SITE[0-9]{3,6}$/, 'Site ID must follow format: SITE001, SITE002, etc.']
  },

  siteName: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    maxlength: [100, 'Site name must not exceed 100 characters']
  },

  // Site Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'under-construction'],
    default: 'active',
    required: true
  },

  // Location Information
  location: {
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { 
        type: String, 
        required: true,
        match: [/^[1-9][0-9]{5}$/, 'Please provide a valid pincode']
      },
      country: { type: String, default: 'India', trim: true }
    },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    },
    landmark: { type: String, trim: true },
    zone: { type: String, trim: true } // Commercial, Residential, etc.
  },

  // Site Configuration
  configuration: {
    totalMachines: { type: Number, default: 0, min: 0 },
    totalCapacity: { type: Number, default: 0, min: 0 },
    supportedVehicleTypes: [{
      type: String,
      enum: ['two-wheeler', 'four-wheeler'],
      required: true
    }],
    operatingHours: {
      monday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      tuesday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      wednesday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      thursday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      friday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      saturday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String },
      sunday: { isOpen: { type: Boolean, default: true }, openTime: String, closeTime: String }
    }
  },

  // Pricing Configuration (can override global pricing)
  pricing: {
    twoWheeler: {
      baseRate: { type: Number, default: 10 },
      minimumCharge: { type: Number, default: 10 }
    },
    fourWheeler: {
      baseRate: { type: Number, default: 20 },
      minimumCharge: { type: Number, default: 20 }
    },
    peakHourMultiplier: { type: Number, default: 1.5, min: 1 },
    peakHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '20:00' }
    }
  },

  // Site Manager/Admin
  siteManager: {
    name: { type: String, required: true, trim: true },
    phoneNumber: { 
      type: String, 
      required: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number'] 
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    }
  },

  // Statistics
  statistics: {
    totalBookings: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    averageOccupancyRate: { type: Number, default: 0, min: 0, max: 100 },
    peakHourUtilization: { type: Number, default: 0, min: 0, max: 100 }
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
siteSchema.virtual('fullAddress').get(function() {
  const addr = this.location.address;
  return `${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}`;
});

// Virtual for occupancy rate
siteSchema.virtual('currentOccupancyRate').get(function() {
  if (this.configuration.totalCapacity === 0) return 0;
  return Math.round((this.statistics.averageOccupancyRate || 0));
});

// Indexes
siteSchema.index({ siteId: 1 }, { unique: true });
siteSchema.index({ status: 1 });
siteSchema.index({ 'location.address.city': 1 });
siteSchema.index({ 'location.address.state': 1 });
siteSchema.index({ createdAt: -1 });

// Pre-save middleware
siteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance methods
siteSchema.methods.updateStatistics = function(booking) {
  this.statistics.totalBookings += 1;
  if (booking.payment && booking.payment.amount) {
    this.statistics.totalRevenue += booking.payment.amount;
  }
  return this.save();
};

// Static methods
siteSchema.statics.findActiveSites = function() {
  return this.find({ status: 'active' });
};

siteSchema.statics.findByCity = function(city) {
  return this.find({ 
    'location.address.city': new RegExp(city, 'i'), 
    status: 'active' 
  });
};

const Site = mongoose.model('Site', siteSchema);
module.exports = Site;