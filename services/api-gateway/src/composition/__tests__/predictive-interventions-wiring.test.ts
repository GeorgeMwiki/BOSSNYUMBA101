/**
 * Unit tests for the predictive-interventions composition wiring.
 *
 * The DB-service layer is exercised via a stub Drizzle client that
 * records every call shape; we verify that the wiring correctly
 * adapts the DB service into the agent's
 * `PredictiveInterventionRepository` port.
 *
 * The agent itself is constructed for real (no mocks) so we also get
 * a smoke test that the cross-package types still align.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPredictiveInterventionsWiring,
  __createRepoAdapterForTests,
  narrowSignalType,
} from '../predictive-interventions-wiring';
import type {
  InterventionOpportunity,
  TenantPrediction,
} from '@bossnyumba/ai-copilot/ai-native';

// ---------------------------------------------------------------------------
// Stub Drizzle client — captures every chained call so we can assert the
// shape passed in by the DB service. Only models the chains the
// `tenant-predictions.service` actually uses.
// ---------------------------------------------------------------------------

interface StubCall {
  readonly method: string;
  readonly args: ReadonlyArray<unknown>;
}

interface StubDb {
  readonly __calls: StubCall[];
  __nextRows: ReadonlyArray<Record<string, unknown>>;
  insert(table: unknown): StubChain;
  select(): StubChain;
}

interface StubChain {
  values(args: unknown): Promise<void>;
  from(table: unknown): StubChain;
  where(cond: unknown): StubChain;
  orderBy(arg: unknown): StubChain;
  limit(n: number): Promise<ReadonlyArray<Record<string, unknown>>>;
}

function createStubDb(): StubDb {
  const calls: StubCall[] = [];
  const state: { nextRows: ReadonlyArray<Record<string, unknown>> } = {
    nextRows: [],
  };

  const chain: StubChain = {
    async values(args) {
      calls.push({ method: 'values', args: [args] });
    },
    from(table) {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
    where(cond) {
      calls.push({ method: 'where', args: [cond] });
      return chain;
    },
    orderBy(arg) {
      calls.push({ method: 'orderBy', args: [arg] });
      return chain;
    },
    async limit(n) {
      calls.push({ method: 'limit', args: [n] });
      const rows = state.nextRows;
      state.nextRows = [];
      return rows;
    },
  };

  return {
    __calls: calls,
    get __nextRows() {
      return state.nextRows;
    },
    set __nextRows(rows: ReadonlyArray<Record<string, unknown>>) {
      state.nextRows = rows;
    },
    insert(table) {
      calls.push({ method: 'insert', args: [table] });
      return chain;
    },
    select() {
      calls.push({ method: 'select', args: [] });
      return chain;
    },
  };
}

// `as never` because the stub does not satisfy the full Drizzle surface;
// it only models the chains the production code actually uses.
function asDb(stub: StubDb): never {
  return stub as never;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PREDICTION: TenantPrediction = {
  id: 'tp_test_1',
  tenantId: 'tenant-7',
  customerId: 'customer-42',
  horizonDays: 30,
  probPayOnTime: 0.7,
  probPayLate: 0.2,
  probDefault: 0.05,
  probChurn: 0.1,
  probDispute: 0.03,
  modelVersion: 'degraded-baseline-v1',
  confidence: 0.35,
  explanation: 'Rule-based baseline (LLM unavailable); confidence reduced.',
  featureSnapshot: { paymentOnTimeRate: 0.9 },
  promptHash: 'abc123',
  computedAt: '2026-05-08T00:00:00.000Z',
};

const SAMPLE_OPPORTUNITY: InterventionOpportunity = {
  id: 'pio_test_1',
  tenantId: 'tenant-7',
  customerId: 'customer-42',
  predictionId: 'tp_test_1',
  signalType: 'high_default_risk',
  signalStrength: 0.8,
  suggestedAction: 'Offer payment plan.',
  status: 'open',
  metadata: {},
  createdAt: '2026-05-08T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPredictiveInterventionsWiring', () => {
  let stub: StubDb;
  let logger: { warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    stub = createStubDb();
    logger = { warn: vi.fn() };
  });

  it('returns null when db is null', () => {
    const wiring = createPredictiveInterventionsWiring({
      db: null,
      logger,
    });
    expect(wiring).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns wiring with .agent when db is present', () => {
    const wiring = createPredictiveInterventionsWiring({
      db: asDb(stub),
      logger,
    });
    expect(wiring).not.toBeNull();
    expect(wiring!.agent).toBeDefined();
    // Agent surface check: predictOne / runNightly / listRecent
    expect(typeof wiring!.agent.predictOne).toBe('function');
    expect(typeof wiring!.agent.runNightly).toBe('function');
    expect(typeof wiring!.agent.listRecent).toBe('function');
  });

  it('listActiveTenants returns an empty list (graceful no-op contract)', async () => {
    const repo = __createRepoAdapterForTests(asDb(stub), logger);
    const result = await repo.listActiveTenants('tenant-7');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      { tenantId: 'tenant-7' },
      expect.stringContaining('listActiveTenants'),
    );
  });

  it('insertPrediction delegates to the DB service (issues an insert with the right values)', async () => {
    const repo = __createRepoAdapterForTests(asDb(stub), logger);
    const out = await repo.insertPrediction(SAMPLE_PREDICTION);
    expect(out.id).toBe(SAMPLE_PREDICTION.id);

    const insertCall = stub.__calls.find((c) => c.method === 'insert');
    const valuesCall = stub.__calls.find((c) => c.method === 'values');
    expect(insertCall).toBeDefined();
    expect(valuesCall).toBeDefined();
    const values = valuesCall!.args[0] as Record<string, unknown>;
    expect(values.id).toBe(SAMPLE_PREDICTION.id);
    expect(values.tenantId).toBe(SAMPLE_PREDICTION.tenantId);
    expect(values.customerId).toBe(SAMPLE_PREDICTION.customerId);
    expect(values.probPayOnTime).toBe(SAMPLE_PREDICTION.probPayOnTime);
    expect(values.probDefault).toBe(SAMPLE_PREDICTION.probDefault);
    expect(values.modelVersion).toBe(SAMPLE_PREDICTION.modelVersion);
  });

  it('insertOpportunity delegates to the DB service and preserves the union signalType', async () => {
    const repo = __createRepoAdapterForTests(asDb(stub), logger);
    const out = await repo.insertOpportunity(SAMPLE_OPPORTUNITY);
    expect(out.id).toBe(SAMPLE_OPPORTUNITY.id);
    expect(out.signalType).toBe('high_default_risk');

    const valuesCall = stub.__calls.find((c) => c.method === 'values');
    const values = valuesCall!.args[0] as Record<string, unknown>;
    expect(values.signalType).toBe('high_default_risk');
    expect(values.signalStrength).toBe(SAMPLE_OPPORTUNITY.signalStrength);
    expect(values.status).toBe('open');
  });

  it('listRecentPredictions round-trips rows through the DB service', async () => {
    stub.__nextRows = [
      {
        id: 'tp_db_1',
        tenantId: 'tenant-7',
        customerId: 'customer-42',
        horizonDays: 30,
        probPayOnTime: '0.7',
        probPayLate: '0.2',
        probDefault: '0.05',
        probChurn: '0.1',
        probDispute: '0.03',
        modelVersion: 'degraded-baseline-v1',
        confidence: '0.35',
        explanation: 'baseline',
        featureSnapshot: { x: 1 },
        promptHash: 'hash-1',
        computedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
    ];

    const repo = __createRepoAdapterForTests(asDb(stub), logger);
    const rows = await repo.listRecentPredictions('tenant-7', 'customer-42');
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe('tp_db_1');
    expect(rows[0]?.probPayOnTime).toBe(0.7);
    expect(rows[0]?.horizonDays).toBe(30);
    expect(rows[0]?.computedAt).toBe('2026-05-08T00:00:00.000Z');
  });
});

describe('narrowSignalType', () => {
  it('preserves all four valid signal types', () => {
    expect(narrowSignalType('high_default_risk')).toBe('high_default_risk');
    expect(narrowSignalType('high_churn_risk')).toBe('high_churn_risk');
    expect(narrowSignalType('high_dispute_risk')).toBe('high_dispute_risk');
    expect(narrowSignalType('sentiment_collapse')).toBe('sentiment_collapse');
  });

  it('falls back to high_default_risk for unknown values', () => {
    expect(narrowSignalType('unknown_signal')).toBe('high_default_risk');
    expect(narrowSignalType('')).toBe('high_default_risk');
  });
});
