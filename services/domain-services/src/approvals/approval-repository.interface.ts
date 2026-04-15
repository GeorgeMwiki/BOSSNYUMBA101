/**
 * Approval Repository Interface
 * Data access for approval requests and policies
 */

import type { TenantId, UserId } from '@bossnyumba/domain-models';
import type {
  ApprovalRequest,
  ApprovalRequestId,
  ApprovalPolicy,
  ApprovalType,
  ApprovalHistoryFilters,
} from './types.js';

/**
 * Local pagination shape used by approvals. This deliberately uses
 * page/pageSize rather than the canonical limit/offset shape in
 * @bossnyumba/domain-models; the approval-service public API surfaces
 * page metadata directly and conversion would add churn without value.
 */
export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface ApprovalRequestRepository {
  findById(id: ApprovalRequestId, tenantId: TenantId): Promise<ApprovalRequest | null>;
  findPendingByApprover(approverId: UserId, tenantId: TenantId): Promise<readonly ApprovalRequest[]>;
  findHistory(tenantId: TenantId, filters: ApprovalHistoryFilters, pagination?: PaginationParams): Promise<PaginatedResult<ApprovalRequest>>;
  create(request: ApprovalRequest): Promise<ApprovalRequest>;
  update(request: ApprovalRequest): Promise<ApprovalRequest>;
}

export interface ApprovalPolicyRepository {
  findByTenantAndType(tenantId: TenantId, type: ApprovalType): Promise<ApprovalPolicy | null>;
  save(policy: ApprovalPolicy): Promise<ApprovalPolicy>;
}
