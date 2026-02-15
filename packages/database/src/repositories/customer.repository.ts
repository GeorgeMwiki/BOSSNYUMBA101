/**
 * CustomerRepository - PostgreSQL implementation for customer data access.
 */

import { eq, and, desc, isNull, sql, like, or, inArray } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { customers } from '../schemas/index.js';
import type {
  TenantId,
  UserId,
  PaginationParams,
  PaginatedResult,
  CustomerId,
} from '@bossnyumba/domain-models';
import { buildPaginatedResult, DEFAULT_PAGINATION } from './base.repository.js';

type CustomerRow = typeof customers.$inferSelect;

export interface CustomerFilters {
  status?: string | string[];
  search?: string;
}

export class CustomerRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: CustomerId, tenantId: TenantId): Promise<CustomerRow | null> {
    const result = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId),
          isNull(customers.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByCode(
    customerCode: string,
    tenantId: TenantId
  ): Promise<CustomerRow | null> {
    const result = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.customerCode, customerCode),
          eq(customers.tenantId, tenantId),
          isNull(customers.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByEmail(
    email: string,
    tenantId: TenantId
  ): Promise<CustomerRow | null> {
    const result = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.email, email),
          eq(customers.tenantId, tenantId),
          isNull(customers.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(
    tenantId: TenantId,
    pagination?: PaginationParams,
    filters?: CustomerFilters
  ): Promise<PaginatedResult<CustomerRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const conditions = [
      eq(customers.tenantId, tenantId),
      isNull(customers.deletedAt),
    ];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(customers.status, statuses as any));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(customers.firstName, searchPattern),
          like(customers.lastName, searchPattern),
          like(customers.email, searchPattern),
          like(customers.phone, searchPattern),
          like(customers.customerCode, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(whereClause)
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(customers).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async create(
    input: typeof customers.$inferInsert,
    createdBy: UserId
  ): Promise<CustomerRow> {
    const [row] = await this.db
      .insert(customers)
      .values({
        ...input,
        createdBy: createdBy ?? input.createdBy,
        updatedBy: createdBy ?? input.updatedBy,
      })
      .returning();
    if (!row) throw new Error('Failed to create customer');
    return row;
  }

  async update(
    id: CustomerId,
    tenantId: TenantId,
    input: Partial<typeof customers.$inferInsert>,
    updatedBy: UserId
  ): Promise<CustomerRow> {
    const [row] = await this.db
      .update(customers)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? input.updatedBy,
      })
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId)
        )
      )
      .returning();
    if (!row) throw new Error(`Customer not found: ${id}`);
    return row;
  }

  async delete(id: CustomerId, tenantId: TenantId, deletedBy: UserId): Promise<void> {
    await this.db
      .update(customers)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(
        and(
          eq(customers.id, id),
          eq(customers.tenantId, tenantId)
        )
      );
  }
}
