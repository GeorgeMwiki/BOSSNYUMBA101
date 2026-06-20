/**
 * Lease Expiry Alert Cron — Wave 15 (TRC pilot).
 *
 * Daily multi-tenant scanner. For every active tenant, finds leases whose
 * `end_date` lands inside one of the configured warning windows (60, 30, 7,
 * 1 days from now) and dispatches a notification per (lease, window).
 *
 * Design notes (Wave 15 = no new architecture):
 *   - We re-use `notification_dispatch_log.idempotency_key` as the dedupe
 *     ledger. The key shape is deterministic — see `buildIdempotencyKey`.
 *     The table's UNIQUE INDEX (tenant_id, idempotency_key) guarantees we
 *     never double-send a (lease, window) alert even across restarts /
 *     two pods racing the same tick.
 *   - Channel preference order: whatsapp → sms → email → in_app. We try
 *     each provider in turn and the first that's configured for the tenant
 *     wins. If none are configured, we still write a `pending` row to
 *     `notification_dispatch_log` so the alert exists for audit and the
 *     ops team can reconfigure providers later.
 *   - The worker is multi-tenant: it enumerates active tenants (the
 *     `tenants` table is RLS `USING(TRUE)`, so visible to any role) and
 *     runs the `leases.end_date` scan + every `notification_dispatch_log`
 *     read/write for that tenant INSIDE `withWorkerTenantContext`, which
 *     binds `app.current_tenant_id` transaction-locally. The `leases` /
 *     `customers` tables carry ONLY the tenant-GUC isolation policy (no
 *     `service_role_bypass`), so without a bound tenant GUC the
 *     `leases_tenant_isolation` policy would silently filter the scan to
 *     ZERO rows under the non-BYPASS DB role. We never rely on a BYPASSRLS
 *     role; per-tenant context is the isolation boundary.
 *   - Lifecycle mirrors `cases-sla-supervisor.ts` — `start()` schedules a
 *     daily tick, `stop()` clears the timer. Both are idempotent.
 *
 * Env knobs:
 *   - LEASE_EXPIRY_ALERT_INTERVAL_MS    override the 24h cadence (tests)
 *   - LEASE_EXPIRY_ALERT_DISABLED=true  inert in this process (k8s CronJob
 *                                       takes over instead)
 *
 * Out of scope for Wave 15 (documented in Docs/WAVE15_TRC_PILOT.md):
 *   - Per-tenant local-time alignment (we tick on UTC; a per-tenant DST
 *     scheduler ships in Wave 17).
 *   - DLQ / retry — relies on `notification_dispatch_log.delivery_status`
 *     + the existing dispatcher worker for retries.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import { withWorkerTenantContext } from './with-tenant-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Expiry windows (in days) at which an alert fires. */
export const DEFAULT_EXPIRY_WINDOWS_DAYS = [60, 30, 7, 1] as const;
export type ExpiryWindowDays = (typeof DEFAULT_EXPIRY_WINDOWS_DAYS)[number] | number;

/** A lease that's eligible for an expiry-window alert. */
export interface ExpiringLeaseRow {
  readonly id: string;
  readonly tenantId: string;
  readonly leaseNumber: string;
  readonly propertyId: string;
  readonly unitId: string;
  readonly customerId: string;
  readonly endDate: Date;
  readonly rentAmount: number;
  readonly rentCurrency: string;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly customerFirstName: string | null;
  readonly customerLastName: string | null;
  readonly windowDays: number;
}

/** Per-channel send adapter — caller wires in the real notifications service. */
export interface NotificationSender {
  send(args: {
    readonly tenantId: string;
    readonly lease: ExpiringLeaseRow;
    readonly window: number;
    readonly channel: 'whatsapp' | 'sms' | 'email' | 'in_app';
    readonly idempotencyKey: string;
  }): Promise<{ readonly delivered: boolean; readonly providerMessageId?: string; readonly error?: string }>;
}

