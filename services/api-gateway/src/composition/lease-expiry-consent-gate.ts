/**
 * Lease-expiry automated-reminder consent gate (Round-3 audit #24 wiring).
 *
 * The lease-expiry cron (`workers/lease-expiry-alert-cron.ts`) ships with a
 * FAIL-CLOSED `defaultConsentGate` (`{ allowed: false,
 * reason: 'no_consent_gate_wired' }`). With no real gate wired in the
 * composition root the cron is born-dark — every 60/30/7/1-day alert is
 * suppressed with `suppressed_no_consent`. This factory builds the REAL gate
 * the composition injects, so alerts dispatch for tenants that have opted in
 * and recipients that have not opted out.
 *
 * Per the `ConsentGate` contract, an automated reminder may go out ONLY when
 * BOTH gates allow it:
 *   (b) the per-tenant automated-reminders switch — `tenants.settings`
 *       jsonb `automatedRemindersEnabled`. OPT-IN (default off/gated): a
 *       tenant enables automated lease reminders explicitly. Unsolicited
 *       automated outbound (SMS/WhatsApp especially) is opt-in across the
 *       jurisdictions BossNyumba serves, so a tenant that has not set the
 *       flag is a legitimate DENY (`tenant_reminders_disabled`).
 *   (a) the per-recipient notification preferences — the SAME gate
 *       `services/notifications` enforces via `prefs.checkAllowed`. Honours a
 *       customer who disabled the channel/template (`channel_disabled` /
 *       `template_disabled` / `quiet_hours`).
 *
 * FAIL-CLOSED only when an upstream is GENUINELY UNAVAILABLE (the tenant-switch
 * query throws, or `prefs.checkAllowed` throws). A reachable-but-negative
 * answer is a normal DENY, never a fault — so a transient infra blip can't
 * silently spam customers, but a deliberate opt-out is respected without
 * tripping the fault path.
 */

import { sql } from 'drizzle-orm';
import type { ConsentGate } from '../workers/lease-expiry-alert-cron.js';

/** Minimal db surface — a Drizzle client or postgres.js `sql` tag executor. */
export interface ConsentGateDbLike {
  execute(query: unknown): Promise<unknown>;
}

/**
 * Structural slice of the notifications `PreferencesService` — only the
 * `checkAllowed` gate is needed. Structural (not the concrete type) so the
 * gate is trivially stubbable in tests and not coupled to the service shape.
 */
export interface ConsentPreferencesGate {
  checkAllowed(args: {
    userId: string;
    tenantId: string;
    channel: 'whatsapp' | 'sms' | 'email' | 'in_app';
    templateId: 'lease_expiring';
    priority?: 'emergency' | 'high' | 'normal' | 'low';
  }): Promise<{ allowed: boolean; reason?: string }>;
}

export interface LeaseExpiryConsentGateDeps {
  readonly db: ConsentGateDbLike;
  readonly prefs: ConsentPreferencesGate;
  readonly logger: { warn(obj: Record<string, unknown>, msg?: string): void };
}

/** The lease-expiry alert maps to the `lease_expiring` notification template. */
const LEASE_EXPIRY_TEMPLATE = 'lease_expiring' as const;

/** Normalise a Drizzle / postgres.js result into a plain rows array. */
function extractRows(res: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const rows = (res as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export function createLeaseExpiryConsentGate(
  deps: LeaseExpiryConsentGateDeps,
): ConsentGate {
  return {
    async isAutomatedReminderAllowed({ tenantId, customerId, channel }) {
      // ── (b) per-tenant automated-reminders switch ───────────────────────
      let tenantEnabled: boolean;
      try {
        const res = await deps.db.execute(
          sql`SELECT settings FROM tenants WHERE id = ${tenantId} LIMIT 1`,
        );
        const rows = extractRows(res);
        if (rows.length === 0) {
          // No such tenant — a genuine deny, not a fault.
          return { allowed: false, reason: 'tenant_not_found' };
        }
        const settings = (rows[0]?.['settings'] ?? {}) as Record<string, unknown>;
        tenantEnabled = settings['automatedRemindersEnabled'] === true;
      } catch (err) {
        // The switch lookup genuinely failed — fail CLOSED.
        deps.logger.warn(
          { err: String(err), tenantId },
          'lease-expiry consent: tenant automated-reminders lookup failed — fail-closed',
        );
        return { allowed: false, reason: 'tenant_settings_unavailable' };
      }
      if (!tenantEnabled) {
        return { allowed: false, reason: 'tenant_reminders_disabled' };
      }

      // ── (a) per-recipient notification preferences ──────────────────────
      try {
        const gate = await deps.prefs.checkAllowed({
          userId: customerId,
          tenantId,
          channel,
          templateId: LEASE_EXPIRY_TEMPLATE,
          priority: 'normal',
        });
        return gate.reason !== undefined
          ? { allowed: gate.allowed, reason: gate.reason }
          : { allowed: gate.allowed };
      } catch (err) {
        // Preferences service genuinely unavailable — fail CLOSED.
        deps.logger.warn(
          { err: String(err), tenantId, customerId },
          'lease-expiry consent: prefs.checkAllowed failed — fail-closed',
        );
        return { allowed: false, reason: 'prefs_unavailable' };
      }
    },
  };
}
