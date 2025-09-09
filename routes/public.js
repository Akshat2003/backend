const express = require('express');
const customerController = require('../controllers/customerController');
const validation = require('../middleware/validation');

const router = express.Router();

/**
 * Public routes for membership purchase (no authentication required)
 * These routes are specifically designed for public membership purchase
 * without requiring operator authentication
 */

/**
 * @route POST /api/public/membership/purchase
 * @desc Create customer and membership in one transaction (public)
 * @access Public
 */
router.post('/membership/purchase', 
  validation.validatePublicMembershipPurchase,
  async (req, res, next) => {
    try {
      const customerService = require('../services/customerService');
      const {
        firstName,
        lastName,
        phoneNumber,
        email,
        vehicleNumber,
        vehicleType,
        membershipType = 'monthly',
        validityTerm = 1,
        make,
        model,
        color
      } = req.body;

      // Step 1: Check if customer already exists
      let customer = await customerService.searchCustomerByPhone(phoneNumber);

      if (customer) {
        // Customer exists, add/update vehicle if needed
        const existingVehicle = customer.vehicles.find(v => 
          v.vehicleNumber === vehicleNumber.toUpperCase() && v.isActive
        );

        if (!existingVehicle) {
          // Add new vehicle
          await customerService.addCustomerVehicle(customer._id, {
            vehicleNumber: vehicleNumber.toUpperCase(),
            vehicleType,
            make,
            model,
            color
          }, null); // null user for public purchase
        }
      } else {
        // Customer doesn't exist, create new one
        const nameParts = firstName.trim().split(' ');
        const firstNamePart = nameParts[0];
        const lastNamePart = lastName || nameParts.slice(1).join(' ') || firstNamePart;

        customer = await customerService.createCustomer({
          firstName: firstNamePart,
          lastName: lastNamePart,
          phoneNumber,
          email: email || null,
          vehicles: [{
            vehicleNumber: vehicleNumber.toUpperCase(),
            vehicleType,
            make,
            model,
            color,
            isActive: true
          }]
        }, null); // null user for public purchase
      }

      // Step 2: Create membership
      const updatedCustomer = await customerService.createCustomerMembership(
        customer._id,
        membershipType,
        validityTerm,
        null, // null user for public purchase
        [vehicleType]
      );

      // Return success response
      res.status(201).json({
        success: true,
        message: 'Membership purchased successfully',
        data: {
          customer: updatedCustomer,
          membership: updatedCustomer.membership
        }
      });

    } catch (error) {
      console.error('Public membership purchase error:', error);
      next(error);
    }
  }
);

/**
 * @route POST /api/public/customers/search
 * @desc Search for existing customer by phone number (public)
 * @access Public
 * @body {string} phoneNumber - Customer phone number
 */
router.post('/customers/search', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber.replace(/\s|-/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit phone number is required'
      });
    }

    const customer = await customerController.searchCustomerByPhone(phoneNumber);
    
    if (customer) {
      res.json({
        success: true,
        data: {
          customers: [customer]
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          customers: []
        }
      });
    }
  } catch (error) {
    console.error('Public customer search error:', error);
    next(error);
  }
});

/**
 * @route POST /api/public/membership/validate
 * @desc Validate membership credentials (public)
 * @access Public
 * @body {string} membershipNumber - 6-digit membership number
 * @body {string} pin - 4-digit PIN
 * @body {string} vehicleType - Vehicle type (two-wheeler/four-wheeler)
 */
router.post('/membership/validate', 
  validation.validateMembershipCredentials,
  customerController.validateMembership
);

module.exports = router;