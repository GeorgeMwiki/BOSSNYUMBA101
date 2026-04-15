/**
 * Base repository with common CRUD operations using Drizzle ORM.
 * Provides tenant-scoped queries, pagination, and soft delete support.
 */

import type {
  PaginationParams,
  PaginatedResult,
} from '@bossnyumba/domain-models';

/**
 * Extract the numeric total from a count query result.
 * Count queries always return exactly one row; if the result is empty, fall back to 0.
 */
export function totalFrom(rows: readonly { total: number }[]): number {
  return rows[0]?.total ?? 0;
}

/**
 * Extract the numeric count from a scalar count query result.
 */
export function countFrom(rows: readonly { count: number }[]): number {
  return rows[0]?.count ?? 0;
}

/** Default pagination when not specified */
export const DEFAULT_PAGINATION: PaginationParams = {
  limit: 20,
  offset: 0,
};

/**
 * Build a PaginatedResult from items and total count.
 */
export function buildPaginatedResult<T>(
  items: readonly T[],
  total: number,
  pagination: PaginationParams
): PaginatedResult<T> {
  const { limit, offset } = pagination;
  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}
