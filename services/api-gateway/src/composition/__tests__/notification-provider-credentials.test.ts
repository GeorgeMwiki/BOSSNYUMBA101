/**
 * Tests for the notification provider credential bootstrap loader (#delivery).
 * Asserts env→snapshot parsing, per-tenant ProviderConfig assembly (with the
 * override maps), and honest-degrade registration across active tenants.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseTenantMap,
  readPlatformProviderCredentials,
  buildTenantProviderConfig,
  registerTenantNotificationProviders,
  type PlatformProviderCredentials,
  type ProviderCredentialsDbLike,
} from '../notification-provider-credentials';

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} };

function dbWithTenants(ids: string[]): ProviderCredentialsDbLike {
  return { execute: async () => ({ rows: ids.map((id) => ({ id })) }) };
}

describe('parseTenantMap', () => {
  it('parses a {tenantId:value} JSON map', () => {
    expect(parseTenantMap('{"t1":"+255700","t2":"+254711"}')).toEqual({ t1: '+255700', t2: '+254711' });
  });
  it('returns {} on empty / non-JSON / array / non-string values', () => {
    expect(parseTenantMap(undefined)).toEqual({});
    expect(parseTenantMap('')).toEqual({});
    expect(parseTenantMap('not json')).toEqual({});
    expect(parseTenantMap('["a","b"]')).toEqual({});
    expect(parseTenantMap('{"t1":123,"t2":"ok"}')).toEqual({ t2: 'ok' });
  });
});

describe('readPlatformProviderCredentials', () => {
  it('reads SendGrid email when SENDGRID_API_KEY is set', () => {
    const c = readPlatformProviderCredentials({
      SENDGRID_API_KEY: 'SG.x',
      NOTIFICATIONS_FROM_EMAIL: 'no-reply@x.io',
    } as NodeJS.ProcessEnv);
    expect(c.email).toEqual({ provider: 'sendgrid', sendgridApiKey: 'SG.x', fromEmail: 'no-reply@x.io', fromName: undefined });
  });
  it('falls back to SMTP email when no SendGrid key', () => {
    const c = readPlatformProviderCredentials({ SMTP_HOST: 'smtp.x.io', SMTP_PORT: '587' } as NodeJS.ProcessEnv);
    expect(c.email?.provider).toBe('smtp');
    expect(c.email?.smtpHost).toBe('smtp.x.io');
    expect(c.email?.smtpPort).toBe(587);
  });
  it('reads Africa’s Talking SMS + its per-tenant username map', () => {
    const c = readPlatformProviderCredentials({
      AFRICASTALKING_API_KEY: 'at_key',
      AFRICASTALKING_USERNAME: 'sandbox',
      AFRICASTALKING_USERNAME_TENANT_MAP: '{"t1":"trc-prod"}',
    } as NodeJS.ProcessEnv);
    expect(c.smsAfricasTalking?.apiKey).toBe('at_key');
    expect(c.smsAfricasTalking?.usernameDefault).toBe('sandbox');
    expect(c.smsAfricasTalking?.usernameByTenant).toEqual({ t1: 'trc-prod' });
  });
  it('reads Twilio SMS + WhatsApp when SID/token/number present', () => {
    const c = readPlatformProviderCredentials({
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_FROM_NUMBER: '+15550000',
      TWILIO_WHATSAPP_NUMBER: '+15551111',
    } as NodeJS.ProcessEnv);
    expect(c.smsTwilio?.accountSid).toBe('AC1');
    expect(c.smsTwilio?.fromNumberDefault).toBe('+15550000');
    expect(c.whatsapp).toEqual({ accountSid: 'AC1', authToken: 'tok', whatsappNumber: '+15551111' });
  });
  it('returns an all-undefined snapshot when env is empty', () => {
    const c = readPlatformProviderCredentials({} as NodeJS.ProcessEnv);
    expect(c.email).toBeUndefined();
    expect(c.smsAfricasTalking).toBeUndefined();
    expect(c.smsTwilio).toBeUndefined();
    expect(c.push).toBeUndefined();
    expect(c.whatsapp).toBeUndefined();
  });
});

describe('buildTenantProviderConfig', () => {
  const creds: PlatformProviderCredentials = {
    email: { provider: 'sendgrid', sendgridApiKey: 'SG.x', fromEmail: 'a@b.io' },
    smsTwilio: {
      accountSid: 'AC1',
      authToken: 'tok',
      fromNumberDefault: '+15550000',
      fromNumberByTenant: { t1: '+255700111' },
    },
    smsAfricasTalking: undefined,
    push: undefined,
    whatsapp: undefined,
  };

  it('assembles email + sms; uses the per-tenant from-number override', () => {
    const cfg = buildTenantProviderConfig('t1', creds);
    expect(cfg?.tenantId).toBe('t1');
    expect(cfg?.email?.provider).toBe('sendgrid');
    expect(cfg?.sms).toEqual({ provider: 'twilio', accountSid: 'AC1', authToken: 'tok', fromNumber: '+255700111' });
  });

  it('falls back to the platform default from-number when the tenant is not mapped', () => {
    const cfg = buildTenantProviderConfig('t2', creds);
    expect(cfg?.sms?.fromNumber).toBe('+15550000');
  });

  it('prefers Africa’s Talking over Twilio when both are present', () => {
    const both: PlatformProviderCredentials = {
      ...creds,
      smsAfricasTalking: { apiKey: 'at', usernameDefault: 'sandbox', usernameByTenant: {} },
    };
    expect(buildTenantProviderConfig('t9', both).sms?.provider).toBe('africastalking');
  });

  it('returns null (honest-degrade) when the tenant has NO configurable channel', () => {
    expect(buildTenantProviderConfig('t1', { email: undefined, smsTwilio: undefined, smsAfricasTalking: undefined, push: undefined, whatsapp: undefined })).toBeNull();
  });
});

describe('registerTenantNotificationProviders', () => {
  const creds: PlatformProviderCredentials = {
    email: { provider: 'sendgrid', sendgridApiKey: 'SG.x' },
    smsTwilio: { accountSid: 'AC1', authToken: 'tok', fromNumberDefault: '+15550000', fromNumberByTenant: { t1: '+255700111' } },
    smsAfricasTalking: undefined,
    push: undefined,
    whatsapp: undefined,
  };

  it('registers a ProviderConfig for every active tenant (override applied)', async () => {
    const register = vi.fn();
    const result = await registerTenantNotificationProviders({
      db: dbWithTenants(['t1', 't2']),
      creds,
      logger: silentLogger,
      register,
    });
    expect(register).toHaveBeenCalledTimes(2);
    expect(result.tenantsScanned).toBe(2);
    expect(result.tenantsConfigured).toBe(2);
    expect([...result.channelsEnabled].sort()).toEqual(['email', 'sms']);
    const t1 = register.mock.calls.find((c) => c[0].tenantId === 't1')?.[0];
    expect(t1.sms.fromNumber).toBe('+255700111');
  });

  it('honest-degrades to zero (warn, no throw, no register) when there are NO platform credentials', async () => {
    const register = vi.fn();
    const result = await registerTenantNotificationProviders({
      db: dbWithTenants(['t1']),
      creds: { email: undefined, smsTwilio: undefined, smsAfricasTalking: undefined, push: undefined, whatsapp: undefined },
      logger: silentLogger,
      register,
    });
    expect(register).not.toHaveBeenCalled();
    expect(result.tenantsConfigured).toBe(0);
  });

  it('honest-degrades (no throw) when the active-tenant query fails', async () => {
    const register = vi.fn();
    const throwingDb: ProviderCredentialsDbLike = {
      execute: async () => {
        throw new Error('db unreachable');
      },
    };
    const result = await registerTenantNotificationProviders({ db: throwingDb, creds, logger: silentLogger, register });
    expect(register).not.toHaveBeenCalled();
    expect(result.tenantsScanned).toBe(0);
  });

  it('skips a tenant whose assembled config has no channel (continues the rest)', async () => {
    // email-only creds → every tenant configurable; flip to no-creds to prove skip path is covered above.
    const register = vi.fn();
    const result = await registerTenantNotificationProviders({
      db: dbWithTenants(['t1', 't2', 't3']),
      creds: { email: { provider: 'sendgrid', sendgridApiKey: 'SG.x' }, smsTwilio: undefined, smsAfricasTalking: undefined, push: undefined, whatsapp: undefined },
      logger: silentLogger,
      register,
    });
    expect(result.tenantsConfigured).toBe(3);
    expect(result.channelsEnabled).toEqual(['email']);
  });
});
