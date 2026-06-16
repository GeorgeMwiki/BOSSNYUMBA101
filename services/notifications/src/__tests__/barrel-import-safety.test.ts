/**
 * Barrel import-safety — born-at-import landmine guard.
 *
 * The package barrel (`../index.js`) re-exports provider/client SINGLETONS.
 * Several of their constructors THROW when a required env var is absent
 * (WHATSAPP_API_URL, AFRICAS_TALKING_USERNAME, AFRICAS_TALKING_ENVIRONMENT).
 * Before the `lazySingleton` wrap, merely importing the barrel crashed every
 * consumer (api-gateway, workers) unless ALL provider env was present.
 *
 * This test is the live detector for that regression:
 *  (a) importing the barrel with NO provider env set must NOT throw, and key
 *      exports must be defined; and
 *  (b) the env requirement must be PRESERVED — actually USING a throwing client
 *      without its env must still throw on first method access (the throw is
 *      merely deferred from import-time to use-time, not removed).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const PROVIDER_ENV_KEYS = [
  'WHATSAPP_API_URL',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'AFRICAS_TALKING_API_KEY',
  'AFRICAS_TALKING_USERNAME',
  'AFRICAS_TALKING_ENVIRONMENT',
  'AFRICAS_TALKING_SENDER_ID',
  'AT_API_KEY',
  'AT_USERNAME',
  'AT_ENVIRONMENT',
  'AT_SENDER_ID',
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.resetModules();
});

describe('barrel import-safety (born-at-import landmine guard)', () => {
  it('imports the package barrel with NO provider env set without throwing, and exposes key exports', async () => {
    const mod = await import('../index.js');

    expect(mod.whatsAppClient).toBeDefined();
    expect(mod.africasTalkingSms).toBeDefined();
    expect(mod.metaWhatsAppClient).toBeDefined();
    expect(mod.inAppProvider).toBeDefined();
    expect(mod.providerRegistry).toBeDefined();
    expect(typeof mod.createInAppNotificationService).toBe('function');
    // Generous budget: the cold dynamic barrel import transitively loads the full
    // provider SDK tree, which can exceed vitest's default 5s on slower machines.
  }, 30000);

  it('preserves the env requirement: using whatsAppClient without WHATSAPP_API_URL still throws on first access', async () => {
    const { whatsAppClient } = await import('../index.js');

    // First property access resolves the lazy singleton -> constructor runs ->
    // the missing-env throw fires now (deferred from import-time, not removed).
    expect(() => whatsAppClient.sendText).toThrow(/WHATSAPP_API_URL/);
  }, 30000);

  it('preserves the env requirement: using africasTalkingSms without AFRICAS_TALKING_* still throws on first access', async () => {
    const { africasTalkingSms } = await import('../index.js');

    expect(() => africasTalkingSms.sendSms).toThrow(
      /AFRICAS_TALKING_(ENVIRONMENT|USERNAME)/,
    );
  }, 30000);
});
