# Migration Scripts

## Archived Scripts

### migrate-memberships-to-vehicles.js.archived
This script was used to migrate the legacy customer-level membership system to the new vehicle-based membership system. It has been archived as it's no longer needed since the legacy system has been completely removed.

The script is kept for reference purposes only and should not be executed.

## Migration History

- **Legacy System**: Customer-level memberships stored in `customer.membership`
- **Current System**: Vehicle-level memberships stored in `customer.vehicles[].membership`
- **Migration Date**: This migration was used during the transition period
- **Cleanup Date**: Legacy system completely removed from codebase