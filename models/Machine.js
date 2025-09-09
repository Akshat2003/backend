const mongoose = require('mongoose');
const { MACHINE_STATUS, PALLET_STATUS } = require('../utils/constants');

const palletSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },

  // Custom name for puzzle parking pallets
  customName: {
    type: String,
    trim: true,
    maxlength: [50, 'Pallet name must not exceed 50 characters']
  },
  
  status: {
    type: String,
    enum: Object.values(PALLET_STATUS),
    default: PALLET_STATUS.AVAILABLE,
    required: true
  },
  
  // For vehicle-specific capacity management
  vehicleCapacity: {
    type: Number,
    required: true,
    default: 1, // Default for four-wheeler machines
    min: 1,
    max: 6 // Maximum for two-wheeler machines
  },
  
  currentOccupancy: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Array of current bookings/vehicles on this pallet
  currentBookings: [{
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    occupiedSince: {
      type: Date,
      default: Date.now
    },
    position: {
      type: Number, // Position 1-6 for two-wheelers, always 1 for four-wheelers
      min: 1,
      max: 6
    }
  }],
  
  occupiedSince: {
    type: Date,
    default: null
  },
  
  lastMaintenance: {
    type: Date,
    default: null
  },
  
  maintenanceNotes: {
    type: String,
    maxlength: [500, 'Maintenance notes must not exceed 500 characters']
  }
}, {
  _id: false
});

