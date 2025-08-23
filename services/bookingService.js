const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Machine = require('../models/Machine');
const machineService = require('./machineService');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { BOOKING_STATUS, VEHICLE_TYPES, PAYMENT_STATUS } = require('../utils/constants');
const encryption = require('../utils/encryption');

class BookingService {
  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @param {String} createdBy - User ID who created the booking
   * @param {String} siteId - Site ID where booking is created (optional, will be derived from user if not provided)
   * @returns {Promise<Object>} - Created booking
   */
  async createBooking(bookingData, createdBy, siteId = null) {
    try {
      const {
        customerName,
        phoneNumber,
        vehicleNumber,
        vehicleType,
        machineNumber,
        palletNumber,
        email,
        notes,
        specialInstructions
      } = bookingData;

      // Determine siteId if not provided
      if (!siteId) {
        // If siteId not provided, we need to get it from the user context
        // This will be handled in the controller by passing the user's primary site
        throw new AppError('Site ID is required for booking creation', 400);
      }

      // Validate required fields
      if (!customerName || !customerName.trim()) {
        throw new AppError('Customer name is required when creating a booking', 400);
      }

      // Find existing customer by phone number
      let customer = await Customer.findOne({ phoneNumber, status: 'active' });
      let isNewCustomer = false;
      let customerNameUpdated = false;
      
      if (!customer) {
        // New customer - name is mandatory
        isNewCustomer = true;
        
        // Extract first and last name from customerName
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        customer = new Customer({
          firstName,
          lastName,
          phoneNumber,
          email: email || null,
          vehicles: [{
            vehicleNumber: vehicleNumber.toUpperCase(),
            vehicleType,
            isActive: true,
            createdAt: new Date(),
            createdBy
          }],
          status: 'active',
          createdBy
        });
        
        await customer.save();
        logger.info('New customer created during booking', { 
          customerId: customer._id, 
          phoneNumber, 
          customerName 
        });
      } else {
        // Existing customer - check if operator provided different name
        const currentFullName = `${customer.firstName} ${customer.lastName}`.trim();
        const providedName = customerName.trim();
        
        if (providedName !== currentFullName) {
          // Update customer name with operator-provided name
          const nameParts = providedName.split(' ');
          const newFirstName = nameParts[0];
          const newLastName = nameParts.slice(1).join(' ') || newFirstName;
          
          customer.firstName = newFirstName;
          customer.lastName = newLastName;
          customer.updatedBy = createdBy;
          customer.updatedAt = new Date();
          customerNameUpdated = true;
          
          logger.info('Customer name updated during booking', { 
            customerId: customer._id, 
            oldName: currentFullName, 
            newName: providedName 
          });
        }
        
        // Check if vehicle exists, if not add it
        const existingVehicle = customer.vehicles.find(
          v => v.vehicleNumber === vehicleNumber.toUpperCase() && v.isActive
        );
        
        if (!existingVehicle) {
          customer.vehicles.push({
            vehicleNumber: vehicleNumber.toUpperCase(),
            vehicleType,
            isActive: true,
            createdAt: new Date(),
            createdBy
          });
          logger.info('New vehicle added to customer during booking', { 
            customerId: customer._id, 
            vehicleNumber 
          });
        }
        
        // Save customer updates if any
        if (customerNameUpdated || !existingVehicle) {
          await customer.save();
        }
      }

      // Basic validation only - removed capacity checks to allow overbooking
      await this.validateMachinePallet(machineNumber, palletNumber);

      // Generate OTP
      const otpCode = encryption.generateOTP(6);
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 30); // 30 minutes expiry

      // Create booking linked to customer
      const booking = new Booking({
        siteId, // Associate booking with the site
        customer: customer._id,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        phoneNumber: customer.phoneNumber,
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleType,
        machineNumber: machineNumber.toUpperCase(),
        palletNumber,
        status: BOOKING_STATUS.ACTIVE,
        otp: {
          code: otpCode,
          generatedAt: new Date(),
          expiresAt: otpExpiry,
          isUsed: false
        },
        notes: notes || '',
        specialInstructions: specialInstructions || '',
        createdBy,
        payment: {
          status: PAYMENT_STATUS.PENDING,
          amount: 0
        }
      });

      const savedBooking = await booking.save();

      // Occupy machine pallet
      try {
        // Find the machine by machine number
        const machine = await Machine.findOne({ 
          machineNumber: machineNumber.toUpperCase(),
          siteId: siteId 
        });
        
        if (machine) {
          // Occupy the pallet using machine service
          await machineService.occupyPallet(
            machine._id,
            palletNumber,
            savedBooking._id.toString(),
            vehicleNumber.toUpperCase(),
            null // Position will be auto-assigned for two-wheelers
          );
          
          logger.info('Machine pallet occupied successfully', {
            machineId: machine._id,
            machineNumber: machine.machineNumber,
            palletNumber,
            bookingId: savedBooking._id,
            vehicleNumber: vehicleNumber.toUpperCase()
          });
        } else {
          logger.warn('Machine not found for pallet occupation', {
            machineNumber: machineNumber.toUpperCase(),
            siteId
          });
        }
      } catch (error) {
        logger.error('Failed to occupy machine pallet', {
          error: error.message,
          machineNumber: machineNumber.toUpperCase(),
          palletNumber,
          bookingId: savedBooking._id
        });
        // Don't fail the booking creation if pallet occupation fails
        // This allows the booking to be created even if machine integration fails
      }

      logger.info('About to populate customer information');
      
      // Populate customer information
      await savedBooking.populate('customer', 'firstName lastName phoneNumber email');
      
      logger.info('Customer information populated successfully');
      
      // Update customer booking statistics
      await this.updateCustomerBookingStats(customer._id, savedBooking);
      
      // Return appropriate message for new customers
      let responseMessage = 'Booking created successfully';
      if (isNewCustomer) {
        responseMessage = 'New customer created and booking created successfully';
      } else if (customerNameUpdated) {
        responseMessage = 'Customer name updated and booking created successfully';
      }

      logger.info('Booking created successfully', { 
        bookingId: savedBooking._id,
        bookingNumber: savedBooking.bookingNumber,
        vehicleNumber: savedBooking.vehicleNumber
      });

      logger.info('About to return booking object');
      
      // Safe object conversion with error handling
      if (!savedBooking) {
        throw new AppError('Saved booking is undefined', 500);
      }
      
      // Skip toObject conversion and return safe manual object
      logger.info('Creating safe booking response object...');
      const safeBooking = {
        _id: savedBooking._id,
        bookingNumber: savedBooking.bookingNumber,
        customerName: savedBooking.customerName,
        phoneNumber: savedBooking.phoneNumber,
        vehicleNumber: savedBooking.vehicleNumber,
        vehicleType: savedBooking.vehicleType,
        machineNumber: savedBooking.machineNumber,
        palletNumber: savedBooking.palletNumber,
        status: savedBooking.status,
        startTime: savedBooking.startTime,
        endTime: savedBooking.endTime,
        otp: {
          code: savedBooking.otp?.code,
          expiresAt: savedBooking.otp?.expiresAt,
          isUsed: savedBooking.otp?.isUsed
        },
        customer: savedBooking.customer ? {
          _id: savedBooking.customer._id,
          firstName: savedBooking.customer.firstName,
          lastName: savedBooking.customer.lastName,
          phoneNumber: savedBooking.customer.phoneNumber,
          email: savedBooking.customer.email
        } : null,
        createdAt: savedBooking.createdAt,
        updatedAt: savedBooking.updatedAt,
        notes: savedBooking.notes,
        specialInstructions: savedBooking.specialInstructions,
        payment: savedBooking.payment,
        // Metadata about customer handling
        _metadata: {
          isNewCustomer: isNewCustomer,
          customerNameUpdated: customerNameUpdated,
          message: responseMessage
        }
      };
      
      logger.info('Safe booking object created successfully', {
        isNewCustomer,
        customerNameUpdated,
        customerId: customer._id
      });
      return safeBooking;

    } catch (error) {
      logger.error('Create booking failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create booking', 500);
    }
  }

  /**
   * Get bookings with filters and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Bookings and metadata
   */
  async getBookings(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'startTime', sortOrder = 'desc' } = pagination;
      const { status, machineNumber, vehicleNumber, search, dateFrom, dateTo, siteId } = filters;

      // Build query
      const query = {};

      if (siteId) {
        query.siteId = siteId;
      }

      if (status) {
        query.status = status;
      }

      if (machineNumber) {
        query.machineNumber = machineNumber.toUpperCase();
      }

      if (vehicleNumber) {
        query.vehicleNumber = vehicleNumber.toUpperCase();
      }

      if (dateFrom || dateTo) {
        query.startTime = {};
        if (dateFrom) query.startTime.$gte = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query.startTime.$lte = endDate;
        }
      }

      if (search) {
        query.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { vehicleNumber: { $regex: search, $options: 'i' } },
          { bookingNumber: { $regex: search, $options: 'i' } },
          { 'otp.code': { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Execute query
      const [bookings, total] = await Promise.all([
        Booking.find(query)
          .populate('customer', 'firstName lastName phoneNumber email')
          .populate('createdBy', 'operatorId firstName lastName')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Booking.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info('Bookings retrieved successfully', { 
        total, 
        page, 
        totalPages,
        filters 
      });

      return {
        bookings: bookings.map(booking => this.sanitizeBooking(booking)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      logger.error('Get bookings failed:', error.message);
      throw new AppError('Failed to retrieve bookings', 500);
    }
  }

  /**
   * Get booking by ID
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>} - Booking details
   */
  async getBookingById(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('customer', 'firstName lastName phoneNumber email vehicles membership')
        .populate('createdBy', 'operatorId firstName lastName')
        .populate('updatedBy', 'operatorId firstName lastName')
        .populate('completedBy', 'operatorId firstName lastName');

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      logger.info('Booking retrieved by ID', { bookingId });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('Get booking by ID failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve booking', 500);
    }
  }

  /**
   * Update booking
   * @param {String} bookingId - Booking ID
   * @param {Object} updateData - Update data
   * @param {String} updatedBy - User ID who updated the booking
   * @returns {Promise<Object>} - Updated booking
   */
  async updateBooking(bookingId, updateData, updatedBy) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status === BOOKING_STATUS.COMPLETED) {
        throw new AppError('Cannot update completed booking', 400);
      }

      if (booking.status === BOOKING_STATUS.CANCELLED) {
        throw new AppError('Cannot update cancelled booking', 400);
      }

      // Update allowed fields
      const allowedFields = ['notes', 'specialInstructions', 'vehicleType'];
      const updates = { updatedBy };

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('customer', 'firstName lastName phoneNumber email');

      logger.info('Booking updated successfully', { 
        bookingId,
        updatedBy 
      });

      return this.sanitizeBooking(updatedBooking);

    } catch (error) {
      logger.error('Update booking failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update booking', 500);
    }
  }

  /**
   * Complete booking
   * @param {String} bookingId - Booking ID
   * @param {Object} paymentData - Payment information
   * @param {String} completedBy - User ID who completed the booking
   * @returns {Promise<Object>} - Completed booking
   */
  async completeBooking(bookingId, paymentData, completedBy) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status !== BOOKING_STATUS.ACTIVE) {
        throw new AppError('Only active bookings can be completed', 400);
      }

      // Complete the booking using the model method
      await booking.complete(completedBy, paymentData);

      // Release machine pallet
      try {
        const machine = await Machine.findOne({ 
          machineNumber: booking.machineNumber,
          siteId: booking.siteId 
        });
        
        if (machine) {
          await machineService.releaseVehicle(
            machine._id,
            booking.palletNumber,
            booking.vehicleNumber
          );
          
          logger.info('Machine pallet released on booking completion', {
            machineId: machine._id,
            machineNumber: machine.machineNumber,
            palletNumber: booking.palletNumber,
            bookingId: booking._id,
            vehicleNumber: booking.vehicleNumber
          });
        }
      } catch (error) {
        logger.error('Failed to release machine pallet on booking completion', {
          error: error.message,
          bookingId: booking._id,
          machineNumber: booking.machineNumber,
          palletNumber: booking.palletNumber
        });
        // Don't fail the booking completion if pallet release fails
      }

      await booking.populate('customer', 'firstName lastName phoneNumber email');

      // Update customer statistics
      await this.updateCustomerStats(booking.customer._id);

      logger.info('Booking completed successfully', { 
        bookingId,
        completedBy,
        duration: booking.formattedDuration
      });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('Complete booking failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to complete booking', 500);
    }
  }

  /**
   * Cancel booking
   * @param {String} bookingId - Booking ID
   * @param {String} reason - Cancellation reason
   * @param {String} cancelledBy - User ID who cancelled the booking
   * @returns {Promise<Object>} - Cancelled booking
   */
  async cancelBooking(bookingId, reason, cancelledBy) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status === BOOKING_STATUS.COMPLETED) {
        throw new AppError('Cannot cancel completed booking', 400);
      }

      if (booking.status === BOOKING_STATUS.CANCELLED) {
        throw new AppError('Booking is already cancelled', 400);
      }

      if (booking.status === BOOKING_STATUS.DELETED) {
        throw new AppError('Booking is already deleted', 400);
      }

      // Delete the booking using the model method (soft delete)
      await booking.delete(reason);
      
      booking.updatedBy = cancelledBy;
      await booking.save();

      // Release machine pallet
      try {
        const machine = await Machine.findOne({ 
          machineNumber: booking.machineNumber,
          siteId: booking.siteId 
        });
        
        if (machine) {
          await machineService.releaseVehicle(
            machine._id,
            booking.palletNumber,
            booking.vehicleNumber
          );
          
          logger.info('Machine pallet released on booking cancellation', {
            machineId: machine._id,
            machineNumber: machine.machineNumber,
            palletNumber: booking.palletNumber,
            bookingId: booking._id,
            vehicleNumber: booking.vehicleNumber
          });
        }
      } catch (error) {
        logger.error('Failed to release machine pallet on booking cancellation', {
          error: error.message,
          bookingId: booking._id,
          machineNumber: booking.machineNumber,
          palletNumber: booking.palletNumber
        });
        // Don't fail the booking cancellation if pallet release fails
      }

      await booking.populate('customer', 'firstName lastName phoneNumber email');

      logger.info('Booking deleted successfully', { 
        bookingId,
        cancelledBy,
        reason 
      });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('Cancel booking failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to cancel booking', 500);
    }
  }

  /**
   * Verify OTP and retrieve vehicle
   * @param {String} otpCode - OTP code
   * @returns {Promise<Object>} - Booking details
   */
  async verifyOTP(otpCode) {
    try {
      const booking = await Booking.findByOTP(otpCode);

      if (!booking) {
        throw new AppError('Invalid or expired OTP', 400);
      }

      // Use OTP
      await booking.useOTP();

      await booking.populate('customer', 'firstName lastName phoneNumber email');

      logger.info('OTP verified successfully', { 
        bookingId: booking._id,
        otpCode 
      });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('OTP verification failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('OTP verification failed', 500);
    }
  }

  /**
   * Generate new OTP for booking
   * @param {String} bookingId - Booking ID
   * @returns {Promise<Object>} - Updated booking with new OTP
   */
  async generateNewOTP(bookingId) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status !== BOOKING_STATUS.ACTIVE) {
        throw new AppError('Can only generate OTP for active bookings', 400);
      }

      // Generate new OTP using the model method
      await booking.generateNewOTP();

      await booking.populate('customer', 'firstName lastName phoneNumber email');

      logger.info('New OTP generated successfully', { 
        bookingId,
        newOTP: booking.otp.code 
      });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('Generate new OTP failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate new OTP', 500);
    }
  }

  /**
   * Get active bookings
   * @returns {Promise<Array>} - Active bookings
   */
  async getActiveBookings() {
    try {
      const bookings = await Booking.findActiveBookings();

      logger.info('Active bookings retrieved successfully', { 
        count: bookings.length 
      });

      return bookings.map(booking => this.sanitizeBooking(booking));

    } catch (error) {
      logger.error('Get active bookings failed:', error.message);
      throw new AppError('Failed to retrieve active bookings', 500);
    }
  }

  /**
   * Search bookings
   * @param {String} query - Search query
   * @param {String} filterType - Filter type (vehicle, pallet, otp, etc.)
   * @returns {Promise<Array>} - Search results
   */
  async searchBookings(query, filterType = 'all') {
    try {
      let searchQuery = {};

      switch (filterType) {
        case 'vehicle':
          searchQuery.vehicleNumber = { $regex: query, $options: 'i' };
          break;
        case 'pallet':
          searchQuery.palletNumber = parseInt(query) || 0;
          break;
        case 'otp':
          searchQuery['otp.code'] = { $regex: query, $options: 'i' };
          break;
        case 'customer':
          searchQuery.customerName = { $regex: query, $options: 'i' };
          break;
        case 'phone':
          searchQuery.phoneNumber = { $regex: query, $options: 'i' };
          break;
        default:
          searchQuery = {
            $or: [
              { vehicleNumber: { $regex: query, $options: 'i' } },
              { customerName: { $regex: query, $options: 'i' } },
              { phoneNumber: { $regex: query, $options: 'i' } },
              { bookingNumber: { $regex: query, $options: 'i' } },
              { 'otp.code': { $regex: query, $options: 'i' } }
            ]
          };
      }

      const bookings = await Booking.find(searchQuery)
        .populate('customer', 'firstName lastName phoneNumber email')
        .sort({ startTime: -1 })
        .limit(50);

      logger.info('Bookings search completed', { 
        query, 
        filterType, 
        resultsCount: bookings.length 
      });

      return bookings.map(booking => this.sanitizeBooking(booking));

    } catch (error) {
      logger.error('Search bookings failed:', error.message);
      throw new AppError('Failed to search bookings', 500);
    }
  }

  /**
   * Validate machine and pallet format only (no availability checks)
   * @param {String} machineNumber - Machine number
   * @param {Number} palletNumber - Pallet number
   * @returns {Promise<void>}
   */
  async validateMachinePallet(machineNumber, palletNumber) {
    try {
      // Basic validation for machine number format
      if (!/^M[0-9]{3}$/.test(machineNumber.toUpperCase())) {
        throw new AppError('Invalid machine number format. Must be M001, M002, etc.', 400);
      }

      // Basic validation for pallet number (allow any positive number)
      if (palletNumber < 1) {
        throw new AppError('Invalid pallet number. Must be a positive number', 400);
      }

      // Allow any machine/pallet combination - no capacity restrictions
      logger.info('Machine validation passed (format only)', { 
        machineNumber: machineNumber.toUpperCase(), 
        palletNumber 
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Machine validation failed', 500);
    }
  }

  /**
   * Update customer statistics
   * @param {String} customerId - Customer ID
   * @returns {Promise<void>}
   */
  async updateCustomerStats(customerId) {
    try {
      const totalBookings = await Booking.countDocuments({ 
        customer: customerId 
      });

      const completedBookings = await Booking.countDocuments({ 
        customer: customerId,
        status: BOOKING_STATUS.COMPLETED 
      });

      const lastBooking = await Booking.findOne({ 
        customer: customerId 
      }).sort({ startTime: -1 });

      await Customer.findByIdAndUpdate(customerId, {
        'stats.totalBookings': totalBookings,
        'stats.completedBookings': completedBookings,
        'stats.lastBookingDate': lastBooking ? lastBooking.startTime : null
      });

    } catch (error) {
      logger.error('Update customer stats failed:', error.message);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get booking statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} - Booking statistics
   */
  async getBookingStats(startDate, endDate) {
    try {
      const stats = await Booking.aggregate([
        {
          $match: {
            startTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            activeBookings: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedBookings: { 
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledBookings: { 
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            totalRevenue: { 
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$payment.amount', 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0
      };

    } catch (error) {
      logger.error('Get booking stats failed:', error.message);
      throw new AppError('Failed to get booking statistics', 500);
    }
  }

  /**
   * Get bookings by machine
   * @param {String} machineNumber - Machine number
   * @param {String} status - Booking status
   * @returns {Promise<Array>} - Bookings for machine
   */
  async getBookingsByMachine(machineNumber, status = 'active') {
    try {
      const bookings = await Booking.find({
        machineNumber: machineNumber.toUpperCase(),
        status: status
      }).populate('customer', 'firstName lastName phoneNumber')
        .sort({ startTime: -1 });

      return bookings.map(booking => this.sanitizeBooking(booking));

    } catch (error) {
      logger.error('Get bookings by machine failed:', error.message);
      throw new AppError('Failed to get bookings by machine', 500);
    }
  }

  /**
   * Get bookings by vehicle
   * @param {String} vehicleNumber - Vehicle number
   * @returns {Promise<Array>} - Bookings for vehicle
   */
  async getBookingsByVehicle(vehicleNumber) {
    try {
      const bookings = await Booking.find({
        vehicleNumber: vehicleNumber.toUpperCase()
      }).populate('customer', 'firstName lastName phoneNumber')
        .sort({ startTime: -1 })
        .limit(10);

      return bookings.map(booking => this.sanitizeBooking(booking));

    } catch (error) {
      logger.error('Get bookings by vehicle failed:', error.message);
      throw new AppError('Failed to get bookings by vehicle', 500);
    }
  }

  /**
   * Extend booking time
   * @param {String} bookingId - Booking ID
   * @param {Object} extensionData - Extension data
   * @param {String} extendedBy - User ID who extended the booking
   * @returns {Promise<Object>} - Extended booking
   */
  async extendBooking(bookingId, extensionData, extendedBy) {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      if (booking.status !== BOOKING_STATUS.ACTIVE) {
        throw new AppError('Only active bookings can be extended', 400);
      }

      const { hours = 0, minutes = 0, reason } = extensionData;
      
      // Add extension to notes
      const extensionNote = `Extended by ${hours}h ${minutes}m. Reason: ${reason || 'No reason provided'}`;
      booking.notes = booking.notes ? `${booking.notes}\n${extensionNote}` : extensionNote;
      booking.updatedBy = extendedBy;

      await booking.save();
      await booking.populate('customer', 'firstName lastName phoneNumber');

      logger.info('Booking extended successfully', {
        bookingId,
        extension: `${hours}h ${minutes}m`,
        extendedBy
      });

      return this.sanitizeBooking(booking);

    } catch (error) {
      logger.error('Extend booking failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to extend booking', 500);
    }
  }

  /**
   * Get active bookings count
   * @returns {Promise<Number>} - Count of active bookings
   */
  async getActiveBookingsCount() {
    try {
      return await Booking.countDocuments({ status: BOOKING_STATUS.ACTIVE });
    } catch (error) {
      logger.error('Get active bookings count failed:', error.message);
      return 0;
    }
  }

  /**
   * Remove sensitive data from booking object
   * @param {Object} booking - Booking object
   * @returns {Object} - Sanitized booking object
   */
  sanitizeBooking(booking) {
    if (!booking || typeof booking !== 'object') {
      return booking;
    }

    // Always create safe object manually to avoid toObject() issues
    return {
      _id: booking._id,
      siteId: booking.siteId,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      phoneNumber: booking.phoneNumber,
      vehicleNumber: booking.vehicleNumber,
      vehicleType: booking.vehicleType,
      machineNumber: booking.machineNumber,
      palletNumber: booking.palletNumber,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      otp: {
        code: booking.otp?.code,
        expiresAt: booking.otp?.expiresAt,
        isUsed: booking.otp?.isUsed
      },
      customer: booking.customer ? {
        _id: booking.customer._id,
        firstName: booking.customer.firstName,
        lastName: booking.customer.lastName,
        phoneNumber: booking.customer.phoneNumber,
        email: booking.customer.email
      } : null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      notes: booking.notes,
      specialInstructions: booking.specialInstructions,
      payment: booking.payment,
      duration: booking.duration
    };
  }

  /**
   * Update customer booking statistics
   * @param {String} customerId - Customer ID
   * @param {Object} booking - Booking object
   * @returns {Promise<void>}
   */
  async updateCustomerBookingStats(customerId, booking) {
    try {
      await Customer.findByIdAndUpdate(
        customerId,
        {
          $inc: { totalBookings: 1 },
          lastBookingDate: new Date()
        },
        { new: true }
      );
      
      logger.info('Customer booking statistics updated', { 
        customerId, 
        bookingId: booking._id 
      });
    } catch (error) {
      // Don't fail booking creation if stats update fails
      logger.error('Failed to update customer booking statistics:', {
        error: error.message,
        customerId,
        bookingId: booking._id
      });
    }
  }
}

module.exports = new BookingService();