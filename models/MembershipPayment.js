const mongoose = require('mongoose');

const membershipPaymentSchema = new mongoose.Schema({
  // Customer reference
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  
  // Payment details
  membershipNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  membershipType: {
    type: String,
    required: true,
    enum: ['monthly', 'quarterly', 'yearly', 'premium']
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'upi', 'online', 'other'],
    default: 'cash'
  },
  
  // Transaction details
  transactionId: {
    type: String,
    trim: true,
    sparse: true
  },
  paymentReference: {
    type: String,
    trim: true
  },
  
  // Membership period
  startDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  validityTerm: {
    type: Number, // Term in months
    required: true
  },
  
  // Vehicle coverage
  vehicleTypes: [{
    type: String,
    enum: ['two-wheeler', 'four-wheeler']
  }],
  
  // Status and metadata
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed', 'refunded'],
    default: 'completed'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes must not exceed 500 characters']
  },
  
  // Audit fields
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
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Indexes for better query performance
membershipPaymentSchema.index({ createdAt: -1 });
membershipPaymentSchema.index({ customerId: 1, createdAt: -1 });
membershipPaymentSchema.index({ membershipType: 1, status: 1 });
membershipPaymentSchema.index({ paymentMethod: 1, status: 1 });
membershipPaymentSchema.index({ startDate: 1, expiryDate: 1 });

// Virtual for calculating membership duration in days
membershipPaymentSchema.virtual('durationInDays').get(function() {
  return Math.ceil((this.expiryDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Instance method to check if membership is active
membershipPaymentSchema.methods.isActive = function() {
  return this.status === 'completed' && 
         this.expiryDate > new Date() && 
         this.startDate <= new Date();
};

// Static method to get revenue by date range
membershipPaymentSchema.statics.getRevenueByDateRange = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get revenue by membership type
membershipPaymentSchema.statics.getRevenueByType = function() {
  return this.aggregate([
    {
      $match: { status: 'completed' }
    },
    {
      $group: {
        _id: '$membershipType',
        totalRevenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);
};

// Static method to get total membership revenue
membershipPaymentSchema.statics.getTotalRevenue = function() {
  return this.aggregate([
    {
      $match: { status: 'completed' }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('MembershipPayment', membershipPaymentSchema);