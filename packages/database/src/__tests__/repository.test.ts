/**
 * Baseline tests for @bossnyumba/database.
 *
 * Focus: pure-function helpers and repository construction.
 *
 * The repositories wrap a Drizzle `DatabaseClient` which in turn wraps the
 * `postgres` driver. Exercising an actual query requires a running PostgreSQL
 * instance plus drizzle's fluent query builder, so for a unit-test we:
 *   1. Test the pure `buildPaginatedResult` row-mapper / `DEFAULT_PAGINATION`
 *      constants which have zero driver coupling.
 *   2. Verify repository classes accept a mock `DatabaseClient` without
 *      throwing at construction time, and expose the documented method surface.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildPaginatedResult,
  DEFAULT_PAGINATION,
} from '../repositories/base.repository.js';
import { CustomerRepository } from '../repositories/customer.repository.js';
import { PropertyRepository } from '../repositories/property.repository.js';
import { PaymentRepository, InvoiceRepository } from '../repositories/payment.repository.js';
import type { DatabaseClient } from '../client.js';

describe('DEFAULT_PAGINATION', () => {
  it('uses sane defaults (limit 20, offset 0)', () => {
    expect(DEFAULT_PAGINATION).toEqual({ limit: 20, offset: 0 });
  });
});

describe('buildPaginatedResult', () => {
  it('returns items/total/limit/offset verbatim and computes hasMore=true when more pages exist', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const result = buildPaginatedResult(items, /* total */ 10, { limit: 2, offset: 0 });
    expect(result.items).toEqual(items);
    expect(result.total).toBe(10);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
    expect(result.hasMore).toBe(true);
  });

  it('computes hasMore=false on the final page', () => {
    const items = [{ id: 'x' }];
    const result = buildPaginatedResult(items, 5, { limit: 2, offset: 4 });
    // offset 4 + items.length 1 === total 5 → no more pages
    expect(result.hasMore).toBe(false);
  });

  it('computes hasMore=false when the result set is empty', () => {
    const result = buildPaginatedResult([], 0, { limit: 20, offset: 0 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('computes hasMore=true when caller asked for less than a full page but more exist server-side', () => {
    // offset 0 + items.length 1 < total 5 → still more
    const result = buildPaginatedResult([{ id: 'only' }], 5, { limit: 1, offset: 0 });
    expect(result.hasMore).toBe(true);
  });
});

describe('Repository classes', () => {
  // A minimal stub standing in for a Drizzle DatabaseClient — the repositories
  // only *store* the client at construction, so the methods never run during
  // these tests.
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as DatabaseClient;

  it('CustomerRepository constructs and exposes CRUD methods', () => {
    const repo = new CustomerRepository(mockDb);
    expect(repo).toBeInstanceOf(CustomerRepository);
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByCode).toBe('function');
    expect(typeof repo.findByEmail).toBe('function');
    expect(typeof repo.findMany).toBe('function');
    expect(typeof repo.create).toBe('function');
    expect(typeof repo.update).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });

  it('PropertyRepository, PaymentRepository, InvoiceRepository are constructable', () => {
    expect(new PropertyRepository(mockDb)).toBeInstanceOf(PropertyRepository);
    expect(new PaymentRepository(mockDb)).toBeInstanceOf(PaymentRepository);
    expect(new InvoiceRepository(mockDb)).toBeInstanceOf(InvoiceRepository);
  });
});
