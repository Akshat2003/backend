const siteService = require('../services/siteService');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

class SiteController {
  /**
   * Create new site
   * @route POST /api/sites
   */
  async createSite(req, res, next) {
    try {
      const siteData = req.body;
      const createdBy = req.user._id;

      const site = await siteService.createSite(siteData, createdBy);

      responseHandler.created(res, { site }, 'Site created successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sites with filters and pagination
   * @route GET /api/sites
   */
  async getSites(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        status,
        city,
        state
      } = req.query;

      const filters = {
        search,
        status,
        city,
        state
      };

      // For non-admin users, filter sites based on their assigned sites
      if (req.user.role !== 'admin') {
        filters.userSites = req.user.assignedSites.map(assignment => assignment.site);
      }

      const result = await siteService.getSites(
        filters,
        { page: parseInt(page), limit: parseInt(limit) },
        { sortBy, sortOrder }
      );

      responseHandler.success(res, result, 'Sites retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get site by ID
   * @route GET /api/sites/:id
   */
  async getSiteById(req, res, next) {
    try {
      const { id } = req.params;

      // Check if user has access to this site
      if (req.user.role !== 'admin') {
        const hasAccess = req.user.assignedSites.some(
          assignment => assignment.site.toString() === id
        );
        if (!hasAccess) {
          return responseHandler.forbidden(res, 'Access denied to this site');
        }
      }

      const site = await siteService.getSiteById(id);

      responseHandler.success(res, { site }, 'Site retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update site details
   * @route PUT /api/sites/:id
   */
  async updateSite(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedBy = req.user._id;

      // Check if user has access to this site
      if (req.user.role !== 'admin') {
        const hasAccess = req.user.assignedSites.some(
          assignment => assignment.site.toString() === id && 
          ['site-admin', 'supervisor'].includes(assignment.role)
        );
        if (!hasAccess) {
          return responseHandler.forbidden(res, 'Insufficient permissions to update this site');
        }
      }

      const site = await siteService.updateSite(id, updateData, updatedBy);

      responseHandler.success(res, { site }, 'Site updated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate site
   * @route DELETE /api/sites/:id
   */
  async deactivateSite(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updatedBy = req.user._id;

      const site = await siteService.deactivateSite(id, reason, updatedBy);

      responseHandler.success(res, { site }, 'Site deactivated successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get site statistics
   * @route GET /api/sites/:id/statistics
   */
  async getSiteStatistics(req, res, next) {
    try {
      const { id } = req.params;

      // Check if user has access to this site
      if (req.user.role !== 'admin') {
        const hasAccess = req.user.assignedSites.some(
          assignment => assignment.site.toString() === id
        );
        if (!hasAccess) {
          return responseHandler.forbidden(res, 'Access denied to this site');
        }
      }

      const statistics = await siteService.getSiteStatistics(id);

      responseHandler.success(res, { statistics }, 'Site statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sites assigned to current user
   * @route GET /api/sites/my-sites
   */
  async getMySites(req, res, next) {
    try {
      const userId = req.user._id;

      const sites = await siteService.getUserSites(userId);

      responseHandler.success(res, { sites }, 'User sites retrieved successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign user to site
   * @route POST /api/sites/:id/assign-user
   */
  async assignUserToSite(req, res, next) {
    try {
      const { id: siteId } = req.params;
      const { userId, role, permissions } = req.body;
      const assignedBy = req.user._id;

      const result = await siteService.assignUserToSite(
        siteId, 
        userId, 
        role, 
        permissions, 
        assignedBy
      );

      responseHandler.success(res, result, 'User assigned to site successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove user from site
   * @route DELETE /api/sites/:id/users/:userId
   */
  async removeUserFromSite(req, res, next) {
    try {
      const { id: siteId, userId } = req.params;
      const removedBy = req.user._id;

      await siteService.removeUserFromSite(siteId, userId, removedBy);

      responseHandler.success(res, {}, 'User removed from site successfully');

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get site users
   * @route GET /api/sites/:id/users
   */
  async getSiteUsers(req, res, next) {
    try {
      const { id } = req.params;

      // Check if user has access to this site
      if (req.user.role !== 'admin') {
        const hasAccess = req.user.assignedSites.some(
          assignment => assignment.site.toString() === id &&
          ['site-admin', 'supervisor'].includes(assignment.role)
        );
        if (!hasAccess) {
          return responseHandler.forbidden(res, 'Access denied to view site users');
        }
      }

      const users = await siteService.getSiteUsers(id);

      responseHandler.success(res, { users }, 'Site users retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SiteController();