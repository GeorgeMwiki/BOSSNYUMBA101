/**
 * In-process PDF renderer for `owner_statements` rows that the
 * `statement-adapter` wrote as `status='draft'`.
 *
 * Wave-3 deep-scrub C1 — the statement adapter (B1) writes drafts but
 * never produces an artifact. This renderer flips each draft to the
 * post-render state with a `pdfUrl` populated so the downstream
 * notification adapter has something concrete to link the owner email
 * to.
 *
 * Schema reality check
 * --------------------
 * The `owner_statement_status` enum only allows
 *   ['draft', 'pending_review', 'approved', 'sent', 'acknowledged'].
 * There is no `'rendered'` value (and we do NOT add one in this commit
 * — the renderer must work against the shipped schema). We therefore
 * treat `pending_review` as the post-render state: the row has a PDF
 * artifact and is ready for the operator's review pass.
 *
 * The schema also has no `run_id` column on `owner_statements`. We
 * scope the drain by `(tenant_id, status='draft')`, optionally further
 * narrowed by `periodStart/periodEnd` when the caller supplies them.
 * The `runId` parameter is preserved on the public API for log
 * correlation and forward-compatibility once a `run_id` column lands.
 *
 * Renderer
 * --------
 * This worktree's `services/api-gateway` does not depend on `pdfkit`
 * (it ships in `services/reports`). Per the C1 brief we therefore
 * scaffold a placeholder `renderPdfBytes` that returns a tiny byte
 * buffer; downstream wiring can swap in a real engine without
 * touching the orchestration logic.
 *
 * Storage
 * -------
 * Until a real document store is available we encode the rendered
 * bytes as a `data:application/pdf;base64,...` URL and write it to
 * `owner_statements.pdf_url`. This keeps the artifact retrievable by
 * its row id and avoids introducing a new table just to ship the
 * end-to-end happy path. A follow-up can swap to S3 / blob storage by
 * replacing `toPdfUrl` only.
 *
 * Tenant-scoped on every query.
 */

import { sql } from 'drizzle-orm';

type Logger = {
  warn(meta: Record<string, unknown>, msg: string): void;
  info?(meta: Record<string, unknown>, msg: string): void;
};

type DbExecutor = { execute(q: unknown): Promise<unknown> };

export type RenderDraftsForRunInput = {
  readonly runId: string;
  readonly tenantId: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
};

export type RenderDraftsForRunOutput = {
  readonly rendered: number;
  readonly failed: number;
};

export type PdfRenderer = {
  renderDraftsForRun(
    input: RenderDraftsForRunInput,
  ): Promise<RenderDraftsForRunOutput>;
};

function asRows(res: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = (res as { rows?: unknown }).rows;
  return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'bigint') return Number(v);
  return 0;
}

/**
 * Build the human-facing summary that goes into the rendered PDF.
 * Pure — no I/O, no clock — so the renderer stays trivially testable.
 */
export function buildStatementSummary(row: {
  readonly statementId: string;
  readonly statementNumber: string;
  readonly ownerId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly grossRentMinor: number;
  readonly currency: string;
}): string {
  const lines: readonly string[] = [
    `OWNER STATEMENT`,
    `Statement: ${row.statementNumber}`,
    `Owner: ${row.ownerId}`,
    `Period: ${row.periodStart} -> ${row.periodEnd}`,
    `Gross rent (minor units): ${row.grossRentMinor}`,
    `Currency: ${row.currency || 'XXX'}`,
    `Statement id: ${row.statementId}`,
  ];
  return lines.join('\n');
}

/**
 * Placeholder PDF byte producer.
 *
 * TODO(wave-29): swap in a real engine. Two viable paths:
 *   1. Add `pdfkit` to `services/api-gateway` and call it directly
 *      (mirrors `services/reports`).
 *   2. Enqueue a `document_render_jobs` row and let the dedicated
 *      render worker pick it up, then poll the result.
 * Until then this returns a minimal byte buffer so the schema's
 * `pdf_url` column is populated and the orchestrator can advance.
 */
export function renderPdfBytes(html: string): Buffer {
  // Tag the placeholder content with the source body so test assertions
  // can see it round-tripped end-to-end.
  return Buffer.from(`<placeholder>${html}</placeholder>`, 'utf8');
}

function toPdfUrl(bytes: Buffer): string {
  const b64 = bytes.toString('base64');
  return `data:application/pdf;base64,${b64}`;
}

export type CreateDrizzlePdfRendererDeps = {
  readonly db: unknown;
  readonly logger: Logger;
  readonly render?: (html: string) => Buffer;
};

export function createDrizzlePdfRenderer(
  deps: CreateDrizzlePdfRendererDeps,
): PdfRenderer {
  const { db, logger } = deps;
  const render = deps.render ?? renderPdfBytes;
  const exec = (db as DbExecutor).execute.bind(db as DbExecutor);

  return {
    async renderDraftsForRun(input) {
      const { runId, tenantId, periodStart, periodEnd } = input;

      let drafts: readonly Record<string, unknown>[] = [];
      try {
        const res = await exec(sql`
          SELECT
            id,
            statement_number,
            owner_id,
            period_start,
            period_end,
            gross_rent_collected,
            currency
          FROM owner_statements
          WHERE tenant_id = ${tenantId}
            AND status = 'draft'
            ${periodStart ? sql`AND period_start = ${periodStart}` : sql``}
            ${periodEnd ? sql`AND period_end = ${periodEnd}` : sql``}
        `);
        drafts = asRows(res);
      } catch (err) {
        logger.warn(
          {
            port: 'pdf-renderer',
            runId,
            tenantId,
            degraded_reason: 'select_drafts_failed',
            err: err instanceof Error ? err.message : String(err),
          },
          'monthly-close: pdf-renderer could not load drafts — returning zeroes',
        );
        return { rendered: 0, failed: 0 };
      }

      let rendered = 0;
      let failed = 0;

      for (const row of drafts) {
        const statementId = toStr(row.id);
        if (!statementId) continue;

        try {
          const summary = buildStatementSummary({
            statementId,
            statementNumber: toStr(row.statement_number),
            ownerId: toStr(row.owner_id),
            periodStart: toStr(row.period_start),
            periodEnd: toStr(row.period_end),
            grossRentMinor: toNumber(row.gross_rent_collected),
            currency: toStr(row.currency),
          });
          const bytes = render(summary);
          const pdfUrl = toPdfUrl(bytes);

          await exec(sql`
            UPDATE owner_statements
            SET status = 'pending_review',
                pdf_url = ${pdfUrl},
                updated_at = NOW()
            WHERE id = ${statementId}
              AND tenant_id = ${tenantId}
              AND status = 'draft'
          `);
          rendered += 1;
        } catch (err) {
          failed += 1;
          logger.warn(
            {
              port: 'pdf-renderer',
              runId,
              tenantId,
              statementId,
              degraded_reason: 'render_or_update_failed',
              err: err instanceof Error ? err.message : String(err),
            },
            'monthly-close: pdf-renderer failed for one statement — continuing',
          );
        }
      }

      logger.info?.(
        {
          port: 'pdf-renderer',
          runId,
          tenantId,
          rendered,
          failed,
          total: drafts.length,
        },
        'monthly-close: pdf-renderer drained drafts',
      );

      return { rendered, failed };
    },
  };
}
