const machineService = require('../services/machineService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

class MachineController {
  /**
   * Create new machine
   * @route POST /api/machines
   */
  async createMachine(req, res, next) {
    try {
      const machineData = req.body;
      const createdBy = req.user._id;

      const machine = await machineService.createMachine(machineData, createdBy);

      responseHandler.created(res, { machine }, 'Machine created successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machines with filters and pagination
   * @route GET /api/machines
   */
  async getMachines(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        siteId,
        machineType,
        status,
        search,
        availability
      } = req.query;

      const filters = {
        siteId,
        machineType,
        status,
        search,
        availability
      };

      // For non-admin users, filter machines based on their assigned sites
      if (req.user.role !== 'admin' && !siteId) {
        const userSiteIds = req.user.assignedSites?.map(assignment => assignment.site._id || assignment.site) || [];
        if (req.user.primarySite) {
          userSiteIds.push(req.user.primarySite._id || req.user.primarySite);
        }
        
        if (userSiteIds.length > 0) {
          filters.siteId = { $in: userSiteIds };
        } else {
          // User has no assigned sites
          return responseHandler.success(res, { 
            machines: [], 
            pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: limit }
          }, 'No machines found');
        }
      }

      const result = await machineService.getMachines(
        filters,
        { page: parseInt(page), limit: parseInt(limit) },
        { sortBy, sortOrder }
      );

      responseHandler.success(res, result, 'Machines retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machine by ID
   * @route GET /api/machines/:id
   */
  async getMachineById(req, res, next) {
    try {
      const { id } = req.params;

      const machine = await machineService.getMachineById(id);

      // Check if user has access to this machine's site
      if (req.user.role !== 'admin') {
        const userSiteIds = req.user.assignedSites?.map(assignment => 
          (assignment.site._id || assignment.site).toString()
        ) || [];
        
        if (req.user.primarySite) {
          userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
        }

        const machineSiteId = (machine.siteId._id || machine.siteId).toString();
        
        if (!userSiteIds.includes(machineSiteId)) {
          return responseHandler.forbidden(res, 'Access denied to this machine');
        }
      }

      responseHandler.success(res, { machine }, 'Machine retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update machine
   * @route PUT /api/machines/:id
   */
  async updateMachine(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user._id;

      // Check permissions (similar to getMachineById)
      if (req.user.role !== 'admin') {
        const machine = await machineService.getMachineById(id);
        const userSiteIds = req.user.assignedSites?.map(assignment => 
          (assignment.site._id || assignment.site).toString()
        ) || [];
        
        if (req.user.primarySite) {
          userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
        }

        const machineSiteId = (machine.siteId._id || machine.siteId).toString();
        
        if (!userSiteIds.includes(machineSiteId)) {
          return responseHandler.forbidden(res, 'Access denied to update this machine');
        }
      }

      const machine = await machineService.updateMachine(id, updateData, updatedBy);

      responseHandler.success(res, { machine }, 'Machine updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available machines for booking
   * @route GET /api/machines/available
   */
  async getAvailableMachines(req, res, next) {
    try {
      const { vehicleType, siteId } = req.query;

      if (!vehicleType) {
        return responseHandler.badRequest(res, 'Vehicle type is required');
      }

      // For non-admin users, restrict to their assigned sites
      let targetSiteId = siteId;
      if (req.user.role !== 'admin') {
        if (!siteId) {
          // Use user's primary site or first assigned site
          if (req.user.primarySite) {
            targetSiteId = req.user.primarySite._id || req.user.primarySite;
          } else if (req.user.assignedSites?.length > 0) {
            targetSiteId = req.user.assignedSites[0].site._id || req.user.assignedSites[0].site;
          } else {
            return responseHandler.badRequest(res, 'User must be assigned to a site');
          }
        } else {
          // Verify user has access to requested site
          const userSiteIds = req.user.assignedSites?.map(assignment => 
            (assignment.site._id || assignment.site).toString()
          ) || [];
          
          if (req.user.primarySite) {
            userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
          }

          if (!userSiteIds.includes(siteId)) {
            return responseHandler.forbidden(res, 'Access denied to this site');
          }
        }
      }

      const machines = await machineService.getAvailableMachines(vehicleType, targetSiteId);

      responseHandler.success(res, { machines }, 'Available machines retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machine pallet status
   * @route GET /api/machines/:id/pallets
   */
  async getMachinePallets(req, res, next) {
    try {
      const { id } = req.params;

      const machine = await machineService.getMachineById(id);

      // Check access permissions
      if (req.user.role !== 'admin') {
        const userSiteIds = req.user.assignedSites?.map(assignment => 
          (assignment.site._id || assignment.site).toString()
        ) || [];
        
        if (req.user.primarySite) {
          userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
        }

        const machineSiteId = (machine.siteId._id || machine.siteId).toString();
        
        if (!userSiteIds.includes(machineSiteId)) {
          return responseHandler.forbidden(res, 'Access denied to this machine');
        }
      }

      const pallets = machine.pallets || [];

      responseHandler.success(res, { pallets }, 'Machine pallets retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Occupy pallet
   * @route POST /api/machines/:id/pallets/:palletNumber/occupy
   */
  async occupyPallet(req, res, next) {
    try {
      const { id, palletNumber } = req.params;
      const { bookingId, vehicleNumber, position } = req.body;

      if (!bookingId || !vehicleNumber) {
        return responseHandler.badRequest(res, 'Booking ID and vehicle number are required');
      }

      const machine = await machineService.occupyPallet(
        id,
        parseInt(palletNumber),
        bookingId,
        vehicleNumber,
        position ? parseInt(position) : null
      );

      responseHandler.success(res, { machine }, 'Pallet occupied successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Release pallet
   * @route POST /api/machines/:id/pallets/:palletNumber/release
   */
  async releasePallet(req, res, next) {
    try {
      const { id, palletNumber } = req.params;
      const { bookingId } = req.body;

      if (!bookingId) {
        return responseHandler.badRequest(res, 'Booking ID is required');
      }

      const machine = await machineService.releasePallet(
        id,
        parseInt(palletNumber),
        bookingId
      );

      responseHandler.success(res, { machine }, 'Pallet released successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Release vehicle from pallet
   * @route POST /api/machines/:id/pallets/:palletNumber/release-vehicle
   */
  async releaseVehicle(req, res, next) {
    try {
      const { id, palletNumber } = req.params;
      const { vehicleNumber } = req.body;

      if (!vehicleNumber) {
        return responseHandler.badRequest(res, 'Vehicle number is required');
      }

      const machine = await machineService.releaseVehicle(
        id,
        parseInt(palletNumber),
        vehicleNumber
      );

      responseHandler.success(res, { machine }, 'Vehicle released successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Set pallet maintenance
   * @route POST /api/machines/:id/pallets/:palletNumber/maintenance
   */
  async setPalletMaintenance(req, res, next) {
    try {
      const { id, palletNumber } = req.params;
      const { maintenanceNotes } = req.body;
      const updatedBy = req.user._id;

      const machine = await machineService.setPalletMaintenance(
        id,
        parseInt(palletNumber),
        maintenanceNotes || '',
        updatedBy
      );

      responseHandler.success(res, { machine }, 'Pallet set to maintenance successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machine statistics
   * @route GET /api/machines/:id/statistics
   */
  async getMachineStatistics(req, res, next) {
    try {
      const { id } = req.params;

      // Check access permissions
      const machine = await machineService.getMachineById(id);
      
      if (req.user.role !== 'admin') {
        const userSiteIds = req.user.assignedSites?.map(assignment => 
          (assignment.site._id || assignment.site).toString()
        ) || [];
        
        if (req.user.primarySite) {
          userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
        }

        const machineSiteId = (machine.siteId._id || machine.siteId).toString();
        
        if (!userSiteIds.includes(machineSiteId)) {
          return responseHandler.forbidden(res, 'Access denied to this machine');
        }
      }

      const statistics = await machineService.getMachineStatistics(id);

      responseHandler.success(res, { statistics }, 'Machine statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update machine heartbeat
   * @route POST /api/machines/:id/heartbeat
   */
  async updateHeartbeat(req, res, next) {
    try {
      const { id } = req.params;
      const heartbeatData = req.body;

      const result = await machineService.updateHeartbeat(id, heartbeatData);

      responseHandler.success(res, result, 'Heartbeat updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get machines needing maintenance
   * @route GET /api/machines/maintenance-due
   */
  async getMaintenanceDue(req, res, next) {
    try {
      const { siteId } = req.query;

      // For non-admin users, restrict to their assigned sites
      let targetSiteId = siteId;
      if (req.user.role !== 'admin') {
        if (!siteId) {
          // Get maintenance due machines from all user's assigned sites
          const userSiteIds = req.user.assignedSites?.map(assignment => 
            assignment.site._id || assignment.site
          ) || [];
          
          if (req.user.primarySite) {
            userSiteIds.push(req.user.primarySite._id || req.user.primarySite);
          }

          if (userSiteIds.length === 0) {
            return responseHandler.success(res, { machines: [] }, 'No machines found');
          }

          // For multiple sites, we'll need to query each site
          const allMachines = [];
          for (const sId of userSiteIds) {
            const machines = await machineService.getMaintenanceDue(sId);
            allMachines.push(...machines);
          }

          return responseHandler.success(res, { machines: allMachines }, 'Maintenance due machines retrieved successfully');
        } else {
          // Verify access to requested site
          const userSiteIds = req.user.assignedSites?.map(assignment => 
            (assignment.site._id || assignment.site).toString()
          ) || [];
          
          if (req.user.primarySite) {
            userSiteIds.push((req.user.primarySite._id || req.user.primarySite).toString());
          }

          if (!userSiteIds.includes(siteId)) {
            return responseHandler.forbidden(res, 'Access denied to this site');
          }
        }
      }

      const machines = await machineService.getMaintenanceDue(targetSiteId);

      responseHandler.success(res, { machines }, 'Maintenance due machines retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate machine
   * @route DELETE /api/machines/:id
   */
  async deactivateMachine(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updatedBy = req.user._id;

      const machine = await machineService.deactivateMachine(id, reason, updatedBy);

      responseHandler.success(res, { machine }, 'Machine deactivated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check
   * @route GET /api/machines/health
   */
  async healthCheck(req, res, next) {
    try {
      responseHandler.success(res, {
        service: 'Machine Service',
        status: 'healthy',
        timestamp: new Date().toISOString()
      }, 'Machine service is healthy');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MachineController();