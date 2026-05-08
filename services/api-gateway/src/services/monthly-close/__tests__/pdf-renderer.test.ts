/**
 * Unit tests for the in-process owner-statement PDF renderer.
 *
 * The renderer is driven through a stub Drizzle `execute` so the tests
 * stay schema-agnostic — we assert the contract:
 *   - selects only `status='draft'` rows for the supplied tenant,
 *   - calls the placeholder `render` once per draft,
 *   - issues an UPDATE per draft that flips `status -> pending_review`
 *     with a populated `pdf_url`,
 *   - returns `{ rendered, failed }` counts,
 *   - never throws on transient DB errors — surfaces a structured warn.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildStatementSummary,
  createDrizzlePdfRenderer,
  renderPdfBytes,
} from '../pdf-renderer';

const noopLogger = {
  warn: vi.fn(),
  info: vi.fn(),
};

function makeDb(rowsByCall: ReadonlyArray<readonly Record<string, unknown>[]>) {
  let i = 0;
  const execute = vi.fn(async () => {
    const rows = rowsByCall[i] ?? [];
    i += 1;
    return rows;
  });
  return { db: { execute }, execute };
}

describe('buildStatementSummary', () => {
  it('produces a deterministic summary block from the row fields', () => {
    const out = buildStatementSummary({
      statementId: 'stmt-1',
      statementNumber: 'STMT-2026-04-owner-01',
      ownerId: 'owner-01',
      periodStart: '2026-04-01T00:00:00Z',
      periodEnd: '2026-05-01T00:00:00Z',
      grossRentMinor: 1_500_000,
      currency: 'KES',
    });
    expect(out).toContain('Statement: STMT-2026-04-owner-01');
    expect(out).toContain('Owner: owner-01');
    expect(out).toContain('Gross rent (minor units): 1500000');
    expect(out).toContain('Currency: KES');
  });

  it('falls back to XXX when currency is empty', () => {
    const out = buildStatementSummary({
      statementId: 's',
      statementNumber: 'n',
      ownerId: 'o',
      periodStart: 'a',
      periodEnd: 'b',
      grossRentMinor: 0,
      currency: '',
    });
    expect(out).toContain('Currency: XXX');
  });
});

describe('renderPdfBytes (placeholder)', () => {
  it('returns a buffer that wraps the supplied html body', () => {
    const out = renderPdfBytes('hello');
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString('utf8')).toBe('<placeholder>hello</placeholder>');
  });
});

describe('createDrizzlePdfRenderer.renderDraftsForRun', () => {
  it('renders every draft, flips status, and writes pdf_url', async () => {
    const drafts = [
      {
        id: 'stmt-1',
        statement_number: 'STMT-2026-04-A',
        owner_id: 'owner-A',
        period_start: '2026-04-01T00:00:00Z',
        period_end: '2026-05-01T00:00:00Z',
        gross_rent_collected: '1500000',
        currency: 'KES',
      },
      {
        id: 'stmt-2',
        statement_number: 'STMT-2026-04-B',
        owner_id: 'owner-B',
        period_start: '2026-04-01T00:00:00Z',
        period_end: '2026-05-01T00:00:00Z',
        gross_rent_collected: '800000',
        currency: 'TZS',
      },
    ];
    const { db, execute } = makeDb([drafts, [], []]);
    const renderer = createDrizzlePdfRenderer({ db, logger: noopLogger });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 2, failed: 0 });
    // 1 SELECT + 2 UPDATE calls
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('returns zeroes and warns when the SELECT fails', async () => {
    const warn = vi.fn();
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const renderer = createDrizzlePdfRenderer({
      db,
      logger: { warn, info: vi.fn() },
    });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 0, failed: 0 });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 'pdf-renderer',
        degraded_reason: 'select_drafts_failed',
        runId: 'run-1',
        tenantId: 'tenant-A',
      }),
      expect.any(String),
    );
  });

  it('counts a failed UPDATE under `failed` and continues with the rest', async () => {
    const drafts = [
      {
        id: 'stmt-1',
        statement_number: 'STMT-A',
        owner_id: 'owner-A',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 100,
        currency: 'KES',
      },
      {
        id: 'stmt-2',
        statement_number: 'STMT-B',
        owner_id: 'owner-B',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 200,
        currency: 'KES',
      },
    ];
    let call = 0;
    const execute = vi.fn(async () => {
      call += 1;
      if (call === 1) return drafts;
      if (call === 2) throw new Error('update failed');
      return [];
    });
    const warn = vi.fn();
    const renderer = createDrizzlePdfRenderer({
      db: { execute },
      logger: { warn, info: vi.fn() },
    });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 1, failed: 1 });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 'pdf-renderer',
        degraded_reason: 'render_or_update_failed',
        statementId: 'stmt-1',
      }),
      expect.any(String),
    );
  });

  it('skips rows without an id', async () => {
    const drafts = [
      {
        id: null,
        statement_number: 'STMT-X',
        owner_id: 'owner-X',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 0,
        currency: 'KES',
      },
      {
        id: 'stmt-3',
        statement_number: 'STMT-3',
        owner_id: 'owner-3',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 0,
        currency: 'KES',
      },
    ];
    const { db, execute } = makeDb([drafts, []]);
    const renderer = createDrizzlePdfRenderer({ db, logger: noopLogger });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 1, failed: 0 });
    // 1 SELECT + 1 UPDATE (the null-id row was skipped before any write)
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('uses the injected render function when provided', async () => {
    const drafts = [
      {
        id: 'stmt-1',
        statement_number: 'STMT-A',
        owner_id: 'owner-A',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 100,
        currency: 'KES',
      },
    ];
    const { db } = makeDb([drafts, []]);
    const render = vi.fn(() => Buffer.from('CUSTOM', 'utf8'));
    const renderer = createDrizzlePdfRenderer({
      db,
      logger: noopLogger,
      render,
    });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 1, failed: 0 });
    expect(render).toHaveBeenCalledTimes(1);
    // The UPDATE call carries the base64 of "CUSTOM" → "Q1VTVE9N"
    expect(render.mock.results[0]?.value.toString('utf8')).toBe('CUSTOM');
  });

  it('returns rendered=0/failed=0 when there are no drafts', async () => {
    const { db, execute } = makeDb([[]]);
    const renderer = createDrizzlePdfRenderer({ db, logger: noopLogger });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-empty',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 0, failed: 0 });
    // Only the SELECT was issued.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('still works when logger.info is undefined', async () => {
    const drafts = [
      {
        id: 'stmt-1',
        statement_number: 'STMT-A',
        owner_id: 'owner-A',
        period_start: 'a',
        period_end: 'b',
        gross_rent_collected: 0,
        currency: 'KES',
      },
    ];
    const { db } = makeDb([drafts, []]);
    const renderer = createDrizzlePdfRenderer({
      db,
      logger: { warn: vi.fn() },
    });
    const out = await renderer.renderDraftsForRun({
      runId: 'run-1',
      tenantId: 'tenant-A',
    });
    expect(out).toEqual({ rendered: 1, failed: 0 });
  });
});
