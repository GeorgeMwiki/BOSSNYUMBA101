/**
 * Operations domain models
 *
 * `common/types` and `common/enums` own canonical Brand types
 * (AssetId, asAssetId) and status enums (DispatchStatus,
 * MaintenanceRequestStatus). Sub-modules redeclare them locally; we
 * re-export selectively so `from '@bossnyumba/domain-models'` exposes one
 * canonical name with no TS2308 ambiguity.
 *
 * `dual-signoff` and `completion-proof` both export `addTechnicianSignature`
 * and `markExpired`; the dual-signoff-specific versions are re-exported
 * under aliased names.
 */

// ---- Maintenance requests ------------------------------------------------
export {
  MaintenanceRequestSchema,
  MaintenanceRequestPrioritySchema,
  MaintenanceRequestCategorySchema,
  MaintenanceRequestSourceSchema,
  AttachmentSchema,
  type MaintenanceRequest,
  type MaintenanceRequestData,
  type MaintenanceRequestPriority,
  type MaintenanceRequestCategory,
  type MaintenanceRequestSource,
  type Attachment,
  createMaintenanceRequest,
  acknowledgeRequest,
  triageRequest,
  scheduleRequest,
  linkWorkOrder,
  completeRequest,
  addCustomerFeedback,
  cancelRequest,
  rejectRequest,
  generateRequestNumber,
} from './maintenance-request';

// ---- Dispatch events (DispatchStatus / DispatchStatusSchema canonical in
// common/enums; startWork canonical in maintenance/work-order. Re-export
// the dispatch-specific symbols selectively.) -----------------------------
export {
  DispatchTypeSchema,
  LocationUpdateSchema,
  DispatchEventSchema,
  type DispatchType,
  type LocationUpdate,
  type DispatchEvent,
  type DispatchEventData,
  createDispatchEvent,
  dispatchTechnician,
  markEnRoute,
  recordArrival,
  startWork as startDispatchWork,
  completeDispatch,
  addLocationUpdate,
  cancelDispatch,
  rescheduleDispatch,
  markNoShow,
} from './dispatch-event';

// ---- Completion proofs ---------------------------------------------------
export * from './completion-proof';

// ---- Dual sign-off (selective; aliases collisions) ----------------------
export {
  DualSignoffSchema,
  DualSignoffStatusSchema,
  RefusalReasonSchema,
  SatisfactionLevelSchema,
  SignatureDetailsSchema,
  type DualSignoff,
  type DualSignoffData,
  type DualSignoffId,
  type DualSignoffStatus,
  type RefusalReason,
  type SatisfactionLevel,
  type SignatureDetails,
  asDualSignoffId,
  createDualSignoff,
} from './dual-signoff';

// ---- Assets (AssetId / asAssetId canonical in common/types) -------------
export {
  AssetCategorySchema,
  DepreciationMethodSchema,
  AssetSpecificationSchema,
  MaintenanceScheduleSchema,
  MaintenanceRecordSchema,
  WarrantyInfoSchema,
  AssetSchema,
  type AssetCategory,
  type DepreciationMethod,
  type AssetSpecification,
  type MaintenanceSchedule,
  type MaintenanceRecord,
  type WarrantyInfo,
  type Asset,
  type AssetData,
  createAsset,
  updateCondition,
  addMaintenanceRecord,
  setMaintenanceSchedule,
  calculateNextMaintenanceDate,
  retireAsset,
  disposeAsset,
  isMaintenanceDue,
  isWarrantyValid,
  calculateDepreciation,
  addPhoto,
  generateAssetCode,
} from './asset';
