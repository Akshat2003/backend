const bookingService = require('../services/bookingService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

class BookingController {
  /**
   * Create new booking
   * @route POST /api/bookings
   */
  async createBooking(req, res, next) {
    try {
      const bookingData = req.body;
      const createdBy = req.user._id;
      
      // Extract siteId - use explicit siteId from request body, or user's primary site, or first assigned site
      let siteId = bookingData.siteId;
      if (!siteId) {
        if (req.user.primarySite) {
          siteId = req.user.primarySite._id || req.user.primarySite;
        } else if (req.user.assignedSites && req.user.assignedSites.length > 0) {
          siteId = req.user.assignedSites[0].site._id || req.user.assignedSites[0].site;
        } else {
          return responseHandler.badRequest(res, 'User must be assigned to a site to create bookings');
        }
      }

      const booking = await bookingService.createBooking(bookingData, createdBy, siteId);

      // Use metadata message if available, otherwise default message
      const message = booking._metadata?.message || 'Booking created successfully';
      
      // Remove metadata from response (internal use only)
      const { _metadata, ...bookingResponse } = booking;
      
      responseHandler.created(res, { booking: bookingResponse }, message);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bookings with filters and pagination
   * @route GET /api/bookings
   */
  async getBookings(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'startTime',
        sortOrder = 'desc',
        status,
        machineNumber,
        vehicleNumber,
        search,
        dateFrom,
        dateTo,
        siteId
      } = req.query;

      const filters = {
        status,
        machineNumber,
        vehicleNumber,
        search,
        dateFrom,
        dateTo,
        siteId
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => 
        filters[key] === undefined && delete filters[key]
      );

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await bookingService.getBookings(filters, pagination);

      responseHandler.success(res, result, 'Bookings retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get booking by ID
   * @route GET /api/bookings/:id
   */
  async getBookingById(req, res, next) {
    try {
      const { id } = req.params;

      const booking = await bookingService.getBookingById(id);

      responseHandler.success(res, { booking }, 'Booking retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update booking
   * @route PUT /api/bookings/:id
   */
  async updateBooking(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user._id;

      const booking = await bookingService.updateBooking(id, updateData, updatedBy);

      responseHandler.success(res, { booking }, 'Booking updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete booking
   * @route POST /api/bookings/:id/complete
   */
  async completeBooking(req, res, next) {
    try {
      const { id } = req.params;
      const paymentData = req.body;
      const completedBy = req.user._id;

      const booking = await bookingService.completeBooking(id, paymentData, completedBy);

      responseHandler.success(res, { booking }, 'Booking completed successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel booking
   * @route DELETE /api/bookings/:id
   */
  async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const cancelledBy = req.user._id;

      const booking = await bookingService.cancelBooking(id, reason, cancelledBy);

      responseHandler.success(res, { booking }, 'Booking deleted successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP and retrieve vehicle information
   * @route POST /api/bookings/verify-otp
   */
  async verifyOTP(req, res, next) {
    try {
      const { otp } = req.body;

      if (!otp) {
        return responseHandler.badRequest(res, 'OTP is required');
      }

      const booking = await bookingService.verifyOTP(otp);

      responseHandler.success(res, { booking }, 'OTP verified successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate new OTP for booking
   * @route POST /api/bookings/:id/regenerate-otp
   */
  async generateNewOTP(req, res, next) {
    try {
      const { id } = req.params;

      const booking = await bookingService.generateNewOTP(id);

      responseHandler.success(res, { 
        booking: {
          _id: booking._id,
          bookingNumber: booking.bookingNumber,
          otp: booking.otp,
          vehicleNumber: booking.vehicleNumber,
          customerName: booking.customerName
        }
      }, 'New OTP generated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active bookings
   * @route GET /api/bookings/active
   */
  async getActiveBookings(req, res, next) {
    try {
      const bookings = await bookingService.getActiveBookings();

      responseHandler.success(res, { bookings }, 'Active bookings retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Search bookings
   * @route GET /api/bookings/search
   */
  async searchBookings(req, res, next) {
    try {
      const { q: query, filter = 'all' } = req.query;

      if (!query || query.trim().length < 2) {
        return responseHandler.badRequest(res, 'Search query must be at least 2 characters');
      }

      const bookings = await bookingService.searchBookings(query.trim(), filter);

      responseHandler.success(res, { bookings }, 'Bookings search completed');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get booking statistics
   * @route GET /api/bookings/stats
   */
  async getBookingStats(req, res, next) {
    try {
      const { dateFrom, dateTo } = req.query;
      
      // Default to today if no dates provided
      const today = new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(today.setHours(0, 0, 0, 0));
      const endDate = dateTo ? new Date(dateTo) : new Date(today.setHours(23, 59, 59, 999));

      const stats = await bookingService.getBookingStats(startDate, endDate);

      responseHandler.success(res, { stats }, 'Booking statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bookings by machine
   * @route GET /api/bookings/machine/:machineNumber
   */
  async getBookingsByMachine(req, res, next) {
    try {
      const { machineNumber } = req.params;
      const { status = 'active' } = req.query;

      const bookings = await bookingService.getBookingsByMachine(machineNumber, status);

      responseHandler.success(res, { bookings }, `Bookings for machine ${machineNumber} retrieved successfully`);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bookings by vehicle
   * @route GET /api/bookings/vehicle/:vehicleNumber
   */
  async getBookingsByVehicle(req, res, next) {
    try {
      const { vehicleNumber } = req.params;

      const bookings = await bookingService.getBookingsByVehicle(vehicleNumber);

      responseHandler.success(res, { bookings }, `Bookings for vehicle ${vehicleNumber} retrieved successfully`);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Extend booking time
   * @route POST /api/bookings/:id/extend
   */
  async extendBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { hours = 0, minutes = 0, reason } = req.body;
      const extendedBy = req.user._id;

      if (hours === 0 && minutes === 0) {
        return responseHandler.badRequest(res, 'Extension time must be provided');
      }

      const booking = await bookingService.extendBooking(id, { hours, minutes, reason }, extendedBy);

      responseHandler.success(res, { booking }, 'Booking extended successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for booking service
   * @route GET /api/bookings/health
   */
  async healthCheck(req, res, next) {
    try {
      const activeBookingsCount = await bookingService.getActiveBookingsCount();

      responseHandler.success(res, {
        service: 'booking',
        status: 'healthy',
        activeBookings: activeBookingsCount,
        timestamp: new Date().toISOString()
      }, 'Booking service is healthy');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();