const machineSchema = new mongoose.Schema({
  // Site Association - MULTI-SITE SUPPORT
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: [true, 'Site association is required'],
    index: true
  },

  machineNumber: {
    type: String,
    required: [true, 'Machine number is required'],
    trim: true,
    uppercase: true,
    match: [/^M[0-9]{3}$/, 'Machine number must follow format: M001, M002, etc.']
  },

  machineName: {
    type: String,
    required: [true, 'Machine name is required'],
    trim: true,
    maxlength: [100, 'Machine name must not exceed 100 characters']
  },

  // Machine type determines vehicle capacity per pallet
  machineType: {
    type: String,
    enum: ['two-wheeler', 'four-wheeler'],
    required: [true, 'Machine type is required']
  },

  // Parking mechanism type
  parkingType: {
    type: String,
    enum: ['puzzle', 'rotary'],
    default: 'rotary',
    required: [true, 'Parking type is required']
  },

  // Machine status and configuration
  status: {
    type: String,
    enum: Object.values(MACHINE_STATUS),
    default: MACHINE_STATUS.ONLINE,
    required: true
  },

  capacity: {
    total: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 50
    },
    available: {
      type: Number,
      required: true,
      default: 8,
      min: 0
    },
    occupied: {
      type: Number,
      default: 0,
      min: 0
    },
    maintenance: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Individual pallet information
  pallets: [palletSchema],

  // Machine specifications
  specifications: {
    maxVehicleLength: {
      type: Number,
      default: 5000, // in mm
      min: 1000
    },
    maxVehicleWidth: {
      type: Number,
      default: 2000, // in mm
      min: 500
    },
    maxVehicleHeight: {
      type: Number,
      default: 2000, // in mm
      min: 500
    },
    maxVehicleWeight: {
      type: Number,
      default: 2000, // in kg
      min: 100
    },
    supportedVehicleTypes: [{
      type: String,
      enum: ['two-wheeler', 'four-wheeler'],
      required: true
    }]
  },

  // Location and installation details
  location: {
    building: {
      type: String,
      trim: true,
      maxlength: [100, 'Building name must not exceed 100 characters']
    },
    floor: {
      type: String,
      trim: true,
      maxlength: [20, 'Floor must not exceed 20 characters']
    },
    zone: {
      type: String,
      trim: true,
      maxlength: [50, 'Zone must not exceed 50 characters']
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },

  // Operating hours
  operatingHours: {
    monday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    tuesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    wednesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    thursday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    friday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    saturday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    },
    sunday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '00:00' },
      closeTime: { type: String, default: '23:59' }
    }
  },

  // Pricing configuration
  pricing: {
    twoWheeler: {
      baseRate: { type: Number, default: 20 }, // ₹20 for 4 hours
      minimumCharge: { type: Number, default: 20 }
    },
    fourWheeler: {
      baseRate: { type: Number, default: 40 }, // ₹40 for 4 hours
      minimumCharge: { type: Number, default: 40 }
    },
    peakHourMultiplier: {
      type: Number,
      default: 1.5,
      min: 1
    },
    peakHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '20:00' }
    }
  },

  // Maintenance and service records
  maintenance: {
    lastServiceDate: {
      type: Date,
      default: null
    },
    nextServiceDue: {
      type: Date,
      default: null
    },
    serviceInterval: {
      type: Number,
      default: 30, // days
      min: 1
    },
    totalServiceHours: {
      type: Number,
      default: 0,
      min: 0
    },
    serviceHistory: [{
      date: { type: Date, required: true },
      type: { 
        type: String, 
        enum: ['routine', 'repair', 'emergency', 'upgrade'],
        required: true 
      },
      description: { type: String, required: true },
      technician: { type: String, required: true },
      cost: { type: Number, min: 0 },
      duration: { type: Number, min: 0 }, // in hours
      partsReplaced: [String],
      notes: String
    }]
  },

  // System integration
  integration: {
    controllerIp: {
      type: String,
      match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Invalid IP address format']
    },
    controllerPort: {
      type: Number,
      min: 1,
      max: 65535
    },
    firmwareVersion: {
      type: String,
      trim: true
    },
    lastHeartbeat: {
      type: Date,
      default: null
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error'],
      default: 'disconnected'
    }
  },

  // Statistics
  statistics: {
    totalBookings: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    averageOccupancyRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    downtimeHours: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Installation details
  installationDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  warrantyExpiryDate: {
    type: Date,
    required: true
  },

  vendor: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    contactPerson: {
      type: String,
      trim: true
    },
    phoneNumber: {
      type: String,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
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

// Virtual for occupancy rate
machineSchema.virtual('occupancyRate').get(function() {
  if (this.capacity.total === 0) return 0;
  return Math.round((this.capacity.occupied / this.capacity.total) * 100);
});

// Virtual for available pallets
machineSchema.virtual('availablePallets').get(function() {
  return this.pallets.filter(pallet => pallet.status === PALLET_STATUS.AVAILABLE);
});

// Virtual for occupied pallets
machineSchema.virtual('occupiedPallets').get(function() {
  return this.pallets.filter(pallet => pallet.status === PALLET_STATUS.OCCUPIED);
});

// Virtual for maintenance status
machineSchema.virtual('needsMaintenance').get(function() {
  if (!this.maintenance.nextServiceDue) return false;
  return this.maintenance.nextServiceDue <= new Date();
});

// Virtual for online status
machineSchema.virtual('isOnline').get(function() {
  if (!this.integration.lastHeartbeat) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.integration.lastHeartbeat > fiveMinutesAgo;
});

// Indexes for better query performance
machineSchema.index({ siteId: 1, machineNumber: 1 }, { unique: true }); // Machine number unique per site
machineSchema.index({ siteId: 1 });
machineSchema.index({ status: 1 });
machineSchema.index({ 'pallets.status': 1 });
machineSchema.index({ 'pallets.number': 1 });
machineSchema.index({ 'location.building': 1 });
machineSchema.index({ 'location.zone': 1 });
machineSchema.index({ installationDate: -1 });

// Compound indexes
machineSchema.index({ status: 1, 'capacity.available': -1 });
machineSchema.index({ 'specifications.supportedVehicleTypes': 1, status: 1 });

// Pre-save middleware
machineSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Initialize pallets if not exists
  if (this.isNew && this.pallets.length === 0) {
    // Calculate vehicle capacity per pallet based on parking type and machine type
    let vehicleCapacityPerPallet;
    if (this.parkingType === 'puzzle') {
      // Puzzle parking: 3 spots for two-wheeler, 1 spot for four-wheeler
      vehicleCapacityPerPallet = this.machineType === 'two-wheeler' ? 3 : 1;
    } else {
      // Rotary parking: 6 spots for two-wheeler, 1 spot for four-wheeler
      vehicleCapacityPerPallet = this.machineType === 'two-wheeler' ? 6 : 1;
    }
    
    // Generate pallets with correct numbering based on parking type
    if (this.parkingType === 'puzzle') {
      // For puzzle parking, use floor-based numbering (101, 102, 103, 104, 201, 202, etc.)
      let palletNumber = 101;
      let floor = 1;
      let palletInFloor = 1;
      
      for (let i = 1; i <= this.capacity.total; i++) {
        this.pallets.push({
          number: palletNumber,
          customName: palletNumber.toString(),
          status: PALLET_STATUS.AVAILABLE,
          vehicleCapacity: vehicleCapacityPerPallet,
          currentOccupancy: 0,
          currentBookings: []
        });
        
        palletInFloor++;
        if (palletInFloor > 4) { // 4 pallets per floor for puzzle parking
          floor++;
          palletInFloor = 1;
          palletNumber = (floor * 100) + 1; // 201, 301, 401, etc.
        } else {
          palletNumber++; // 102, 103, 104, etc.
        }
      }
    } else {
      // For rotary parking, use sequential numbering (1, 2, 3, 4, etc.)
      for (let i = 1; i <= this.capacity.total; i++) {
        this.pallets.push({
          number: i,
          customName: i.toString(),
          status: PALLET_STATUS.AVAILABLE,
          vehicleCapacity: vehicleCapacityPerPallet,
          currentOccupancy: 0,
          currentBookings: []
        });
      }
    }
  }
  
  // Update pallet vehicle capacity if machine type or parking type changed
  if (this.isModified('machineType') || this.isModified('parkingType')) {
    let vehicleCapacityPerPallet;
    if (this.parkingType === 'puzzle') {
      // Puzzle parking: 3 spots for two-wheeler, 1 spot for four-wheeler
      vehicleCapacityPerPallet = this.machineType === 'two-wheeler' ? 3 : 1;
    } else {
      // Rotary parking: 6 spots for two-wheeler, 1 spot for four-wheeler
      vehicleCapacityPerPallet = this.machineType === 'two-wheeler' ? 6 : 1;
    }
    
    this.pallets.forEach(pallet => {
      pallet.vehicleCapacity = vehicleCapacityPerPallet;
      // If reducing capacity and pallet has more vehicles than new capacity, keep only allowed vehicles
      if (pallet.currentBookings.length > vehicleCapacityPerPallet) {
        pallet.currentBookings = pallet.currentBookings.slice(0, vehicleCapacityPerPallet);
        pallet.currentOccupancy = Math.min(pallet.currentOccupancy, vehicleCapacityPerPallet);
      }
    });
  }
  
  // Update capacity counts based on pallet statuses and occupancy
  if (this.pallets.length > 0) {
    this.capacity.available = 0;
    this.capacity.occupied = 0;
    this.capacity.maintenance = this.pallets.filter(p => p.status === PALLET_STATUS.MAINTENANCE).length;
    
    this.pallets.forEach(pallet => {
      if (pallet.status === PALLET_STATUS.AVAILABLE) {
        this.capacity.available += (pallet.vehicleCapacity - pallet.currentOccupancy);
      } else if (pallet.status === PALLET_STATUS.OCCUPIED) {
        this.capacity.occupied += pallet.currentOccupancy;
      }
    });
  }
  
  next();
});

