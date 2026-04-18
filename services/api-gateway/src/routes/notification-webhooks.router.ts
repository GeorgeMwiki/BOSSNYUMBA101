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

/**
 * Africa's Talking: HMAC-SHA256 of the raw body, sent as hex in the
 * `X-AT-Signature` header. Secret comes from `AFRICASTALKING_WEBHOOK_SECRET`.
 */
function verifyAfricasTalking(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = process.env.AFRICASTALKING_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signatureHeader);
}

/**
 * Twilio: HMAC-SHA1 over `url + sorted-form-params`, Base64-encoded, sent
 * as `X-Twilio-Signature`. For the simplified JSON webhook variant Twilio
 * also accepts HMAC over the raw body — we support that form here to avoid
 * requiring URL reconstruction.
 */
function verifyTwilio(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = process.env.TWILIO_AUTH_TOKEN;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac('sha1', secret).update(rawBody).digest('base64');
  return safeEqualB64(expected, signatureHeader);
}

/**
 * Meta (WhatsApp Business Cloud API): HMAC-SHA256 of the raw body, prefixed
 * with "sha256=" in the `X-Hub-Signature-256` header. Secret is the App
 * Secret set in `META_APP_SECRET`.
 */
function verifyMeta(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
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
    if (!verifyAfricasTalking(raw, sig)) {
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
    if (!verifyTwilio(raw, sig)) {
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
    if (!verifyMeta(raw, sig)) {
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
