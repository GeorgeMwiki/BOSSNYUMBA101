/**
 * property-management vertical — public surface.
 */

export { PROPERTY_MANAGEMENT_PACK } from './pack.js';
export {
  PM_ENTITY_TYPES,
  type PmEntityType,
  type MaintenanceCategory,
  type MaintenanceSeverity,
  type MaintenanceTicket,
  type VendorCandidate,
} from './entities.js';
export {
  createMaintenanceDispatch,
  createMaintenanceVendorSelector,
  defaultClassifier,
  vendorToDispatchCandidate,
  type MaintenanceDispatchSubMd,
  type MaintenanceClassification,
  type CreateMaintenanceDispatchArgs,
} from './maintenance-dispatch.js';
