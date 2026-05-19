/**
 * bossnyumba-internal vertical — public surface.
 */

export { BOSSNYUMBA_INTERNAL_PACK } from './pack.js';
export {
  INTERNAL_ENTITY_TYPES,
  type InternalEntityType,
  type CandidateSubmission,
  type RecruiterCandidate,
  type RoleFamily,
  type SeniorityBand,
  type ChurnSignal,
  type ChurnSignalKind,
  type OwnerAccount,
  type CsTouchpoint,
  type PayrollLedgerRow,
  type InternalInvoice,
  type InternalPayment,
  type OpsIncident,
  type OncallTeamMember,
  type IncidentSurface,
} from './entities.js';
export {
  createHrDispatch,
  createHrTriageStrategy,
  createHrRecruiterSelector,
  recruiterToDispatchCandidate,
  type HrDispatchSubMd,
  type CreateHrDispatchArgs,
  type RecruiterPick,
  type RecruiterRouteLabel,
} from './hr-dispatch.js';
export {
  createSalesChase,
  DEFAULT_SALES_CHASE_LADDER,
  type SalesChaseSubMd,
  type CreateSalesChaseArgs,
} from './sales-chase.js';
export {
  createCustomerSuccessCompile,
  createCsCompileStrategy,
  computeCompositeRisk,
  bandFromScore,
  type CustomerSuccessCompileSubMd,
  type CreateCustomerSuccessCompileArgs,
  type CsCompileInput,
  type CsBrief,
  type CsBriefOwnerRow,
  type CsRiskBand,
  type CohortAnomaly,
} from './customer-success-compile.js';
export {
  createPayrollCompile,
  createPayrollCompileStrategy,
  type PayrollCompileSubMd,
  type PayrollCompileStrategyOptions,
  type PayRunSummary,
} from './payroll-compile.js';
export {
  createVendorReconcile,
  createVendorReconcileStrategy,
  type VendorReconcileSubMd,
  type VendorReconcileStrategyOptions,
} from './vendor-reconcile.js';
export {
  createIncidentTriage,
  createIncidentTriageStrategy,
  type IncidentTriageSubMd,
  type IncidentTriageOptions,
  type IncidentClassification,
  type IncidentSeverity,
} from './incident-triage.js';
