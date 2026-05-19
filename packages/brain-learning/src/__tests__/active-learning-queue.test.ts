/**
 * active-learning-queue tests.
 *
 * Covers triggers + queue lifecycle + anti-fatigue cap + decline
 * deprioritisation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  enqueueActiveLearningItem,
  buildDailyDigest,
  recordDecline,
  checkActiveLearningTrigger,
  MAX_ITEMS_PER_LABELLER_PER_DAY,
  DECLINE_DEPRIORITISE_THRESHOLD,
  CONFIDENCE_TRIGGER_THRESHOLD,
  PRM_STEP_TRIGGER_THRESHOLD,
  CALIBRATION_DRIFT_THRESHOLD,
  type ActiveLearningItemStore,
  type ActiveLearningPorts,
} from '../active-learning-queue/index.js';
import type { ActiveLearningItem } from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

function mkStore(): ActiveLearningItemStore & {
  __rows: ActiveLearningItem[];
} {
  const rows: ActiveLearningItem[] = [];
  return {
    __rows: rows,
    insert: async (item) => {
      rows.push(item);
    },
    updateStatus: async (args) => {
      const i = rows.findIndex(
        (r) => r.tenantId === args.tenantId && r.turnId === args.turnId,
      );
      if (i >= 0) {
        rows[i] = { ...rows[i], status: args.status };
      }
    },
    incrementDeclineCount: async (args) => {
      const i = rows.findIndex(
        (r) => r.tenantId === args.tenantId && r.turnId === args.turnId,
      );
      if (i < 0) return null;
      rows[i] = { ...rows[i], declineCount: rows[i].declineCount + 1 };
      return rows[i];
    },
    listPending: async (args) =>
      rows
        .filter((r) => r.tenantId === args.tenantId && r.status === 'pending')
        .slice(0, args.limit),
    countAssignedToday: vi.fn(async () => 0),
  };
}

function mkPorts(opts?: {
  store?: ReturnType<typeof mkStore>;
  countAssignedToday?: number;
}): ActiveLearningPorts & {
  __store: ReturnType<typeof mkStore>;
} {
  const store = opts?.store ?? mkStore();
  if (opts?.countAssignedToday !== undefined) {
    store.countAssignedToday = vi.fn(async () => opts.countAssignedToday!);
  }
  return {
    store,
    clock: () => CLOCK_AT,
    __store: store,
  };
}

// ───────────────────────── triggers ──────────────────────────────

describe('checkActiveLearningTrigger', () => {
  it('verbalised confidence < 0.6 → confidence-low', () => {
    expect(
      checkActiveLearningTrigger({
        verbalisedConfidence: 0.5,
        prmStepScore: null,
      }),
    ).toBe('confidence-low');
  });

  it('PRM step < 0.5 → prm-step-low (when confidence is OK)', () => {
    expect(
      checkActiveLearningTrigger({
        verbalisedConfidence: 0.8,
        prmStepScore: 0.3,
      }),
    ).toBe('prm-step-low');
  });

  it('|verbalised - logprob| > 0.25 → consistency-disagreement', () => {
    expect(
      checkActiveLearningTrigger({
        verbalisedConfidence: 0.85,
        prmStepScore: 0.8,
        logprobConsistency: 0.4,
      }),
    ).toBe('consistency-disagreement');
  });

  it('debate split → debate-split', () => {
    expect(
      checkActiveLearningTrigger({
        verbalisedConfidence: 0.8,
        prmStepScore: 0.7,
        debateSplit: true,
      }),
    ).toBe('debate-split');
  });

  it('all-clear → null', () => {
    expect(
      checkActiveLearningTrigger({
        verbalisedConfidence: 0.85,
        prmStepScore: 0.8,
        logprobConsistency: 0.82,
        debateSplit: false,
      }),
    ).toBeNull();
  });

  it('threshold constants exposed', () => {
    expect(CONFIDENCE_TRIGGER_THRESHOLD).toBe(0.6);
    expect(PRM_STEP_TRIGGER_THRESHOLD).toBe(0.5);
    expect(CALIBRATION_DRIFT_THRESHOLD).toBe(0.25);
  });
});

// ──────────────────────── enqueue ────────────────────────────────

describe('enqueueActiveLearningItem', () => {
  it('enqueues when confidence below threshold', async () => {
    const ports = mkPorts();
    const result = await enqueueActiveLearningItem(ports, {
      tenantId: TENANT,
      turnId: 'turn-1',
      signals: { verbalisedConfidence: 0.4, prmStepScore: null },
    });
    expect(result.enqueued).toBe(true);
    expect(result.trigger).toBe('confidence-low');
    expect(ports.__store.__rows.length).toBe(1);
    expect(ports.__store.__rows[0].status).toBe('pending');
  });

  it('skips when no trigger fires', async () => {
    const ports = mkPorts();
    const result = await enqueueActiveLearningItem(ports, {
      tenantId: TENANT,
      turnId: 'turn-2',
      signals: { verbalisedConfidence: 0.9, prmStepScore: 0.8 },
    });
    expect(result.enqueued).toBe(false);
    expect(result.trigger).toBeNull();
    expect(ports.__store.__rows.length).toBe(0);
  });

  it('starts declineCount at 0', async () => {
    const ports = mkPorts();
    await enqueueActiveLearningItem(ports, {
      tenantId: TENANT,
      turnId: 'turn-3',
      signals: { verbalisedConfidence: 0.4, prmStepScore: null },
    });
    expect(ports.__store.__rows[0].declineCount).toBe(0);
  });
});

// ─────────────────── daily digest + anti-fatigue ─────────────────

describe('buildDailyDigest', () => {
  it('caps at MAX_ITEMS_PER_LABELLER_PER_DAY', async () => {
    const store = mkStore();
    for (let i = 0; i < 50; i++) {
      store.__rows.push({
        tenantId: TENANT,
        turnId: `t${i}`,
        status: 'pending',
        verbalisedConfidence: 0.4,
        prmStepScore: null,
        reason: 'confidence-low',
        queuedAt: new Date(`2026-05-${10 + (i % 9)}T00:00:00Z`).toISOString(),
        declineCount: 0,
      });
    }
    const ports = mkPorts({ store, countAssignedToday: 0 });
    const digest = await buildDailyDigest(ports, {
      tenantId: TENANT,
      labellerId: 'l-1',
    });
    expect(digest.length).toBe(MAX_ITEMS_PER_LABELLER_PER_DAY);
    expect(MAX_ITEMS_PER_LABELLER_PER_DAY).toBe(25);
  });

  it('returns empty when labeller already hit cap', async () => {
    const store = mkStore();
    for (let i = 0; i < 30; i++) {
      store.__rows.push({
        tenantId: TENANT,
        turnId: `t${i}`,
        status: 'pending',
        verbalisedConfidence: 0.4,
        prmStepScore: null,
        reason: 'confidence-low',
        queuedAt: '2026-05-19T01:00:00Z',
        declineCount: 0,
      });
    }
    const ports = mkPorts({
      store,
      countAssignedToday: MAX_ITEMS_PER_LABELLER_PER_DAY,
    });
    const digest = await buildDailyDigest(ports, {
      tenantId: TENANT,
      labellerId: 'l-1',
    });
    expect(digest.length).toBe(0);
  });

  it('sorts low-decline items first', async () => {
    const store = mkStore();
    store.__rows.push({
      tenantId: TENANT,
      turnId: 'tDeclined',
      status: 'pending',
      verbalisedConfidence: 0.3,
      prmStepScore: null,
      reason: 'confidence-low',
      queuedAt: '2026-05-19T01:00:00Z',
      declineCount: 5,
    });
    store.__rows.push({
      tenantId: TENANT,
      turnId: 'tFresh',
      status: 'pending',
      verbalisedConfidence: 0.3,
      prmStepScore: null,
      reason: 'confidence-low',
      queuedAt: '2026-05-19T02:00:00Z',
      declineCount: 0,
    });
    const ports = mkPorts({ store, countAssignedToday: 0 });
    const digest = await buildDailyDigest(ports, {
      tenantId: TENANT,
      labellerId: 'l-1',
    });
    expect(digest[0].turnId).toBe('tFresh');
    expect(digest[1].turnId).toBe('tDeclined');
  });
});

// ──────────────────────── decline ────────────────────────────────

describe('recordDecline', () => {
  it('increments decline count', async () => {
    const store = mkStore();
    store.__rows.push({
      tenantId: TENANT,
      turnId: 't1',
      status: 'pending',
      verbalisedConfidence: 0.3,
      prmStepScore: null,
      reason: 'confidence-low',
      queuedAt: '2026-05-19T01:00:00Z',
      declineCount: 0,
    });
    const ports = mkPorts({ store });
    const r1 = await recordDecline(ports, { tenantId: TENANT, turnId: 't1' });
    expect(r1.newDeclineCount).toBe(1);
    expect(r1.deprioritised).toBe(false);
  });

  it('deprioritises at threshold', async () => {
    const store = mkStore();
    store.__rows.push({
      tenantId: TENANT,
      turnId: 't1',
      status: 'pending',
      verbalisedConfidence: 0.3,
      prmStepScore: null,
      reason: 'confidence-low',
      queuedAt: '2026-05-19T01:00:00Z',
      declineCount: DECLINE_DEPRIORITISE_THRESHOLD - 1,
    });
    const ports = mkPorts({ store });
    const result = await recordDecline(ports, {
      tenantId: TENANT,
      turnId: 't1',
    });
    expect(result.newDeclineCount).toBe(DECLINE_DEPRIORITISE_THRESHOLD);
    expect(result.deprioritised).toBe(true);
    expect(DECLINE_DEPRIORITISE_THRESHOLD).toBe(3);
  });

  it('no-op for missing item', async () => {
    const ports = mkPorts();
    const result = await recordDecline(ports, {
      tenantId: TENANT,
      turnId: 'absent',
    });
    expect(result.newDeclineCount).toBe(0);
    expect(result.deprioritised).toBe(false);
  });
});
