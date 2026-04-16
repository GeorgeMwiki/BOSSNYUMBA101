import { describe, it, expect } from 'vitest';
import {
  databaseSchema,
  redisSchema,
  authSchema,
  paymentsSchema,
  notificationsSchema,
  storageSchema,
  aiSchema,
  urlsSchema,
  envSchema,
  apiGatewayEnvSchema,
  paymentsEnvSchema,
  notificationsEnvSchema,
  reportsEnvSchema,
} from './schemas.js';

describe('@bossnyumba/config schemas', () => {
  describe('databaseSchema', () => {
    it('accepts a valid Postgres URL', () => {
      const result = databaseSchema.safeParse({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/bossnyumba',
      });
      expect(result.success).toBe(true);
    });
    it('rejects non-URL DATABASE_URL', () => {
      const result = databaseSchema.safeParse({ DATABASE_URL: 'not-a-url' });
      expect(result.success).toBe(false);
    });
    it('rejects missing DATABASE_URL', () => {
      const result = databaseSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('redisSchema', () => {
    it('accepts a valid Redis URL', () => {
      expect(redisSchema.safeParse({ REDIS_URL: 'redis://localhost:6379' }).success).toBe(true);
    });
    it('allows omitting REDIS_URL (optional)', () => {
      expect(redisSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('authSchema', () => {
    it('accepts a 32+ char JWT_SECRET', () => {
      const result = authSchema.safeParse({
        JWT_SECRET: 'a'.repeat(32),
      });
      expect(result.success).toBe(true);
    });
    it('rejects a too-short JWT_SECRET (hardening is at schema level)', () => {
      const result = authSchema.safeParse({ JWT_SECRET: 'short' });
      expect(result.success).toBe(false);
    });
    it('allows omitting JWT_SECRET (optional in schema; env loader enforces prod)', () => {
      expect(authSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('composite envSchema', () => {
    it('composes database + redis + auth + payments + notifications + storage + ai + urls', () => {
      const parsed = envSchema.safeParse({
        DATABASE_URL: 'postgres://x:y@z/d',
      });
      // Database is the only required field in the composite. Missing it fails.
      expect(parsed.success).toBe(true);
    });
    it('rejects when DATABASE_URL missing', () => {
      expect(envSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('service-specific env schemas', () => {
    it('apiGatewayEnvSchema exists and validates', () => {
      expect(typeof apiGatewayEnvSchema.safeParse).toBe('function');
      const r = apiGatewayEnvSchema.safeParse({ DATABASE_URL: 'postgres://x:y@z/d' });
      expect(r.success).toBe(true);
    });
    it('paymentsEnvSchema exists and validates', () => {
      const r = paymentsEnvSchema.safeParse({ DATABASE_URL: 'postgres://x:y@z/d' });
      expect(r.success).toBe(true);
    });
    it('notificationsEnvSchema exists and validates', () => {
      const r = notificationsEnvSchema.safeParse({ DATABASE_URL: 'postgres://x:y@z/d' });
      expect(r.success).toBe(true);
    });
    it('reportsEnvSchema exists and validates', () => {
      const r = reportsEnvSchema.safeParse({ DATABASE_URL: 'postgres://x:y@z/d' });
      expect(r.success).toBe(true);
    });
  });

  describe('schema presence (catches accidental removal)', () => {
    it('exports all documented schemas', () => {
      // If any of these stop existing, the import at the top of this
      // file fails with a TS error. A passing test is confirmation.
      expect(databaseSchema).toBeDefined();
      expect(redisSchema).toBeDefined();
      expect(authSchema).toBeDefined();
      expect(paymentsSchema).toBeDefined();
      expect(notificationsSchema).toBeDefined();
      expect(storageSchema).toBeDefined();
      expect(aiSchema).toBeDefined();
      expect(urlsSchema).toBeDefined();
      expect(envSchema).toBeDefined();
    });
  });
});
