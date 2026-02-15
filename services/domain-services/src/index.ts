/**
 * @bossnyumba/domain-services
 *
 * Core domain services for the BOSSNYUMBA platform.
 * Implements business logic and data persistence with tenant isolation.
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
export * from './lease/index.js';

// Invoice services - generate, send, getOutstanding
export * from './invoice/index.js';

// Payment services
export * from './payment/index.js';

// Maintenance services - createRequest, dispatch, complete
export * from './maintenance/index.js';

// Document services - upload, verify, getEvidencePack
export * from './document/index.js';

// Report services - getDashboard, getStatement, exportPdf
export * from './report/index.js';

// Feedback services
export * from './feedback/index.js';

// Inspection services
export * from './inspections/index.js';

// Scheduling services
export * from './scheduling/index.js';

// Approval workflow services
export * from './approvals/index.js';

// Utilities tracking services
export * from './utilities/index.js';

// Audit logging services
export * from './audit/index.js';

// Messaging/Chat services
export * from './messaging/index.js';

// Compliance/Legal services
export * from './compliance/index.js';

// Case management services
export * from './cases/index.js';

// Vendor management services
export * from './vendor/index.js';
