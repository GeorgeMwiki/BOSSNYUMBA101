/**
 * HTTP delivery with HMAC-SHA256 signatures for webhook payloads
 */

import CryptoJS from 'crypto-js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface DeliveryOptions {
  timeoutMs?: number;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export function signPayload(payload: string, secret: string): string {
  return CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
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

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

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
