/**
 * GePG signature validation
 *
 * TODO: Replace this stub with real XML-DSig / RSA verification using
 * the PKCS#12 cert issued by GePG. The real flow:
 *   1) Canonicalize XML body
 *   2) Extract <Signature> element
 *   3) Load GePG public cert, verify RSA-SHA256 signature
 * See GePG integration spec §4 (SignatureValue/KeyInfo).
 *
 * For sandbox and PSP-shortcut mode (see RESEARCH_ANSWERS.md Q2) we
 * validate via HMAC shared secret — the PSP terminates the full GePG
 * signature envelope on our behalf.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { GepgSignatureVerification } from './types';

export interface GepgSignatureConfig {
  readonly mode: 'hmac-psp' | 'rsa-gepg';
  readonly hmacSecret?: string;
  readonly gepgPublicCertPem?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyGepgSignature(
  rawBody: string,
  signature: string | undefined,
  config: GepgSignatureConfig
): GepgSignatureVerification {
  if (!signature) {
    return { valid: false, reason: 'missing_signature' };
  }

  if (config.mode === 'hmac-psp') {
    if (!config.hmacSecret) {
      return { valid: false, reason: 'hmac_secret_not_configured' };
    }
    const expected = createHmac('sha256', config.hmacSecret)
      .update(rawBody)
      .digest('hex');
    const normalized = signature.replace(/^sha256=/, '');
    const valid = constantTimeEqual(expected, normalized);
    return {
      valid,
      reason: valid ? undefined : 'signature_mismatch',
      signedBy: valid ? 'psp' : undefined,
    };
  }

  // FIXED C-2: wire the real RSA XML-DSig verifier for rsa-gepg mode.
  // Uses gepg-rsa-signature.ts (pure Node crypto, zero external XML deps).
  // Keys loaded lazily from GEPG_SIGNING_CERT_PEM env or GEPG_SIGNING_CERT_PATH
  // file. Falls back to invalid if no public cert configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { verifyGepgEnvelope } = require('./gepg-rsa-signature') as typeof import('./gepg-rsa-signature');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadGepgKeys } = require('./key-loader') as typeof import('./key-loader');
  const keys = loadGepgKeys();
  if (keys.source === 'missing' || !keys.publicCertPem) {
    return { valid: false, reason: 'rsa_gepg_public_cert_not_configured' };
  }
  const result = verifyGepgEnvelope(rawBody, { publicCertPem: keys.publicCertPem });
  return {
    valid: result.valid,
    reason: result.valid ? undefined : result.reason ?? 'rsa_verification_failed',
    signedBy: result.valid ? 'gepg' : undefined,
  };
}

export function signPayloadHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
