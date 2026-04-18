import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  canonicalizeGepgEnvelope,
  signGepgEnvelope,
  verifyGepgEnvelope,
  GepgRsaError,
} from './gepg-rsa-signature';

function fakeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicCertPem: publicKey };
}

const SAMPLE = `<?xml version="1.0"?>
<gepgBillSubReq>
  <BillHdr>
    <SpCode>SP001</SpCode>
    <RtrRespFlg>true</RtrRespFlg>
  </BillHdr>
  <BillTrxInf>
    <BillId>INV-001</BillId>
  </BillTrxInf>
</gepgBillSubReq>`;

describe('canonicalizeGepgEnvelope', () => {
  it('strips XML declaration and whitespace between tags', () => {
    const out = canonicalizeGepgEnvelope(SAMPLE);
    expect(out.startsWith('<gepgBillSubReq>')).toBe(true);
    expect(out).not.toMatch(/>\s+</);
  });

  it('removes any existing signature block for re-signing idempotency', () => {
    const withSig = SAMPLE.replace(
      '</gepgBillSubReq>',
      '<gepgSignature>OLDSIG</gepgSignature></gepgBillSubReq>'
    );
    const out = canonicalizeGepgEnvelope(withSig);
    expect(out).not.toContain('gepgSignature');
  });
});

describe('sign/verify round-trip', () => {
  it('signs and verifies successfully with matching keys', () => {
    const keys = fakeKeyPair();
    const signed = signGepgEnvelope(SAMPLE, keys);
    expect(signed.xml).toContain('<gepgSignature>');
    expect(signed.signatureBase64.length).toBeGreaterThan(100);
    const r = verifyGepgEnvelope(signed.xml, keys);
    expect(r.valid).toBe(true);
  });

  it('fails verification with a different key', () => {
    const signing = fakeKeyPair();
    const other = fakeKeyPair();
    const signed = signGepgEnvelope(SAMPLE, signing);
    const r = verifyGepgEnvelope(signed.xml, { publicCertPem: other.publicCertPem });
    expect(r.valid).toBe(false);
  });

  it('throws MISSING_PRIVATE_KEY when no key is provided', () => {
    expect(() => signGepgEnvelope(SAMPLE, {})).toThrow(GepgRsaError);
  });

  it('returns not-valid when signature block is absent', () => {
    const keys = fakeKeyPair();
    const r = verifyGepgEnvelope(SAMPLE, keys);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('No <gepgSignature>');
  });
});
