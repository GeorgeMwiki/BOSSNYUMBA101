/**
 * inngest-client tests — env-gating, factory fallback when package
 * absent, signing-key resolver.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInngestClient,
  isInngestEnabled,
  getInngestSigningKey,
  AGENCY_RUN_EVENT,
  INNGEST_APP_ID,
} from '../inngest-client.js';

describe('inngest-client — env gating', () => {
  const originalEventKey = process.env.INNGEST_EVENT_KEY;
  const originalSigningKey = process.env.INNGEST_SIGNING_KEY;

  beforeEach(() => {
    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
  });

  afterEach(() => {
    if (originalEventKey !== undefined) {
      process.env.INNGEST_EVENT_KEY = originalEventKey;
    } else {
      delete process.env.INNGEST_EVENT_KEY;
    }
    if (originalSigningKey !== undefined) {
      process.env.INNGEST_SIGNING_KEY = originalSigningKey;
    } else {
      delete process.env.INNGEST_SIGNING_KEY;
    }
  });

  it('is disabled when INNGEST_EVENT_KEY is absent', () => {
    expect(isInngestEnabled()).toBe(false);
  });

  it('is enabled when INNGEST_EVENT_KEY is set', () => {
    process.env.INNGEST_EVENT_KEY = 'evt_local';
    expect(isInngestEnabled()).toBe(true);
  });

  it('forceEnabled overrides the env check', () => {
    expect(isInngestEnabled({ forceEnabled: true })).toBe(true);
    process.env.INNGEST_EVENT_KEY = 'evt_local';
    expect(isInngestEnabled({ forceEnabled: false })).toBe(false);
  });

  it('createInngestClient returns null when disabled', async () => {
    const client = await createInngestClient();
    expect(client).toBeNull();
  });

  it('createInngestClient returns null when inngest package not installed', async () => {
    // No INNGEST_EVENT_KEY in env → forceEnabled to get past gate.
    const client = await createInngestClient({
      forceEnabled: true,
      eventKey: 'evt_local',
    });
    // The actual `inngest` package isn't in api-gateway's deps yet;
    // the factory should fall back to null instead of crashing.
    expect(client).toBeNull();
  });

  it('getInngestSigningKey returns null when env unset', () => {
    expect(getInngestSigningKey()).toBeNull();
  });

  it('getInngestSigningKey reads from env when set', () => {
    process.env.INNGEST_SIGNING_KEY = 'signkey_xyz';
    expect(getInngestSigningKey()).toBe('signkey_xyz');
  });
});

describe('inngest-client — constants', () => {
  it('exposes a stable agency-run event name', () => {
    expect(AGENCY_RUN_EVENT).toBe('agency/run.requested');
  });
  it('exposes a stable app id', () => {
    expect(INNGEST_APP_ID).toBe('bossnyumba-api-gateway');
  });
});