/**
 * Round-3 audit #24 — consent / preference gate for automated lease-expiry
 * alerts. The cron previously dispatched to customers WITHOUT consulting the
 * per-recipient notification preferences (the same gate `services/
 * notifications` enforces via `prefs.checkAllowed`) NOR a per-tenant
 * automated-reminders switch. That bypassed an opt-out and could spam a
 * customer who disabled the channel/template.
 *
 * The gate is injected so the gateway composition wires the real
 * notifications preferences service + the tenant automated-reminders flag.
 * It is FAIL-CLOSED by default (see `defaultConsentGate`): when no gate is
 * wired, automated alerts are suppressed rather than sent, because consent
 * is a hard precondition for unsolicited outbound messaging.
 */
export interface ConsentGate {
  /**
   * Returns whether an automated lease-expiry alert may be sent to this
   * (tenant, customer, channel). MUST consult BOTH the per-recipient
   * notification preferences AND the per-tenant automated-reminders switch
   * (default off/gated). `false` ⇒ the cron skips the send and records
   * `suppressed_no_consent`.
   */
  isAutomatedReminderAllowed(args: {
    readonly tenantId: string;
    readonly customerId: string;
    readonly channel: 'whatsapp' | 'sms' | 'email' | 'in_app';
  }): Promise<{ readonly allowed: boolean; readonly reason?: string }>;
}

/**
 * Default gate when none is injected: fail-closed. An automated alert
 * without an explicit consent decision is suppressed — never sent — so a
 * misconfigured composition can't silently spam customers.
 */
export const defaultConsentGate: ConsentGate = {
  async isAutomatedReminderAllowed() {
    return { allowed: false, reason: 'no_consent_gate_wired' };
  },
};

/** DB execute shim — accepts either a Drizzle client or a postgres.js sql tag. */
export interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface LeaseExpiryAlertCronOptions {
  readonly db: DbLike;
  readonly sender: NotificationSender;
  readonly logger: Logger;
  readonly intervalMs?: number;
  readonly enabled?: boolean;
  readonly windowsDays?: readonly number[];
  /** Channel priority (first configured wins). */
  readonly channelOrder?: ReadonlyArray<'whatsapp' | 'sms' | 'email' | 'in_app'>;
  /** Used in tests to make tick() deterministic. */
  readonly now?: () => Date;
  /**
   * Optional cluster-wide single-flight gate (multi-replica safety). When
   * provided, the SCHEDULED tick runs only on the replica holding the
   * Postgres advisory lock — so 3 replicas don't all scan + dispatch the
   * same expiry alerts on the same day. The per-(lease,window) idempotency
   * key + `ON CONFLICT DO NOTHING` insert is the second line of defence
   * (see `insertPendingDispatch`). `tickOnce()` always bypasses the gate.
   */
  readonly clusterLock?: (fn: () => Promise<void>) => Promise<void>;
  /**
   * #24 — per-recipient consent + per-tenant automated-reminders gate.
   * Defaults to `defaultConsentGate` (fail-closed) when omitted so the
   * cron never sends an unsolicited automated alert without consent.
   */
  readonly consentGate?: ConsentGate;
}

export interface LeaseExpiryAlertCronHandle {
  start(): void;
  stop(): void;
  /** Drive a single tick synchronously — exposed for tests + ops. */
  tickOnce(): Promise<TickResult>;
}

