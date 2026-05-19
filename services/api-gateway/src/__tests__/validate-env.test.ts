/**
 * validate-env — happy path, required-missing, and production-recommendation
 * coverage.
 */

import { describe, it, expect } from 'vitest';
import { validateEnv } from '../config/validate-env';

const VALID_BASE = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(64),
  NODE_ENV: 'development' as const,
};

describe('validate-env', () => {
  it('passes with minimal valid env', () => {
    const { env, warnings } = validateEnv(VALID_BASE as never);
    expect(env.DATABASE_URL).toContain('postgres://');
    expect(env.JWT_SECRET).toHaveLength(64);
    expect(warnings).toEqual([]);
  });

  it('throws a clear error if DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'a'.repeat(64) } as never)
    ).toThrow(/DATABASE_URL/);
  });

  it('throws a clear error if JWT_SECRET is missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: VALID_BASE.DATABASE_URL } as never)
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, DATABASE_URL: 'redis://oops' } as never)
    ).toThrow(/postgres:\/\//);
  });

  it('rejects a too-short JWT_SECRET', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, JWT_SECRET: 'short' } as never)
    ).toThrow(/at least 32 characters/);
  });

  it('coerces PORT and defaults NODE_ENV', () => {
    const { env } = validateEnv({
      DATABASE_URL: VALID_BASE.DATABASE_URL,
      JWT_SECRET: VALID_BASE.JWT_SECRET,
      PORT: '8080',
    } as never);
    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('development');
  });

  it('emits production-env warnings for missing recommended vars', () => {
    const { warnings } = validateEnv({
      ...VALID_BASE,
      NODE_ENV: 'production',
      SESSION_HASH_SECRET: 'a'.repeat(48),
      LEDGER_SEAL_HMAC_KEY: 'a'.repeat(32),
      AGENT_CERT_SIGNING_SECRET: 'a'.repeat(48),
    } as never);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => w.includes('SENTRY_DSN'))).toBe(true);
  });

  it('warns when JWT_SECRET is weak in production', () => {
    const { warnings } = validateEnv({
      ...VALID_BASE,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(40),
      SENTRY_DSN: 'https://example.ingest.sentry.io/1',
      REDIS_URL: 'redis://localhost',
      ALLOWED_ORIGINS: 'https://bossnyumba.com',
      APP_VERSION: '1.0.0',
      GIT_SHA: 'deadbeef',
      SESSION_HASH_SECRET: 'a'.repeat(48),
      LEDGER_SEAL_HMAC_KEY: 'a'.repeat(32),
      AGENT_CERT_SIGNING_SECRET: 'a'.repeat(48),
    } as never);
    expect(warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
  });

  it('throws when SESSION_HASH_SECRET is missing in production', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        NODE_ENV: 'production',
      } as never)
    ).toThrow(/SESSION_HASH_SECRET/);
  });

  // B4 C3/C10 regression — production must throw when the sovereign-
  // action-ledger seal HMAC key is missing.
  it('B4 C10: throws when LEDGER_SEAL_HMAC_KEY is missing in production', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        NODE_ENV: 'production',
        SESSION_HASH_SECRET: 'a'.repeat(48),
      } as never),
    ).toThrow(/LEDGER_SEAL_HMAC_KEY/);
  });

  it('B4 C10: rejects a too-short LEDGER_SEAL_HMAC_KEY when provided', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        LEDGER_SEAL_HMAC_KEY: 'short',
      } as never),
    ).toThrow(/LEDGER_SEAL_HMAC_KEY/);
  });

  // B4 C12 regression — production must throw when the agent-cert
  // signing secret is missing (no silent fall-back to JWT_SECRET).
  it('B4 C12: throws when AGENT_CERT_SIGNING_SECRET is missing in production', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        NODE_ENV: 'production',
        SESSION_HASH_SECRET: 'a'.repeat(48),
        LEDGER_SEAL_HMAC_KEY: 'a'.repeat(32),
      } as never),
    ).toThrow(/AGENT_CERT_SIGNING_SECRET/);
  });

  it('B4 C12: rejects a too-short AGENT_CERT_SIGNING_SECRET when provided', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        AGENT_CERT_SIGNING_SECRET: 'short',
      } as never),
    ).toThrow(/AGENT_CERT_SIGNING_SECRET/);
  });

  it('passes production validation with the full secret set', () => {
    const { env } = validateEnv({
      ...VALID_BASE,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(64),
      SESSION_HASH_SECRET: 'a'.repeat(48),
      LEDGER_SEAL_HMAC_KEY: 'a'.repeat(32),
      AGENT_CERT_SIGNING_SECRET: 'a'.repeat(48),
      SENTRY_DSN: 'https://example.ingest.sentry.io/1',
      REDIS_URL: 'redis://localhost',
      ALLOWED_ORIGINS: 'https://bossnyumba.com',
      APP_VERSION: '1.0.0',
      GIT_SHA: 'deadbeef',
    } as never);
    expect(env.LEDGER_SEAL_HMAC_KEY).toBe('a'.repeat(32));
    expect(env.AGENT_CERT_SIGNING_SECRET).toBe('a'.repeat(48));
  });

  it('rejects a too-short SESSION_HASH_SECRET when provided', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        SESSION_HASH_SECRET: 'too-short',
      } as never)
    ).toThrow(/SESSION_HASH_SECRET/);
  });

  it('accepts a valid SESSION_HASH_SECRET + optional _PREV', () => {
    const { env } = validateEnv({
      ...VALID_BASE,
      SESSION_HASH_SECRET: 'a'.repeat(48),
      SESSION_HASH_SECRET_PREV: 'b'.repeat(48),
    } as never);
    expect(env.SESSION_HASH_SECRET).toBe('a'.repeat(48));
    expect(env.SESSION_HASH_SECRET_PREV).toBe('b'.repeat(48));
  });

  it('warns when dev env points at a non-localhost DB', () => {
    const { warnings } = validateEnv({
      ...VALID_BASE,
      DATABASE_URL: 'postgres://u:p@prod-db.example.com:5432/app',
    } as never);
    expect(warnings.some((w) => w.includes('localhost'))).toBe(true);
  });
});
