import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeyPairSync,
  privateDecrypt,
  constants,
} from 'crypto';
import { buildSecurityCredential } from '../providers/mpesa/security-credential';
import { PaymentError } from '../common/errors';

describe('buildSecurityCredential', () => {
  let publicKeyPem: string;
  let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];

  beforeAll(() => {
    const kp = generateKeyPairSync('rsa', { modulusLength: 2048 });
    publicKeyPem = kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privateKey = kp.privateKey;
  });

  it('RSA-encrypts the initiator password with the provided certificate', () => {
    const cipherB64 = buildSecurityCredential({
      environment: 'sandbox',
      initiatorPassword: 'S3cretP@ss',
      certificatePem: publicKeyPem,
    });
    const decrypted = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(cipherB64, 'base64')
    );
    expect(decrypted.toString('utf8')).toBe('S3cretP@ss');
  });

  it('throws if the PEM is invalid', () => {
    expect(() =>
      buildSecurityCredential({
        environment: 'sandbox',
        initiatorPassword: 'x',
        certificatePem: 'not-a-pem',
      })
    ).toThrow(PaymentError);
  });

  it('throws if initiatorPassword is empty', () => {
    expect(() =>
      buildSecurityCredential({
        environment: 'sandbox',
        initiatorPassword: '',
        certificatePem: publicKeyPem,
      })
    ).toThrow(/initiatorPassword/);
  });
});
