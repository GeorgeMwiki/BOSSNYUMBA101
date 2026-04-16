/**
 * HTTP delivery with HMAC-SHA256 signatures for webhook payloads.
 *
 * Production-hardened: exponential backoff + jitter on retryable failures
 * (network error, 408, 429, 5xx). Caller can opt out with retries=0.
 */

import CryptoJS from 'crypto-js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface DeliveryOptions {
  timeoutMs?: number;
  /** Maximum retry attempts (default 3). */
  retries?: number;
  /** Base backoff in ms (default 500). */
  retryBaseMs?: number;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export function signPayload(payload: string, secret: string): string {
  return CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
}

function isRetryable(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

async function deliverOnce(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok
      ? { success: true, statusCode: res.status }
      : { success: false, statusCode: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function deliver(
  url: string,
  payload: object,
  secret?: string,
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': new Date().toISOString(),
  };
  if (secret) {
    headers['X-Webhook-Signature'] = `sha256=${signPayload(body, secret)}`;
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, (options.retries ?? 3) + 1);
  const baseMs = options.retryBaseMs ?? 500;

  let last: DeliveryResult = { success: false, error: 'no_attempt' };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await deliverOnce(url, body, headers, timeoutMs);
    if (r.success) return r;
    last = r;
    if (!isRetryable(r.statusCode) || attempt === maxAttempts - 1) return r;
    const backoff = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
  return last;
}
