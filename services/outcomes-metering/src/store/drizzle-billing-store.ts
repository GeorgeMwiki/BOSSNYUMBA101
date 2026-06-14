/**
 * Drizzle-backed `BillingStore` — the PRODUCTION adapter.
 *
 * Binds the abstract `BillingStore` port to the `outcome_events` +
 * `outcome_billing_lines` tables (migration `0169_outcomes_metering.sql`).
 * Pure raw-SQL (`tx.execute(sql\`…\`)`) so this module carries no
 * compile-time dependency on the Drizzle schema objects — it accepts the
 * same minimal structural client the sibling workers use.
 *
 * Why raw SQL + a transaction (not the ORM query builder):
 *   - The money path (`commitOutcome`) MUST write the idempotency anchor
 *     AND the billing line in ONE transaction. Either both land or
 *     neither does — there is no window where the anchor exists without
 *     revenue (finding ANCHOR-BEFORE-BILLING).
 *   - Idempotency is enforced at the DB by the UNIQUE indexes
 *     `uq_outcome_events_tenant_event (tenant_id, event_id)` and
 *     `uq_outcome_billing_lines_record (tenant_id, record_id)` via
 *     `ON CONFLICT DO NOTHING`. The transaction's anchor insert is the
 *     race arbiter: when its `RETURNING` is empty, the (tenant, event)
 *     pair was already committed and we report `{ inserted: false }`
 *     WITHOUT a second billing line.
 *
 * RLS: migration 0155 FORCE-enables RLS on `tenant_id` tables. Each
 * write binds `app.current_tenant_id` with `SET LOCAL` semantics
 * (`set_config(..., true)`) inside the transaction so the FORCE-RLS
 * policy admits the insert and scopes the read — mirroring the
 * api-gateway `oauth-state-nonce-store` exactly.
 */

import { sql } from 'drizzle-orm';
import type {
  MeteringRecord,
  OutcomeKind,
} from '@bossnyumba/outcomes';
import type {
  BillingStore,
  CommitOutcomeResult,
  MonthlyBillingAggregate,
  RecordEventInput,
  RecordEventResult,
} from './billing-store.js';

// ---------------------------------------------------------------------------
// Minimal structural client — `db.execute` + `db.transaction` is all the
// adapter needs. Avoids importing the concrete (namespace-colliding)
// `DatabaseClient` type, matching the sibling workers' duck-type.
// ---------------------------------------------------------------------------

export interface DrizzleTxLike {
  execute(query: unknown): Promise<unknown>;
}

