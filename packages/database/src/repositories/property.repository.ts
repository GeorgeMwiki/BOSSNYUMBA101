/**
 * PropertyRepository and UnitRepository - PostgreSQL implementations.
 */

import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { properties, units } from '../schemas/index.js';
import type {
  TenantId,
  PropertyId,
  UnitId,
  UserId,
  PaginationParams,
  PaginatedResult,
} from '@bossnyumba/domain-models';
import { buildPaginatedResult, DEFAULT_PAGINATION } from './base.repository.js';

type PropertyRow = typeof properties.$inferSelect;
type UnitRow = typeof units.$inferSelect;

export class PropertyRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: PropertyId, tenantId: TenantId): Promise<PropertyRow | null> {
    const result = await this.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.id, id),
          eq(properties.tenantId, tenantId),
          isNull(properties.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByCode(
    propertyCode: string,
    tenantId: TenantId
  ): Promise<PropertyRow | null> {
    const result = await this.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.propertyCode, propertyCode),
          eq(properties.tenantId, tenantId),
          isNull(properties.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<PropertyRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const whereClause = and(
      eq(properties.tenantId, tenantId),
      isNull(properties.deletedAt)
    );

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(properties)
        .where(whereClause)
        .orderBy(desc(properties.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(properties).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async findByOwner(
    ownerId: string,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<PropertyRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const whereClause = and(
      eq(properties.ownerId, ownerId),
      eq(properties.tenantId, tenantId),
      isNull(properties.deletedAt)
    );

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(properties)
        .where(whereClause)
        .orderBy(desc(properties.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(properties).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async create(
    input: typeof properties.$inferInsert,
    createdBy: UserId
  ): Promise<PropertyRow> {
    const [row] = await this.db
      .insert(properties)
      .values({
        ...input,
        createdBy: createdBy ?? input.createdBy,
        updatedBy: createdBy ?? input.updatedBy,
      })
      .returning();
    if (!row) throw new Error('Failed to create property');
    return row;
  }

  async update(
    id: PropertyId,
    tenantId: TenantId,
    input: Partial<typeof properties.$inferInsert>,
    updatedBy: UserId
  ): Promise<PropertyRow> {
    const [row] = await this.db
      .update(properties)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? input.updatedBy,
      })
      .where(
        and(
          eq(properties.id, id),
          eq(properties.tenantId, tenantId)
        )
      )
      .returning();
    if (!row) throw new Error(`Property not found: ${id}`);
    return row;
  }

  async delete(id: PropertyId, tenantId: TenantId, deletedBy: UserId): Promise<void> {
    await this.db
      .update(properties)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(
        and(
          eq(properties.id, id),
          eq(properties.tenantId, tenantId)
        )
      );
  }
}

export class UnitRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: UnitId, tenantId: TenantId): Promise<UnitRow | null> {
    const result = await this.db
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.tenantId, tenantId),
          isNull(units.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findByProperty(
    propertyId: PropertyId,
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<UnitRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const whereClause = and(
      eq(units.propertyId, propertyId),
      eq(units.tenantId, tenantId),
      isNull(units.deletedAt)
    );

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(units)
        .where(whereClause)
        .orderBy(units.unitCode)
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(units).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async findByCode(
    propertyId: PropertyId,
    unitCode: string,
    tenantId: TenantId
  ): Promise<UnitRow | null> {
    const result = await this.db
      .select()
      .from(units)
      .where(
        and(
          eq(units.propertyId, propertyId),
          eq(units.unitCode, unitCode),
          eq(units.tenantId, tenantId),
          isNull(units.deletedAt)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async findMany(
    tenantId: TenantId,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<UnitRow>> {
    const { limit, offset } = pagination ?? DEFAULT_PAGINATION;

    const whereClause = and(
      eq(units.tenantId, tenantId),
      isNull(units.deletedAt)
    );

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(units)
        .where(whereClause)
        .orderBy(desc(units.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(units).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return buildPaginatedResult(items, total, { limit, offset });
  }

  async create(
    input: typeof units.$inferInsert,
    createdBy: UserId
  ): Promise<UnitRow> {
    const [row] = await this.db
      .insert(units)
      .values({
        ...input,
        createdBy: createdBy ?? input.createdBy,
        updatedBy: createdBy ?? input.updatedBy,
      })
      .returning();
    if (!row) throw new Error('Failed to create unit');
    return row;
  }

  async update(
    id: UnitId,
    tenantId: TenantId,
    input: Partial<typeof units.$inferInsert>,
    updatedBy: UserId
  ): Promise<UnitRow> {
    const [row] = await this.db
      .update(units)
      .set({
        ...input,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? input.updatedBy,
      })
      .where(
        and(
          eq(units.id, id),
          eq(units.tenantId, tenantId)
        )
      )
      .returning();
    if (!row) throw new Error(`Unit not found: ${id}`);
    return row;
  }

  async delete(id: UnitId, tenantId: TenantId, deletedBy: UserId): Promise<void> {
    await this.db
      .update(units)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
        updatedBy: deletedBy,
      })
      .where(
        and(
          eq(units.id, id),
          eq(units.tenantId, tenantId)
        )
      );
  }
}
