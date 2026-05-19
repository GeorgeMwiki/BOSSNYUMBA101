/**
 * Refresh-token mint/verify tests (AM-1).
 *
 * Locks in:
 *   - mint round-trips: a freshly-generated refresh token verifies
 *   - distinct secret: tokens signed with JWT_SECRET fail
 *   - jti present: rotation needs the jti to track revocation
 *   - expiry honoured
 */

import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/refresh-token';
import { getJwtRefreshSecret, getJwtSecret } from '../config/jwt';

describe('refresh-token mint + verify (AM-1)', () => {
  beforeAll(() => {
    // Ensure both secrets are set — force dev ephemeral keys to populate.
    void getJwtSecret();
    void getJwtRefreshSecret();
  });

  it('round-trips a freshly-minted token', () => {
    const { token, jti, sid } = generateRefreshToken({ userId: 'u-1' });
    const result = verifyRefreshToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.sub).toBe('u-1');
    expect(result.payload?.jti).toBe(jti);
    expect(result.payload?.sid).toBe(sid);
  });

  it('rejects a token signed with the access secret (cross-secret attack)', () => {
    // Manually mint a token using JWT_SECRET — should NOT verify.
    const fakeRefresh = jwt.sign(
      { sub: 'u-1', sid: 'sid-1' },
      getJwtSecret(),
      { expiresIn: '7d', jwtid: 'fake-jti', algorithm: 'HS256' }
    );
    const result = verifyRefreshToken(fakeRefresh);
    expect(result.valid).toBe(false);
  });

  it('expired tokens are marked expired (not just invalid)', () => {
    const expired = jwt.sign(
      { sub: 'u-1', sid: 'sid-1' },
      getJwtRefreshSecret(),
      { expiresIn: '-10s', jwtid: 'expired-jti', algorithm: 'HS256' }
    );
    const result = verifyRefreshToken(expired);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it('reuses a provided sessionId so token-family rotation can chain', () => {
    const first = generateRefreshToken({ userId: 'u-1' });
    const second = generateRefreshToken({ userId: 'u-1', sessionId: first.sid });
    expect(second.sid).toBe(first.sid);
    expect(second.jti).not.toBe(first.jti); // jti is always fresh
  });

  it('garbage strings fail with valid:false', () => {
    const result = verifyRefreshToken('not.a.real.jwt');
    expect(result.valid).toBe(false);
  });
});
