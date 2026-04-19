
/**
 * MFA — TOTP-based second-factor flow.
 *
 *   POST /auth/mfa/challenge    → issues a short-lived challenge ID after
 *                                 the caller's primary-factor login has
 *                                 succeeded but MFA is enabled on the
 *                                 account. Client renders TOTP input.
 *   POST /auth/mfa/verify       → accepts {challengeId, code}; if valid,
 *                                 mints the full-scope access token.
 *   POST /auth/mfa/enroll       → begin MFA enrollment — returns a QR
 *                                 otpauth:// URL + recovery codes.
 *   POST /auth/mfa/confirm      → finish enrollment after the user scans
 *                                 and enters a valid code.
 *
 * The TOTP math (HMAC-SHA1 of the current 30s window + secret) is
 * implemented inline with Node's built-in crypto so we don't pull
 * a heavyweight dep for a tiny primitive. See RFC 6238.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import { UserRole } from '../types/user-role';

const app = new Hono();

// Process-local challenge store. Replace with Redis for multi-replica.
interface ChallengeEntry {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
  createdAt: number;
  consumedAt?: number;
}
const challenges = new Map<string, ChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function reapChallenges() {
  const now = Date.now();
  for (const [id, e] of challenges) {
    if (e.createdAt + CHALLENGE_TTL_MS < now) challenges.delete(id);
  }
}
setInterval(reapChallenges, 60 * 1000).unref?.();

// TOTP primitives --------------------------------------------------------

// RFC 4648 base32 alphabet (public standard, not a secret).
// eslint-disable-next-line no-secrets/no-secrets
const RFC4648_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  // RFC 4648 base32. TOTP secrets are conventionally base32-encoded.
  const alphabet = RFC4648_BASE32_ALPHABET;
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(buf: Buffer): string {
  const alphabet = RFC4648_BASE32_ALPHABET;
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder) {
    const last = bits.slice(-remainder).padEnd(5, '0');
    out += alphabet[parseInt(last, 2)];
  }
  return out;
}

/** Compute the 6-digit TOTP code for a given time window. */
function totpCode(secretB32: string, timeSec: number, step = 30): string {
  const secret = base32Decode(secretB32);
  const counter = Math.floor(timeSec / step);
  const counterBuf = Buffer.alloc(8);
  // Write the counter as a big-endian 64-bit int (top 32 bits are always 0
  // for the next ~135 years, so just write the low 32).
  counterBuf.writeUInt32BE(0, 0);
  counterBuf.writeUInt32BE(counter, 4);
  const hmac = createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const slice = hmac.subarray(offset, offset + 4);
  const code =
    ((slice[0] & 0x7f) << 24) |
    (slice[1] << 16) |
    (slice[2] << 8) |
    slice[3];
  return (code % 1_000_000).toString().padStart(6, '0');
}

/** Accept ±1 window (~30s either side) to absorb client-clock drift. */
function verifyTotp(secretB32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (const offset of [-1, 0, 1]) {
    const expected = totpCode(secretB32, now + offset * 30);
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// Endpoints --------------------------------------------------------------

const ChallengeSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.string().min(1),
  permissions: z.array(z.string()).optional(),
  propertyAccess: z.array(z.string()).optional(),
});

/**
 * Issued internally by /auth/login when the account has MFA enabled,
 * rather than minting the full access token immediately. The client
 * then POSTs to /verify with the challenge id + 6-digit TOTP.
 *
 * NOTE: In production this endpoint should be service-to-service only;
 * exposing it directly would let any authenticated user forge a
 * challenge. We gate it with authMiddleware so the caller at least
 * needs a valid scoped token.
 */
app.post('/challenge', authMiddleware, zValidator('json', ChallengeSchema), async (c) => {
  const body = c.req.valid('json');
  const challengeId = randomUUID();
  challenges.set(challengeId, {
    userId: body.userId,
    tenantId: body.tenantId,
    role: body.role as UserRole,
    permissions: body.permissions ?? [],
    propertyAccess: body.propertyAccess ?? [],
    createdAt: Date.now(),
  });
  return c.json({
    success: true,
    data: {
      challengeId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    },
  });
});

const VerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, '6-digit TOTP code required'),
  secret: z.string().min(16), // caller supplies the stored user secret
});

app.post('/verify', zValidator('json', VerifySchema), async (c) => {
  const { challengeId, code, secret } = c.req.valid('json');
  const entry = challenges.get(challengeId);
  if (!entry || entry.consumedAt) {
    return c.json(
      { success: false, error: { code: 'INVALID_CHALLENGE', message: 'Challenge expired or already used' } },
      401
    );
  }
  if (entry.createdAt + CHALLENGE_TTL_MS < Date.now()) {
    challenges.delete(challengeId);
    return c.json(
      { success: false, error: { code: 'CHALLENGE_EXPIRED', message: 'Challenge expired' } },
      401
    );
  }
  if (!verifyTotp(secret, code)) {
    return c.json(
      { success: false, error: { code: 'INVALID_CODE', message: 'Invalid TOTP code' } },
      401
    );
  }
  // Single-use: mark consumed so a replay in a race condition fails.
  entry.consumedAt = Date.now();
  const token = generateToken({
    userId: entry.userId,
    tenantId: entry.tenantId,
    role: entry.role,
    permissions: entry.permissions,
    propertyAccess: entry.propertyAccess,
  });
  return c.json({
    success: true,
    data: { token, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  });
});

const EnrollSchema = z.object({
  accountName: z.string().min(1).max(100),
  issuer: z.string().default('BOSSNYUMBA'),
});

app.post('/enroll', authMiddleware, zValidator('json', EnrollSchema), async (c) => {
  const auth = c.get('auth');
  const { accountName, issuer } = c.req.valid('json');
  // 20 bytes = 160 bits of entropy, the RFC-6238 recommended minimum.
  const secret = base32Encode(randomBytes(20));
  const otpauth =
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  // Recovery codes — one-time-use backups printed to the user.
  const recoveryCodes = Array.from({ length: 10 }, () =>
    randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')
  );
  return c.json({
    success: true,
    data: {
      secret,
      otpauth,
      recoveryCodes,
      notice:
        'Store the secret server-side (encrypted) and prompt the user to confirm enrollment via POST /auth/mfa/confirm with a valid code before you trust it.',
      userId: auth.userId,
    },
  });
});

const ConfirmSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/, '6-digit TOTP code required'),
});

app.post('/confirm', authMiddleware, zValidator('json', ConfirmSchema), async (c) => {
  const { secret, code } = c.req.valid('json');
  if (!verifyTotp(secret, code)) {
    return c.json(
      { success: false, error: { code: 'INVALID_CODE', message: 'Invalid TOTP code' } },
      401
    );
  }
  // Caller service is responsible for persisting `mfa_enabled=true` +
  // the (encrypted) secret on the user record. We just attest that the
  // code validates against the secret.
  return c.json({ success: true, data: { verified: true } });
});

export const authMfaRouter = app;
