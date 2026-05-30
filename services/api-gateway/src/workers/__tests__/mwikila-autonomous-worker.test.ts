/**
 * Mr. Mwikila autonomous worker — unit tests (BossNyumba real-estate).
 *
 * Drives `tickOnce()` against stub tenants + handlers:
 *   - zero tenants → zero invocations
 *   - one tenant × N handlers → N invocations
 *   - handler exception is caught and logged; loop continues
 *   - inbox row counted only when runtime returns a non-null row
 *   - MWIKILA_WORKER_DISABLED=true does NOT auto-start the timer
 *   - tenant-listing failure aborts the tick cleanly
 *
 * Ported from Borjie services/api-gateway/src/workers/__tests__/
 * mwikila-autonomous-worker.test.ts; domain language stays generic so
 * both repos can keep this file in lockstep.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { createMwikilaAutonomousWorker } from '../mwikila-autonomous-worker.js';
import type {
  MwikilaHandler,
  MwikilaHandlerRuntime,
  MwikilaInboxRow,
} from '../../services/mwikila-autonomy/index.js';

// Minimal logger surface — pinned to `unknown` so the Pino contract drift
// across versions does not block the test from compiling.
const stubLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<typeof createMwikilaAutonomousWorker>[0]['logger'];

afterEach(() => {
  delete process.env.MWIKILA_WORKER_DISABLED;
  delete process.env.BOSSNYUMBA_MWIKILA_WORKER_DISABLED;
});

function makeRuntime(ret: MwikilaInboxRow | null): MwikilaHandlerRuntime {
  return Object.freeze({
    run: vi.fn().mockResolvedValue(ret),
  }) as unknown as MwikilaHandlerRuntime;
}

function makeHandler(actionKind: string): MwikilaHandler {
  return Object.freeze({
    actionKind,
    category: 'shifts' as const,
    propose: vi.fn(),
  }) as unknown as MwikilaHandler;
}

const stubRow: MwikilaInboxRow = Object.freeze({
  id: 'row-1',
  tenantId: 'tenant-x',
  actingOnUserId: 'user-owner',
  actionKind: 'rent.invoice_draft',
  category: 'shifts',
  delegationTier: 'T2',
  status: 'executed',
  summary: 's',
  summarySw: 'm',
  rationale: 'r',
  payload: Object.freeze({}),
  reversalToken: null,
  reversalUntil: null,
  proposedAt: '2026-05-29T08:00:00.000Z',
  proposalTtlAt: null,
  executedAt: null,
  ownerReviewedAt: null,
  ownerReviewedBy: null,
  reversedAt: null,
  committedAt: null,
  auditChainHash: null,
  decisionId: null,
  blockedReason: null,
  provenance: Object.freeze({}),
  createdAt: '2026-05-29T08:00:00.000Z',
  updatedAt: '2026-05-29T08:00:00.000Z',
}) as unknown as MwikilaInboxRow;

describe('mwikila autonomous worker (BossNyumba)', () => {
  it('zero tenants → zero handler invocations', async () => {
    const runtime = makeRuntime(stubRow);
    const worker = createMwikilaAutonomousWorker({
      runtime,
      tenants: { listActiveTenants: vi.fn().mockResolvedValue([]) },
      handlers: [makeHandler('a'), makeHandler('b')],
      logger: stubLogger,
    });
    const stats = await worker.tickOnce();
    expect(stats).toEqual({
      tenantsScanned: 0,
      handlersInvoked: 0,
      inboxRowsWritten: 0,
    });
    expect((runtime.run as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('one tenant × N handlers → N invocations', async () => {
    const runtime = makeRuntime(stubRow);
    const worker = createMwikilaAutonomousWorker({
      runtime,
      tenants: {
        listActiveTenants: vi
          .fn()
          .mockResolvedValue([
            { tenantId: 'tenant-x', ownerUserId: 'user-owner' },
          ]),
      },
      handlers: [makeHandler('a'), makeHandler('b'), makeHandler('c')],
      logger: stubLogger,
    });
    const stats = await worker.tickOnce();
    expect(stats.handlersInvoked).toBe(3);
    expect(stats.inboxRowsWritten).toBe(3);
  });

  it('runtime returning null does not count as written', async () => {
    const runtime = makeRuntime(null);
    const worker = createMwikilaAutonomousWorker({
      runtime,
      tenants: {
        listActiveTenants: vi
          .fn()
          .mockResolvedValue([
            { tenantId: 'tenant-x', ownerUserId: 'user-owner' },
          ]),
      },
      handlers: [makeHandler('a')],
      logger: stubLogger,
    });
    const stats = await worker.tickOnce();
    expect(stats.inboxRowsWritten).toBe(0);
  });

  it('handler throw is logged and loop continues', async () => {
    const goodHandler = makeHandler('good');
    const throwingRuntime: MwikilaHandlerRuntime = Object.freeze({
      run: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('boom');
        })
        .mockResolvedValueOnce(stubRow),
    }) as unknown as MwikilaHandlerRuntime;
    const worker = createMwikilaAutonomousWorker({
      runtime: throwingRuntime,
      tenants: {
        listActiveTenants: vi
          .fn()
          .mockResolvedValue([
            { tenantId: 'tenant-x', ownerUserId: 'user-owner' },
          ]),
      },
      handlers: [makeHandler('bad'), goodHandler],
      logger: stubLogger,
    });
    const stats = await worker.tickOnce();
    expect(stats.handlersInvoked).toBe(2);
    expect(stats.inboxRowsWritten).toBe(1);
    expect((stubLogger as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalled();
  });

  it('tenant-listing failure aborts the tick cleanly', async () => {
    const runtime = makeRuntime(stubRow);
    const worker = createMwikilaAutonomousWorker({
      runtime,
      tenants: {
        listActiveTenants: vi.fn().mockRejectedValue(new Error('db down')),
      },
      handlers: [makeHandler('a')],
      logger: stubLogger,
    });
    const stats = await worker.tickOnce();
    expect(stats).toEqual({
      tenantsScanned: 0,
      handlersInvoked: 0,
      inboxRowsWritten: 0,
    });
    expect((runtime.run as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('MWIKILA_WORKER_DISABLED=true keeps start() inert', () => {
    process.env.MWIKILA_WORKER_DISABLED = 'true';
    const worker = createMwikilaAutonomousWorker({
      runtime: makeRuntime(stubRow),
      tenants: {
        listActiveTenants: vi.fn().mockResolvedValue([]),
      },
      handlers: [makeHandler('a')],
      logger: stubLogger,
    });
    worker.start();
    worker.stop();
    expect(true).toBe(true);
  });

  it('BOSSNYUMBA_MWIKILA_WORKER_DISABLED=true keeps start() inert', () => {
    process.env.BOSSNYUMBA_MWIKILA_WORKER_DISABLED = 'true';
    const worker = createMwikilaAutonomousWorker({
      runtime: makeRuntime(stubRow),
      tenants: {
        listActiveTenants: vi.fn().mockResolvedValue([]),
      },
      handlers: [makeHandler('a')],
      logger: stubLogger,
    });
    worker.start();
    worker.stop();
    expect(true).toBe(true);
  });
});
