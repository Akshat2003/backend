const mongoose = require('mongoose');
const Machine = require('../models/Machine');
const Site = require('../models/Site');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { MACHINE_STATUS, PALLET_STATUS } = require('../utils/constants');

// Helper function to create errors
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

class MachineService {
  /**
   * Create new machine
   */
  async createMachine(machineData, createdBy) {
    try {
      // Validate siteId format
      if (!machineData.siteId || !mongoose.isValidObjectId(machineData.siteId)) {
        throw createError('Invalid site ID format', 400);
      }

      // Validate site exists
      const site = await Site.findById(machineData.siteId);
      if (!site) {
        throw createError('Site not found', 404);
      }

      // Check if machine number already exists at this site
      const existingMachine = await Machine.findOne({ 
        siteId: machineData.siteId, 
        machineNumber: machineData.machineNumber.toUpperCase() 
      });
      if (existingMachine) {
        throw createError('Machine number already exists at this site', 409);
      }

      // Set default supported vehicle types based on machine type
      if (!machineData.specifications) {
        machineData.specifications = {};
      }
      
      if (!machineData.specifications.supportedVehicleTypes) {
        machineData.specifications.supportedVehicleTypes = [machineData.machineType];
      }

      const machine = new Machine({
        ...machineData,
        machineNumber: machineData.machineNumber.toUpperCase(),
        createdBy
      });

      await machine.save();

      logger.info('Machine created successfully', {
        machineId: machine._id,
        machineNumber: machine.machineNumber,
        machineType: machine.machineType,
        siteId: machine.siteId,
        createdBy
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Machine creation failed:', error);
      throw error;
    }
  }

  /**
   * Get machines with filters and pagination
   */
  async getMachines(filters = {}, pagination = {}, sorting = {}) {
    try {
      const {
        siteId,
        machineType,
        status,
        search,
        availability
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

      if (siteId) {
        query.siteId = siteId;
      }

      if (machineType) {
        query.machineType = machineType;
      }

      if (status) {
        query.status = status;
      }

      if (availability === 'available') {
        query.status = MACHINE_STATUS.ONLINE;
        query['capacity.available'] = { $gt: 0 };
      }

      if (search) {
        query.$or = [
          { machineNumber: { $regex: search, $options: 'i' } },
          { machineName: { $regex: search, $options: 'i' } },
          { 'location.building': { $regex: search, $options: 'i' } },
          { 'location.zone': { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const [machines, total] = await Promise.all([
        Machine.find(query)
          .populate('siteId', 'siteId siteName location.address.city')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Machine.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info('Machines retrieved successfully', {
        count: machines.length,
        total,
        page,
        totalPages,
        filters
      });

      return {
        machines: machines.map(machine => this.sanitizeMachine(machine)),
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
      logger.error('Get machines failed:', error);
      throw createError('Failed to retrieve machines', 500);
    }
  }

  /**
   * Get machine by ID
   */
  async getMachineById(machineId) {
    try {
      // Validate machineId format
      if (!machineId || !mongoose.isValidObjectId(machineId)) {
        throw createError('Invalid machine ID format', 400);
      }

      const machine = await Machine.findById(machineId)
        .populate('siteId', 'siteId siteName location')
        .populate('pallets.currentBookings.booking', 'bookingNumber customerName vehicleNumber startTime');

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      logger.info('Machine retrieved by ID', { machineId });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Get machine by ID failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw createError('Failed to retrieve machine', 500);
    }
  }

  /**
   * Update machine
   */
  async updateMachine(machineId, updateData, updatedBy) {
    try {
      // Validate machineId format
      if (!machineId || !mongoose.isValidObjectId(machineId)) {
        throw createError('Invalid machine ID format', 400);
      }

      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      // Prevent updating certain fields
      delete updateData.siteId;
      delete updateData.machineNumber;
      delete updateData.pallets;
      delete updateData.createdBy;
      delete updateData.createdAt;

      // Handle warrantyExpiryDate - don't update if null or undefined
      if (updateData.warrantyExpiryDate === null || updateData.warrantyExpiryDate === undefined) {
        delete updateData.warrantyExpiryDate;
      }

      // Update machine
      Object.assign(machine, updateData);
      machine.updatedBy = updatedBy;

      await machine.save();

      logger.info('Machine updated successfully', {
        machineId,
        updatedBy
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Update machine failed:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw createError(error.message || 'Failed to update machine', error.statusCode || 500);
    }
  }

  /**
   * Get available machines for specific vehicle type
   */
  async getAvailableMachines(vehicleType, siteId = null) {
    try {
      const machines = await Machine.findAvailable(vehicleType, siteId)
        .populate('siteId', 'siteId siteName');

      const availableMachines = machines.map(machine => {
        const availablePallet = machine.findAvailablePallet(vehicleType);
        return {
          ...this.sanitizeMachine(machine),
          availablePallet
        };
      }).filter(machine => machine.availablePallet);

      logger.info('Available machines retrieved', {
        vehicleType,
        siteId,
        count: availableMachines.length
      });

      return availableMachines;

    } catch (error) {
      logger.error('Get available machines failed:', error);
      throw createError('Failed to retrieve available machines', 500);
    }
  }

  /**
   * Occupy pallet with vehicle
   */
  async occupyPallet(machineId, palletNumber, bookingId, vehicleNumber, position = null) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      if (machine.status !== MACHINE_STATUS.ONLINE) {
        throw createError('Machine is not online', 400);
      }

      await machine.occupyPallet(palletNumber, bookingId, vehicleNumber, position);

      logger.info('Pallet occupied successfully', {
        machineId,
        palletNumber,
        bookingId,
        vehicleNumber,
        position
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Occupy pallet failed:', error.message);
      throw createError(error.message, 400);
    }
  }

  /**
   * Release pallet
   */
  async releasePallet(machineId, palletNumber, bookingId) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      await machine.releasePallet(palletNumber, bookingId);

      logger.info('Pallet released successfully', {
        machineId,
        palletNumber,
        bookingId
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Release pallet failed:', error.message);
      throw createError(error.message, 400);
    }
  }

  /**
   * Release vehicle from pallet
   */
  async releaseVehicle(machineId, palletNumber, vehicleNumber) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      await machine.releaseVehicle(palletNumber, vehicleNumber);

      logger.info('Vehicle released successfully', {
        machineId,
        palletNumber,
        vehicleNumber
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Release vehicle failed:', error.message);
      throw createError(error.message, 400);
    }
  }

  /**
   * Set pallet maintenance
   */
  async setPalletMaintenance(machineId, palletNumber, maintenanceNotes, updatedBy) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      await machine.setPalletMaintenance(palletNumber, maintenanceNotes);
      machine.updatedBy = updatedBy;
      await machine.save();

      logger.info('Pallet set to maintenance', {
        machineId,
        palletNumber,
        updatedBy
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Set pallet maintenance failed:', error.message);
      throw createError(error.message, 400);
    }
  }

  /**
   * Get machine statistics
   */
  async getMachineStatistics(machineId) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      // Calculate additional statistics
      const totalVehicleCapacity = machine.pallets.reduce((sum, pallet) => 
        sum + pallet.vehicleCapacity, 0
      );

      const currentOccupancy = machine.pallets.reduce((sum, pallet) => 
        sum + pallet.currentOccupancy, 0
      );

      const occupancyRate = totalVehicleCapacity > 0 ? 
        Math.round((currentOccupancy / totalVehicleCapacity) * 100) : 0;

      const statistics = {
        ...machine.statistics,
        totalVehicleCapacity,
        currentOccupancy,
        occupancyRate: occupancyRate,
        palletUtilization: machine.pallets.map(pallet => ({
          palletNumber: pallet.number,
          capacity: pallet.vehicleCapacity,
          occupied: pallet.currentOccupancy,
          utilizationRate: pallet.vehicleCapacity > 0 ? 
            Math.round((pallet.currentOccupancy / pallet.vehicleCapacity) * 100) : 0,
          status: pallet.status
        }))
      };

      logger.info('Machine statistics retrieved', { machineId });

      return statistics;

    } catch (error) {
      logger.error('Get machine statistics failed:', error);
      throw createError('Failed to retrieve machine statistics', 500);
    }
  }

  /**
   * Update machine heartbeat
   */
  async updateHeartbeat(machineId, heartbeatData = {}) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      machine.integration.lastHeartbeat = new Date();
      machine.integration.connectionStatus = 'connected';

      if (heartbeatData.firmwareVersion) {
        machine.integration.firmwareVersion = heartbeatData.firmwareVersion;
      }

      await machine.save();

      logger.info('Machine heartbeat updated', { machineId });

      return {
        machineId: machine._id,
        lastHeartbeat: machine.integration.lastHeartbeat,
        connectionStatus: machine.integration.connectionStatus,
        isOnline: machine.isOnline
      };

    } catch (error) {
      logger.error('Update heartbeat failed:', error);
      throw createError('Failed to update heartbeat', 500);
    }
  }

  /**
   * Get machines needing maintenance
   */
  async getMaintenanceDue(siteId = null) {
    try {
      const query = {
        $or: [
          { 'maintenance.nextServiceDue': { $lte: new Date() } },
          { 'pallets.status': PALLET_STATUS.MAINTENANCE }
        ],
        status: { $ne: MACHINE_STATUS.MAINTENANCE }
      };

      if (siteId) {
        query.siteId = siteId;
      }

      const machines = await Machine.find(query)
        .populate('siteId', 'siteId siteName');

      logger.info('Maintenance due machines retrieved', {
        count: machines.length,
        siteId
      });

      return machines.map(machine => this.sanitizeMachine(machine));

    } catch (error) {
      logger.error('Get maintenance due machines failed:', error);
      throw createError('Failed to retrieve maintenance due machines', 500);
    }
  }

  /**
   * Deactivate machine
   */
  async deactivateMachine(machineId, reason, updatedBy) {
    try {
      const machine = await Machine.findById(machineId);

      if (!machine) {
        throw createError('Machine not found', 404);
      }

      // Check if machine has active bookings
      const hasActiveBookings = machine.pallets.some(pallet => 
        pallet.currentBookings.length > 0
      );

      if (hasActiveBookings) {
        throw createError('Cannot deactivate machine with active bookings', 400);
      }

      machine.status = MACHINE_STATUS.OFFLINE;
      machine.updatedBy = updatedBy;

      await machine.save();

      logger.info('Machine deactivated', {
        machineId,
        reason,
        updatedBy
      });

      return this.sanitizeMachine(machine);

    } catch (error) {
      logger.error('Deactivate machine failed:', error.message);
      if (error instanceof AppError) {
        throw error;
      }
      throw createError('Failed to deactivate machine', 500);
    }
  }

  /**
   * Remove sensitive data from machine object
   */
  sanitizeMachine(machine) {
    if (!machine || typeof machine !== 'object') {
      return machine;
    }

    const sanitized = {
      _id: machine._id,
      siteId: machine.siteId,
      machineNumber: machine.machineNumber,
      machineName: machine.machineName,
      machineType: machine.machineType,
      status: machine.status,
      capacity: machine.capacity,
      pallets: machine.pallets ? machine.pallets.map(pallet => ({
        number: pallet.number,
        status: pallet.status,
        vehicleCapacity: pallet.vehicleCapacity,
        currentOccupancy: pallet.currentOccupancy,
        currentBookings: pallet.currentBookings,
        occupiedSince: pallet.occupiedSince,
        lastMaintenance: pallet.lastMaintenance,
        maintenanceNotes: pallet.maintenanceNotes
      })) : [],
      specifications: machine.specifications,
      location: machine.location,
      operatingHours: machine.operatingHours,
      pricing: machine.pricing,
      maintenance: machine.maintenance,
      statistics: machine.statistics,
      integration: {
        lastHeartbeat: machine.integration?.lastHeartbeat,
        connectionStatus: machine.integration?.connectionStatus,
        firmwareVersion: machine.integration?.firmwareVersion
      },
      installationDate: machine.installationDate,
      warrantyExpiryDate: machine.warrantyExpiryDate,
      vendor: machine.vendor,
      createdAt: machine.createdAt,
      updatedAt: machine.updatedAt,
      // Virtuals
      occupancyRate: machine.occupancyRate,
      isOnline: machine.isOnline,
      needsMaintenance: machine.needsMaintenance
    };

    return sanitized;
  }
}

module.exports = new MachineService();