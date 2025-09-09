const customerService = require('../services/customerService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

class CustomerController {
  /**
   * Create new customer
   * @route POST /api/customers
   */
  async createCustomer(req, res, next) {
    try {
      const customerData = req.body;
      const createdBy = req.user._id;

      const customer = await customerService.createCustomer(customerData, createdBy);

      responseHandler.created(res, { customer }, 'Customer created successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customers with filters and pagination
   * @route GET /api/customers
   */
  async getCustomers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        isActive
      } = req.query;

      const filters = {
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      };

      const result = await customerService.getCustomers(
        filters,
        { page: parseInt(page), limit: parseInt(limit) },
        { sortBy, sortOrder }
      );

      responseHandler.success(res, result, 'Customers retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer by ID
   * @route GET /api/customers/:id
   */
  async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await customerService.getCustomerById(id);

      responseHandler.success(res, { customer }, 'Customer retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update customer details
   * @route PUT /api/customers/:id
   */
  async updateCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user._id;

      const customer = await customerService.updateCustomer(id, updateData, updatedBy);

      responseHandler.success(res, { customer }, 'Customer updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft delete customer
   * @route DELETE /api/customers/:id
   */
  async deleteCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const deletedBy = req.user._id;

      const customer = await customerService.deleteCustomer(id, reason, deletedBy);

      responseHandler.success(res, { customer }, 'Customer deleted successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Search customers
   * @route GET /api/customers/search
   */
  async searchCustomers(req, res, next) {
    try {
      const { q: query, type = 'all' } = req.query;

      if (!query || query.length < 2) {
        return responseHandler.badRequest(res, 'Search query must be at least 2 characters long');
      }

      const customers = await customerService.searchCustomers(query, type);

      responseHandler.success(res, { customers }, 'Search completed successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer's booking history
   * @route GET /api/customers/:id/bookings
   */
  async getCustomerBookings(req, res, next) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 20,
        status
      } = req.query;

      const filters = { status };
      const pagination = { page: parseInt(page), limit: parseInt(limit) };

      const result = await customerService.getCustomerBookings(id, filters, pagination);

      responseHandler.success(res, result, 'Customer bookings retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer's vehicles
   * @route GET /api/customers/:id/vehicles
   */
  async getCustomerVehicles(req, res, next) {
    try {
      const { id } = req.params;

      const vehicles = await customerService.getCustomerVehicles(id);

      responseHandler.success(res, { vehicles }, 'Customer vehicles retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Add vehicle to customer
   * @route POST /api/customers/:id/vehicles
   */
  async addCustomerVehicle(req, res, next) {
    try {
      const { id } = req.params;
      const vehicleData = req.body;
      const addedBy = req.user._id;

      const vehicle = await customerService.addCustomerVehicle(id, vehicleData, addedBy);

      responseHandler.created(res, { vehicle }, 'Vehicle added successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update customer vehicle
   * @route PUT /api/customers/:id/vehicles/:vehicleId
   */
  async updateCustomerVehicle(req, res, next) {
    try {
      const { id, vehicleId } = req.params;
      const updateData = req.body;
      const updatedBy = req.user._id;

      const vehicle = await customerService.updateCustomerVehicle(id, vehicleId, updateData, updatedBy);

      responseHandler.success(res, { vehicle }, 'Vehicle updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove vehicle from customer
   * @route DELETE /api/customers/:id/vehicles/:vehicleId
   */
  async removeCustomerVehicle(req, res, next) {
    try {
      const { id, vehicleId } = req.params;
      const removedBy = req.user._id;

      await customerService.removeCustomerVehicle(id, vehicleId, removedBy);

      responseHandler.success(res, {}, 'Vehicle removed successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create membership for customer with vehicle type coverage
   * @route POST /api/customers/:id/membership
   */
  async createCustomerMembership(req, res, next) {
    try {
      const { id } = req.params;
      const { membershipType, validityTerm = 12, vehicleTypes } = req.body;
      const createdBy = req.user._id;

      const customer = await customerService.createCustomerMembership(
        id,
        membershipType,
        validityTerm,
        createdBy,
        vehicleTypes
      );

      responseHandler.created(res, { customer }, 'Customer membership created successfully');

    } catch (error) {
      next(error);
    }
  }


  /**
   * Validate vehicle membership credentials
   * @route POST /api/customers/validate-membership
   */
  async validateMembership(req, res, next) {
    try {
      const { membershipNumber, pin, vehicleType } = req.body;

      const result = await customerService.validateVehicleMembershipCredentials(
        membershipNumber, 
        pin,
        null, // vehicleNumber not needed anymore
        vehicleType
      );

      if (!result) {
        return responseHandler.badRequest(res, 'Invalid membership number or PIN');
      }

      responseHandler.success(res, { 
        customer: {
          _id: result.customer._id,
          fullName: result.customer.fullName,
          phoneNumber: result.customer.phoneNumber,
          membership: result.customer.membership
        }
      }, 'Membership validated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate customer membership
   * @route DELETE /api/customers/:id/membership
   */
  async deactivateCustomerMembership(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await customerService.deactivateCustomerMembership(id);

      responseHandler.success(res, { customer }, 'Customer membership deactivated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all memberships for a customer
   * @route GET /api/customers/:id/memberships
   */
  async getCustomerMemberships(req, res, next) {
    try {
      const { id } = req.params;

      const memberships = await customerService.getCustomerMemberships(id);

      responseHandler.success(res, { memberships }, 'Customer memberships retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for customer service
   * @route GET /api/customers/health
   */
  async healthCheck(req, res, next) {
    try {
      const activeCustomersCount = await customerService.getActiveCustomersCount();

      responseHandler.success(res, {
        service: 'customer',
        status: 'healthy',
        activeCustomers: activeCustomersCount,
        timestamp: new Date().toISOString()
      }, 'Customer service is healthy');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customers with active memberships
   * @route GET /api/customers/active-members
   */
  async getActiveMembers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        membershipType
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sortBy,
        sortOrder,
        search,
        membershipType
      };

      const result = await customerService.getActiveMembers(filters);

      responseHandler.success(res, result, 'Active members retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomerController();