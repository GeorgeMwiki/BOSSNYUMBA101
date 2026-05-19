/**
 * Combined unit tests for the four other sample views:
 *   - LeaseTimelineView
 *   - ArrearsTableView
 *   - KraFilingProfileCardView
 *   - RecommendationListView
 *
 * Each view gets at least 4 tests covering validateQuery happy +
 * sad paths and renderToBlocks happy + edge paths. The shared
 * harness keeps the file manageable.
 */

import { describe, expect, it } from 'vitest';
import {
  LeaseTimelineView,
  type LeaseData,
} from '../views/lease-timeline-view.js';
import {
  ArrearsTableView,
  type ArrearsData,
  type ArrearsRow,
} from '../views/arrears-table-view.js';
import {
  KraFilingProfileCardView,
  type KraFilingData,
} from '../views/kra-filing-profile-card-view.js';
import {
  RecommendationListView,
  type RecommendationData,
} from '../views/recommendation-list-view.js';
import { ownerCustomer } from '../types/principal.js';
import type { RenderContext } from '../types/tab-view.js';

function ctxFor(entityType: string): RenderContext {
  return {
    principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }),
    entityType,
  };
}

// ─── LeaseTimelineView ────────────────────────────────────────────────

describe('LeaseTimelineView', () => {
  it('defaults to limit=100 when no query provided', () => {
    const r = LeaseTimelineView.validateQuery(undefined, ctxFor('lease'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.limit).toBe(100);
  });

  it('rejects unknown category', () => {
    const r = LeaseTimelineView.validateQuery(
      { categories: ['unknown-category'] },
      ctxFor('lease'),
    );
    expect(r.ok).toBe(false);
  });

  it('emits a timeline block sorted newest-first', () => {
    const data: LeaseData = {
      events: [
        {
          id: 'e1',
          leaseId: 'L-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          category: 'rent-paid',
          title: 'Rent paid Jan',
        },
        {
          id: 'e2',
          leaseId: 'L-1',
          timestamp: '2026-03-01T00:00:00.000Z',
          category: 'rent-paid',
          title: 'Rent paid Mar',
        },
        {
          id: 'e3',
          leaseId: 'L-1',
          timestamp: '2026-02-01T00:00:00.000Z',
          category: 'rent-paid',
          title: 'Rent paid Feb',
        },
      ],
    };
    const blocks = LeaseTimelineView.renderToBlocks(data, ctxFor('lease'));
    expect(blocks[0]?.kind).toBe('timeline');
    const events = (blocks[0] as unknown as { events: { title: string }[] }).events;
    expect(events.map((e) => e.title)).toEqual([
      'Rent paid Mar',
      'Rent paid Feb',
      'Rent paid Jan',
    ]);
  });

  it('maps category to severity', () => {
    const data: LeaseData = {
      events: [
        {
          id: 'e1',
          leaseId: 'L-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          category: 'rent-missed',
          title: 'Rent missed',
        },
        {
          id: 'e2',
          leaseId: 'L-1',
          timestamp: '2026-02-01T00:00:00.000Z',
          category: 'lease-renewed',
          title: 'Renewed',
        },
      ],
    };
    const blocks = LeaseTimelineView.renderToBlocks(data, ctxFor('lease'));
    const events = (blocks[0] as unknown as { events: { severity: string }[] }).events;
    expect(events.find((e) => (e as unknown as { title: string }).title === 'Rent missed')?.severity).toBe(
      'error',
    );
    expect(
      events.find((e) => (e as unknown as { title: string }).title === 'Renewed')?.severity,
    ).toBe('success');
  });

  it('renders a markdown-card when there are no events', () => {
    const blocks = LeaseTimelineView.renderToBlocks({ events: [] }, ctxFor('lease'));
    expect(blocks[0]?.kind).toBe('markdown-card');
  });
});

// ─── ArrearsTableView ─────────────────────────────────────────────────

describe('ArrearsTableView', () => {
  function row(over: Partial<ArrearsRow> = {}): ArrearsRow {
    return {
      id: 'a1',
      tenantPersonId: 't-p-1',
      tenantName: 'Asha Mwangi',
      leaseId: 'L-1',
      propertyLabel: 'Unit 4B',
      amountDueCents: 50_000_00,
      daysLate: 32,
      rank: 32 * 50_000_00,
      currency: 'KES',
      ...over,
    };
  }

  it('rejects an invalid sortBy', () => {
    const r = ArrearsTableView.validateQuery({ sortBy: 'colour' }, ctxFor('arrears'));
    expect(r.ok).toBe(false);
  });

  it('defaults to limit=25 sortBy=rank desc', () => {
    const r = ArrearsTableView.validateQuery(undefined, ctxFor('arrears'));
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.query).toEqual({ limit: 25, sortBy: 'rank', sortDir: 'desc' });
  });

  it('emits BOTH a data-table and a prompt-suggestions block', () => {
    const data: ArrearsData = { rows: [row()] };
    const blocks = ArrearsTableView.renderToBlocks(data, ctxFor('arrears'));
    expect(blocks.length).toBe(2);
    expect(blocks[0]?.kind).toBe('data-table');
    expect(blocks[1]?.kind).toBe('prompt-suggestions');
  });

  it('renders a success card when there are no arrears', () => {
    const blocks = ArrearsTableView.renderToBlocks({ rows: [] }, ctxFor('arrears'));
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.kind).toBe('markdown-card');
    expect((blocks[0] as unknown as { severity: string }).severity).toBe('success');
  });

  it('table emits the currency the data carries', () => {
    const data: ArrearsData = { rows: [row({ currency: 'USD' })] };
    const blocks = ArrearsTableView.renderToBlocks(data, ctxFor('arrears'));
    const cols = (blocks[0] as unknown as { columns: { id: string; currency?: string }[] }).columns;
    const amount = cols.find((c) => c.id === 'amountDue');
    expect(amount?.currency).toBe('USD');
  });

  it('includes 3 bulk-action suggestions', () => {
    const data: ArrearsData = { rows: [row()] };
    const blocks = ArrearsTableView.renderToBlocks(data, ctxFor('arrears'));
    const sugg = (blocks[1] as unknown as { suggestions: { label: string }[] }).suggestions;
    expect(sugg.length).toBe(3);
    expect(sugg.map((s) => s.label)).toContain('Send reminders to all');
  });
});

// ─── KraFilingProfileCardView ─────────────────────────────────────────

describe('KraFilingProfileCardView', () => {
  function data(over: Partial<KraFilingData> = {}): KraFilingData {
    return {
      id: 'F-1',
      authorityLabel: 'Kenya Revenue Authority',
      jurisdiction: 'KE',
      filingPeriod: '2026-Q1',
      filingTypeLabel: 'PAYE Return',
      status: 'review-required',
      dueDate: '2026-05-31',
      amountDueCents: 50_000_00,
      currency: 'KES',
      summary: 'Quarterly PAYE return for staff salaries.',
      payloadPreview: '{"gross_pay":"500000","tax_due":"50000"}',
      attachmentsCount: 2,
      ...over,
    };
  }

  it('rejects unknown status filter', () => {
    const r = KraFilingProfileCardView.validateQuery(
      { status: 'archived' },
      ctxFor('kra-filing'),
    );
    expect(r.ok).toBe(false);
  });

  it('accepts an empty query', () => {
    const r = KraFilingProfileCardView.validateQuery({}, ctxFor('kra-filing'));
    expect(r.ok).toBe(true);
  });

  it('emits markdown-card + prompt-suggestions for review-required', () => {
    const blocks = KraFilingProfileCardView.renderToBlocks(data(), ctxFor('kra-filing'));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]?.kind).toBe('markdown-card');
    expect(blocks[1]?.kind).toBe('prompt-suggestions');
  });

  it('uses authorityLabel from data — no hard-coded KRA string', () => {
    const blocks = KraFilingProfileCardView.renderToBlocks(
      data({ authorityLabel: 'Tanzania Revenue Authority', jurisdiction: 'TZ' }),
      ctxFor('kra-filing'),
    );
    const md = (blocks[0] as unknown as { markdown: string }).markdown;
    expect(md).toContain('Tanzania Revenue Authority');
    expect(md).toContain('TZ');
  });

  it('paid status emits markdown-card with success severity and no actions', () => {
    const blocks = KraFilingProfileCardView.renderToBlocks(
      data({ status: 'paid' }),
      ctxFor('kra-filing'),
    );
    expect((blocks[0] as unknown as { severity: string }).severity).toBe('success');
    // No actions for a paid filing.
    expect(blocks.find((b) => b.kind === 'prompt-suggestions')).toBeUndefined();
  });

  it('overdue status surfaces "Mark paid" action', () => {
    const blocks = KraFilingProfileCardView.renderToBlocks(
      data({ status: 'overdue' }),
      ctxFor('kra-filing'),
    );
    const actions = blocks.find((b) => b.kind === 'prompt-suggestions') as unknown as {
      suggestions: { label: string }[];
    };
    expect(actions.suggestions.map((s) => s.label)).toContain('Mark paid');
  });
});

// ─── RecommendationListView ───────────────────────────────────────────

describe('RecommendationListView', () => {
  function data(): RecommendationData {
    return {
      rows: [
        {
          id: 'r1',
          title: 'Raise rent on Unit 4B',
          category: 'pricing',
          confidence: 0.92,
          impact: 8,
          status: 'pending',
          summary: 'Comp set at 12% above current rent.',
          createdAt: '2026-05-19T00:00:00.000Z',
        },
        {
          id: 'r2',
          title: 'Refer plumber X to platform',
          category: 'vendor',
          confidence: 0.4,
          impact: 9,
          status: 'pending',
          summary: 'Tier-A reliability score',
          createdAt: '2026-05-19T00:00:00.000Z',
        },
        {
          id: 'r3',
          title: 'Renew lease L-204 early',
          category: 'lease',
          confidence: 0.78,
          impact: 6,
          status: 'pending',
          summary: 'Tenant indicated openness',
          createdAt: '2026-05-19T00:00:00.000Z',
        },
      ],
    };
  }

  it('defaults to limit=20, statuses=[pending]', () => {
    const r = RecommendationListView.validateQuery(undefined, ctxFor('recommendation'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.limit).toBe(20);
      expect(r.query.statuses).toEqual(['pending']);
    }
  });

  it('rejects minConfidence outside [0, 1]', () => {
    const r = RecommendationListView.validateQuery({ minConfidence: 1.5 }, ctxFor('recommendation'));
    expect(r.ok).toBe(false);
  });

  it('ranks by confidence × impact descending', () => {
    const blocks = RecommendationListView.renderToBlocks(data(), ctxFor('recommendation'));
    const rows = (blocks[0] as unknown as { rows: { id: string; score: number }[] }).rows;
    // r1: 0.92*8 = 7.36 ; r3: 0.78*6 = 4.68 ; r2: 0.4*9 = 3.6
    expect(rows.map((r) => r.id)).toEqual(['r1', 'r3', 'r2']);
    expect(rows[0]?.score).toBeCloseTo(7.36, 2);
  });

  it('emits a prompt-suggestions block with 4 action suggestions', () => {
    const blocks = RecommendationListView.renderToBlocks(data(), ctxFor('recommendation'));
    const sugg = (blocks[1] as unknown as { suggestions: { label: string }[] }).suggestions;
    expect(sugg.length).toBe(4);
  });

  it('renders empty-state markdown when there are no recommendations', () => {
    const blocks = RecommendationListView.renderToBlocks(
      { rows: [] },
      ctxFor('recommendation'),
    );
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.kind).toBe('markdown-card');
  });
});
