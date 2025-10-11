const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const MembershipPayment = require('../models/MembershipPayment');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class CustomerService {
  /**
   * Create a new customer
   * @param {Object} customerData - Customer data
   * @param {String} createdBy - User ID who created the customer
   * @returns {Promise<Object>} - Created customer
   */
  async createCustomer(customerData, createdBy) {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        email,
        vehicles = []
      } = customerData;

      // Check if customer with phone number already exists
      const existingCustomer = await Customer.findOne({ phoneNumber, status: 'active' });
      if (existingCustomer) {
        throw new AppError('Customer with this phone number already exists', 400);
      }

      // Create new customer
      const customer = new Customer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email ? email.trim().toLowerCase() : null,
        vehicles: vehicles.map(vehicle => ({
          ...vehicle,
          vehicleNumber: vehicle.vehicleNumber.toUpperCase(),
          isActive: true
        })),
        status: 'active',
        createdBy
      });

      await customer.save();

      logger.info('Customer created successfully', { 
        customerId: customer._id,
        phoneNumber: customer.phoneNumber,
        createdBy 
      });

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Create customer failed:', error.message);
      throw error;
    }
  }

  /**
   * Get customers with filters and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @param {Object} sorting - Sorting options
   * @returns {Promise<Object>} - Paginated customers
   */
  async getCustomers(filters = {}, pagination = {}, sorting = {}) {
    try {
      const {
        search,
        isActive
      } = filters;

      const {
        page = 1,
        limit = 20
      } = pagination;

      const {
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = sorting;

      // Build query
      const query = {};

      // Active status filter
      if (isActive !== undefined) {
        query.status = isActive ? 'active' : { $ne: 'active' };
      }

      // Search filter
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { phoneNumber: searchRegex },
          { email: searchRegex },
          { 'vehicles.vehicleNumber': searchRegex }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOrder_num = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const [customers, totalCount] = await Promise.all([
        Customer.find(query)
          .sort({ [sortBy]: sortOrder_num })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Customer.countDocuments(query)
      ]);


      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const result = {
        customers: customers.map(customer => this.sanitizeCustomer(customer)),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      };

      return result;

    } catch (error) {
      logger.error('Get customers failed:', error.message);
      throw error;
    }
  }

  /**
   * Get customer by ID
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>} - Customer data
   */
  async getCustomerById(customerId) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Get customer by ID failed:', error.message);
      throw error;
    }
  }

  /**
   * Update customer details
   * @param {String} customerId - Customer ID
   * @param {Object} updateData - Update data
   * @param {String} updatedBy - User ID who updated
   * @returns {Promise<Object>} - Updated customer
   */
  async updateCustomer(customerId, updateData, updatedBy) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (customer.status !== 'active') {
        throw new AppError('Cannot update deleted customer', 400);
      }

      // Update fields
      const allowedUpdates = ['firstName', 'lastName', 'email'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          if (field === 'email') {
            customer[field] = updateData[field] ? updateData[field].trim().toLowerCase() : null;
          } else {
            customer[field] = updateData[field].trim();
          }
        }
      });

      customer.updatedBy = updatedBy;
      customer.updatedAt = new Date();

      await customer.save();

      logger.info('Customer updated successfully', { 
        customerId,
        updatedBy 
      });

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Update customer failed:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete customer
   * @param {String} customerId - Customer ID
   * @param {String} reason - Deletion reason
   * @param {String} deletedBy - User ID who deleted
   * @returns {Promise<Object>} - Deleted customer
   */
  async deleteCustomer(customerId, reason, deletedBy) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (customer.status !== 'active') {
        throw new AppError('Customer is already deleted', 400);
      }

      // Check for active bookings
      const activeBookings = await Booking.countDocuments({
        customer: customerId,
        status: { $in: ['active', 'pending'] }
      });

      if (activeBookings > 0) {
        throw new AppError('Cannot delete customer with active bookings', 400);
      }

      // Soft delete
      customer.status = 'inactive';
      customer.deletedAt = new Date();
      customer.deletedBy = deletedBy;
      
      if (reason) {
        customer.deletionReason = reason;
      }

      await customer.save();

      logger.info('Customer deleted successfully', { 
        customerId,
        deletedBy,
        reason 
      });

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Delete customer failed:', error.message);
      throw error;
    }
  }

  /**
   * Search customers
   * @param {String} query - Search query
   * @param {String} type - Search type
   * @returns {Promise<Array>} - Search results
   */
  async searchCustomers(query, type = 'all') {
    try {
      const searchRegex = new RegExp(query, 'i');
      let searchQuery = { status: 'active' };

      switch (type) {
        case 'phone':
          searchQuery.phoneNumber = searchRegex;
          break;
        case 'name':
          searchQuery.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex }
          ];
          break;
        case 'vehicle':
          searchQuery['vehicles.vehicleNumber'] = searchRegex;
          break;
        default: // 'all'
          searchQuery.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { phoneNumber: searchRegex },
            { email: searchRegex },
            { 'vehicles.vehicleNumber': searchRegex }
          ];
      }

      const customers = await Customer.find(searchQuery)
        .limit(50) // Limit search results
        .sort({ firstName: 1 })
        .lean();

      return customers.map(customer => this.sanitizeCustomer(customer));

    } catch (error) {
      logger.error('Search customers failed:', error.message);
      throw error;
    }
  }

  /**
   * Get customer's booking history
   * @param {String} customerId - Customer ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Customer bookings
   */
  async getCustomerBookings(customerId, filters = {}, pagination = {}) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const { status } = filters;
      const { page = 1, limit = 20 } = pagination;

      // Build booking query
      const bookingQuery = { customer: customerId };
      if (status) {
        bookingQuery.status = status;
      }

      const skip = (page - 1) * limit;

      const [bookings, totalCount] = await Promise.all([
        Booking.find(bookingQuery)
          .select('bookingNumber machineNumber palletNumber vehicleNumber vehicleType status startTime endTime duration otp payment notes createdAt')
          .sort({ startTime: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Booking.countDocuments(bookingQuery)
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      logger.error('Get customer bookings failed:', error.message);
      throw error;
    }
  }

  /**
   * Get customer's vehicles
   * @param {String} customerId - Customer ID
   * @returns {Promise<Array>} - Customer vehicles
   */
  async getCustomerVehicles(customerId) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      return customer.vehicles.filter(vehicle => vehicle.isActive);

    } catch (error) {
      logger.error('Get customer vehicles failed:', error.message);
      throw error;
    }
  }

  /**
   * Add vehicle to customer
   * @param {String} customerId - Customer ID
   * @param {Object} vehicleData - Vehicle data
   * @param {String} addedBy - User ID who added
   * @returns {Promise<Object>} - Added vehicle
   */
  async addCustomerVehicle(customerId, vehicleData, addedBy) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (customer.status !== 'active') {
        throw new AppError('Cannot add vehicle to deleted customer', 400);
      }

      const {
        vehicleNumber,
        vehicleType,
        make,
        model,
        color
      } = vehicleData;

      // Check if vehicle already exists for this customer
      const existingVehicle = customer.vehicles.find(
        vehicle => vehicle.vehicleNumber.toUpperCase() === vehicleNumber.toUpperCase() && vehicle.isActive
      );

      if (existingVehicle) {
        throw new AppError('Vehicle already exists for this customer', 400);
      }

      // Add new vehicle
      const newVehicle = {
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleType,
        make: make || null,
        model: model || null,
        color: color || null,
        isActive: true,
        createdAt: new Date(),
        createdBy: addedBy
      };

      customer.vehicles.push(newVehicle);
      customer.updatedBy = addedBy;
      customer.updatedAt = new Date();

      await customer.save();

      // Get the newly added vehicle
      const addedVehicle = customer.vehicles[customer.vehicles.length - 1];

      logger.info('Vehicle added to customer successfully', { 
        customerId,
        vehicleId: addedVehicle._id,
        vehicleNumber: addedVehicle.vehicleNumber,
        addedBy 
      });

      return addedVehicle;

    } catch (error) {
      logger.error('Add customer vehicle failed:', error.message);
      throw error;
    }
  }

  /**
   * Update customer vehicle
   * @param {String} customerId - Customer ID
   * @param {String} vehicleId - Vehicle ID
   * @param {Object} updateData - Update data
   * @param {String} updatedBy - User ID who updated
   * @returns {Promise<Object>} - Updated vehicle
   */
  async updateCustomerVehicle(customerId, vehicleId, updateData, updatedBy) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const vehicle = customer.vehicles.id(vehicleId);

      if (!vehicle || !vehicle.isActive) {
        throw new AppError('Vehicle not found', 404);
      }

      // Update vehicle fields
      const allowedUpdates = ['vehicleNumber', 'vehicleType', 'make', 'model', 'color'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          if (field === 'vehicleNumber') {
            vehicle[field] = updateData[field].toUpperCase();
          } else {
            vehicle[field] = updateData[field] || null;
          }
        }
      });

      vehicle.updatedAt = new Date();
      vehicle.updatedBy = updatedBy;

      customer.updatedBy = updatedBy;
      customer.updatedAt = new Date();

      await customer.save();

      logger.info('Customer vehicle updated successfully', { 
        customerId,
        vehicleId,
        updatedBy 
      });

      return vehicle;

    } catch (error) {
      logger.error('Update customer vehicle failed:', error.message);
      throw error;
    }
  }

  /**
   * Remove vehicle from customer
   * @param {String} customerId - Customer ID
   * @param {String} vehicleId - Vehicle ID
   * @param {String} removedBy - User ID who removed
   * @returns {Promise<void>}
   */
  async removeCustomerVehicle(customerId, vehicleId, removedBy) {
    try {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const vehicle = customer.vehicles.id(vehicleId);

      if (!vehicle || !vehicle.isActive) {
        throw new AppError('Vehicle not found', 404);
      }

      // Check for active bookings with this vehicle
      const activeBookings = await Booking.countDocuments({
        customer: customerId,
        vehicleNumber: vehicle.vehicleNumber,
        status: { $in: ['active', 'pending'] }
      });

      if (activeBookings > 0) {
        throw new AppError('Cannot remove vehicle with active bookings', 400);
      }

      // Soft delete vehicle
      vehicle.isActive = false;
      vehicle.deletedAt = new Date();
      vehicle.deletedBy = removedBy;

      customer.updatedBy = removedBy;
      customer.updatedAt = new Date();

      await customer.save();

      logger.info('Customer vehicle removed successfully', { 
        customerId,
        vehicleId,
        removedBy 
      });

    } catch (error) {
      logger.error('Remove customer vehicle failed:', error.message);
      throw error;
    }
  }

  /**
   * Get active customers count
   * @returns {Promise<Number>} - Active customers count
   */
  async getActiveCustomersCount() {
    try {
      return await Customer.countDocuments({ status: 'active' });
    } catch (error) {
      logger.error('Get active customers count failed:', error.message);
      throw error;
    }
  }

  /**
   * Create membership for customer (works across all vehicles)
   * @param {String} customerId - Customer ID
   * @param {String} membershipType - Type of membership
   * @param {Number} validityTerm - Validity term in months
   * @param {String} createdBy - User ID who created the membership
   * @param {Array} vehicleTypes - Array of vehicle types covered
   * @returns {Promise<Object>} - Updated customer with membership
   */
  async createCustomerMembership(customerId, membershipType, validityTerm, createdBy, vehicleTypes, paymentDetails = {}) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (customer.status !== 'active') {
        throw new AppError('Cannot create membership for inactive customer', 400);
      }

      // Create customer membership using the model method
      await customer.createMembership(membershipType, validityTerm, createdBy, vehicleTypes);

      // Calculate membership amount based on type if not provided
      let amount = paymentDetails.amount;
      if (!amount) {
        const membershipPrices = {
          monthly: 500,
          quarterly: 1200,
          yearly: 4000,
          premium: 6000
        };
        amount = membershipPrices[membershipType] || 500;
      }

      // Create MembershipPayment record
      const membershipPayment = new MembershipPayment({
        customerId: customer._id,
        customerName: customer.fullName,
        customerPhone: customer.phoneNumber,
        membershipNumber: customer.membership.membershipNumber,
        membershipType: membershipType,
        amount: amount,
        paymentMethod: paymentDetails.method || 'cash',
        transactionId: paymentDetails.transactionId,
        paymentReference: paymentDetails.reference,
        startDate: customer.membership.issuedDate,
        expiryDate: customer.membership.expiryDate,
        validityTerm: validityTerm,
        vehicleTypes: vehicleTypes || [],
        status: 'completed',
        notes: paymentDetails.notes,
        createdBy: createdBy
      });

      await membershipPayment.save();

      logger.info('Customer membership and payment record created successfully', {
        customerId: customer._id,
        membershipType,
        vehicleTypes,
        validityTerm,
        createdBy
      });

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Create customer membership failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(error.message || 'Failed to create customer membership', 500);
    }
  }


  /**
   * Validate customer membership credentials
   * @param {String} membershipNumber - Membership number
   * @param {String} pin - Membership PIN
   * @param {String} vehicleNumber - Optional vehicle number (not used anymore)
   * @param {String} bookingVehicleType - Vehicle type for this booking
   * @returns {Promise<Object|null>} - Customer with valid membership or null
   */
  async validateVehicleMembershipCredentials(membershipNumber, pin, vehicleNumber = null, bookingVehicleType = null) {
    try {
      const customer = await Customer.validateMembershipCredentials(membershipNumber, pin);
      
      if (customer) {
        // Check if membership covers the booking vehicle type
        const membershipCoversVehicleType = !bookingVehicleType || 
          (customer.membership.vehicleTypes && customer.membership.vehicleTypes.includes(bookingVehicleType));

        if (membershipCoversVehicleType) {
          logger.info('Customer membership validated successfully', {
            customerId: customer._id,
            membershipNumber,
            bookingVehicleType
          });

          return {
            customer: this.sanitizeCustomer(customer),
            vehicle: null // No longer needed since membership is customer-level
          };
        } else {
          logger.warn('Membership does not cover vehicle type', {
            membershipNumber,
            bookingVehicleType,
            coverageTypes: customer.membership.vehicleTypes
          });
        }
      }
      
      logger.warn('Invalid customer membership credentials', {
        membershipNumber,
        pin: '****', // Don't log the actual PIN
        bookingVehicleType
      });

      return null;

    } catch (error) {
      logger.error('Validate customer membership credentials failed:', error.message);
      throw new AppError('Failed to validate membership credentials', 500);
    }
  }

  /**
   * Deactivate customer membership
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>} - Updated customer
   */
  async deactivateCustomerMembership(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (!customer.membership || !customer.membership.isActive) {
        throw new AppError('Customer does not have an active membership', 400);
      }

      // Deactivate the membership using the model method
      await customer.deactivateMembership();

      logger.info('Customer membership deactivated successfully', {
        customerId: customer._id,
        membershipNumber: customer.membership.membershipNumber
      });

      return this.sanitizeCustomer(customer);

    } catch (error) {
      logger.error('Deactivate customer membership failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(error.message || 'Failed to deactivate membership', 500);
    }
  }

  /**
   * Get all memberships for a customer
   * @param {String} customerId - Customer ID
   * @returns {Promise<Array>} - Array of vehicles with memberships
   */
  async getCustomerMemberships(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      // Filter vehicles that have memberships
      const vehiclesWithMemberships = customer.vehicles.filter(v => 
        v.membership && v.membership.membershipNumber
      ).map(v => ({
        vehicleNumber: v.vehicleNumber,
        vehicleType: v.vehicleType,
        make: v.make,
        model: v.model,
        membership: {
          membershipNumber: v.membership.membershipNumber,
          membershipType: v.membership.membershipType,
          issuedDate: v.membership.issuedDate,
          expiryDate: v.membership.expiryDate,
          isActive: v.membership.isActive,
          isExpired: v.membership.expiryDate && v.membership.expiryDate <= new Date()
        }
      }));

      return vehiclesWithMemberships;

    } catch (error) {
      logger.error('Get customer memberships failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get customer memberships', 500);
    }
  }

  /**
   * Sanitize customer data for response
   * @param {Object} customer - Customer object
   * @returns {Object} - Sanitized customer
   */
  sanitizeCustomer(customer) {
    const customerObj = customer.toObject ? customer.toObject() : customer;
    
    return {
      _id: customerObj._id,
      firstName: customerObj.firstName,
      lastName: customerObj.lastName,
      fullName: `${customerObj.firstName} ${customerObj.lastName}`,
      phoneNumber: customerObj.phoneNumber,
      email: customerObj.email,
      vehicles: customerObj.vehicles ? customerObj.vehicles.filter(v => v.isActive) : [],
      membership: customerObj.membership || null,
      hasMembership: !!(customerObj.membership && 
                      customerObj.membership.isActive && 
                      customerObj.membership.membershipNumber && 
                      customerObj.membership.expiryDate > new Date()),
      status: customerObj.status,
      createdAt: customerObj.createdAt,
      updatedAt: customerObj.updatedAt
    };
  }

}

module.exports = new CustomerService();