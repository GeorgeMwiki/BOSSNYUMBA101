/**
 * TenantRepository & UserRepository - PostgreSQL implementations for tenant and user data access.
 */

import { eq, and, desc, isNull, sql, like, or, count } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { tenants, users } from '../schemas/index.js';
import type {
  TenantId,
  UserId,
  PaginationParams,
  PaginatedResult,
} from '@bossnyumba/domain-models';
import { buildPaginatedResult, DEFAULT_PAGINATION } from './base.repository.js';

type TenantRow = typeof tenants.$inferSelect;

export class TenantRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: TenantId): Promise<TenantRow | null> {
    const result = await this.db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
      .limit(1);
    return result[0] ?? null;
  }

  async findBySlug(slug: string): Promise<TenantRow | null> {
    const result = await this.db
      .select()
      .from(tenants)
      .where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)))
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(pagination?: PaginationParams): Promise<PaginatedResult<TenantRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(tenants)
        .where(isNull(tenants.deletedAt))
        .orderBy(desc(tenants.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(isNull(tenants.deletedAt)),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async findWithUsage(id: TenantId): Promise<TenantRow | null> {
    const result = await this.db
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
      .limit(1);
    return result[0] ?? null;
  }

  async create(
    input: typeof tenants.$inferInsert,
    createdBy: UserId
  ): Promise<TenantRow> {
    const [row] = await this.db
      .insert(tenants)
      .values({
        ...input,
        createdBy: createdBy ?? input.createdBy,
        updatedBy: createdBy ?? input.updatedBy,
      })
      .returning();
    if (!row) throw new Error('Failed to create tenant');
    return row;
  }

  async update(
    id: TenantId,
    input: Partial<typeof tenants.$inferInsert>,
    updatedBy: UserId
  ): Promise<TenantRow> {
    const [row] = await this.db
      .update(tenants)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? input.updatedBy,
      })
      .where(eq(tenants.id, id))
      .returning();
    if (!row) throw new Error(`Tenant not found: ${id}`);
    return row;
  }

  async delete(id: TenantId, deletedBy: UserId): Promise<void> {
    await this.db
      .update(tenants)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(eq(tenants.id, id));
  }

  async updateLastActivity(id: TenantId): Promise<void> {
    await this.db
      .update(tenants)
      .set({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id));
  }
}

// ============================================================================
// UserRepository
// ============================================================================

type UserRow = typeof users.$inferSelect;

export interface UserFilters {
  status?: string;
  role?: string;
  search?: string;
}

export class UserRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string, tenantId: TenantId): Promise<UserRow | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId),
          isNull(users.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByEmail(email: string, tenantId: TenantId): Promise<UserRow | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.tenantId, tenantId),
          isNull(users.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(
    tenantId: TenantId,
    limit = 50,
    offset = 0,
    filters?: UserFilters
  ) {
    const conditions = [
      eq(users.tenantId, tenantId),
      isNull(users.deletedAt),
    ];

    if (filters?.status) {
      conditions.push(eq(users.status, filters.status as any));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(users.firstName, searchPattern),
          like(users.lastName, searchPattern),
          like(users.email, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const rows = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(users)
      .where(whereClause);

    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async create(data: typeof users.$inferInsert): Promise<UserRow> {
    const [row] = await this.db.insert(users).values(data).returning();
    if (!row) throw new Error('Failed to create user');
    return row;
  }

  async update(
    id: string,
    tenantId: TenantId,
    data: Partial<typeof users.$inferInsert>
  ): Promise<UserRow | null> {
    const [row] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId),
          isNull(users.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  }

  async delete(id: string, tenantId: TenantId, deletedBy: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        status: 'deactivated' as any,
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId)
        )
      );
  }
}
