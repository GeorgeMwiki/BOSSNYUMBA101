/**
 * Disbursement Repository Interface
 * Defines the contract for disbursement persistence
 */
import { TenantId, OwnerId, Money, CurrencyCode } from '@bossnyumba/domain-models';

/**
 * Disbursement status
 */
export type DisbursementStatus = 'PENDING' | 'PROCESSING' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELLED';

/**
 * Disbursement entity
 */
export interface Disbursement {
  id: string;
  tenantId: TenantId;
  ownerId: OwnerId;
  amountMinorUnits: number;
  currency: CurrencyCode;
  status: DisbursementStatus;
  destination: string;
  destinationType: string;
  provider?: string;
  transferId?: string;
  providerResponse?: Record<string, unknown>;
  description?: string;
  initiatedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  estimatedArrival?: Date;
  failureReason?: string;
  failureCode?: string;
  idempotencyKey?: string;
  ledgerEntryId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Disbursement filters
 */
export interface DisbursementFilters {
  tenantId: TenantId;
  ownerId?: OwnerId;
  status?: DisbursementStatus | DisbursementStatus[];
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Paginated result
 */
export interface DisbursementPaginatedResult {
  items: Disbursement[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Disbursement Repository Interface
 */
export interface IDisbursementRepository {
  /**
   * Create a new disbursement
   */
  create(disbursement: Disbursement): Promise<Disbursement>;

  /**
   * Atomically claim a disbursement for processing.
   *
   * Inserts `disbursement` (expected status 'PROCESSING') guarded by the
   * unique index on (tenant_id, idempotency_key). The first writer wins
   * and gets `{ claimed: true, disbursement: <inserted row> }`. A
   * concurrent replica / replay collides on the unique index and gets
   * back `{ claimed: false, disbursement: <existing row> }` WITHOUT
   * inserting a second row — the caller returns the original result and
   * fires no transfer. This is the row-lock-free guard against the
   * double-fire described in the audit (BLOCKER #13).
   *
   * `disbursement.idempotencyKey` MUST be set; the partial unique index
   * only covers non-null keys.
   */
  claimForProcessing(
    disbursement: Disbursement,
  ): Promise<{ claimed: boolean; disbursement: Disbursement }>;

  /**
   * Get disbursement by ID
   */
  findById(id: string, tenantId: TenantId): Promise<Disbursement | null>;

  /**
   * Get disbursement by idempotency key
   */
  findByIdempotencyKey(idempotencyKey: string, tenantId: TenantId): Promise<Disbursement | null>;

  /**
   * Get disbursement by transfer ID
   */
  findByTransferId(provider: string, transferId: string): Promise<Disbursement | null>;

  /**
   * Update disbursement
   */
  update(disbursement: Disbursement): Promise<Disbursement>;

  /**
   * Find disbursements with filters
   */
  find(filters: DisbursementFilters, page?: number, pageSize?: number): Promise<DisbursementPaginatedResult>;

  /**
   * Get disbursements by owner
   */
  findByOwner(tenantId: TenantId, ownerId: OwnerId, page?: number, pageSize?: number): Promise<DisbursementPaginatedResult>;

  /**
   * Get pending disbursements. Bounded by `limit` (default 500) so a
   * tenant with a large pending backlog can never load an unbounded set
   * into memory.
   */
  findPending(tenantId: TenantId, limit?: number): Promise<Disbursement[]>;

  /**
   * Get last disbursement for owner
   */
  findLastByOwner(tenantId: TenantId, ownerId: OwnerId): Promise<Disbursement | null>;
}

/**
 * In-memory implementation for testing
 */
export class InMemoryDisbursementRepository implements IDisbursementRepository {
  private disbursements: Map<string, Disbursement> = new Map();

  async create(disbursement: Disbursement): Promise<Disbursement> {
    this.disbursements.set(disbursement.id, { ...disbursement });
    return disbursement;
  }

  async claimForProcessing(
    disbursement: Disbursement,
  ): Promise<{ claimed: boolean; disbursement: Disbursement }> {
    // Mirror the DB's (tenant_id, idempotency_key) unique index: an
    // existing row with the same key means a concurrent claim already won.
    if (disbursement.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        disbursement.idempotencyKey,
        disbursement.tenantId,
      );
      if (existing) {
        return { claimed: false, disbursement: existing };
      }
    }
    const created = await this.create(disbursement);
    return { claimed: true, disbursement: created };
  }

  async findById(id: string, tenantId: TenantId): Promise<Disbursement | null> {
    const disbursement = this.disbursements.get(id);
    if (disbursement && disbursement.tenantId === tenantId) {
      return { ...disbursement };
    }
    return null;
  }

  async findByIdempotencyKey(idempotencyKey: string, tenantId: TenantId): Promise<Disbursement | null> {
    for (const disbursement of this.disbursements.values()) {
      if (disbursement.idempotencyKey === idempotencyKey && disbursement.tenantId === tenantId) {
        return { ...disbursement };
      }
    }
    return null;
  }

  async findByTransferId(provider: string, transferId: string): Promise<Disbursement | null> {
    for (const disbursement of this.disbursements.values()) {
      if (disbursement.provider === provider && disbursement.transferId === transferId) {
        return { ...disbursement };
      }
    }
    return null;
  }

  async update(disbursement: Disbursement): Promise<Disbursement> {
    this.disbursements.set(disbursement.id, { ...disbursement, updatedAt: new Date() });
    return disbursement;
  }

  async find(
    filters: DisbursementFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<DisbursementPaginatedResult> {
    let items = Array.from(this.disbursements.values())
      .filter(d => d.tenantId === filters.tenantId);

    if (filters.ownerId) {
      items = items.filter(d => d.ownerId === filters.ownerId);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      items = items.filter(d => statuses.includes(d.status));
    }
    if (filters.fromDate) {
      items = items.filter(d => d.createdAt >= filters.fromDate!);
    }
    if (filters.toDate) {
      items = items.filter(d => d.createdAt <= filters.toDate!);
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);

    return {
      items: items.map(d => ({ ...d })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total
    };
  }

  async findByOwner(
    tenantId: TenantId,
    ownerId: OwnerId,
    page: number = 1,
    pageSize: number = 20
  ): Promise<DisbursementPaginatedResult> {
    return this.find({ tenantId, ownerId }, page, pageSize);
  }

  async findPending(tenantId: TenantId, limit: number = 500): Promise<Disbursement[]> {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    return Array.from(this.disbursements.values())
      .filter(d =>
        d.tenantId === tenantId &&
        ['PENDING', 'PROCESSING', 'IN_TRANSIT'].includes(d.status)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, safeLimit)
      .map(d => ({ ...d }));
  }

  async findLastByOwner(tenantId: TenantId, ownerId: OwnerId): Promise<Disbursement | null> {
    const disbursements = Array.from(this.disbursements.values())
      .filter(d => d.tenantId === tenantId && d.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return disbursements.length > 0 ? { ...disbursements[0] } : null;
  }
}
