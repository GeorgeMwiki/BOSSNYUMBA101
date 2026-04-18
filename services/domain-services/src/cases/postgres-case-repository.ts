// @ts-nocheck — drizzle-orm typing drift vs schema; matches project convention
/**
 * Postgres-backed Case Repository (Wave 3).
 *
 * Implements the CaseRepository contract against the `cases` table
 * (schemas/cases.schema.ts) with tenant-isolated reads/writes. Denormalises
 * the aggregate (timeline, notices, evidence, resolution) onto the row
 * via a `payload` JSONB column that is added via the amendment migration
 * `0025_repo_amendments.sql` (see this wave).
 *
 * Only the surface required by the case service + SLA worker is
 * implemented here:
 *   - createCase / findById / update
 *   - appendTimelineEvent (append-only)
 *   - findOverdue(tenantId, cutoffDate)
 *
 * Methods not yet required by callers throw NOT_IMPLEMENTED so unused
 * pathways are obvious rather than silently returning stubbed data.
 *
 * Spec: Docs/analysis/SCAFFOLDED_COMPLETION.md §3 (SLA worker).
 */

import { and, eq, lt } from 'drizzle-orm';
import { cases as casesTable } from '@bossnyumba/database';
import type {
  TenantId,
  UserId,
  PaginationParams,
  PaginatedResult,
  ISOTimestamp,
} from '@bossnyumba/domain-models';
import type {
  Case,
  CaseId,
  CaseRepository,
  CaseStatus,
  CaseType,
  CaseSeverity,
  CaseTimelineEvent,
  CustomerId,
  PropertyId,
} from './index.js';
import { asCaseId } from './index.js';

export interface PostgresCaseRepositoryClient {
  select: (...args: unknown[]) => any;
  insert: (...args: unknown[]) => any;
  update: (...args: unknown[]) => any;
}

