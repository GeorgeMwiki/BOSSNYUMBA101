/**
 * M-Pesa Security Credential helper.
 *
 * Daraja's privileged endpoints (B2C, Reversal, AccountBalance, TransactionStatus)
 * require an RSA-encrypted version of the initiator password, using Safaricom's
 * public key certificate. The encrypted blob is base64-encoded and sent in the
 * `SecurityCredential` field.
 *
 * Consumers should provide the PEM-encoded certificate via env variable
 * `MPESA_INITIATOR_CERT_PEM` (production) or `MPESA_SANDBOX_CERT_PEM` (sandbox).
 */
import { publicEncrypt, constants, createPublicKey } from 'crypto';
import { PaymentError } from '../../common/errors';

export interface SecurityCredentialConfig {
  environment: 'sandbox' | 'production';
  initiatorPassword: string;
  /** PEM-encoded certificate. If omitted, read from env. */
  certificatePem?: string;
}

function loadCertificate(env: 'sandbox' | 'production', pem?: string): string {
  if (pem) return pem;
  const cert =
    env === 'production'
      ? process.env.MPESA_INITIATOR_CERT_PEM
      : process.env.MPESA_SANDBOX_CERT_PEM;
  if (!cert) {
    throw new PaymentError(
      `Missing M-Pesa certificate PEM for ${env} environment`,
      'CERT_MISSING',
      'mpesa'
    );
  }
  return cert;
}

/**
 * Build the `SecurityCredential` string for a Daraja privileged endpoint.
 *
 * @returns Base64-encoded RSA-PKCS1 ciphertext of the initiator password.
 */
export function buildSecurityCredential(
  config: SecurityCredentialConfig
): string {
  if (!config.initiatorPassword) {
    throw new PaymentError(
      'initiatorPassword is required to build SecurityCredential',
      'VALIDATION_ERROR',
      'mpesa'
    );
  }
  const pem = loadCertificate(config.environment, config.certificatePem);

  let key;
  try {
    key = createPublicKey(pem);
  } catch (err) {
    throw new PaymentError(
      'Invalid M-Pesa certificate PEM',
      'CERT_INVALID',
      'mpesa',
      err
    );
  }

  const encrypted = publicEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(config.initiatorPassword, 'utf8')
  );
  return encrypted.toString('base64');
}
