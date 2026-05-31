/**
 * Mr. Mwikila autonomous handler — real BN domain ports.
 *
 * Replaces the empty `handlers: []` registration in `index.ts` with
 * real Drizzle-backed queries against the canonical BN tables
 * (leases, units, invoices, employees, marketplace_listings,
 * negotiations, negotiation_policies, mwikila_actions_inbox).
 *
 * Every port is read-only + idempotent + tenant-scoped. Errors are
 * caught per-port and degrade to safe-empty / safe-fail-closed so a
 * single failing query cannot crash the worker tick.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import type {
  ActiveLeaseRow,
  RentSchedulerPorts,
  ExpiringLeaseRow,
  LeaseRenewalPorts,
  RenewalLadderWindow,
  PayrollStaffRow,
  AttendanceRow,
  PayrollPorts,
  OpenBidRow,
  SellerTargets,
  ListingCounterOfferPorts,
  UpcomingFilingRow,
  PortfolioSnapshotForFiling,
  RegulatoryFilingPorts,
} from '../services/mwikila-autonomy/index.js';

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

interface ExecRow {
  readonly [key: string]: unknown;
}

function rowsOf(result: unknown): ReadonlyArray<ExecRow> {
  if (Array.isArray(result)) return result as ReadonlyArray<ExecRow>;
  const wrapped = result as { rows?: ReadonlyArray<ExecRow> };
  return wrapped?.rows ?? [];
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return toStr(v);
}

// ─── RENT-SCHEDULER PORTS ─────────────────────────────────────────────

export function buildRentSchedulerPorts(
  db: DbLike,
  logger: Logger,
): RentSchedulerPorts {
  return Object.freeze({
    async listActiveLeasesDueWithin(args) {
      try {
        // Compute next billing date as start of (current_month + 1) for
        // monthly leases; honour rent_due_day. The query is a single
        // SELECT — date math lives in SQL so the row matches the
        // ActiveLeaseRow contract directly.
        const result = await db.execute(sql`
          WITH next_bill AS (
            SELECT l.id,
                   l.tenant_id,
                   l.unit_id,
                   l.rent_amount,
                   l.rent_currency,
                   l.primary_occupant,
                   make_date(
                     EXTRACT(YEAR  FROM CURRENT_DATE)::int,
                     EXTRACT(MONTH FROM CURRENT_DATE)::int,
                     LEAST(GREATEST(COALESCE(l.rent_due_day, 1), 1), 28)
                   ) + INTERVAL '1 month' AS next_bill_date
              FROM leases l
             WHERE l.tenant_id = ${args.tenantId}
               AND l.status    = 'active'
               AND l.rent_frequency = 'monthly'
          )
          SELECT id, tenant_id, unit_id, rent_amount, rent_currency, primary_occupant, next_bill_date
            FROM next_bill
           WHERE next_bill_date >= ${args.fromIso}::timestamptz
             AND next_bill_date <= ${args.toIso}::timestamptz
           ORDER BY next_bill_date ASC
           LIMIT 200
        `);
        const out: ActiveLeaseRow[] = [];
        for (const r of rowsOf(result)) {
          const leaseId = toStr(r.id);
          if (!leaseId) continue;
          const occupant = r.primary_occupant as
            | { name?: string }
            | null;
          out.push(
            Object.freeze({
              leaseId,
              tenantId: toStr(r.tenant_id),
              unitId: toStr(r.unit_id),
              residentName: toStr(occupant?.name) || 'Tenant',
              monthlyRent: toNum(r.rent_amount),
              currencyCode: toStr(r.rent_currency) || 'TZS',
              nextBillDateIso: toIso(r.next_bill_date),
            }),
          );
        }
        return Object.freeze(out);
      } catch (err) {
        logger.warn(
          {
            port: 'rent-scheduler.listActiveLeasesDueWithin',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: listActiveLeasesDueWithin failed; returning []',
        );
        return Object.freeze([]);
      }
    },
    async invoiceAlreadyExists(args) {
      try {
        // Real invoice for that lease/month already issued?
        const result = await db.execute(sql`
          SELECT 1
            FROM invoices
           WHERE tenant_id = ${args.tenantId}
             AND lease_id  = ${args.leaseId}
             AND invoice_type = 'rent'
             AND to_char(period_start, 'YYYY-MM') = ${args.billingMonthIso}
           LIMIT 1
        `);
        if (rowsOf(result).length > 0) return true;
        // Also dedupe against a prior mwikila draft for the same month.
        const proposed = await db.execute(sql`
          SELECT 1
            FROM mwikila_actions_inbox
           WHERE tenant_id   = ${args.tenantId}
             AND action_kind = 'rent.next_period_invoice_draft'
             AND payload->'drafts' @> jsonb_build_array(
                   jsonb_build_object(
                     'leaseId', ${args.leaseId}::text,
                     'billingMonthIso', ${args.billingMonthIso}::text
                   )
                 )
           LIMIT 1
        `);
        return rowsOf(proposed).length > 0;
      } catch (err) {
        logger.warn(
          {
            port: 'rent-scheduler.invoiceAlreadyExists',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: invoiceAlreadyExists failed; treating as existing',
        );
        return true;
      }
    },
  });
}

// ─── REGULATORY-FILING PORTS ──────────────────────────────────────────

export function buildRegulatoryFilingPorts(
  db: DbLike,
  logger: Logger,
): RegulatoryFilingPorts {
  return Object.freeze({
    async listUpcomingFilingsWithin(args) {
      try {
        // BN does not yet have a regulatory_filings table. We derive an
        // upcoming filing from the tenant's quarterly snapshot cadence:
        // if no draft inbox row exists for the current quarter, propose
        // a single "quarterly_owner_statement" filing due 15 days after
        // quarter-end. The deduplicated probe (below) prevents loops.
        const result = await db.execute(sql`
          WITH quarter_end AS (
            SELECT date_trunc('quarter', CURRENT_DATE) + INTERVAL '3 month - 1 day' AS qend
          ),
          due AS (
            SELECT (qend + INTERVAL '15 day')::date AS due_date FROM quarter_end
          )
          SELECT
            'quarterly_owner_statement' AS filing_id,
            'quarterly_owner_statement' AS filing_kind,
            'housing_authority'          AS authority_code,
            to_char(date_trunc('quarter', CURRENT_DATE), 'YYYY-"Q"Q') AS period_label,
            (SELECT due_date FROM due) AS due_date,
            'TZ'                         AS jurisdiction_code
        `);
        const rows = rowsOf(result);
        const r = rows[0];
        if (!r) return Object.freeze([]);
        const dueIso = toIso(r.due_date);
        if (!dueIso) return Object.freeze([]);
        const dueTs = new Date(dueIso).getTime();
        const fromTs = new Date(args.fromIso).getTime();
        const toTs = new Date(args.toIso).getTime();
        if (dueTs < fromTs || dueTs > toTs) return Object.freeze([]);
        const filing: UpcomingFilingRow = Object.freeze({
          filingId: `${args.tenantId}:${toStr(r.period_label)}`,
          filingKind: toStr(r.filing_kind),
          authorityCode: toStr(r.authority_code),
          periodLabel: toStr(r.period_label),
          dueDateIso: dueIso,
          jurisdictionCode: toStr(r.jurisdiction_code),
        });
        // Dedupe against prior draft.
        const drafted = await db.execute(sql`
          SELECT 1
            FROM mwikila_actions_inbox
           WHERE tenant_id   = ${args.tenantId}
             AND action_kind = 'regulatory.quarterly_filing_prep'
             AND payload->'draft'->>'periodLabel' = ${filing.periodLabel}
           LIMIT 1
        `);
        if (rowsOf(drafted).length > 0) return Object.freeze([]);
        return Object.freeze([filing]);
      } catch (err) {
        logger.warn(
          {
            port: 'regulatory-filing.listUpcomingFilingsWithin',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: listUpcomingFilingsWithin failed; returning []',
        );
        return Object.freeze([]);
      }
    },
    async snapshotPortfolioForFiling(args) {
      try {
        const result = await db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM units WHERE tenant_id = ${args.tenantId})::int            AS total_units,
            (SELECT COUNT(*) FROM units WHERE tenant_id = ${args.tenantId} AND status = 'occupied')::int AS occupied_units,
            COALESCE(
              (SELECT SUM(paid_amount)
                 FROM invoices
                WhERE tenant_id    = ${args.tenantId}
                  AND invoice_type = 'rent'
                  AND issue_date >= ${args.periodStartIso}::timestamptz
                  AND issue_date <= ${args.periodEndIso}::timestamptz),
              0
            )::int AS gross_rent,
            COALESCE(
              (SELECT currency FROM currency_preferences WHERE tenant_id = ${args.tenantId} LIMIT 1),
              'TZS'
            ) AS currency
        `);
        const r = rowsOf(result)[0];
        const snapshot: PortfolioSnapshotForFiling = Object.freeze({
          totalUnits: r ? Math.max(0, Math.floor(toNum(r.total_units))) : 0,
          occupiedUnits: r ? Math.max(0, Math.floor(toNum(r.occupied_units))) : 0,
          grossRentCollected: r ? toNum(r.gross_rent) : 0,
          currencyCode: r ? toStr(r.currency) || 'TZS' : 'TZS',
        });
        return snapshot;
      } catch (err) {
        logger.warn(
          {
            port: 'regulatory-filing.snapshotPortfolioForFiling',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: snapshotPortfolioForFiling failed; returning empty snapshot',
        );
        return Object.freeze({
          totalUnits: 0,
          occupiedUnits: 0,
          grossRentCollected: 0,
          currencyCode: 'TZS',
        });
      }
    },
  });
}

// ─── LEASE-RENEWAL PORTS ──────────────────────────────────────────────

export function buildLeaseRenewalPorts(
  db: DbLike,
  logger: Logger,
): LeaseRenewalPorts {
  return Object.freeze({
    async listLeasesExpiringWithin(args) {
      try {
        const result = await db.execute(sql`
          SELECT id, unit_id, rent_amount, rent_currency, end_date, primary_occupant
            FROM leases
           WHERE tenant_id = ${args.tenantId}
             AND status IN ('active', 'expiring_soon')
             AND end_date IS NOT NULL
             AND end_date >= CURRENT_TIMESTAMP
             AND end_date <= CURRENT_TIMESTAMP + (${args.daysOut} || ' days')::interval
           ORDER BY end_date ASC
           LIMIT 100
        `);
        const out: ExpiringLeaseRow[] = [];
        for (const r of rowsOf(result)) {
          const leaseId = toStr(r.id);
          if (!leaseId) continue;
          const occupant = r.primary_occupant as { name?: string } | null;
          out.push(
            Object.freeze({
              leaseId,
              unitId: toStr(r.unit_id),
              residentName: toStr(occupant?.name) || 'Tenant',
              monthlyRent: toNum(r.rent_amount),
              currencyCode: toStr(r.rent_currency) || 'TZS',
              endDateIso: toIso(r.end_date),
            }),
          );
        }
        return Object.freeze(out);
      } catch (err) {
        logger.warn(
          {
            port: 'lease-renewal.listLeasesExpiringWithin',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: listLeasesExpiringWithin failed; returning []',
        );
        return Object.freeze([]);
      }
    },
    async mostRecentReminderWindow(args) {
      try {
        // Look at past mwikila renewal-ladder inbox rows for this
        // lease; take the SMALLEST ladder window already sent (smaller
        // window = more recent in time).
        const result = await db.execute(sql`
          SELECT (payload->>'ladderWindow')::int AS window
            FROM mwikila_actions_inbox
           WHERE tenant_id   = ${args.tenantId}
             AND action_kind = 'lease.renewal_reminder_ladder'
             AND payload->>'leaseId' = ${args.leaseId}
             AND (payload->>'ladderWindow') IS NOT NULL
           ORDER BY (payload->>'ladderWindow')::int ASC
           LIMIT 1
        `);
        const r = rowsOf(result)[0];
        if (!r) return null;
        const w = toNum(r.window);
        if (w === 90 || w === 60 || w === 30) {
          return w as RenewalLadderWindow;
        }
        return null;
      } catch (err) {
        logger.warn(
          {
            port: 'lease-renewal.mostRecentReminderWindow',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: mostRecentReminderWindow failed; returning null (no prior)',
        );
        return null;
      }
    },
  });
}

// ─── PAYROLL PORTS ────────────────────────────────────────────────────

function mapEmployeeRole(jobTitle: string): PayrollStaffRow['role'] {
  const lower = jobTitle.toLowerCase();
  if (lower.includes('caretaker') || lower.includes('janitor')) return 'caretaker';
  if (lower.includes('manager') || lower.includes('lead'))
    return 'property_manager';
  if (lower.includes('maintenance') || lower.includes('repair'))
    return 'maintenance';
  return 'other';
}

export function buildPayrollPorts(
  db: DbLike,
  logger: Logger,
): PayrollPorts {
  return Object.freeze({
    async listActiveStaff(args) {
      try {
        const result = await db.execute(sql`
          SELECT id, first_name, last_name, job_title, base_salary_kes
            FROM employees
           WHERE tenant_id = ${args.tenantId}
             AND status    = 'active'
             AND base_salary_kes IS NOT NULL
           ORDER BY last_name ASC
           LIMIT 500
        `);
        const out: PayrollStaffRow[] = [];
        for (const r of rowsOf(result)) {
          const staffId = toStr(r.id);
          if (!staffId) continue;
          const salary = toNum(r.base_salary_kes);
          if (salary <= 0) continue;
          out.push(
            Object.freeze({
              staffId,
              fullName: `${toStr(r.first_name)} ${toStr(r.last_name)}`.trim(),
              role: mapEmployeeRole(toStr(r.job_title)),
              baseSalary: Math.round(salary),
              // BN historically defaults to KES for legacy compatibility;
              // the inviolable currency rail re-checks against the
              // tenant's domestic currency at run-time.
              currencyCode: 'KES',
              hourlyOvertimeRate: Math.round((salary / 160) * 1.5),
            }),
          );
        }
        return Object.freeze(out);
      } catch (err) {
        logger.warn(
          {
            port: 'payroll.listActiveStaff',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: listActiveStaff failed; returning []',
        );
        return Object.freeze([]);
      }
    },
    async listAttendanceFor(_args) {
      // BN does not yet ship an attendance/time-entry table. Return an
      // empty array so the handler computes base-salary-only payroll;
      // when the attendance schema lands, this port wires to it
      // without changing any handler.
      const empty: ReadonlyArray<AttendanceRow> = Object.freeze([]);
      return empty;
    },
    async batchAlreadyExists(args) {
      try {
        const result = await db.execute(sql`
          SELECT 1
            FROM mwikila_actions_inbox
           WHERE tenant_id   = ${args.tenantId}
             AND action_kind = 'payroll.monthly_batch_prep'
             AND payload->>'periodStartIso' = ${args.periodStartIso}
             AND payload->>'periodEndIso'   = ${args.periodEndIso}
           LIMIT 1
        `);
        return rowsOf(result).length > 0;
      } catch (err) {
        logger.warn(
          {
            port: 'payroll.batchAlreadyExists',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: batchAlreadyExists failed; treating as existing',
        );
        return true;
      }
    },
  });
}

// ─── LISTING-COUNTER-OFFER PORTS ──────────────────────────────────────

export function buildListingCounterOfferPorts(
  db: DbLike,
  logger: Logger,
): ListingCounterOfferPorts {
  return Object.freeze({
    async listOpenBids(args) {
      try {
        const result = await db.execute(sql`
          SELECT n.id            AS bid_id,
                 n.listing_id    AS listing_id,
                 ml.attributes->>'headline' AS listing_title,
                 c.first_name    AS first_name,
                 c.last_name     AS last_name,
                 n.current_offer AS offer,
                 COALESCE(np.currency, ml.currency, 'TZS') AS currency,
                 n.created_at    AS opened_at
            FROM negotiations n
       LEFT JOIN marketplace_listings ml ON ml.id = n.listing_id
       LEFT JOIN customers             c ON c.id = n.prospect_customer_id
       LEFT JOIN negotiation_policies np ON np.id = n.policy_id
           WHERE n.tenant_id = ${args.tenantId}
             AND n.status    = 'open'
             AND n.domain    = 'lease_price'
             AND n.current_offer IS NOT NULL
             AND (n.current_offer_by IS NULL OR n.current_offer_by IN ('prospect', 'agent'))
           ORDER BY n.last_activity_at ASC
           LIMIT 25
        `);
        const out: OpenBidRow[] = [];
        for (const r of rowsOf(result)) {
          const bidId = toStr(r.bid_id);
          if (!bidId) continue;
          out.push(
            Object.freeze({
              bidId,
              listingId: toStr(r.listing_id),
              listingTitle:
                toStr(r.listing_title) || `Listing ${toStr(r.listing_id)}`,
              buyerName:
                `${toStr(r.first_name)} ${toStr(r.last_name)}`.trim() ||
                'Prospect',
              bidAmount: toNum(r.offer),
              currencyCode: toStr(r.currency) || 'TZS',
              openedAtIso: toIso(r.opened_at),
            }),
          );
        }
        return Object.freeze(out);
      } catch (err) {
        logger.warn(
          {
            port: 'listing-counter.listOpenBids',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: listOpenBids failed; returning []',
        );
        return Object.freeze([]);
      }
    },
    async getSellerTargets(args) {
      try {
        const result = await db.execute(sql`
          SELECT np.list_price, np.floor_price, np.currency
            FROM negotiation_policies np
           WHERE np.tenant_id = ${args.tenantId}
             AND np.active   = TRUE
             AND np.domain   = 'lease_price'
             AND (
                   np.unit_id IN (
                     SELECT unit_id FROM marketplace_listings
                      WHERE id = ${args.listingId}
                        AND tenant_id = ${args.tenantId}
                   )
                   OR np.property_id IN (
                     SELECT property_id FROM marketplace_listings
                      WHERE id = ${args.listingId}
                        AND tenant_id = ${args.tenantId}
                        AND property_id IS NOT NULL
                   )
                 )
           ORDER BY np.unit_id NULLS LAST
           LIMIT 1
        `);
        const r = rowsOf(result)[0];
        if (!r) return null;
        const list = toNum(r.list_price);
        const floor = toNum(r.floor_price);
        if (list <= 0 || floor <= 0) return null;
        const targets: SellerTargets = Object.freeze({
          listingId: args.listingId,
          reservePrice: floor,
          idealPrice: list,
          currencyCode: toStr(r.currency) || 'TZS',
        });
        return targets;
      } catch (err) {
        logger.warn(
          {
            port: 'listing-counter.getSellerTargets',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: getSellerTargets failed; returning null',
        );
        return null;
      }
    },
    async hasAlreadyCountered(args) {
      try {
        const result = await db.execute(sql`
          SELECT 1
            FROM mwikila_actions_inbox
           WHERE tenant_id   = ${args.tenantId}
             AND action_kind = 'marketplace.counter_offer_listing'
             AND payload->>'bidId' = ${args.bidId}
           LIMIT 1
        `);
        if (rowsOf(result).length > 0) return true;
        // Also dedupe against an AI-counter already in negotiation_turns.
        const turn = await db.execute(sql`
          SELECT 1
            FROM negotiation_turns
           WHERE tenant_id      = ${args.tenantId}
             AND negotiation_id = ${args.bidId}
             AND actor          = 'ai'
           LIMIT 1
        `);
        return rowsOf(turn).length > 0;
      } catch (err) {
        logger.warn(
          {
            port: 'listing-counter.hasAlreadyCountered',
            err: err instanceof Error ? err.message : String(err),
          },
          'mwikila-port: hasAlreadyCountered failed; treating as countered',
        );
        return true;
      }
    },
  });
}
