/**
 * Baseline tests for @bossnyumba/config.
 *
 * Covers:
 *  - envSchema accepts a minimal valid development env
 *  - envSchema rejects bad values (bad URL / short JWT secret)
 *  - Typed getters (database(), urls(), auth()) return expected shape
 *
 * Note: the getConfig() singleton caches on first call; we exercise it
 * in an isolated child test by carefully controlling process.env.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  envSchema,
  databaseSchema,
  authSchema,
  urlsSchema,
} from '../schemas';

describe('config env schemas', () => {
  it('envSchema accepts a minimal valid development env', () => {
    const parsed = envSchema.safeParse({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      API_URL: 'http://localhost:4000',
      FRONTEND_URL: 'http://localhost:3000',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // JWT_EXPIRES_IN defaults to '7d'
      expect(parsed.data.JWT_EXPIRES_IN).toBe('7d');
      // AFRICAS_TALKING_USERNAME defaults to 'sandbox'
      expect(parsed.data.AFRICAS_TALKING_USERNAME).toBe('sandbox');
      // AWS_REGION defaults to 'eu-west-1'
      expect(parsed.data.AWS_REGION).toBe('eu-west-1');
    }
  });

  it('envSchema rejects non-URL DATABASE_URL', () => {
    const parsed = envSchema.safeParse({
      DATABASE_URL: 'not-a-url',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true);
    }
  });

  it('envSchema rejects a JWT_SECRET shorter than 32 chars', () => {
    const parsed = envSchema.safeParse({
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      JWT_SECRET: 'too-short',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('JWT_SECRET'))).toBe(true);
    }
  });

  it('envSchema requires DATABASE_URL (nothing else is strictly required)', () => {
    const parsed = envSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true);
    }
  });

  it('sub-schemas parse a valid slice', () => {
    const db = databaseSchema.safeParse({ DATABASE_URL: 'postgres://u:p@h:5432/d' });
    expect(db.success).toBe(true);

    const urls = urlsSchema.safeParse({
      API_URL: 'http://localhost:4000',
      FRONTEND_URL: 'http://localhost:3000',
    });
    expect(urls.success).toBe(true);

    const auth = authSchema.safeParse({ JWT_SECRET: 'a'.repeat(32) });
    expect(auth.success).toBe(true);
    if (auth.success) {
      expect(auth.data.JWT_EXPIRES_IN).toBe('7d');
    }
  });
});

describe('config typed getters', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Isolate env mutation to this test block.
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('database()/urls()/auth() return values sourced from env', async () => {
    // Reset module cache so the internal config singleton re-reads env.
    const { resetModules, unstable_mockModule } = await import('vitest').catch(() => ({
      resetModules: null,
      unstable_mockModule: null,
    })) as unknown as { resetModules: unknown; unstable_mockModule: unknown };
    // vitest provides `vi.resetModules` but we import fresh via dynamic import + cache-busting query
    void resetModules;
    void unstable_mockModule;

    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/bossnyumba_test';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.API_URL = 'http://localhost:4000';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    // Use a fresh import to bypass the singleton cache from any earlier run.
    const mod = await import(`../index.js?cfg=${Date.now()}`);

    const db = mod.database();
    expect(db).toHaveProperty('url');
    expect(typeof db.url).toBe('string');
    expect(db.url).toBe('postgres://user:pass@localhost:5432/bossnyumba_test');

    const auth = mod.auth();
    expect(auth.jwtExpiresIn).toBe('1h');
    expect(typeof auth.jwtSecret).toBe('string');

    const urls = mod.urls();
    expect(urls.apiUrl).toBe('http://localhost:4000');
    expect(urls.frontendUrl).toBe('http://localhost:3000');
  });
});
