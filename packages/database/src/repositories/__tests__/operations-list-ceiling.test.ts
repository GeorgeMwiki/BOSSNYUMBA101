/**
 * Scale-hardening detectors for the operations repositories.
 *
 * `listForWorkOrder` / `listForVendor` / `listForProperty` (and the
 * dispatch `listForTenant`) were fully UNBOUNDED — reachable from
 * api-gateway routes, they could stream an arbitrarily large result set
 * into memory and over the wire. These tests pin that EVERY list path now
 * applies a `.limit(...)` clamped into (0, LIST_CEILING].
 *
 * We assert against a fluent query-builder spy that records the final
 * `.limit(n)` argument, so the test is agnostic to the underlying driver.
 */
import { describe, it, expect } from 'vitest';
import {
  DispatchEventRepository,
  CompletionProofRepository,
  VendorAssignmentRepository,
} from '../operations.repository.js';

const LIST_CEILING = 500;

/**
 * Minimal fluent stub mimicking the Drizzle select chain. Every chainable
 * method returns `this`; the terminal `.limit(n)` records `n` and resolves
 * to an empty array (awaited as a thenable).
 */
function makeDbSpy() {
  const calls: { limit?: number } = {};
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.from = passthrough;
  chain.where = passthrough;
  chain.orderBy = passthrough;
  chain.limit = (n: number) => {
    calls.limit = n;
    return Promise.resolve([]);
  };
  // Allow the builder itself to be awaited (paths that never call .limit
  // would resolve here — proving the absence of a cap would be a bug).
  chain.then = (resolve: (v: unknown[]) => void) => resolve([]);
  return { db: chain as never, calls };
}

describe('operations repositories — list ceiling', () => {
  it('DispatchEventRepository.listForWorkOrder applies the ceiling by default', async () => {
    const { db, calls } = makeDbSpy();
    await new DispatchEventRepository(db).listForWorkOrder('wo1', 't1');
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('DispatchEventRepository.listForTenant applies the ceiling by default', async () => {
    const { db, calls } = makeDbSpy();
    await new DispatchEventRepository(db).listForTenant('t1');
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('CompletionProofRepository.listForWorkOrder applies the ceiling by default', async () => {
    const { db, calls } = makeDbSpy();
    await new CompletionProofRepository(db).listForWorkOrder('wo1', 't1');
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('VendorAssignmentRepository.listForVendor applies the ceiling by default', async () => {
    const { db, calls } = makeDbSpy();
    await new VendorAssignmentRepository(db).listForVendor('v1', 't1');
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('VendorAssignmentRepository.listForProperty applies the ceiling by default', async () => {
    const { db, calls } = makeDbSpy();
    await new VendorAssignmentRepository(db).listForProperty('p1', 't1');
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('honours a caller limit below the ceiling', async () => {
    const { db, calls } = makeDbSpy();
    await new DispatchEventRepository(db).listForWorkOrder('wo1', 't1', 25);
    expect(calls.limit).toBe(25);
  });

  it('never lets a caller exceed the hard ceiling', async () => {
    const { db, calls } = makeDbSpy();
    await new VendorAssignmentRepository(db).listForVendor('v1', 't1', 100000);
    expect(calls.limit).toBe(LIST_CEILING);
  });

  it('falls back to the ceiling for non-positive limits', async () => {
    const { db, calls } = makeDbSpy();
    await new CompletionProofRepository(db).listForWorkOrder('wo1', 't1', 0);
    expect(calls.limit).toBe(LIST_CEILING);
  });
});
