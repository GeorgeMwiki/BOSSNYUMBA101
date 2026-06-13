/**
 * Reminder → real notification-delivery adapter.
 *
 * The lease-expiry alert cron (`workers/lease-expiry-alert-cron.ts`) talks to
 * a narrow `NotificationSender` port: `send({ tenantId, lease, window,
 * channel, idempotencyKey }) → { delivered, providerMessageId?, error? }`.
 *
 * Until now the composition root wired a STUB sender that logged the dispatch
 * and returned `{ delivered: true, providerMessageId: 'stub-…' }` — it never
 * touched a provider, so the cron recorded a FAKE success on every tick and no
 * lease-expiry alert ever reached a customer.
 *
 * This factory builds the REAL adapter. It delegates to the canonical
 * reliability path — the notifications dispatcher's `enqueueNotification`
 * (a.k.a. `dispatchNotification`) — which is the documented entry point every
 * reminder/alert source MUST route through (see `services/notifications/src/
 * index.ts`). Routing through the dispatcher (rather than calling a single
 * provider directly) is what gives lease-expiry alerts the full
 * "without-fail" apparatus:
 *
 *   - tenant-scoped provider selection + provider failover WITHIN a channel
 *     (e.g. SendGrid → SES → SMTP for email);
 *   - cross-channel fallback (the requested channel first, then the
 *     priority's chain, terminating in the always-available in-app inbox), so
 *     a WhatsApp-requested alert still lands in the customer's portal inbox
 *     when WhatsApp is down for the tenant;
 *   - retry-with-jittered-backoff on transient provider failure;
 *   - dispatch-time preference re-check + dedupe via a tenant-scoped
 *     idempotency key;
 *   - DLQ + `NotificationDeliveryFailed` event on genuine terminal failure.
 *
 * HONESTY CONTRACT (the whole point of replacing the stub): the adapter
 * returns `delivered: false` with a real `error` whenever the dispatcher could
 * not deliver on ANY channel (dead-lettered) OR was suppressed by preferences.
 * It returns `delivered: true` ONLY when the dispatcher actually `accepted`
 * the send on a real provider. The cron then records the truthful outcome in
 * `notification_dispatch_log` instead of a fabricated success.
 *
 * Tenant scoping: every dispatch carries `input.tenantId`, so provider
 * selection and the idempotency-key namespace are tenant-isolated — tenant-B's
 * alert can never route through tenant-A's Twilio/SendGrid credentials.
 */

import type {
  NotificationSender,
  ExpiringLeaseRow,
} from '../workers/lease-expiry-alert-cron.js';

// ─────────────────────────────────────────────────────────────────────────
// Structural ports (kept dependency-light so the adapter is trivially
// stubbable in unit tests and not coupled to the concrete service shapes).
// ─────────────────────────────────────────────────────────────────────────

/** The cron's channel set — a strict subset of the dispatcher's channels. */
type ReminderChannel = 'whatsapp' | 'sms' | 'email' | 'in_app';

/** Cross-channel dispatch priority (mirrors the dispatcher's `NotificationPriority`). */
type DispatchPriority = 'emergency' | 'high' | 'normal' | 'low';

/** Locales BossNyumba renders templates in. English is the launch default. */
type ReminderLocale = 'en' | 'sw';

/**
 * Structural slice of the dispatcher's `EnqueueNotificationInput`. The adapter
 * builds this and hands it to `enqueueNotification`. Only the fields the
 * lease-expiry alert needs are declared.
 */
export interface ReminderEnqueueInput {
  readonly tenantId: string;
  readonly userId?: string;
  readonly channel: ReminderChannel;
  readonly templateId: 'lease_expiring';
  readonly recipient: string;
  readonly subject?: string;
  readonly body: string;
  readonly title?: string;
  readonly data?: Record<string, string>;
  readonly priority?: DispatchPriority;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
}

/**
 * Structural slice of the dispatcher's `DispatchResult`. `accepted` is the
 * single source of truth for honest delivery; `deliveredVia` records a
 * cross-channel fallback; `deadLettered` / `suppressedReason` / `lastError`
 * carry the failure detail surfaced to the cron.
 */
export interface ReminderDispatchResult {
  readonly accepted: boolean;
  readonly externalId?: string;
  readonly deliveredVia?: ReminderChannel | string;
  readonly suppressedReason?: string;
  readonly deadLettered?: boolean;
  readonly attempts: number;
  readonly lastError?: string;
}

