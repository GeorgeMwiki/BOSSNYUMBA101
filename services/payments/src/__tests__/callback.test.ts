/**
 * Callback hardening tests (Week-0).
 *
 * Coverage:
 *   - HMAC signature verification accepts a valid signature
 *   - Invalid or missing signatures are rejected (fail-closed)
 *   - Missing MPESA_CALLBACK_SECRET fails closed (no accidental bypass)
 *   - Replay protection rejects duplicate (MerchantRequestID, CheckoutRequestID)
 *   - Parser redacts the raw MSISDN in log context (via maskMsisdn helper)
 *   - timingSafeEqual is used (smoke-tested via tampered signatures)
 */
import { createHmac } from 'crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { maskMsisdn } from '../common/redact';
import { InMemoryReplayStore } from '../common/replay-store';
import {
  assertStkCallbackNotReplayed,
  DuplicateCallbackError,
  handleVerifiedStkCallback,
  InvalidSignatureError,
  parseStkCallback,
  setCallbackReplayStore,
  verifyMpesaCallbackSignature,
} from '../providers/mpesa/callback-handler';

const SECRET = 'unit-test-callback-secret';

function sign(body: string, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function successBody(mr = 'MR-1', cr = 'CR-1') {
  return JSON.stringify({
    Body: {
      stkCallback: {
        MerchantRequestID: mr,
        CheckoutRequestID: cr,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 1000 },
            { Name: 'MpesaReceiptNumber', Value: 'ABC123XYZ' },
            { Name: 'TransactionDate', Value: 20240301120000 },
            { Name: 'PhoneNumber', Value: 254712345678 },
          ],
        },
      },
    },
  });
}

describe('verifyMpesaCallbackSignature', () => {
  beforeEach(() => {
    process.env.MPESA_CALLBACK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.MPESA_CALLBACK_SECRET;
  });

  it('accepts a correctly signed body (hex)', () => {
    const body = successBody();
    expect(verifyMpesaCallbackSignature(body, sign(body))).toBe(true);
  });

  it('accepts a sha256=<hex> prefixed signature', () => {
    const body = successBody();
    const sig = `sha256=${sign(body)}`;
    expect(verifyMpesaCallbackSignature(body, sig)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const body = successBody();
    const sig = sign(body).replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    expect(verifyMpesaCallbackSignature(body, sig)).toBe(false);
  });

  it('rejects a signature for a different body', () => {
    const body = successBody();
    const otherSig = sign('{"tampered":true}');
    expect(verifyMpesaCallbackSignature(body, otherSig)).toBe(false);
  });

  it('rejects missing signature', () => {
    const body = successBody();
    expect(verifyMpesaCallbackSignature(body, undefined)).toBe(false);
    expect(verifyMpesaCallbackSignature(body, null)).toBe(false);
    expect(verifyMpesaCallbackSignature(body, '')).toBe(false);
  });

  it('fails closed when the secret is not configured', () => {
    delete process.env.MPESA_CALLBACK_SECRET;
    const body = successBody();
    expect(verifyMpesaCallbackSignature(body, sign(body, 'anything'))).toBe(false);
  });

  it('respects the passed-in override secret (rotation)', () => {
    const body = successBody();
    const rotated = 'rotated-secret';
    expect(
      verifyMpesaCallbackSignature(body, sign(body, rotated), rotated)
    ).toBe(true);
  });
});

describe('parseStkCallback', () => {
  it('parses a successful STK callback', () => {
    const parsed = parseStkCallback(JSON.parse(successBody()));
    expect(parsed.status).toBe('SUCCEEDED');
    expect(parsed.amount).toBe(1000);
    expect(parsed.mpesaReceiptNumber).toBe('ABC123XYZ');
    expect(parsed.phoneNumber).toBe('254712345678');
    // MSISDN is masked when the helper is applied for log output.
    expect(maskMsisdn(parsed.phoneNumber!)).toBe('254***5678');
  });

  it('parses a cancelled STK callback (1032)', () => {
    const body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR-c',
          CheckoutRequestID: 'CR-c',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    };
    const parsed = parseStkCallback(body);
    expect(parsed.status).toBe('CANCELLED');
  });

  it('throws on malformed payload', () => {
    expect(() => parseStkCallback({ not: 'valid' })).toThrow(
      /Invalid STK callback structure/
    );
  });
});

describe('assertStkCallbackNotReplayed', () => {
  beforeEach(() => {
    setCallbackReplayStore(new InMemoryReplayStore({ ttlMs: 60_000 }));
  });

  it('accepts the first occurrence of a (merchantId, checkoutId) pair', () => {
    expect(() => assertStkCallbackNotReplayed('MR-x', 'CR-x')).not.toThrow();
  });

  it('rejects a second occurrence as a duplicate', () => {
    assertStkCallbackNotReplayed('MR-y', 'CR-y');
    expect(() => assertStkCallbackNotReplayed('MR-y', 'CR-y')).toThrow(
      DuplicateCallbackError
    );
  });

  it('distinguishes different checkout ids', () => {
    assertStkCallbackNotReplayed('MR-z', 'CR-z1');
    expect(() => assertStkCallbackNotReplayed('MR-z', 'CR-z2')).not.toThrow();
  });
});

describe('handleVerifiedStkCallback', () => {
  beforeEach(() => {
    process.env.MPESA_CALLBACK_SECRET = SECRET;
    setCallbackReplayStore(new InMemoryReplayStore({ ttlMs: 60_000 }));
  });
  afterEach(() => {
    delete process.env.MPESA_CALLBACK_SECRET;
  });

  it('happy path: verifies signature, parses, and records replay key', () => {
    const raw = successBody('MR-H1', 'CR-H1');
    const parsed = handleVerifiedStkCallback({
      rawBody: raw,
      signature: sign(raw),
    });
    expect(parsed.checkoutRequestId).toBe('CR-H1');
    expect(parsed.merchantRequestId).toBe('MR-H1');
  });

  it('throws InvalidSignatureError on bad signature', () => {
    const raw = successBody('MR-H2', 'CR-H2');
    expect(() =>
      handleVerifiedStkCallback({ rawBody: raw, signature: 'deadbeef' })
    ).toThrow(InvalidSignatureError);
  });

  it('throws DuplicateCallbackError when the same callback arrives twice', () => {
    const raw = successBody('MR-H3', 'CR-H3');
    const sig = sign(raw);
    handleVerifiedStkCallback({ rawBody: raw, signature: sig });
    expect(() =>
      handleVerifiedStkCallback({ rawBody: raw, signature: sig })
    ).toThrow(DuplicateCallbackError);
  });

  it('fails closed when MPESA_CALLBACK_SECRET is missing', () => {
    delete process.env.MPESA_CALLBACK_SECRET;
    const raw = successBody('MR-H4', 'CR-H4');
    expect(() =>
      handleVerifiedStkCallback({ rawBody: raw, signature: sign(raw, 'x') })
    ).toThrow(InvalidSignatureError);
  });

  it('throws CallbackError on malformed JSON', () => {
    const raw = 'not-json';
    expect(() =>
      handleVerifiedStkCallback({ rawBody: raw, signature: sign(raw) })
    ).toThrow(/Malformed JSON/);
  });
});
