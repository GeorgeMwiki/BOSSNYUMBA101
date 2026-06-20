/**
 * Live detector for the JarvisConsole bearer source.
 *
 * The console authenticates the Jarvis SDK client purely via the
 * `Authorization: Bearer …` header (the SDK does not send cookies). The
 * original code read an `sb-access-token` cookie that is NEVER set in
 * this Supabase-less admin portal, so every Send hit the gateway
 * unauthenticated (401). The fix reads the canonical
 * `sessionStorage.platform_token` that the login flow stashes — the same
 * source `src/lib/api.ts` forwards.
 *
 * We assert against the source so a regression to the dead cookie source
 * is caught without dragging the SDK / chat-ui dependency graph into the
 * test runner.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../JarvisConsole.tsx'),
  'utf8',
);

const LOGIN_SOURCE = readFileSync(
  path.resolve(__dirname, '../../login/LoginForm.tsx'),
  'utf8',
);

describe('JarvisConsole bearer source', () => {
  it('reads the platform_token from sessionStorage', () => {
    expect(SOURCE).toContain("sessionStorage.getItem('platform_token')");
  });

  it('does not read the never-set sb-access-token cookie', () => {
    expect(SOURCE).not.toContain('sb-access-token');
  });

  it('wires the SDK bearerToken to the real reader', () => {
    expect(SOURCE).toMatch(/bearerToken:\s*\(\)\s*=>\s*readPlatformBearer\(\)/);
  });
});

describe('platform_token has a WRITER (login flow), not just readers', () => {
  // The R1 fix wired the reader but left no writer, so every Send still
  // 401'd. The login flow MUST persist the session JWT to
  // sessionStorage.platform_token on a successful login, or the reader above
  // is permanently empty. Assert the writer exists in source so a regression
  // that drops it is caught without booting the whole login flow.
  it('LoginForm writes platform_token to sessionStorage on login', () => {
    expect(LOGIN_SOURCE).toContain(
      "sessionStorage.setItem('platform_token'",
    );
  });

  it('LoginForm stashes the token on the res.ok path before redirecting', () => {
    expect(LOGIN_SOURCE).toMatch(/stashPlatformToken\(extractSessionToken\(/);
  });
});
