/**
 * PART B — seed-tool adapter tests.
 *
 * Proves the three seed BrainTools execute against REAL backing logic
 * THROUGH the registry dispatcher (the same disciplined path the kernel
 * main-loop runs): zod input gate → executor → zod output gate → audit
 * row → DispatchResult.
 *
 *   - lookupTenantArrears        → replays a fake immutable ledger and
 *     projects the outstanding balance + months-overdue (the REAL
 *     `createArrearsProjectionService` runs; only the DB-loader boundary
 *     is stubbed).
 *   - getMarketRateBand          → maps the latest fake comp snapshot band.
 *   - checkComplianceCertificate → degrades honestly to `not-found`
 *     (no registry backing) without throwing.
 *
 * The DB seam is stubbed at the loader / snapshot-service boundary — the
 * adapter's own projection + mapping logic runs for real, which is the
 * behaviour under test.
 */

import { describe, it, expect } from 'vitest';
import {
  createBrainToolRegistry,
  createInMemoryBrainToolAuditSink,
  registerSeedBrainTools,
  orchestrator,
} from '@bossnyumba/central-intelligence';
import { buildSeedToolDeps } from '../seed-tool-adapters';
import type { ArrearsEntryLoader } from '../arrears-infrastructure';

// `createRegistryDispatcher` is exposed only via the `orchestrator`
// namespace at the package boundary (the top-level barrel re-exports the
// namespace, not the individual adapter symbols) — mirrors how
// `brain-kernel-wiring.ts` consumes it.
const { createRegistryDispatcher } = orchestrator;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CTX = {
  threadId: 'th-seed',
  scope: {
    kind: 'tenant' as const,
    tenantId: 't_alpha',
    actorUserId: 'u_1',
    roles: ['estate-manager'],
    personaId: 'estate-manager-head',
  },
  tier: 'tenant' as const,
  userMessage: 'seed',
  tickStartedAt: 0,
};

/** A fake arrears ledger: 3 charges of 500 each, one payment of 600. */
function makeArrearsLoader(): ArrearsEntryLoader {
  return async ({ arrearsCaseId }) => {
    if (arrearsCaseId === 'unknown') return null;
    const base = {
      tenantId: 't_alpha',
      customerId: 'cust_1',
      currency: 'TZS',
      invoiceId: null,
      relatedEntryId: null,
    };
    return {
      customerId: 'cust_1',
      currency: 'TZS',
      entries: [
        {
          ...base,
          id: 'e1',
          entryType: 'charge' as const,
          amountMinorUnits: 500,
          description: 'rent jan',
          transactionDate: '2026-01-01T00:00:00Z',
          postedAt: '2026-01-01T00:00:00Z',
        },
        {
          ...base,
          id: 'e2',
          entryType: 'charge' as const,
          amountMinorUnits: 500,
          description: 'rent feb',
          transactionDate: '2026-02-01T00:00:00Z',
          postedAt: '2026-02-01T00:00:00Z',
        },
        {
          ...base,
          id: 'e3',
          entryType: 'charge' as const,
          amountMinorUnits: 500,
          description: 'rent mar',
          transactionDate: '2026-03-01T00:00:00Z',
          postedAt: '2026-03-01T00:00:00Z',
        },
        {
          ...base,
          id: 'e4',
          entryType: 'payment' as const,
          amountMinorUnits: -600,
          description: 'partial pay',
          transactionDate: '2026-03-15T00:00:00Z',
          postedAt: '2026-03-15T00:00:00Z',
        },
      ],
    };
  };
}

/**
 * Fake DB that mimics the tiny `select().from().where().orderBy().limit()`
 * chain `createMarketRateSnapshotsService.listRecent` issues, returning one
 * comp-band row. Shaped to the snapshot service's row reader.
 */
function makeFakeDb(rows: ReadonlyArray<Record<string, unknown>>): unknown {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: undefined,
  };
  return {
    select: () => chain,
  };
}

function snapshotRow(): Record<string, unknown> {
  return {
    id: 'snap_1',
    tenantId: 't_alpha',
    unitId: 'unit_1',
    propertyId: 'prop_1',
    currencyCode: 'TZS',
    ourRentAmountMinor: 500,
    marketMedianMinor: 520,
    marketP25Minor: 480,
    marketP75Minor: 560,
    marketSampleSize: 42,
    deltaPct: -3.8,
    driftFlag: 'below_market',
    compRadiusKm: 2,
    sourceAdapter: 'test',
    sourceMetadata: {},
    modelVersion: 'v1',
    promptHash: null,
    observedAt: new Date('2026-06-01T00:00:00Z'),
  };
}