const CASE_STATUS_TO_DB: Record<CaseStatus, string> = {
  OPEN: 'open',
  IN_PROGRESS: 'investigating',
  PENDING_RESPONSE: 'pending_response',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

const CASE_STATUS_FROM_DB: Record<string, CaseStatus> = {
  open: 'OPEN',
  investigating: 'IN_PROGRESS',
  pending_response: 'PENDING_RESPONSE',
  pending_evidence: 'PENDING_RESPONSE',
  mediation: 'IN_PROGRESS',
  escalated: 'ESCALATED',
  resolved: 'RESOLVED',
  closed: 'CLOSED',
  withdrawn: 'CLOSED',
};

const CASE_TYPE_TO_DB: Record<CaseType, string> = {
  RENT_ARREARS: 'arrears',
  DEPOSIT_DISPUTE: 'deposit_dispute',
  PROPERTY_DAMAGE: 'damage_claim',
  LEASE_VIOLATION: 'lease_violation',
  NOISE_COMPLAINT: 'noise_complaint',
  MAINTENANCE_DISPUTE: 'maintenance_dispute',
  EVICTION: 'eviction',
  OTHER: 'other',
};

const CASE_TYPE_FROM_DB: Record<string, CaseType> = {
  arrears: 'RENT_ARREARS',
  deposit_dispute: 'DEPOSIT_DISPUTE',
  damage_claim: 'PROPERTY_DAMAGE',
  lease_violation: 'LEASE_VIOLATION',
  noise_complaint: 'NOISE_COMPLAINT',
  maintenance_dispute: 'MAINTENANCE_DISPUTE',
  eviction: 'EVICTION',
  harassment: 'OTHER',
  safety_concern: 'OTHER',
  billing_dispute: 'OTHER',
  other: 'OTHER',
};

export class PostgresCaseRepository implements Partial<CaseRepository> {
  constructor(private readonly db: PostgresCaseRepositoryClient) {}

  // -------------------------------------------------------------------------
  // Required by CaseService / SLA worker
  // -------------------------------------------------------------------------

  async createCase(entity: Case): Promise<Case> {
    await this.db.insert(casesTable).values(entityToRow(entity));
    return entity;
  }

  async create(entity: Case): Promise<Case> {
    return this.createCase(entity);
  }

  async findById(id: CaseId, tenantId: TenantId): Promise<Case | null> {
    const rows = await this.db
      .select()
      .from(casesTable)
      .where(
        and(
          eq(casesTable.id, id as unknown as string),
          eq(casesTable.tenantId, tenantId as unknown as string)
        )
      )
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  }

  async update(entity: Case): Promise<Case> {
    await this.db
      .update(casesTable)
      .set(entityToRow(entity))
      .where(
        and(
          eq(casesTable.id, entity.id as unknown as string),
          eq(casesTable.tenantId, entity.tenantId as unknown as string)
        )
      );
    return entity;
  }

  async appendTimelineEvent(
    id: CaseId,
    tenantId: TenantId,
    event: CaseTimelineEvent,
    actor: UserId
  ): Promise<Case | null> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;
    const now = new Date().toISOString() as ISOTimestamp;
    const updated: Case = {
      ...existing,
      timeline: [...existing.timeline, event],
      updatedAt: now,
      updatedBy: actor,
    };
    await this.update(updated);
    return updated;
  }

  async findOverdue(
    tenantId: TenantId,
    cutoffDate?: ISOTimestamp
  ): Promise<Case[]> {
    const cutoff = cutoffDate ? new Date(cutoffDate) : new Date();
    const rows = await this.db
      .select()
      .from(casesTable)
      .where(
        and(
          eq(casesTable.tenantId, tenantId as unknown as string),
          lt(casesTable.resolutionDueAt, cutoff)
        )
      );
    // Filter out already-closed cases in JS for portability (status col uses
    // the snake_case DB vocab).
    return rows
      .map(rowToEntity)
      .filter((c) => c.status !== 'CLOSED' && c.status !== 'RESOLVED');
  }

  // -------------------------------------------------------------------------
  // Not yet implemented (SLA worker does NOT rely on these); throwing surfaces
  // unplanned usage rather than returning silent empty results.
  // -------------------------------------------------------------------------

  async findByCaseNumber(
    _caseNumber: string,
    _tenantId: TenantId
  ): Promise<Case | null> {
    throw new Error('PostgresCaseRepository.findByCaseNumber: not implemented');
  }

  async findMany(
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findMany: not implemented');
  }

  async findByCustomer(
    _customerId: CustomerId,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findByCustomer: not implemented');
  }

  async findByStatus(
    _status: CaseStatus,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findByStatus: not implemented');
  }

  async findByType(
    _type: CaseType,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findByType: not implemented');
  }

  async findBySeverity(
    _severity: CaseSeverity,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findBySeverity: not implemented');
  }

  async findByAssignee(
    _assignedTo: UserId,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findByAssignee: not implemented');
  }

  async findByProperty(
    _propertyId: PropertyId,
    _tenantId: TenantId,
    _pagination?: PaginationParams
  ): Promise<PaginatedResult<Case>> {
    throw new Error('PostgresCaseRepository.findByProperty: not implemented');
  }

  async findEscalated(_tenantId: TenantId): Promise<Case[]> {
    throw new Error('PostgresCaseRepository.findEscalated: not implemented');
  }

  async delete(): Promise<void> {
    throw new Error('PostgresCaseRepository.delete: not implemented');
  }

  async getNextSequence(_tenantId: TenantId): Promise<number> {
    throw new Error('PostgresCaseRepository.getNextSequence: not implemented');
  }

  async countByStatus(_tenantId: TenantId): Promise<Record<CaseStatus, number>> {
    throw new Error('PostgresCaseRepository.countByStatus: not implemented');
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toDate(v: ISOTimestamp | null | undefined): Date | null {
  if (!v) return null;
  return typeof v === 'string' ? new Date(v) : v;
}

function fromDate(v: Date | string | null | undefined): ISOTimestamp | null {
  if (!v) return null;
  return (v instanceof Date ? v.toISOString() : v) as ISOTimestamp;
}

function entityToRow(entity: Case): Record<string, unknown> {
  // We persist the denormalised arrays (timeline / notices / evidence /
  // resolution) via the amendment migration's `payload` JSONB column.
  return {
    id: entity.id as unknown as string,
    tenantId: entity.tenantId as unknown as string,
    propertyId: (entity.propertyId as unknown as string) ?? null,
    unitId: (entity.unitId as unknown as string) ?? null,
    customerId: (entity.customerId as unknown as string) ?? null,
    leaseId: (entity.leaseId as unknown as string) ?? null,
    caseNumber: entity.caseNumber,
    caseType: CASE_TYPE_TO_DB[entity.type] ?? 'other',
    severity: entity.severity.toLowerCase(),
    status: CASE_STATUS_TO_DB[entity.status] ?? 'open',
    title: entity.title,
    description: entity.description,
    amountInDispute: entity.amountInDispute ?? null,
    currency: entity.currency ?? null,
    resolutionDueAt: toDate(entity.dueDate ?? undefined),
    assignedTo: (entity.assignedTo as unknown as string) ?? null,
    escalatedAt: toDate(entity.escalatedAt ?? undefined),
    escalationLevel: entity.escalationLevel ?? 0,
    resolvedAt:
      entity.resolution?.resolvedAt != null
        ? new Date(entity.resolution.resolvedAt)
        : null,
    resolvedBy: (entity.resolution?.resolvedBy as unknown as string) ?? null,
    closedAt: toDate(entity.closedAt ?? undefined),
    closedBy: (entity.closedBy as unknown as string) ?? null,
    closureReason: entity.closureReason ?? null,
    // Amendment-added JSONB column carrying the aggregate payload.
    payload: {
      timeline: entity.timeline,
      notices: entity.notices,
      evidence: entity.evidence,
      resolution: entity.resolution,
      relatedInvoiceIds: entity.relatedInvoiceIds ?? [],
    },
    tags: [],
    createdAt: toDate(entity.createdAt) ?? new Date(),
    updatedAt: toDate(entity.updatedAt) ?? new Date(),
    createdBy: entity.createdBy as unknown as string,
    updatedBy: entity.updatedBy as unknown as string,
  };
}

function rowToEntity(row: any): Case {
  const payload = (row.payload ?? {}) as Partial<{
    timeline: readonly CaseTimelineEvent[];
    notices: readonly unknown[];
    evidence: readonly unknown[];
    resolution: unknown;
    relatedInvoiceIds: readonly unknown[];
  }>;
  const dbStatus = (row.status ?? 'open') as string;
  const dbType = (row.caseType ?? 'other') as string;
  return {
    id: asCaseId(row.id),
    tenantId: row.tenantId as unknown as TenantId,
    caseNumber: row.caseNumber,
    type: CASE_TYPE_FROM_DB[dbType] ?? 'OTHER',
    severity: (row.severity?.toUpperCase?.() ?? 'MEDIUM') as CaseSeverity,
    status: CASE_STATUS_FROM_DB[dbStatus] ?? 'OPEN',
    title: row.title,
    description: row.description ?? '',
    customerId: (row.customerId ?? '') as CustomerId,
    leaseId: row.leaseId ?? undefined,
    propertyId: row.propertyId ?? undefined,
    unitId: row.unitId ?? undefined,
    relatedInvoiceIds: (payload.relatedInvoiceIds ?? []) as Case['relatedInvoiceIds'],
    amountInDispute:
      row.amountInDispute != null ? Number(row.amountInDispute) : undefined,
    currency: row.currency ?? undefined,
    assignedTo: row.assignedTo ? (row.assignedTo as unknown as UserId) : undefined,
    timeline: (payload.timeline ?? []) as readonly CaseTimelineEvent[],
    notices: (payload.notices ?? []) as Case['notices'],
    evidence: (payload.evidence ?? []) as Case['evidence'],
    resolution: (payload.resolution ?? undefined) as Case['resolution'],
    escalatedAt: fromDate(row.escalatedAt) ?? undefined,
    escalationLevel: row.escalationLevel ?? 0,
    dueDate: fromDate(row.resolutionDueAt) ?? undefined,
    closedAt: fromDate(row.closedAt) ?? undefined,
    closedBy: row.closedBy ? (row.closedBy as unknown as UserId) : undefined,
    closureReason: row.closureReason ?? undefined,
    createdAt: fromDate(row.createdAt)! as ISOTimestamp,
    createdBy: row.createdBy as unknown as UserId,
    updatedAt: fromDate(row.updatedAt)! as ISOTimestamp,
    updatedBy: row.updatedBy as unknown as UserId,
  };
}