/**
 * The dispatcher entry point — the REAL `enqueueNotification` /
 * `dispatchNotification` from `@bossnyumba/notifications-service`. Injected so
 * the adapter is unit-testable without standing up live providers.
 */
export type DispatchFn = (input: ReminderEnqueueInput) => Promise<ReminderDispatchResult>;

/**
 * Template renderer — the REAL `resolveTemplate` from the notifications
 * package. Returns the locale-rendered subject/body/smsBody so the dispatcher
 * sends pre-rendered copy (it does not re-render).
 */
export type ResolveTemplateFn = (
  templateId: 'lease_expiring',
  locale: ReminderLocale,
  data: Record<string, string>,
) => { subject: string; body: string; smsBody: string };

export interface ReminderNotificationSenderLogger {
  readonly info: (obj: Record<string, unknown>, msg?: string) => void;
  readonly warn: (obj: Record<string, unknown>, msg?: string) => void;
  readonly error: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface ReminderNotificationSenderDeps {
  /** REAL dispatcher entry point (`enqueueNotification`). */
  readonly dispatch: DispatchFn;
  /** REAL template resolver (`resolveTemplate`). */
  readonly resolveTemplate: ResolveTemplateFn;
  readonly logger: ReminderNotificationSenderLogger;
  /**
   * Default recipient locale. English is the launch default per the hard
   * bilingual rule (a Tanzanian user toggles to `sw` in settings; the lease
   * row carries no per-customer locale, so the cron-side default applies).
   * Overridable for tenants whose default differs.
   */
  readonly defaultLocale?: ReminderLocale;
  /**
   * Cross-channel priority for automated lease-expiry alerts. Defaults to
   * `high` — a lease lapsing is materially important, so the dispatcher fans
   * across loud rails (whatsapp → sms → email) before settling in the in-app
   * inbox — but never `emergency` (these are scheduled, not safety-critical).
   */
  readonly priority?: DispatchPriority;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure mapping helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Format an expiry date for human-readable template copy. ISO date (UTC,
 * `YYYY-MM-DD`) — locale-neutral and unambiguous across the jurisdictions
 * BossNyumba serves; the template surrounds it with localized prose.
 */
export function formatExpiryDate(endDate: Date): string {
  return endDate.toISOString().slice(0, 10);
}

/**
 * Resolve the recipient address the dispatcher should target on the cron's
 * requested channel. Mirrors the cron's own `recipientAddress` derivation:
 *   - email  → customer email
 *   - in_app → customer id (the inbox is keyed by user, not an external addr)
 *   - sms / whatsapp → customer phone
 * Returns `null` when the lease lacks the address the channel needs (the
 * caller then reports an honest non-delivery — never a fake success).
 */
export function resolveRecipientAddress(
  lease: ExpiringLeaseRow,
  channel: ReminderChannel,
): string | null {
  switch (channel) {
    case 'email':
      return lease.customerEmail && lease.customerEmail.length > 0 ? lease.customerEmail : null;
    case 'in_app':
      return lease.customerId && lease.customerId.length > 0 ? lease.customerId : null;
    case 'sms':
    case 'whatsapp':
      return lease.customerPhone && lease.customerPhone.length > 0 ? lease.customerPhone : null;
    default:
      return null;
  }
}

/**
 * Build the lease-expiry template variables from a lease row. The
 * `lease_expiring` template consumes `expiryDate` (required) plus optional
 * `propertyName`/`unitNumber`. The cron row carries only IDs (no display
 * names), so we pass the expiry date and a `category` hint for the in-app
 * inbox row; we deliberately omit property/unit names rather than render a
 * raw UUID into customer-facing copy.
 */
export function buildTemplateData(lease: ExpiringLeaseRow, window: number): Record<string, string> {
  return {
    expiryDate: formatExpiryDate(lease.endDate),
    // Inbox classification hint consumed by the in-app provider's fallback hop.
    category: 'lease',
    // Carried for observability / downstream rendering; not customer-facing copy.
    windowDays: String(window),
    leaseNumber: lease.leaseNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build the real `NotificationSender` the lease-expiry cron delegates to.
 *
 * The returned `send(...)`:
 *   1. resolves the recipient address for the requested channel (honest
 *      non-delivery when the lease lacks it);
 *   2. renders the `lease_expiring` template in the recipient locale;
 *   3. dispatches through the REAL `enqueueNotification` with the cron's
 *      idempotency key (tenant-scoped inside the dispatcher) so a retry / racing
 *      replica can never double-send;
 *   4. maps the dispatcher's `DispatchResult` to the cron's
 *      `{ delivered, providerMessageId?, error? }` — `delivered: true` ONLY when
 *      the dispatcher `accepted` the send on a real provider; `delivered: false`
 *      with a real `error` on dead-letter or preference suppression.
 */
export function createReminderNotificationSender(
  deps: ReminderNotificationSenderDeps,
): NotificationSender {
  const defaultLocale: ReminderLocale = deps.defaultLocale ?? 'en';
  const priority: DispatchPriority = deps.priority ?? 'high';

  return {
    async send(args) {
      const { tenantId, lease, window, channel, idempotencyKey } = args;

      const recipient = resolveRecipientAddress(lease, channel);
      if (!recipient) {
        // The lease genuinely lacks the address this channel needs. Report an
        // honest non-delivery — NOT a fake success — so the cron records
        // `failed` with a real reason and ops can fix the customer record.
        const error = `no ${channel} address for customer ${lease.customerId}`;
        deps.logger.warn(
          { tenantId, leaseId: lease.id, window, channel, idempotencyKey },
          'reminder-sender: missing recipient address — honest non-delivery',
        );
        return { delivered: false, error };
      }

      let body: string;
      let subject: string;
      let smsBody: string;
      try {
        const rendered = deps.resolveTemplate(
          'lease_expiring',
          defaultLocale,
          buildTemplateData(lease, window),
        );
        subject = rendered.subject;
        body = rendered.body;
        smsBody = rendered.smsBody;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        deps.logger.error(
          { tenantId, leaseId: lease.id, window, channel, err: error },
          'reminder-sender: template render failed — honest non-delivery',
        );
        return { delivered: false, error: `template render failed: ${error}` };
      }

      // SMS / WhatsApp use the terse smsBody; email/in_app use the full body.
      const channelBody = channel === 'sms' || channel === 'whatsapp' ? smsBody : body;

      try {
        const result = await deps.dispatch({
          tenantId,
          // The cron treats `customerId` as the recipient identity for both the
          // in-app inbox row and the preference gate — carry it as `userId` so
          // the dispatcher's in-app terminal can address the inbox even when the
          // requested channel uses an external address (phone/email).
          userId: lease.customerId,
          channel,
          templateId: 'lease_expiring',
          recipient,
          subject: channel === 'email' ? subject : undefined,
          title: channel === 'in_app' ? subject : undefined,
          body: channelBody,
          data: buildTemplateData(lease, window),
          priority,
          correlationId: `lease-expiry-${lease.id}`,
          // Tenant-scoped inside the dispatcher → exactly-once across retries.
          idempotencyKey,
        });

        if (result.accepted) {
          // Surface a cross-channel fallback (e.g. whatsapp → in_app) so the
          // log row + ops see WHERE the alert actually landed.
          if (result.deliveredVia && result.deliveredVia !== channel) {
            deps.logger.info(
              {
                tenantId,
                leaseId: lease.id,
                window,
                requestedChannel: channel,
                deliveredVia: result.deliveredVia,
                idempotencyKey,
              },
              'reminder-sender: delivered via cross-channel fallback',
            );
          }
          return result.externalId !== undefined
            ? { delivered: true, providerMessageId: result.externalId }
            : { delivered: true };
        }

        // Not accepted → honest failure. Preference suppression and terminal
        // dead-letter both produce `delivered: false` with a real reason.
        const error = result.suppressedReason
          ? `suppressed: ${result.suppressedReason}`
          : (result.lastError ?? 'dispatch not accepted');
        deps.logger.warn(
          {
            tenantId,
            leaseId: lease.id,
            window,
            channel,
            attempts: result.attempts,
            deadLettered: result.deadLettered === true,
            idempotencyKey,
          },
          'reminder-sender: dispatch not accepted — recording honest failure',
        );
        return { delivered: false, error };
      } catch (err) {
        // The dispatcher itself threw (infra fault). Report honest failure so
        // the cron records `failed` and the alert is retried next tick.
        const error = err instanceof Error ? err.message : String(err);
        deps.logger.error(
          { tenantId, leaseId: lease.id, window, channel, err: error },
          'reminder-sender: dispatch threw — honest non-delivery',
        );
        return { delivered: false, error };
      }
    },
  };
}
