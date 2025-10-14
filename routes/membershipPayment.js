const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const MembershipPayment = require('../models/MembershipPayment');
const responseHandler = require('../utils/responseHandler');

/**
 * Get total membership revenue
 * @route GET /api/membership-payments/revenue
 * @access Private (Admin, Operator)
 */
router.get('/revenue', 
  authenticateToken,
  authorizeRoles('admin', 'operator'),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      let query = { status: 'completed' };
      
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const result = await MembershipPayment.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalPayments: { $sum: 1 }
          }
        }
      ]);
      
      const data = result[0] || { totalRevenue: 0, totalPayments: 0 };
      
      responseHandler.success(res, data, 'Membership revenue fetched successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get membership payments list
 * @route GET /api/membership-payments
 * @access Private (Admin)
 */
router.get('/', 
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        membershipType,
        customerId
      } = req.query;
      
      let query = {};
      
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      if (membershipType) {
        query.membershipType = membershipType;
      }
      
      if (customerId) {
        query.customerId = customerId;
      }
      
      const skip = (page - 1) * limit;
      
      const [payments, total] = await Promise.all([
        MembershipPayment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('customerId', 'firstName lastName phoneNumber')
          .populate('createdBy', 'operatorId name'),
        MembershipPayment.countDocuments(query)
      ]);
      
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      };
      
      responseHandler.success(res, {
        payments,
        pagination
      }, 'Membership payments fetched successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get revenue by membership type
 * @route GET /api/membership-payments/revenue-by-type
 * @access Private (Admin)
 */
router.get('/revenue-by-type',
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await MembershipPayment.getRevenueByType();

      responseHandler.success(res, result, 'Revenue by type fetched successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check if phone number has active membership
 * @route GET /api/membership-payments/check-membership/:phoneNumber
 * @access Private (Operator, Admin)
 */
router.get('/check-membership/:phoneNumber',
  authenticateToken,
  authorizeRoles('admin', 'operator'),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;

      // Find all memberships for this phone number
      const memberships = await MembershipPayment.find({
        customerPhone: phoneNumber,
        status: 'completed'
      }).sort({ expiryDate: -1 });

      // Check if any membership is currently active
      const activeMembership = memberships.find(membership => membership.isActive());

      if (activeMembership) {
        responseHandler.success(res, {
          hasActiveMembership: true,
          membership: {
            membershipNumber: activeMembership.membershipNumber,
            membershipType: activeMembership.membershipType,
            startDate: activeMembership.startDate,
            expiryDate: activeMembership.expiryDate,
            vehicleTypes: activeMembership.vehicleTypes
          }
        }, 'Active membership found');
      } else {
        responseHandler.success(res, {
          hasActiveMembership: false,
          membership: null
        }, 'No active membership found');
      }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;