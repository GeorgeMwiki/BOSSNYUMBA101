/**
 * @bossnyumba/domain-services
 *
 * Core domain services for the BOSSNYUMBA platform.
 * Implements business logic and data persistence with tenant isolation.
 *
 * NOTE: Some sub-modules have overlapping export names. To avoid TS2308
 * ambiguous re-export errors, conflicting modules are not re-exported here.
 * Import directly from the sub-module path instead (e.g., './cases/index.js').
 */

// Common infrastructure
export * from './common/index.js';

// Tenant services - create, update, getPolicyConstitution
export * from './tenant/index.js';

// Identity services
export * from './identity/index.js';

// Property services - CRUD, getOccupancy, getUnits
export * from './property/index.js';

// Customer services - onboard, updateProfile, getTimeline
export * from './customer/index.js';

// Lease services - create, renew, terminate, getActive
// NOTE: CustomerCreatedEvent/CustomerRepository conflicts with customer - import from './lease/index.js' directly

// Invoice services - generate, send, getOutstanding
export * from './invoice/index.js';

// Payment services
// NOTE: Invoice/RecordPaymentInput conflicts with invoice module - import from './payment/index.js' directly

// Maintenance services - createRequest, dispatch, complete
export * from './maintenance/index.js';

// Document services - upload, verify, getEvidencePack
export * from './document/index.js';

// Report services - getDashboard, getStatement, exportPdf
export * from './report/index.js';

// Feedback services
export * from './feedback/index.js';

// Inspection services
// NOTE: ConditionRating conflicts with lease - import from './inspections/index.js' directly

// Scheduling services
export * from './scheduling/index.js';

// Approval workflow services
export * from './approvals/index.js';

// Utilities tracking services
export * from './utilities/index.js';

// Audit logging services
// NOTE: AuditService/DateRange conflicts - import from './audit/index.js' directly

// Messaging/Chat services
export * from './messaging/index.js';

// Compliance/Legal services
// NOTE: CaseStatus/NoticeType/CustomerId conflicts - import from './compliance/index.js' directly

// Case management services
// NOTE: CaseStatus/NoticeType/CustomerId conflicts - import from './cases/index.js' directly

// Vendor management services
// NOTE: VendorContact/VendorStatus conflicts with maintenance - import from './vendor/index.js' directly