// Instance methods
machineSchema.methods.occupyPallet = function(palletNumber, bookingId, vehicleNumber, position = null) {
  // Search by both number and customName to handle both old and new pallet numbering systems
  const pallet = this.pallets.find(p => 
    p.number === palletNumber || 
    p.number === parseInt(palletNumber) || 
    p.customName === palletNumber.toString()
  );
  if (!pallet) {
    throw new Error(`Pallet not found: ${palletNumber}`);
  }
  
  // Check if pallet has available space
  if (pallet.currentOccupancy >= pallet.vehicleCapacity) {
    throw new Error('Pallet is at full capacity');
  }
  
  // For two-wheeler machines, find next available position
  if (this.machineType === 'two-wheeler') {
    if (!position) {
      // Find next available position (1-6)
      const occupiedPositions = pallet.currentBookings.map(b => b.position);
      for (let i = 1; i <= 6; i++) {
        if (!occupiedPositions.includes(i)) {
          position = i;
          break;
        }
      }
    }
    
    // Check if position is already occupied
    if (pallet.currentBookings.some(b => b.position === position)) {
      throw new Error(`Position ${position} is already occupied`);
    }
  } else {
    // Four-wheeler machines always use position 1
    position = 1;
  }
  
  // Add vehicle to pallet
  pallet.currentBookings.push({
    booking: bookingId,
    vehicleNumber: vehicleNumber.toUpperCase(),
    occupiedSince: new Date(),
    position: position
  });
  
  pallet.currentOccupancy += 1;
  
  // Update pallet status
  if (pallet.currentOccupancy >= pallet.vehicleCapacity) {
    pallet.status = PALLET_STATUS.OCCUPIED;
  }
  
  if (pallet.currentOccupancy === 1) {
    pallet.occupiedSince = new Date();
  }
  
  return this.save();
};

machineSchema.methods.releasePallet = function(palletNumber, bookingId) {
  // Search by both number and customName to handle both old and new pallet numbering systems
  const pallet = this.pallets.find(p => 
    p.number === palletNumber || 
    p.number === parseInt(palletNumber) || 
    p.customName === palletNumber.toString()
  );
  if (!pallet) {
    throw new Error(`Pallet not found: ${palletNumber}`);
  }
  
  // Find and remove the specific booking
  const bookingIndex = pallet.currentBookings.findIndex(b => 
    b.booking.toString() === bookingId.toString()
  );
  
  if (bookingIndex === -1) {
    throw new Error('Booking not found on this pallet');
  }
  
  pallet.currentBookings.splice(bookingIndex, 1);
  pallet.currentOccupancy = Math.max(0, pallet.currentOccupancy - 1);
  
  // Update pallet status
  if (pallet.currentOccupancy === 0) {
    pallet.status = PALLET_STATUS.AVAILABLE;
    pallet.occupiedSince = null;
  }
  
  return this.save();
};

