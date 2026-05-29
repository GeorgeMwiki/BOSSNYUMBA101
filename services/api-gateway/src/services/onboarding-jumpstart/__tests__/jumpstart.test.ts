/**
 * Day-1 jumpstart tests — Wave COMPANY-BRAIN (Y-D).
 *
 * Cover the at-most-once invariant, the dismissed-by-owner gate, the
 * card content, and the bilingual narrative output.
 */

import { describe, expect, it, vi } from 'vitest';

import { maybeFireJumpstart } from '../jumpstart.js';
import { buildJumpstartCard } from '../card-builder.js';
import type { OnboardingPersistence, OnboardingStateRow } from '../persistence.js';
import type { JumpstartInput } from '../types.js';
import type { IngestIntent } from '../../ingestion-intent-inferrer/types.js';

function freshIntent(overrides?: Partial<IngestIntent>): IngestIntent {
  return Object.freeze({
    proposedTabs: Object.freeze([
      Object.freeze({
        tabType: 'tenants',
        titleEn: 'Tenants',
        titleSw: 'Wapangaji',
        reasonEn: 'reason',
        reasonSw: 'sababu',
        evidenceIds: Object.freeze(['chunk-1']),
        confidence: 0.7,
        config: Object.freeze({}),
      }),
    ]),
    proposedReminders: Object.freeze([]),
    proposedOpportunities: Object.freeze([]),
    proposedRisks: Object.freeze([]),
    confidence: 0.6,
    narrativeEn: 'Mr. Mwikila scanned the doc.',
    narrativeSw: 'Mr. Mwikila amechanganua hati.',
    reasonTag: 'heuristic-v1',
    provider: 'heuristic',
    generatedAtIso: new Date(0).toISOString(),
    ...overrides,
  });
}

function input(overrides?: Partial<JumpstartInput>): JumpstartInput {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    uploadId: 'upload-abc',
    intent: freshIntent(),
    filename: 'lease.pdf',
    summaryEn: 'Standard lease.',
    summarySw: 'Mkataba wa kawaida.',
    ...overrides,
  };
}

function makePersistence(
  initial: Partial<OnboardingStateRow> = {},
): OnboardingPersistence & {
  readonly markFirstIngest: ReturnType<typeof vi.fn>;
  readonly markJumpstarted: ReturnType<typeof vi.fn>;
} {
  const state: OnboardingStateRow = Object.freeze({
    tenantId: 'tenant-1',
    status: 'pending',
    firstIngestAt: null,
    jumpstartedAt: null,
    ...initial,
  });
  return {
    async fetch() {
      return state;
    },
    markFirstIngest: vi.fn(async ({ nowIso }: { nowIso: string }) =>
      Object.freeze({
        ...state,
        status: state.status === 'demoed' || state.status === 'dismissed' ? state.status : 'ready',
        firstIngestAt: state.firstIngestAt ?? nowIso,
      }),
    ),
    markJumpstarted: vi.fn(async ({ nowIso }: { nowIso: string }) =>
      Object.freeze({
        ...state,
        status: 'demoed' as const,
        firstIngestAt: state.firstIngestAt ?? nowIso,
        jumpstartedAt: nowIso,
      }),
    ),
  } as OnboardingPersistence & {
    readonly markFirstIngest: ReturnType<typeof vi.fn>;
    readonly markJumpstarted: ReturnType<typeof vi.fn>;
  };
}

describe('maybeFireJumpstart — Day-1 demo orchestrator', () => {
  it('fires on the very first ingest', async () => {
    const persistence = makePersistence();
    const publish = vi.fn(() => 1);
    const result = await maybeFireJumpstart(
      { persistence, publish, now: () => new Date('2026-05-29T10:00:00Z') },
      input(),
    );
    expect(result.fired).toBe(true);
    expect(result.skippedReason).toBeNull();
    expect(result.card).not.toBeNull();
    expect(persistence.markFirstIngest).toHaveBeenCalledOnce();
    expect(persistence.markJumpstarted).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
  });

  it('skips jumpstart when status is already "demoed"', async () => {
    const persistence = makePersistence({ status: 'demoed' });
    const publish = vi.fn(() => 1);
    const result = await maybeFireJumpstart(
      { persistence, publish, now: () => new Date('2026-05-29T10:00:00Z') },
      input(),
    );
    expect(result.fired).toBe(false);
    expect(result.skippedReason).toBe('already_demoed');
    expect(persistence.markJumpstarted).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('skips jumpstart when status is "dismissed" by owner', async () => {
    const persistence = makePersistence({ status: 'dismissed' });
    const publish = vi.fn(() => 1);
    const result = await maybeFireJumpstart(
      { persistence, publish, now: () => new Date('2026-05-29T10:00:00Z') },
      input(),
    );
    expect(result.fired).toBe(false);
    expect(result.skippedReason).toBe('dismissed_by_owner');
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes a property.celebrate event with the proposal count', async () => {
    const persistence = makePersistence();
    const captured: unknown[] = [];
    const publish = vi.fn((event: unknown) => {
      captured.push(event);
      return 1;
    });
    await maybeFireJumpstart(
      { persistence, publish, now: () => new Date('2026-05-29T10:00:00Z') },
      input(),
    );
    expect(captured).toHaveLength(1);
    const evt = captured[0] as { kind: string; proposalCount: number; tenantId: string };
    expect(evt.kind).toBe('property.celebrate');
    expect(evt.proposalCount).toBe(1);
    expect(evt.tenantId).toBe('tenant-1');
  });

  it('does not throw when publish fails (non-fatal)', async () => {
    const persistence = makePersistence();
    const publish = vi.fn(() => {
      throw new Error('bus down');
    });
    const logger = { info: vi.fn(), warn: vi.fn() };
    const result = await maybeFireJumpstart(
      {
        persistence,
        publish,
        logger,
        now: () => new Date('2026-05-29T10:00:00Z'),
      },
      input(),
    );
    expect(result.fired).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('buildJumpstartCard — content shape', () => {
  it('renders bilingual headers and subheaders', () => {
    const card = buildJumpstartCard({
      filename: 'lease.pdf',
      summaryEn: 'En summary',
      summarySw: 'Sw summary',
      intent: freshIntent(),
    });
    expect(card.headerEn).toContain('Karibu');
    expect(card.headerSw).toContain('Karibu');
    expect(card.headerEn).toContain('Mr. Mwikila');
    expect(card.headerSw).toContain('Mr. Mwikila');
    expect(card.subheaderEn).toContain('lease.pdf');
    expect(card.subheaderSw).toContain('lease.pdf');
  });

  it('emits at least 4 baseline metric rows', () => {
    const card = buildJumpstartCard({
      filename: 'lease.pdf',
      summaryEn: null,
      summarySw: null,
      intent: freshIntent(),
    });
    expect(card.metrics.length).toBeGreaterThanOrEqual(4);
  });

  it('skips the summary metric when only one language is present', () => {
    const card = buildJumpstartCard({
      filename: 'lease.pdf',
      summaryEn: 'English summary',
      summarySw: null,
      intent: freshIntent(),
    });
    const summaryMetric = card.metrics.find((m) => m.labelEn === 'Summary');
    expect(summaryMetric?.value).toBe('English summary');
    const swMetric = card.metrics.find((m) => m.labelEn === 'Muhtasari (sw)');
    expect(swMetric).toBeUndefined();
  });

  it('forwards the intent untouched', () => {
    const intent = freshIntent();
    const card = buildJumpstartCard({
      filename: 'lease.pdf',
      summaryEn: null,
      summarySw: null,
      intent,
    });
    expect(card.intent).toBe(intent);
  });
});
