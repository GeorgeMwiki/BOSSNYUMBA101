/**
 * Outcome reconciliation resolvers — real-estate domain (BossNyumba).
 *
 * Each resolver answers: "given a prediction the brain made about
 * entity X, what is the current ground-truth state of X?" Returned
 * shapes mirror the prediction shape so the worker's drift-scoring
 * lines up bit-for-bit (jsonb cosine when value is null, scalar % delta
 * when both sides carry a numeric `value`).
 *
 * Bound at composition time in services/api-gateway/src/index.ts as
 *   const resolvers = new Map<string, ObservationResolver>([
 *     ['lease',                buildLeaseResolver(db)],
 *     ['rent_invoice',         buildRentInvoiceResolver(db)],
 *     ['maintenance_ticket',   buildMaintenanceResolver(db)],
 *   ]);
 *   createReconciliationWorker({ db, logger, resolvers, ... }).start();
 *
 * Why these three:
 *   - `lease` — the brain emits "will this lease renew?" predictions
 *     for every lease whose end_date is < 90 days away.
 *   - `rent_invoice` — "will this invoice be paid on time?" / "what % of
 *     the balance will land in the grace window?"
 *   - `maintenance_ticket` — "will this work order close inside its SLA?"
 *
 * Every resolver is RLS-safe — the worker wraps its call in
 * `withWorkerTenantContext(BEGIN/COMMIT)` so `app.tenant_id` is bound
 * before the SELECT fires. Resolvers therefore do NOT cross-filter by
 * tenant_id; RLS handles isolation. A defensive `tenant_id = $1` is
 * still appended so the row inspector / pgAudit trail stays unambiguous.
 *
 * Returning `null` lands the reconciliation in `expired` status — the
 * worker logs and continues. Mirrors Borjie's resolver shape from the
 * agent-platform docs.
 */

import { sql } from 'drizzle-orm';

import type {
  DbLike,
  ObservationResolver,
  ObservationResolverInput,
  ObservationResolverResult,
} from './outcome-reconciliation-worker.js';

interface ExecRow {
  readonly [key: string]: unknown;
}

function rowsOf(result: unknown): ReadonlyArray<ExecRow> {
  if (Array.isArray(result)) return result as ReadonlyArray<ExecRow>;
  const wrapped = result as { rows?: ReadonlyArray<ExecRow> };
  return wrapped?.rows ?? [];
}

// ─────────────────────────────────────────────────────────────────────
// lease — "will this lease renew?"
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolves to:
 *   - observedOutcome: { status, end_date, renewed_through, rent_amount, currency }
 *   - observedValue:   final rent_amount (minor units) when status='active'
 *                      with end_date pushed forward; null otherwise.
 *
 * Closed-loop signal: the brain predicted `{ renew: true|false }`; the
 * worker compares the predicted boolean against the current lease
 * status field via jsonb drift OR the predicted rent value against the
 * post-renewal value via scalar drift.
 */