function seededRegistry(opts?: {
  readonly snapshots?: ReadonlyArray<Record<string, unknown>>;
}) {
  const sink = createInMemoryBrainToolAuditSink();
  const registry = createBrainToolRegistry({ auditSink: sink });
  const deps = buildSeedToolDeps({
    db: makeFakeDb(opts?.snapshots ?? [snapshotRow()]) as never,
    arrearsEntryLoader: makeArrearsLoader(),
    tenantId: 't_alpha',
  });
  registerSeedBrainTools(registry, deps);
  return { registry, sink, dispatcher: createRegistryDispatcher(registry) };
}

// ---------------------------------------------------------------------------
// lookupTenantArrears
// ---------------------------------------------------------------------------

describe('seed tool — lookupTenantArrears (through the dispatcher)', () => {
  it('replays the ledger, projects the balance, and returns tool_ok', async () => {
    const { dispatcher, sink } = seededRegistry();
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: {
          toolName: 'lookupTenantArrears',
          input: { tenantProfileId: 'case_1', asOfDate: '2026-06-07' },
          callId: 'c1',
        },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      const out = result.output as {
        arrearsAmount: number;
        currency: string;
        monthsOverdue: number;
      };
      // 3×500 charged − 600 paid = 900 outstanding.
      expect(out.arrearsAmount).toBe(900);
      expect(out.currency).toBe('TZS');
      expect(out.monthsOverdue).toBeGreaterThanOrEqual(1);
    }
    // Disciplined gate proof — audit row laid down with outcome 'ok'.
    expect(sink.rows().some((r) => r.name === 'lookupTenantArrears' && r.outcome === 'ok')).toBe(true);
  });

  it('returns a zero-state (not a throw) for an unknown case', async () => {
    const { dispatcher } = seededRegistry();
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: {
          toolName: 'lookupTenantArrears',
          input: { tenantProfileId: 'unknown' },
          callId: 'c2',
        },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      const out = result.output as { arrearsAmount: number };
      expect(out.arrearsAmount).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getMarketRateBand
// ---------------------------------------------------------------------------

describe('seed tool — getMarketRateBand (through the dispatcher)', () => {
  it('maps the latest comp snapshot band and returns tool_ok', async () => {
    const { dispatcher, sink } = seededRegistry();
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: {
          toolName: 'getMarketRateBand',
          input: { bedrooms: 2, unitType: '2br', propertyId: 'prop_1' },
          callId: 'c3',
        },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      const out = result.output as {
        p25: number;
        median: number;
        p75: number;
        sampleSize: number;
        currency: string;
      };
      expect(out.p25).toBe(480);
      expect(out.median).toBe(520);
      expect(out.p75).toBe(560);
      expect(out.sampleSize).toBe(42);
      expect(out.currency).toBe('TZS');
    }
    expect(sink.rows().some((r) => r.name === 'getMarketRateBand' && r.outcome === 'ok')).toBe(true);
  });

  it('returns a zero-band (not a throw) when no snapshot exists', async () => {
    const { dispatcher } = seededRegistry({ snapshots: [] });
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: {
          toolName: 'getMarketRateBand',
          input: { bedrooms: 1, unitType: '1br' },
          callId: 'c4',
        },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      const out = result.output as { sampleSize: number; median: number };
      expect(out.sampleSize).toBe(0);
      expect(out.median).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// checkComplianceCertificate (honest degrade — no backing)
// ---------------------------------------------------------------------------

describe('seed tool — checkComplianceCertificate (honest degrade)', () => {
  it('returns a not-found shaped result (no throw, no fabricated valid)', async () => {
    const { dispatcher, sink } = seededRegistry();
    const result = await dispatcher.dispatch(
      {
        kind: 'tool_call',
        call: {
          toolName: 'checkComplianceCertificate',
          input: { certificateId: 'cert_1', jurisdiction: 'TZ' },
          callId: 'c5',
        },
      },
      CTX,
    );
    expect(result.kind).toBe('tool_ok');
    if (result.kind === 'tool_ok') {
      const out = result.output as { status: string; issuedAt: null };
      expect(out.status).toBe('not-found');
      expect(out.issuedAt).toBeNull();
    }
    expect(sink.rows().some((r) => r.name === 'checkComplianceCertificate' && r.outcome === 'ok')).toBe(true);
  });
});
