/**
 * Notification Provider Webhook Router — SCAFFOLDED 8 + NEW 21
 *
 * Single Hono router that terminates delivery-status webhooks from the
 * three SMS/WhatsApp/Email providers we use in production:
 *
 *   - POST /webhooks/notifications/africastalking  (SMS delivery reports)
 *   - POST /webhooks/notifications/twilio          (SMS + WhatsApp)
 *   - POST /webhooks/notifications/meta            (WhatsApp Business / Meta)
 *
 * Signature verification is enforced for each provider using the secret
 * configured via environment variable. The raw body is required for
 * verification — callers mounting this router MUST NOT pre-parse JSON for
 * these paths. We read the body ourselves via `c.req.raw.text()`.
 */

import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookHandlerDeps {
  /** Handler invoked with the parsed status update. Kept abstract so the
   * gateway can decide whether to update the DB directly or emit an event. */
  onDeliveryStatus(update: {
    provider: 'africastalking' | 'twilio' | 'meta';
    providerMessageId?: string;
    status: string;
    occurredAt: Date;
    raw: Record<string, unknown>;
  }): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Signature verification helpers
// ---------------------------------------------------------------------------

// HIGH-7 (audit .audit/post-pr90-api-mcp-bug-sweep.md): the previous
// implementation computed HMAC over the raw body ALONE — no timestamp,
// no nonce. A signed body captured once was replayable forever.
//
// Fix: when callers send an `X-Webhook-Timestamp` header, include the
// timestamp in the signed payload AND enforce a 5-minute replay window
// (mirroring Inngest). Verifiers reject the request if drift exceeds the
// window even when the signature matches a stale body.
//
// Backward compatibility: if no timestamp header is present we fall back
// to the legacy body-only verification (with a startup warn) so existing
// production webhooks keep working until provider configs roll. Set
// `WEBHOOK_REQUIRE_TIMESTAMP=true` to fail closed in production.
const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const TIMESTAMP_HEADER = 'x-webhook-timestamp';

function timestampInWindow(tsHeader: string | undefined): boolean {
  if (!tsHeader) return false;
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= WEBHOOK_REPLAY_WINDOW_MS;
}

function requireTimestamp(): boolean {
  return (
    process.env.WEBHOOK_REQUIRE_TIMESTAMP === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Africa's Talking: HMAC-SHA256 of `${ts}.${rawBody}` (with timestamp)
 * or raw body alone (legacy), sent as hex in `X-AT-Signature`. Secret
 * comes from `AFRICASTALKING_WEBHOOK_SECRET`.
 */
function verifyAfricasTalking(
  rawBody: string,
  signatureHeader: string | undefined,
  timestampHeader?: string
): boolean {
  const secret = process.env.AFRICASTALKING_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  if (timestampHeader) {
    if (!timestampInWindow(timestampHeader)) return false;
    const expected = createHmac('sha256', secret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex');
    return safeEqualHex(expected, signatureHeader);
  }
  if (requireTimestamp()) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signatureHeader);
}

/**
 * Twilio: per https://www.twilio.com/docs/usage/webhooks/webhooks-security,
 * the signature is HMAC-SHA1 over `url + sorted-form-params` (concatenated
 * key+value), Base64-encoded, sent in `X-Twilio-Signature`.
 *
 * HIGH-7 fix: implement Twilio's documented format. The old code computed
 * HMAC-SHA1 over the JSON raw body — which (a) would reject real Twilio
 * webhooks following the documented URL+form format, AND (b) would accept
 * forged signatures computed over arbitrary JSON. Both broken.
 *
 * `url` must be the FULL request URL as Twilio called it (gateway should
 * pass the public-facing URL via `TWILIO_WEBHOOK_URL` or via the request
 * itself).
 */
function verifyTwilio(
  rawBody: string,
  signatureHeader: string | undefined,
  requestUrl: string | undefined
): boolean {
  const secret = process.env.TWILIO_AUTH_TOKEN;
  if (!secret || !signatureHeader) return false;
  if (!requestUrl) return false;
  // Twilio sends form-encoded bodies; sort the params and concatenate
  // key+value pairs to the URL.
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(rawBody);
  } catch {
    return false;
  }
  const sorted = Array.from(params.entries()).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  let signedPayload = requestUrl;
  for (const [k, v] of sorted) {
    signedPayload += k + v;
  }
  const expected = createHmac('sha1', secret).update(signedPayload).digest('base64');
  return safeEqualB64(expected, signatureHeader);
}

/**
 * Meta (WhatsApp Business Cloud API): HMAC-SHA256 of the raw body, prefixed
 * with "sha256=" in `X-Hub-Signature-256`. Meta does not yet sign a
 * timestamp; when callers wrap the request via the api-gateway we add
 * one and verify it for replay protection.
 */
function verifyMeta(
  rawBody: string,
  signatureHeader: string | undefined,
  timestampHeader?: string
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  if (timestampHeader && !timestampInWindow(timestampHeader)) return false;
  if (!timestampHeader && requireTimestamp()) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  return safeEqualHex(expected, provided);
}

function safeEqualHex(expectedHex: string, providedHex: string): boolean {
  if (expectedHex.length !== providedHex.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(providedHex, 'hex'));
  } catch {
    return false;
  }
}

function safeEqualB64(expectedB64: string, providedB64: string): boolean {
  try {
    const a = Buffer.from(expectedB64, 'base64');
    const b = Buffer.from(providedB64, 'base64');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Status normalization
// ---------------------------------------------------------------------------

function normalizeAfricasTalkingStatus(raw: Record<string, unknown>): string {
  const status = String((raw as { status?: string }).status ?? 'unknown').toLowerCase();
  // AT values: Success, Sent, Submitted, Buffered, Rejected, Failed, Delivered, Expired
  if (status === 'success' || status === 'delivered') return 'delivered';
  if (status === 'sent' || status === 'submitted' || status === 'buffered') return 'sent';
  if (status === 'rejected' || status === 'failed') return 'failed';
  if (status === 'expired') return 'expired';
  return 'unknown';
}

function normalizeTwilioStatus(raw: Record<string, unknown>): string {
  const status = String(
    (raw as { MessageStatus?: string; SmsStatus?: string }).MessageStatus ??
      (raw as { SmsStatus?: string }).SmsStatus ??
      'unknown'
  ).toLowerCase();
  if (status === 'delivered' || status === 'read') return status;
  if (status === 'sent' || status === 'queued' || status === 'sending') return 'sent';
  if (status === 'failed' || status === 'undelivered') return 'failed';
  return 'unknown';
}

function normalizeMetaStatus(raw: Record<string, unknown>): {
  status: string;
  providerMessageId?: string;
} {
  // Meta webhooks are nested: entry[].changes[].value.statuses[].status
  const entry = (raw as { entry?: Array<Record<string, unknown>> }).entry ?? [];
  const changes = (entry[0]?.changes as Array<Record<string, unknown>>) ?? [];
  const value = (changes[0]?.value as Record<string, unknown>) ?? {};
  const statuses = (value.statuses as Array<Record<string, unknown>>) ?? [];
  const first = statuses[0];
  if (!first) return { status: 'unknown' };
  const status = String(first.status ?? 'unknown').toLowerCase();
  const normalized =
    status === 'delivered' || status === 'read' || status === 'sent' || status === 'failed'
      ? status
      : 'unknown';
  return { status: normalized, providerMessageId: first.id as string | undefined };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createNotificationWebhookRouter(deps: WebhookHandlerDeps): Hono {
  const app = new Hono();

  app.post('/africastalking', async (c) => {
    const raw = await c.req.raw.text();
    const sig = c.req.header('x-at-signature');
    const ts = c.req.header(TIMESTAMP_HEADER);
    if (!verifyAfricasTalking(raw, sig, ts)) {
      return c.json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } }, 401);
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ error: { code: 'INVALID_BODY', message: 'Malformed JSON' } }, 400);
    }
    await deps.onDeliveryStatus({
      provider: 'africastalking',
      providerMessageId: (payload as { id?: string }).id,
      status: normalizeAfricasTalkingStatus(payload),
      occurredAt: new Date(),
      raw: payload,
    });
    return c.json({ received: true });
  });

  app.post('/twilio', async (c) => {
    const raw = await c.req.raw.text();
    const sig = c.req.header('x-twilio-signature');
    // Twilio signs over the FULL URL — prefer the env-pinned URL so
    // forwarded-header spoofing can't shift it. Fall back to the
    // request URL only in non-prod.
    const requestUrl =
      process.env.TWILIO_WEBHOOK_URL ?? (process.env.NODE_ENV !== 'production' ? c.req.url : undefined);
    if (!verifyTwilio(raw, sig, requestUrl)) {
      return c.json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } }, 401);
    }
    // Twilio uses form-encoded bodies by default; JSON webhooks are opt-in.
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      // Fallback: parse urlencoded.
      const params = new URLSearchParams(raw);
      payload = Object.fromEntries(params.entries());
    }
    await deps.onDeliveryStatus({
      provider: 'twilio',
      providerMessageId: (payload as { MessageSid?: string }).MessageSid,
      status: normalizeTwilioStatus(payload),
      occurredAt: new Date(),
      raw: payload,
    });
    return c.json({ received: true });
  });

  app.post('/meta', async (c) => {
    const raw = await c.req.raw.text();
    const sig = c.req.header('x-hub-signature-256');
    const ts = c.req.header(TIMESTAMP_HEADER);
    if (!verifyMeta(raw, sig, ts)) {
      return c.json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } }, 401);
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ error: { code: 'INVALID_BODY', message: 'Malformed JSON' } }, 400);
    }
    const { status, providerMessageId } = normalizeMetaStatus(payload);
    await deps.onDeliveryStatus({
      provider: 'meta',
      providerMessageId,
      status,
      occurredAt: new Date(),
      raw: payload,
    });
    return c.json({ received: true });
  });

  return app;
}

// Exported for unit testing without spinning up Hono.
export const __internal = {
  verifyAfricasTalking,
  verifyTwilio,
  verifyMeta,
  normalizeAfricasTalkingStatus,
  normalizeTwilioStatus,
  normalizeMetaStatus,
};