export function buildLeaseResolver(db: DbLike): ObservationResolver {
  return async (
    input: ObservationResolverInput,
  ): Promise<ObservationResolverResult | null> => {
    try {
      const result = await db.execute(sql`
        SELECT
          id, status, end_date, rent_amount, rent_currency,
          move_out_date
        FROM leases
        WHERE id = ${input.entityId}
          AND tenant_id = ${input.tenantId}
        LIMIT 1
      `);
      const row = rowsOf(result)[0];
      if (!row) return null;

      const status = String(row.status ?? 'unknown');
      const renewed =
        status === 'active' || status === 'renewed' || status === 'extended';
      const rentAmount =
        row.rent_amount == null ? null : Number(row.rent_amount);

      return {
        observedOutcome: {
          status,
          renewed,
          end_date: row.end_date instanceof Date
            ? row.end_date.toISOString()
            : row.end_date ?? null,
          rent_amount: rentAmount,
          currency: String(row.rent_currency ?? 'TZS'),
          move_out_date: row.move_out_date instanceof Date
            ? row.move_out_date.toISOString()
            : row.move_out_date ?? null,
        },
        observedValue: rentAmount,
        observedCurrency: String(row.rent_currency ?? 'TZS'),
        narrative: renewed
          ? `Lease ${input.entityId} is currently ${status}; renewal carried forward.`
          : `Lease ${input.entityId} did not renew (status=${status}).`,
      };
    } catch {
      // Hard failure resolving the entity is treated as "unknown" so the
      // worker marks this row `expired` with an audit reason rather than
      // crashing the whole reconciliation tick.
      return null;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// rent_invoice — "will this rent be paid on time?"
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolves to:
 *   - observedOutcome: { status, paid_amount, balance_remaining,
 *                        days_late, currency }
 *   - observedValue:   paid_amount (minor units)
 *
 * Closed-loop signal: the brain predicted `{ paid_on_time: true|false }`
 * or `{ collected_amount: N }`. Worker scores both shapes.
 *
 * Reads from `invoices` joined to its ledger entries to compute the
 * current paid_amount — the ledger is the source of truth per the
 * "money path through LedgerService.post()" hard rule.
 */
export function buildRentInvoiceResolver(db: DbLike): ObservationResolver {
  return async (
    input: ObservationResolverInput,
  ): Promise<ObservationResolverResult | null> => {
    try {
      const result = await db.execute(sql`
        SELECT
          i.id, i.status, i.due_date, i.total_amount, i.currency,
          COALESCE(
            (
              SELECT SUM(le.amount_minor_units)
              FROM ledger_entries le
              WHERE le.invoice_id = i.id
                AND le.tenant_id = i.tenant_id
                AND le.direction = 'credit'
            ),
            0
          ) AS paid_amount
        FROM invoices i
        WHERE i.id = ${input.entityId}
          AND i.tenant_id = ${input.tenantId}
        LIMIT 1
      `);
      const row = rowsOf(result)[0];
      if (!row) return null;

      const total = row.total_amount == null ? 0 : Number(row.total_amount);
      const paid = row.paid_amount == null ? 0 : Number(row.paid_amount);
      const balance = Math.max(0, total - paid);
      const status = String(row.status ?? 'unknown');
      const paidOnTime = status === 'paid' && balance === 0;

      // Compute days_late vs due_date (positive when overdue).
      let daysLate = 0;
      if (row.due_date) {
        const due = row.due_date instanceof Date
          ? row.due_date
          : new Date(String(row.due_date));
        if (!Number.isNaN(due.getTime())) {
          daysLate = Math.max(
            0,
            Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000)),
          );
        }
      }

      return {
        observedOutcome: {
          status,
          paid_amount: paid,
          balance_remaining: balance,
          paid_on_time: paidOnTime,
          days_late: daysLate,
          currency: String(row.currency ?? 'TZS'),
        },
        observedValue: paid,
        observedCurrency: String(row.currency ?? 'TZS'),
        narrative:
          balance === 0
            ? `Invoice ${input.entityId} paid in full (${paid} ${row.currency}).`
            : `Invoice ${input.entityId} carries balance ${balance} ${row.currency} (paid=${paid}, total=${total}, days_late=${daysLate}).`,
      };
    } catch {
      return null;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// maintenance_ticket — "will this maintenance close by SLA?"
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolves to:
 *   - observedOutcome: { status, closed, sla_breached, completed_at,
 *                        cost_amount, currency }
 *   - observedValue:   cost_amount when completed; null otherwise.
 *
 * Reads from `work_orders` (production maintenance lifecycle table).
 * The brain typically predicts `{ closed_within_sla: true|false }` or
 * `{ cost: N }`; both shapes drive the drift score.
 */
export function buildMaintenanceResolver(db: DbLike): ObservationResolver {
  return async (
    input: ObservationResolverInput,
  ): Promise<ObservationResolverResult | null> => {
    try {
      const result = await db.execute(sql`
        SELECT
          id,
          status,
          (response_breached OR resolution_breached) AS sla_breached,
          completed_at,
          resolution_due_at AS due_at,
          actual_cost AS cost_amount,
          currency AS cost_currency
        FROM work_orders
        WHERE id = ${input.entityId}
          AND tenant_id = ${input.tenantId}
        LIMIT 1
      `);
      const row = rowsOf(result)[0];
      if (!row) return null;

      const status = String(row.status ?? 'unknown');
      const closed = status === 'completed' || status === 'closed';
      const slaBreached = row.sla_breached === true;
      const cost = row.cost_amount == null ? null : Number(row.cost_amount);
      const closedWithinSla = closed && !slaBreached;

      return {
        observedOutcome: {
          status,
          closed,
          sla_breached: slaBreached,
          closed_within_sla: closedWithinSla,
          completed_at: row.completed_at instanceof Date
            ? row.completed_at.toISOString()
            : row.completed_at ?? null,
          cost_amount: cost,
          currency: String(row.cost_currency ?? 'TZS'),
        },
        observedValue: cost,
        observedCurrency: String(row.cost_currency ?? 'TZS'),
        narrative: closed
          ? `Work order ${input.entityId} ${closedWithinSla ? 'closed within' : 'breached'} SLA (status=${status}).`
          : `Work order ${input.entityId} is still open (status=${status}).`,
      };
    } catch {
      return null;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// Composition barrel
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the full resolver map. Called once at composition time in
 * services/api-gateway/src/index.ts.
 */
export function buildRealEstateOutcomeResolvers(
  db: DbLike,
): Map<string, ObservationResolver> {
  return new Map<string, ObservationResolver>([
    ['lease', buildLeaseResolver(db)],
    ['rent_invoice', buildRentInvoiceResolver(db)],
    ['maintenance_ticket', buildMaintenanceResolver(db)],
  ]);
}