export interface TickResult {
  readonly scanned: number;
  readonly dispatched: number;
  readonly skippedAlreadySent: number;
  /** #24 — alerts suppressed because consent/preferences disallowed them. */
  readonly suppressedNoConsent: number;
  readonly failed: number;
  readonly byWindow: Record<number, number>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Day-level idempotency key for a (lease, window) alert.
 *
 *   key = `lease-expiry::${leaseId}::${window}d`
 *
 * NOT date-suffixed — a 30-day window for a given lease can only ever fire
 * once. If the lease is renewed, a NEW lease row is created with a new id,
 * so the key namespace stays clean.
 */
export function buildIdempotencyKey(leaseId: string, windowDays: number): string {
  return `lease-expiry::${leaseId}::${windowDays}d`;
}

/**
 * Match an `endDate` against the configured windows. A lease matches a
 * window if the date diff (now → endDate) rounds to that window exactly.
 * We bucket by calendar-days (00:00 UTC), so the function is deterministic
 * regardless of when within the tick day the cron actually runs.
 *
 * Returns the matching window (in days) or `null` if no match.
 */
export function classifyExpiryWindow(
  endDate: Date,
  now: Date,
  windows: readonly number[],
): number | null {
  const startOfDay = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const ms = startOfDay(endDate) - startOfDay(now);
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return windows.includes(days) ? days : null;
}

/** Decide which channel to use for a given lease based on customer fields + priority. */
export function selectChannel(
  lease: ExpiringLeaseRow,
  channelOrder: ReadonlyArray<'whatsapp' | 'sms' | 'email' | 'in_app'>,
): 'whatsapp' | 'sms' | 'email' | 'in_app' | null {
  for (const ch of channelOrder) {
    if (ch === 'whatsapp' && lease.customerPhone) return ch;
    if (ch === 'sms' && lease.customerPhone) return ch;
    if (ch === 'email' && lease.customerEmail) return ch;
    if (ch === 'in_app') return ch; // in-app needs no channel address
  }
  return null;
}

// ---------------------------------------------------------------------------
// Active-tenant enumeration — the `tenants` table is RLS `USING(TRUE)`, so
// this read resolves under the non-BYPASS DB role without binding any tenant
// GUC. Every per-tenant scan below then runs inside `withWorkerTenantContext`
// so the tenant-isolation policy on `leases` / `customers` matches rows.
// ---------------------------------------------------------------------------

interface RawTenantRow {
  readonly id: unknown;
}

export async function enumerateActiveTenants(db: DbLike): Promise<readonly string[]> {
  const res = await db.execute(sql`
    SELECT id FROM tenants
     WHERE status = 'active' AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 5000
  `);
  const rows = Array.isArray(res)
    ? (res as RawTenantRow[])
    : (((res as { rows?: RawTenantRow[] }).rows ?? []) as RawTenantRow[]);
  return rows.map((r) => String(r.id));
}

// ---------------------------------------------------------------------------
// Scan query — returns leases whose end_date falls within MAX(windows) days.
// We over-scan and filter in JS so the same row can match different windows
// across multiple cron runs (e.g. a lease at 60d today is at 30d in 30 days
// — both alerts must fire).
//
// MUST run inside `withWorkerTenantContext` (see the tick loop): the query has
// no explicit `tenant_id` predicate, so the `leases_tenant_isolation` RLS
// policy is what scopes it to the bound tenant. Without a bound tenant GUC it
// returns ZERO rows under the non-BYPASS DB role.
// ---------------------------------------------------------------------------

interface RawLeaseRow {
  readonly id: unknown;
  readonly tenant_id: unknown;
  readonly lease_number: unknown;
  readonly property_id: unknown;
  readonly unit_id: unknown;
  readonly customer_id: unknown;
  readonly end_date: unknown;
  readonly rent_amount: unknown;
  readonly rent_currency: unknown;
  readonly customer_email: unknown;
  readonly customer_phone: unknown;
  readonly customer_first_name: unknown;
  readonly customer_last_name: unknown;
}

export async function fetchExpiringLeases(
  db: DbLike,
  now: Date,
  windowsDays: readonly number[],
): Promise<readonly ExpiringLeaseRow[]> {
  const maxWindow = Math.max(...windowsDays);
  // Add 1 day of slack so a lease whose end_date is exactly at the upper
  // boundary is still picked up by the query.
  const upperBound = new Date(now.getTime() + (maxWindow + 1) * 24 * 60 * 60 * 1000);
  // Lower bound: include leases that already crossed (so a 1-day window can
  // still fire on the morning of expiry day).
  const lowerBound = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const res = await db.execute(sql`
    SELECT
      l.id,
      l.tenant_id,
      l.lease_number,
      l.property_id,
      l.unit_id,
      l.customer_id,
      l.end_date,
      l.rent_amount,
      l.rent_currency,
      c.email AS customer_email,
      c.phone AS customer_phone,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name
    FROM leases l
    LEFT JOIN customers c ON c.id = l.customer_id AND c.tenant_id = l.tenant_id
    WHERE l.deleted_at IS NULL
      AND l.status IN ('active', 'expiring_soon', 'approved')
      AND l.end_date BETWEEN ${lowerBound.toISOString()} AND ${upperBound.toISOString()}
    ORDER BY l.end_date ASC
    LIMIT 5000
  `);

  const rows = Array.isArray(res)
    ? (res as RawLeaseRow[])
    : (((res as { rows?: RawLeaseRow[] }).rows ?? []) as RawLeaseRow[]);

  // Filter to exact-window matches; rows that don't classify drop out.
  const matched: ExpiringLeaseRow[] = [];
  for (const r of rows) {
    const endDate = new Date(String(r.end_date));
    const window = classifyExpiryWindow(endDate, now, windowsDays);
    if (window === null) continue;
    matched.push({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      leaseNumber: String(r.lease_number),
      propertyId: String(r.property_id),
      unitId: String(r.unit_id),
      customerId: String(r.customer_id),
      endDate,
      rentAmount: Number(r.rent_amount ?? 0),
      rentCurrency: String(r.rent_currency ?? 'TZS'),
      customerEmail: r.customer_email ? String(r.customer_email) : null,
      customerPhone: r.customer_phone ? String(r.customer_phone) : null,
      customerFirstName: r.customer_first_name ? String(r.customer_first_name) : null,
      customerLastName: r.customer_last_name ? String(r.customer_last_name) : null,
      windowDays: window,
    });
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Already-sent guard — the unique index on (tenant_id, idempotency_key) does
// the heavy lifting; we still pre-check so we don't waste a provider call.
// ---------------------------------------------------------------------------

export async function isAlreadySent(
  db: DbLike,
  tenantId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT 1 FROM notification_dispatch_log
     WHERE tenant_id = ${tenantId} AND idempotency_key = ${idempotencyKey}
     LIMIT 1
  `);
  const rows = Array.isArray(res)
    ? (res as unknown[])
    : ((res as { rows?: unknown[] }).rows ?? []);
  return rows.length > 0;
}

/** Result of attempting to claim a (lease, window) dispatch slot. */
export interface InsertPendingDispatchResult {
  /**
   * `true` when THIS call inserted the row (i.e. we won the race and own
   * the send). `false` when a concurrent replica/tick already inserted the
   * same `(tenant_id, idempotency_key)` — the `ON CONFLICT DO NOTHING`
   * suppressed our insert, so we must NOT send (the winner will).
   */
  readonly inserted: boolean;
  /** Row id (only meaningful when `inserted === true`). */
  readonly id: string;
}

/**
 * Atomically claim the dispatch slot for a (lease, window) alert.
 *
 * TOCTOU hardening: even with the per-tick cluster lock + the upfront
 * `isAlreadySent` pre-check, two replicas could race between the SELECT and
 * the INSERT. We make the INSERT the single source of truth by relying on
 * the UNIQUE `(tenant_id, idempotency_key)` index: `ON CONFLICT DO NOTHING
 * RETURNING id` returns a row ONLY when this statement actually inserted.
 * The caller sends `iff inserted`, so the alert is delivered exactly once
 * cluster-wide regardless of how many replicas reach this point.
 */
export async function insertPendingDispatch(
  db: DbLike,
  args: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
    readonly lease: ExpiringLeaseRow;
    readonly channel: string;
    readonly recipientAddress: string;
  },
): Promise<InsertPendingDispatchResult> {
  const id = `ndl_${randomUUID()}`;
  const res = await db.execute(sql`
    INSERT INTO notification_dispatch_log (
      id, tenant_id, customer_id, channel, recipient_address,
      template_key, locale, payload, correlation_id, idempotency_key,
      attempt_count, delivery_status, created_at, updated_at
    ) VALUES (
      ${id}, ${args.tenantId}, ${args.lease.customerId}, ${args.channel}, ${args.recipientAddress},
      ${'lease.expiry.alert'}, ${'sw'},
      ${JSON.stringify({
        leaseId: args.lease.id,
        leaseNumber: args.lease.leaseNumber,
        propertyId: args.lease.propertyId,
        unitId: args.lease.unitId,
        windowDays: args.lease.windowDays,
        endDate: args.lease.endDate.toISOString(),
        rentAmountMinor: args.lease.rentAmount,
        rentCurrency: args.lease.rentCurrency,
        customerName: [args.lease.customerFirstName, args.lease.customerLastName].filter(Boolean).join(' '),
      })}::jsonb,
      ${`lease-expiry-${args.lease.id}`}, ${args.idempotencyKey},
      0, 'pending', NOW(), NOW()
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id
  `);
  const rows = Array.isArray(res)
    ? (res as unknown[])
    : ((res as { rows?: unknown[] }).rows ?? []);
  return { inserted: rows.length > 0, id };
}

/**
 * #24 — durably record that a (lease, window) alert was SUPPRESSED because
 * the consent/preference gate disallowed it. We write the dispatch-log row
 * keyed by the same idempotency key (so the cron does not re-evaluate the
 * same suppressed alert every day) with a terminal status and an explicit
 * `suppressed_no_consent` marker in the payload + error column. The
 * `notification_delivery_status` enum has no `suppressed` member (migrations
 * are immutable), so we use the terminal `failed` status purely as the row's
 * lifecycle state while `provider_error_message` carries the audit reason.
 *
 * Returns whether THIS call inserted the row (it may already exist from a
 * prior tick — `ON CONFLICT DO NOTHING`).
 */
export async function recordSuppressedDispatch(
  db: DbLike,
  args: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
    readonly lease: ExpiringLeaseRow;
    readonly channel: string;
    readonly recipientAddress: string;
    readonly reason: string;
  },
): Promise<{ readonly inserted: boolean }> {
  const id = `ndl_${randomUUID()}`;
  const res = await db.execute(sql`
    INSERT INTO notification_dispatch_log (
      id, tenant_id, customer_id, channel, recipient_address,
      template_key, locale, payload, correlation_id, idempotency_key,
      attempt_count, delivery_status, provider_error_message, created_at, updated_at
    ) VALUES (
      ${id}, ${args.tenantId}, ${args.lease.customerId}, ${args.channel}, ${args.recipientAddress},
      ${'lease.expiry.alert'}, ${'sw'},
      ${JSON.stringify({
        leaseId: args.lease.id,
        leaseNumber: args.lease.leaseNumber,
        windowDays: args.lease.windowDays,
        suppressed: true,
        suppressedReason: 'suppressed_no_consent',
        gateReason: args.reason,
      })}::jsonb,
      ${`lease-expiry-${args.lease.id}`}, ${args.idempotencyKey},
      0, 'failed', ${`suppressed_no_consent:${args.reason}`}, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id
  `);
  const rows = Array.isArray(res)
    ? (res as unknown[])
    : ((res as { rows?: unknown[] }).rows ?? []);
  return { inserted: rows.length > 0 };
}

/** Mark a dispatched row as sent or failed after the provider call. */
export async function updateDispatchOutcome(
  db: DbLike,
  args: {
    readonly id: string;
    readonly delivered: boolean;
    readonly providerMessageId?: string;
    readonly error?: string;
  },
): Promise<void> {
  if (args.delivered) {
    await db.execute(sql`
      UPDATE notification_dispatch_log
         SET delivery_status = 'sent',
             provider_message_id = ${args.providerMessageId ?? null},
             last_attempt_at = NOW(),
             attempt_count = attempt_count + 1,
             updated_at = NOW()
       WHERE id = ${args.id}
    `);
  } else {
    await db.execute(sql`
      UPDATE notification_dispatch_log
         SET delivery_status = 'failed',
             provider_error_message = ${args.error ?? 'unknown'},
             last_attempt_at = NOW(),
             attempt_count = attempt_count + 1,
             updated_at = NOW()
       WHERE id = ${args.id}
    `);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHANNEL_ORDER = ['whatsapp', 'sms', 'email', 'in_app'] as const;

export function createLeaseExpiryAlertCron(
  options: LeaseExpiryAlertCronOptions,
): LeaseExpiryAlertCronHandle {
  const envIntervalMs = Number(process.env.LEASE_EXPIRY_ALERT_INTERVAL_MS);
  const intervalMs = Math.max(
    1_000,
    options.intervalMs ??
      (Number.isFinite(envIntervalMs) && envIntervalMs > 0 ? envIntervalMs : ONE_DAY_MS),
  );
  const enabled =
    options.enabled ??
    (process.env.NODE_ENV !== 'test' &&
      process.env.LEASE_EXPIRY_ALERT_DISABLED !== 'true');

  const windowsDays = options.windowsDays ?? DEFAULT_EXPIRY_WINDOWS_DAYS;
  const channelOrder = options.channelOrder ?? DEFAULT_CHANNEL_ORDER;
  const nowFn = options.now ?? (() => new Date());
  // #24 — fail-closed when no consent gate is wired.
  const consentGate = options.consentGate ?? defaultConsentGate;

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  // Scheduled ticks pass through the cluster-lock gate (when wired) so only
  // one replica scans + dispatches per cadence. `tickOnce()` stays ungated.
  async function scheduledTick(): Promise<void> {
    if (options.clusterLock) {
      await options.clusterLock(async () => {
        await tick();
      });
      return;
    }
    await tick();
  }

  /**
   * Process one tenant's expiring-lease alerts. Every DB statement runs
   * inside `withWorkerTenantContext` so the `leases_tenant_isolation` /
   * `customers_tenant_isolation` policies match rows for THIS tenant (these
   * tables have no `service_role_bypass` policy — a bound tenant GUC is the
   * only way they return rows under the non-BYPASS DB role).
   *
   * The cost-bearing `sender.send` (a network call) is deliberately run
   * OUTSIDE any transaction — between two short context blocks — so the cron
   * never holds a reserved DB connection across a provider round-trip. The
   * slot-claim block and the outcome-update block are each their own pinned
   * transaction; the per-(lease,window) `ON CONFLICT DO NOTHING` claim keeps
   * delivery exactly-once across replicas regardless.
   */
  async function processTenant(tenantId: string, now: Date, result: TickResult): Promise<void> {
    // Scan this tenant's leases under its bound GUC.
    const candidates = await withWorkerTenantContext(options.db, tenantId, (pinned) =>
      fetchExpiringLeases(pinned, now, windowsDays),
    );
    (result as { scanned: number }).scanned += candidates.length;

    for (const lease of candidates) {
      const window = lease.windowDays;
      const idempotencyKey = buildIdempotencyKey(lease.id, window);
      try {
        const channel = selectChannel(lease, channelOrder);
        if (!channel) {
          options.logger.warn(
            { tenantId: lease.tenantId, leaseId: lease.id, window },
            'lease-expiry-cron: no channel available for lease',
          );
          (result as { failed: number }).failed += 1;
          continue;
        }
        const recipientAddress =
          channel === 'email'
            ? (lease.customerEmail ?? '')
            : channel === 'in_app'
              ? lease.customerId
              : (lease.customerPhone ?? '');

        // Slot-claim block: the already-sent pre-check, the #24 consent
        // suppression, and the TOCTOU-safe pending-dispatch insert all share
        // ONE bound-tenant transaction so the FORCE-RLS
        // `notification_dispatch_log` reads/writes match this tenant's rows.
        // The consent gate (its own non-DB service) is consulted ONLY after
        // the already-sent short-circuit, then BEFORE claiming a slot: if it
        // disallows, we durably record `suppressed_no_consent` (idempotency-
        // keyed so it isn't re-evaluated every day) and skip the send.
        const claim = await withWorkerTenantContext(
          options.db,
          lease.tenantId,
          async (
            pinned,
          ): Promise<{ readonly action: 'send' | 'skip' | 'suppressed'; readonly reason?: string; readonly id?: string }> => {
            const sent = await isAlreadySent(pinned, lease.tenantId, idempotencyKey);
            if (sent) return { action: 'skip' };

            const consent = await consentGate.isAutomatedReminderAllowed({
              tenantId: lease.tenantId,
              customerId: lease.customerId,
              channel,
            });
            if (!consent.allowed) {
              const reason = consent.reason ?? 'no_consent';
              await recordSuppressedDispatch(pinned, {
                tenantId: lease.tenantId,
                idempotencyKey,
                lease,
                channel,
                recipientAddress,
                reason,
              });
              return { action: 'suppressed', reason };
            }

            const inserted = await insertPendingDispatch(pinned, {
              tenantId: lease.tenantId,
              idempotencyKey,
              lease,
              channel,
              recipientAddress,
            });
            // TOCTOU defence: if we did NOT win the insert race, another
            // replica/tick owns this (lease, window) — skip the send so the
            // alert goes out exactly once cluster-wide.
            if (!inserted.inserted) return { action: 'skip' };
            return { action: 'send', id: inserted.id };
          },
        );

        if (claim.action === 'skip') {
          (result as { skippedAlreadySent: number }).skippedAlreadySent += 1;
          continue;
        }
        if (claim.action === 'suppressed') {
          options.logger.info(
            {
              tenantId: lease.tenantId,
              leaseId: lease.id,
              window,
              reason: claim.reason ?? 'no_consent',
            },
            'lease-expiry-cron: suppressed_no_consent',
          );
          (result as { suppressedNoConsent: number }).suppressedNoConsent += 1;
          continue;
        }

        // Network send — OUTSIDE any transaction so no DB connection is held
        // across the provider round-trip.
        const outcome = await options.sender.send({
          tenantId: lease.tenantId,
          lease,
          window,
          channel,
          idempotencyKey,
        });

        // Outcome-update block: separate bound-tenant transaction.
        await withWorkerTenantContext(options.db, lease.tenantId, (pinned) =>
          updateDispatchOutcome(pinned, {
            id: claim.id!,
            delivered: outcome.delivered,
            providerMessageId: outcome.providerMessageId,
            error: outcome.error,
          }),
        );
        if (outcome.delivered) {
          (result as { dispatched: number }).dispatched += 1;
          (result as { byWindow: Record<number, number> }).byWindow[window] =
            (result.byWindow[window] ?? 0) + 1;
        } else {
          (result as { failed: number }).failed += 1;
        }
      } catch (err) {
        options.logger.error(
          {
            tenantId: lease.tenantId,
            leaseId: lease.id,
            window,
            err: err instanceof Error ? err.message : String(err),
          },
          'lease-expiry-cron: lease alert failed',
        );
        (result as { failed: number }).failed += 1;
      }
    }
  }

  async function tick(): Promise<TickResult> {
    const result: TickResult = {
      scanned: 0,
      dispatched: 0,
      skippedAlreadySent: 0,
      suppressedNoConsent: 0,
      failed: 0,
      byWindow: {},
    };
    if (running) return result; // skip overlapping ticks
    running = true;
    const started = Date.now();
    try {
      const now = nowFn();
      // Enumerate active tenants (the `tenants` table is RLS `USING(TRUE)`,
      // so this read resolves without any tenant GUC). Each tenant's scan +
      // dispatch then runs inside `withWorkerTenantContext` so the
      // tenant-isolation policy on `leases` / `customers` matches rows.
      const tenants = await enumerateActiveTenants(options.db);
      if (tenants.length === 0) {
        // Fail loud rather than silently no-op: an empty active-tenant set on
        // a live deployment means either the enumeration itself was RLS-
        // filtered to zero or there genuinely are no tenants. Log a warning
        // so the dark-worker failure mode (the original bug) stays observable.
        options.logger.warn(
          'lease-expiry-cron: no active tenants enumerated — nothing to scan',
        );
      }

      for (const tenantId of tenants) {
        try {
          await processTenant(tenantId, now, result);
        } catch (err) {
          options.logger.error(
            {
              tenantId,
              err: err instanceof Error ? err.message : String(err),
            },
            'lease-expiry-cron: tenant tick failed',
          );
          (result as { failed: number }).failed += 1;
        }
      }
      options.logger.info(
        { durationMs: Date.now() - started, tenants: tenants.length, ...result },
        'lease-expiry-cron: tick complete',
      );
    } finally {
      running = false;
    }
    return result;
  }

  return {
    start() {
      if (!enabled) {
        options.logger.info('lease-expiry-cron: disabled by env');
        return;
      }
      if (timer) {
        options.logger.warn('lease-expiry-cron: already running, ignoring duplicate start');
        return;
      }
      options.logger.info({ intervalMs, windowsDays }, 'lease-expiry-cron started');
      timer = setInterval(() => {
        void scheduledTick();
      }, intervalMs);
      if (typeof timer.unref === 'function') timer.unref();
      // Kick once immediately so a fresh process starts converged.
      void scheduledTick();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        options.logger.info('lease-expiry-cron stopped');
      }
    },
    async tickOnce() {
      return tick();
    },
  };
}