export interface DrizzleBillingClient {
  execute(query: unknown): Promise<unknown>;
  transaction<T>(fn: (tx: DrizzleTxLike) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function toRows(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Postgres BIGINT comes back as a string from postgres-js — coerce.
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  if (typeof value === 'bigint') return Number(value);
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function billingMonthOf(scoredAtIso: string): string {
  if (typeof scoredAtIso === 'string' && /^\d{4}-\d{2}/.test(scoredAtIso)) {
    return scoredAtIso.slice(0, 7);
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const OUTCOME_KINDS: ReadonlyArray<OutcomeKind> = [
  'ticket_resolved_within_sla',
  'rent_collected',
  'vacancy_filled',
];

/** Mutable mirror of `MonthlyBillingAggregate['byOutcome']` used while
 *  accumulating; cast to the readonly public shape on return. */
type MutableByOutcome = Record<
  OutcomeKind,
  { qualifiedCount: number; totalBillableMinor: number; currencies: string[] }
>;

function zeroByOutcome(): MutableByOutcome {
  return {
    ticket_resolved_within_sla: { qualifiedCount: 0, totalBillableMinor: 0, currencies: [] },
    rent_collected: { qualifiedCount: 0, totalBillableMinor: 0, currencies: [] },
    vacancy_filled: { qualifiedCount: 0, totalBillableMinor: 0, currencies: [] },
  };
}

// ---------------------------------------------------------------------------
// SQL fragments
// ---------------------------------------------------------------------------

/** Bind the RLS GUC for the duration of the surrounding transaction. */
function bindTenant(tx: DrizzleTxLike, tenantId: string): Promise<unknown> {
  return tx.execute(
    sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
  );
}

function insertEventSql(input: RecordEventInput) {
  return sql`
    INSERT INTO outcome_events (
      tenant_id, event_id, outcome_kind, property_id, agent_id,
      occurred_at_iso, payload, source_event_type
    )
    VALUES (
      ${input.tenantId}, ${input.eventId}, ${input.outcomeKind},
      ${input.propertyId}, ${input.agentId}, ${input.occurredAtIso},
      ${JSON.stringify(input.payload)}::jsonb, ${input.sourceEventType}
    )
    ON CONFLICT (tenant_id, event_id) DO NOTHING
    RETURNING event_id
  `;
}

function insertBillingLineSql(record: MeteringRecord) {
  return sql`
    INSERT INTO outcome_billing_lines (
      tenant_id, record_id, event_id, outcome_kind, property_id,
      billing_month, qualified, reason, billable_amount_minor, currency,
      price_unit_applied, scored_at_iso, clawback_closes_at_iso
    )
    VALUES (
      ${record.tenantId}, ${record.recordId}, ${record.eventId},
      ${record.outcomeKind}, ${record.propertyId},
      ${billingMonthOf(record.scoredAt)}, ${record.qualified}, ${record.reason},
      ${record.billableAmountMinor}, ${record.currency},
      ${record.priceUnitApplied === null ? null : JSON.stringify(record.priceUnitApplied)}::jsonb,
      ${record.scoredAt}, ${record.clawbackClosesAt}
    )
    ON CONFLICT (tenant_id, record_id) DO NOTHING
  `;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface DrizzleBillingStoreDeps {
  readonly db: DrizzleBillingClient;
}

/**
 * Build a Drizzle-backed `BillingStore`. The composition root passes the
 * api-gateway db-client; tests can pass a fake that records the SQL it
 * was handed (the structural client makes that trivial).
 */
export function createDrizzleBillingStore(
  deps: DrizzleBillingStoreDeps,
): BillingStore {
  const { db } = deps;

  return {
    async commitOutcome(
      input: RecordEventInput,
      record: MeteringRecord,
    ): Promise<CommitOutcomeResult> {
      // ONE transaction. The anchor insert is the race arbiter:
      // when its RETURNING is empty the (tenant, event) pair was
      // already committed, so we DON'T write a second billing line and
      // report `{ inserted: false }`. Otherwise the billing line rides
      // the same transaction — both land or both roll back.
      return db.transaction(async (tx) => {
        await bindTenant(tx, input.tenantId);
        const anchor = await tx.execute(insertEventSql(input));
        const claimed = toRows(anchor).length > 0;
        if (!claimed) {
          return { inserted: false };
        }
        await tx.execute(insertBillingLineSql(record));
        return { inserted: true };
      });
    },

    async recordEvent(input: RecordEventInput): Promise<RecordEventResult> {
      return db.transaction(async (tx) => {
        await bindTenant(tx, input.tenantId);
        const result = await tx.execute(insertEventSql(input));
        return { inserted: toRows(result).length > 0 };
      });
    },

    async recordBillingLine(record: MeteringRecord): Promise<RecordEventResult> {
      return db.transaction(async (tx) => {
        await bindTenant(tx, record.tenantId);
        // Append `RETURNING record_id` so a fresh insert reports
        // `inserted: true` and an ON CONFLICT no-op reports false —
        // no extra round-trip. (The money path uses commitOutcome;
        // this isolated path is the rare backfill case.)
        const result = await tx.execute(sql`
          INSERT INTO outcome_billing_lines (
            tenant_id, record_id, event_id, outcome_kind, property_id,
            billing_month, qualified, reason, billable_amount_minor, currency,
            price_unit_applied, scored_at_iso, clawback_closes_at_iso
          )
          VALUES (
            ${record.tenantId}, ${record.recordId}, ${record.eventId},
            ${record.outcomeKind}, ${record.propertyId},
            ${billingMonthOf(record.scoredAt)}, ${record.qualified}, ${record.reason},
            ${record.billableAmountMinor}, ${record.currency},
            ${record.priceUnitApplied === null ? null : JSON.stringify(record.priceUnitApplied)}::jsonb,
            ${record.scoredAt}, ${record.clawbackClosesAt}
          )
          ON CONFLICT (tenant_id, record_id) DO NOTHING
          RETURNING record_id
        `);
        return { inserted: toRows(result).length > 0 };
      });
    },

    async getMonthlyBilling(
      tenantId: string,
      billingMonth: string,
    ): Promise<MonthlyBillingAggregate> {
      return db.transaction(async (tx) => {
        await bindTenant(tx, tenantId);
        const result = await tx.execute(sql`
          SELECT outcome_kind, currency,
                 COUNT(*)::bigint                      AS qualified_count,
                 COALESCE(SUM(billable_amount_minor),0)::bigint AS total_minor
          FROM outcome_billing_lines
          WHERE tenant_id = ${tenantId}
            AND billing_month = ${billingMonth}
            AND qualified = TRUE
          GROUP BY outcome_kind, currency
        `);
        const rows = toRows(result);

        const byOutcome = zeroByOutcome();
        const currencyCounts = new Map<string, number>();
        let totalBillableMinor = 0;
        let qualifiedLineCount = 0;

        for (const row of rows) {
          const kind = asString(row['outcome_kind']) as OutcomeKind;
          if (!OUTCOME_KINDS.includes(kind)) continue;
          const currency = asString(row['currency'], 'USD');
          const count = asNumber(row['qualified_count']);
          const minor = asNumber(row['total_minor']);

          const bucket = byOutcome[kind];
          bucket.qualifiedCount += count;
          bucket.totalBillableMinor += minor;
          if (!bucket.currencies.includes(currency)) {
            bucket.currencies.push(currency);
          }
          totalBillableMinor += minor;
          qualifiedLineCount += count;
          currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + count);
        }

        let dominantCurrency = 'USD';
        let bestCount = -1;
        for (const [currency, count] of currencyCounts) {
          if (count > bestCount) {
            bestCount = count;
            dominantCurrency = currency;
          }
        }

        return {
          tenantId,
          billingMonth,
          byOutcome,
          totalBillableMinor,
          dominantCurrency,
          qualifiedLineCount,
        };
      });
    },
  };
}
