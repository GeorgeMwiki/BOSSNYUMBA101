/**
 * LeaseRepository - PostgreSQL implementation for lease data access.
 */

import { eq, and, desc, isNull, sql, inArray } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { leases } from '../schemas/index.js';
import type {
  TenantId,
  PropertyId,
  UnitId,
  UserId,
  PaginationParams,
  PaginatedResult,
  CustomerId,
  LeaseId,
} from '@bossnyumba/domain-models';
import { buildPaginatedResult, DEFAULT_PAGINATION } from './base.repository.js';

type LeaseRow = typeof leases.$inferSelect;

export interface LeaseFilters {
  status?: string | string[];
  propertyId?: PropertyId;
  unitId?: UnitId;
  customerId?: CustomerId;
}

export class LeaseRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: LeaseId, tenantId: TenantId): Promise<LeaseRow | null> {
    const result = await this.db
      .select()
      .from(leases)
      .where(
        and(
          eq(leases.id, id),
          eq(leases.tenantId, tenantId),
          isNull(leases.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByNumber(
    leaseNumber: string,
    tenantId: TenantId
  ): Promise<LeaseRow | null> {
    const result = await this.db
      .select()
      .from(leases)
      .where(
        and(
          eq(leases.leaseNumber, leaseNumber),
          eq(leases.tenantId, tenantId),
          isNull(leases.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(
    tenantId: TenantId,
    pagination?: PaginationParams,
    filters?: LeaseFilters
  ): Promise<PaginatedResult<LeaseRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const conditions = [
      eq(leases.tenantId, tenantId),
      isNull(leases.deletedAt),
    ];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(leases.status, statuses as any));
    }

    if (filters?.propertyId) {
      conditions.push(eq(leases.propertyId, filters.propertyId));
    }

    if (filters?.unitId) {
      conditions.push(eq(leases.unitId, filters.unitId));
    }

    if (filters?.customerId) {
      conditions.push(eq(leases.customerId, filters.customerId));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(leases)
        .where(whereClause)
        .orderBy(desc(leases.startDate))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(leases).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async findByProperty(
    propertyId: PropertyId,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<LeaseRow>> {
    return this.findMany(tenantId, pagination, { propertyId });
  }

  async findByUnit(
    unitId: UnitId,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<LeaseRow>> {
    return this.findMany(tenantId, pagination, { unitId });
  }

  async findByCustomer(
    customerId: CustomerId,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<LeaseRow>> {
    return this.findMany(tenantId, pagination, { customerId });
  }

  async create(
    input: typeof leases.$inferInsert,
    createdBy: UserId
  ): Promise<LeaseRow> {
    const [row] = await this.db
      .insert(leases)
      .values({
        ...input,
        createdBy: createdBy ?? input.createdBy,
        updatedBy: createdBy ?? input.updatedBy,
      })
      .returning();
    if (!row) throw new Error('Failed to create lease');
    return row;
  }

  async update(
    id: LeaseId,
    tenantId: TenantId,
    input: Partial<typeof leases.$inferInsert>,
    updatedBy: UserId
  ): Promise<LeaseRow> {
    const [row] = await this.db
      .update(leases)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? input.updatedBy,
      })
      .where(
        and(
          eq(leases.id, id),
          eq(leases.tenantId, tenantId)
        )
      )
      .returning();
    if (!row) throw new Error(`Lease not found: ${id}`);
    return row;
  }

  async delete(id: LeaseId, tenantId: TenantId, deletedBy: UserId): Promise<void> {
    await this.db
      .update(leases)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(
        and(
          eq(leases.id, id),
          eq(leases.tenantId, tenantId)
        )
      );
  }
}
