/**
 * Repository exports for BOSSNYUMBA database
 */

export {
  buildPaginatedResult,
  DEFAULT_PAGINATION,
} from './base.repository.js';

export { TenantRepository, UserRepository } from './tenant.repository.js';
export { PropertyRepository, UnitRepository } from './property.repository.js';
export {
  CustomerRepository,
  type CustomerFilters,
} from './customer.repository.js';
export {
  LeaseRepository,
  type LeaseFilters,
} from './lease.repository.js';
export {
  InvoiceRepository,
  PaymentRepository,
  TransactionRepository,
} from './payment.repository.js';
export {
  WorkOrderRepository,
  VendorRepository,
} from './maintenance.repository.js';
export { InspectionRepository } from './inspection.repository.js';
export { MessagingRepository } from './messaging.repository.js';
export { SchedulingRepository } from './scheduling.repository.js';
export { UtilitiesRepository } from './utilities.repository.js';
export { ComplianceRepository, DocumentRepository } from './compliance.repository.js';

// Operations — dispatch events, completion proofs, vendor assignments
export {
  DispatchEventRepository,
  CompletionProofRepository,
  VendorAssignmentRepository,
} from './operations.repository.js';

// Brain — Thread Store + HR
export { BrainThreadRepository } from './brain-thread.repository.js';
export type {
  BrainThread,
  BrainThreadEvent,
} from './brain-thread.repository.js';
export {
  DepartmentRepository,
  TeamRepository,
  EmployeeRepository,
  AssignmentRepository,
  PerformanceRepository,
  type EmployeeRankingRow,
} from './hr.repository.js';
