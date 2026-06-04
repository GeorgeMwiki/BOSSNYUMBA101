/**
 * Wire tests: the flag name, default-OFF null, the bound facade, a happy-path
 * drill, and a malformed input rejected at the zod boundary without throwing.
 */

import { describe, it, expect } from 'vitest';
import {
  wireRegulatorSim,
  REGULATOR_SIM_FLAG,
  createInMemoryAuditStore,
  DEFAULT_ALLOWED_REASON_CODES,
  type AuditReplayInput,
  type DecisionRecord,
  type RegulatorAuditSink,
  type WireRegulatorSimDeps,
} from './index';

function goodRecord(): DecisionRecord {
  return {
    decisionId: 'dec-1',
    domain: 'rent',
    decidedAt: '2026-06-02T09:00:00.000Z',
    outcome: 'approve',
    cotTrace: 'cot-hash-abc',
    reasonCodes: ['RENT_RECONCILED'],
    reasonNotesEn: 'Rent reconciled against the ledger.',
    reasonNotesSw: 'Kodi imelinganishwa na leja.',
    modelId: 'mwikila-rent-v3',
    modelCardVersion: '3.1',
    modelCardCurrentAt: '2026-05-20T00:00:00.000Z',
    fairnessTpDelta: 0.02,
    fairnessFpDelta: 0.01,
    crossOrgAction: false,
    approverIds: ['officer-a'],
  };
}

const happyInput: AuditReplayInput = {
  fromIso: '2026-06-01T00:00:00.000Z',
  toIso: '2026-06-03T00:00:00.000Z',
  records: [goodRecord()],
  fairnessTolerance: 0.1,
  registeredModelIds: ['mwikila-rent-v3'],
  allowedReasonCodes: [...DEFAULT_ALLOWED_REASON_CODES],
  modelCardMaxAgeDays: 90,
};

function baseDeps(enabled: boolean): WireRegulatorSimDeps {
  return {
    enabled,
    store: createInMemoryAuditStore(),
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(REGULATOR_SIM_FLAG).toBe('BOSSNYUMBA_FEATURE_REGULATOR_SIM');
  });
});

describe('wireRegulatorSim — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireRegulatorSim(baseDeps(false))).toBeNull();
  });

  it('returns a bound facade when the flag is enabled', () => {
    const sim = wireRegulatorSim(baseDeps(true));
    expect(sim).not.toBeNull();
    expect(typeof sim?.handle).toBe('function');
  });
});

describe('wireRegulatorSim — bound handle', () => {
  it('runs a happy-path drill and persists the run', async () => {
    const store = createInMemoryAuditStore();
    const logged: string[] = [];
    const audit: RegulatorAuditSink = { log: (e) => logged.push(e.detail) };
    const sim = wireRegulatorSim({ enabled: true, store, audit });

    const outcome = await sim!.handle(happyInput);
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.passed).toBe(true);
    expect(outcome.runId).toMatch(/^run-/);

    const persisted = await store.get(outcome.runId);
    expect(persisted?.status).toBe('complete');
    expect(logged.length).toBe(1);
  });

  it('rejects a malformed input via the zod boundary without throwing', async () => {
    const sim = wireRegulatorSim(baseDeps(true));
    // fairnessTolerance is required to be a number; pass garbage.
    const bad = {
      fromIso: '',
      toIso: '',
      records: [],
      fairnessTolerance: 'nope',
      registeredModelIds: [],
      allowedReasonCodes: [],
      modelCardMaxAgeDays: -1,
    } as unknown as AuditReplayInput;

    const outcome = await sim!.handle(bad);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/invalid audit replay input/);
  });

  it('does not let a throwing audit sink break the hot path', async () => {
    const explosiveAudit: RegulatorAuditSink = {
      log: () => {
        throw new Error('sink down');
      },
    };
    const sim = wireRegulatorSim({
      enabled: true,
      store: createInMemoryAuditStore(),
      audit: explosiveAudit,
    });
    const outcome = await sim!.handle(happyInput);
    expect(outcome.ok).toBe(true);
  });
});
