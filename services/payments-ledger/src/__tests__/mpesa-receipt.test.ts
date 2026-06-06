/**
 * M-Pesa receipt resource URL (gap: gateway `GET /payments/:id/receipt`
 * sat at 409 for M-Pesa).
 *
 * Root cause pinned here:
 *   - `PaymentIntent.receiptUrl` is `z.string().url()`.
 *   - The M-Pesa STK/C2B success paths used to pass the bare Daraja receipt
 *     NUMBER (e.g. "QGR7AXH8LM") as `receiptUrl`. A bare number is not a URL,
 *     so it violates the schema contract and the gateway receipt endpoint
 *     (which returns `{ url: intent.receiptUrl }`) cannot resolve.
 *
 * `buildMpesaReceiptUrl` mints a deterministic receipt RESOURCE URL from the
 * real receipt number. These tests pin:
 *   1. The output is a valid URL that PASSES the `PaymentIntentSchema`
 *      `.url()` constraint that was being violated.
 *   2. The authoritative receipt number is recoverable from the URL.
 *   3. No receipt number → `undefined` (failed/cancelled STK issues none),
 *      so the caller leaves `receiptUrl` unset and the gateway correctly
 *      reports "not ready" rather than minting a dead URL.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buildMpesaReceiptUrl,
  MPESA_RECEIPT_DEFAULT_BASE_URL,
} from '../lib/mpesa-receipt';

// The exact constraint the bug violated (mirrors `PaymentIntentSchema`).
const receiptUrlContract = z.string().url();

const RECEIPT = 'QGR7AXH8LM';

describe('buildMpesaReceiptUrl', () => {
  it('returns undefined when no receipt number is available (failed STK)', () => {
    expect(buildMpesaReceiptUrl(undefined)).toBeUndefined();
    expect(buildMpesaReceiptUrl(null)).toBeUndefined();
    expect(buildMpesaReceiptUrl('')).toBeUndefined();
    expect(buildMpesaReceiptUrl('   ')).toBeUndefined();
  });

  it('produces a value that satisfies the receiptUrl `.url()` contract', () => {
    const url = buildMpesaReceiptUrl(RECEIPT, {});
    expect(url).toBeDefined();
    // This is the assertion that would have FAILED with the bare number.
    expect(() => receiptUrlContract.parse(url)).not.toThrow();
  });

  it('embeds the real receipt number so it is recoverable from the URL', () => {
    const url = buildMpesaReceiptUrl(RECEIPT, {})!;
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    expect(last).toBe(RECEIPT);
  });

  it('uses the default base URL when env override is unset', () => {
    const url = buildMpesaReceiptUrl(RECEIPT, {})!;
    expect(url.startsWith(MPESA_RECEIPT_DEFAULT_BASE_URL)).toBe(true);
    expect(url).toBe(`${MPESA_RECEIPT_DEFAULT_BASE_URL}/receipts/mpesa/${RECEIPT}`);
  });

  it('honours PAYMENTS_RECEIPT_BASE_URL and strips a trailing slash', () => {
    const url = buildMpesaReceiptUrl(RECEIPT, {
      PAYMENTS_RECEIPT_BASE_URL: 'https://pay.example.com/',
    })!;
    expect(url).toBe(`https://pay.example.com/receipts/mpesa/${RECEIPT}`);
    expect(() => receiptUrlContract.parse(url)).not.toThrow();
  });

  it('falls back to the default base when the configured base is not a usable http(s) URL', () => {
    // eslint-disable-next-line no-script-url -- intentional test fixture: asserts a `javascript:` base URL is rejected and falls back to the safe default. The string is never executed.
    for (const bad of ['not-a-url', 'ftp://x', 'javascript:alert(1)']) {
      const url = buildMpesaReceiptUrl(RECEIPT, { PAYMENTS_RECEIPT_BASE_URL: bad })!;
      expect(url.startsWith(MPESA_RECEIPT_DEFAULT_BASE_URL)).toBe(true);
      expect(() => receiptUrlContract.parse(url)).not.toThrow();
    }
  });

  it('trims and URL-encodes the receipt number so it cannot smuggle a path segment', () => {
    const url = buildMpesaReceiptUrl('  AB/CD 12  ', {})!;
    const parsed = new URL(url);
    // Exactly one segment after /receipts/mpesa/ — the slash is encoded.
    expect(parsed.pathname).toBe('/receipts/mpesa/AB%2FCD%2012');
    const last = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    expect(last).toBe('AB/CD 12');
    expect(() => receiptUrlContract.parse(url)).not.toThrow();
  });
});