machineSchema.methods.releaseVehicle = function(palletNumber, vehicleNumber) {
  // Search by both number and customName to handle both old and new pallet numbering systems
  const pallet = this.pallets.find(p => 
    p.number === palletNumber || 
    p.number === parseInt(palletNumber) || 
    p.customName === palletNumber.toString()
  );
  if (!pallet) {
    throw new Error(`Pallet not found: ${palletNumber}`);
  }
  
  // Find and remove the specific vehicle
  const bookingIndex = pallet.currentBookings.findIndex(b => 
    b.vehicleNumber === vehicleNumber.toUpperCase()
  );
  
  if (bookingIndex === -1) {
    throw new Error('Vehicle not found on this pallet');
  }
  
  const removedBooking = pallet.currentBookings.splice(bookingIndex, 1)[0];
  pallet.currentOccupancy = Math.max(0, pallet.currentOccupancy - 1);
  
  // Update pallet status
  if (pallet.currentOccupancy === 0) {
    pallet.status = PALLET_STATUS.AVAILABLE;
    pallet.occupiedSince = null;
  }
  
  return this.save();
};

machineSchema.methods.setPalletMaintenance = function(palletNumber, maintenanceNotes = '') {
  const pallet = this.pallets.find(p => p.number === palletNumber);
  if (!pallet) {
    throw new Error('Pallet not found');
  }
  
  pallet.status = PALLET_STATUS.MAINTENANCE;
  pallet.maintenanceNotes = maintenanceNotes;
  pallet.lastMaintenance = new Date();
  
  return this.save();
};

machineSchema.methods.addServiceRecord = function(serviceData) {
  this.maintenance.serviceHistory.unshift(serviceData);
  this.maintenance.lastServiceDate = serviceData.date;
  
  // Calculate next service due date
  const nextServiceDate = new Date(serviceData.date);
  nextServiceDate.setDate(nextServiceDate.getDate() + this.maintenance.serviceInterval);
  this.maintenance.nextServiceDue = nextServiceDate;
  
  return this.save();
};

machineSchema.methods.updateStatistics = function(booking) {
  this.statistics.totalBookings += 1;
  if (booking.payment && booking.payment.amount) {
    this.statistics.totalRevenue += booking.payment.amount;
  }
  
  return this.save();
};

// Method to find available pallet for specific vehicle type
machineSchema.methods.findAvailablePallet = function(vehicleType) {
  // Check if machine supports this vehicle type
  if (!this.specifications.supportedVehicleTypes.includes(vehicleType)) {
    return null;
  }
  
  // For vehicle type mismatch with machine type, return null
  if (this.machineType !== vehicleType) {
    return null;
  }
  
  // Find pallet with available space
  for (const pallet of this.pallets) {
    if (pallet.status !== PALLET_STATUS.MAINTENANCE && 
        pallet.currentOccupancy < pallet.vehicleCapacity) {
      return {
        palletNumber: pallet.number,
        availableSpaces: pallet.vehicleCapacity - pallet.currentOccupancy,
        totalCapacity: pallet.vehicleCapacity,
        currentOccupancy: pallet.currentOccupancy
      };
    }
  }
  
  return null;
};

// Static methods
machineSchema.statics.findAvailable = function(vehicleType = null, siteId = null) {
  const query = { 
    status: MACHINE_STATUS.ONLINE,
    'capacity.available': { $gt: 0 }
  };
  
  if (vehicleType) {
    query.machineType = vehicleType;
    query['specifications.supportedVehicleTypes'] = vehicleType;
  }
  
  if (siteId) {
    query.siteId = siteId;
  }
  
  return this.find(query).sort({ 'capacity.available': -1 });
};

machineSchema.statics.findByZone = function(zone) {
  return this.find({ 'location.zone': zone, status: { $ne: MACHINE_STATUS.OFFLINE } });
};

machineSchema.statics.getMachineUtilization = function(machineNumber, date) {
  return this.findOne({ machineNumber: machineNumber.toUpperCase() })
    .populate({
      path: 'pallets.currentBooking',
      match: { startTime: { $gte: date, $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } }
    });
};

machineSchema.statics.getMaintenanceDue = function() {
  const today = new Date();
  return this.find({
    'maintenance.nextServiceDue': { $lte: today },
    status: { $ne: MACHINE_STATUS.MAINTENANCE }
  });
};

// Create and export model
const Machine = mongoose.model('Machine', machineSchema);

module.exports = Machine;