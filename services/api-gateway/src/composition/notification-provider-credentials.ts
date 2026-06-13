/**
 * Notification provider credential bootstrap.
 *
 * The notification providers (SendGrid/SES/SMTP email, Africa's Talking +
 * Twilio SMS, Twilio WhatsApp, Firebase push) are tenant-scoped: each provider's
 * `isConfigured(tenantId)` returns false until `registerProviderConfig` is
 * called for that tenant. Nothing called it at bootstrap, so every external
 * dispatch fell through the cross-channel fallback chain to the in-app inbox
 * terminal — email/SMS/WhatsApp/push never actually sent.
 *
 * This module closes that gap. At gateway bootstrap it reads platform provider
 * credentials from env ONCE (the only process.env access — CLAUDE.md forbids
 * env reads in hot paths), then registers a per-tenant ProviderConfig for every
 * ACTIVE tenant, honouring the per-tenant override maps
 * (TWILIO_PHONE_TENANT_MAP / AFRICASTALKING_USERNAME_TENANT_MAP) the codebase
 * already uses. It is credential-source agnostic by shape (env today; a
 * per-tenant secrets table can populate the same snapshot later) and
 * jurisdiction/currency/locale neutral. Honest-degrade throughout: a tenant
 * (or a channel) whose credentials are absent is simply skipped — never throws,
 * never blocks bootstrap, never fakes a configured channel.
 */

// Type-only import (erased at runtime) so merely importing this loader does NOT
// pull the notifications-service barrel — that barrel has fail-loud module-load
// env guards (e.g. WHATSAPP_API_URL). The real registerProviderConfig is
// lazy-imported at call time (prod already loads the barrel at bootstrap; tests
// inject `register` and never touch it).
import type { ProviderConfig } from '@bossnyumba/notifications-service';

/** Minimal db surface — a Drizzle client or postgres.js `sql` tag executor. */
export interface ProviderCredentialsDbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface ProviderCredentialsLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  debug?(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * Immutable snapshot of platform provider credentials, read from env ONCE at
 * bootstrap. Everything downstream consumes this snapshot — no further env reads.
 */
export interface PlatformProviderCredentials {
  readonly email?: ProviderConfig['email'];
  readonly smsAfricasTalking?: {
    readonly apiKey: string;
    readonly usernameDefault?: string;
    readonly usernameByTenant: Readonly<Record<string, string>>;
  };
  readonly smsTwilio?: {
    readonly accountSid: string;
    readonly authToken: string;
    readonly fromNumberDefault?: string;
    readonly fromNumberByTenant: Readonly<Record<string, string>>;
  };
  readonly push?: ProviderConfig['push'];
  readonly whatsapp?: ProviderConfig['whatsapp'];
}

const isNonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** Parse a `{"<tenantId>":"<value>"}` JSON env map; {} on absence/parse error. */
export function parseTenantMap(raw: unknown): Readonly<Record<string, string>> {
  if (!isNonEmpty(raw)) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isNonEmpty(v)) out[k] = v;
    }
    return Object.freeze(out);
  } catch {
    return {};
  }
}

/**
 * Read platform provider credentials from env. THE ONLY env access — call once
 * at bootstrap and pass the snapshot to registerTenantNotificationProviders.
 */
export function readPlatformProviderCredentials(
  env: NodeJS.ProcessEnv,
): PlatformProviderCredentials {
  const fromEmail = env.NOTIFICATIONS_FROM_EMAIL;
  const fromName = env.NOTIFICATIONS_FROM_NAME;

  let email: ProviderConfig['email'] | undefined;
  if (isNonEmpty(env.SENDGRID_API_KEY)) {
    email = { provider: 'sendgrid', sendgridApiKey: env.SENDGRID_API_KEY, fromEmail, fromName };
  } else if (isNonEmpty(env.SMTP_HOST)) {
    email = {
      provider: 'smtp',
      smtpHost: env.SMTP_HOST,
      smtpPort: isNonEmpty(env.SMTP_PORT) ? Number(env.SMTP_PORT) : undefined,
      smtpUser: env.SMTP_USER,
      smtpPass: env.SMTP_PASS,
      fromEmail,
      fromName,
    };
  } else if (isNonEmpty(env.SES_REGION)) {
    email = {
      provider: 'ses',
      sesRegion: env.SES_REGION,
      sesAccessKeyId: env.SES_ACCESS_KEY_ID,
      sesSecretAccessKey: env.SES_SECRET_ACCESS_KEY,
      fromEmail,
      fromName,
    };
  }

  const smsAfricasTalking = isNonEmpty(env.AFRICASTALKING_API_KEY)
    ? {
        apiKey: env.AFRICASTALKING_API_KEY,
        usernameDefault: isNonEmpty(env.AFRICASTALKING_USERNAME) ? env.AFRICASTALKING_USERNAME : undefined,
        usernameByTenant: parseTenantMap(env.AFRICASTALKING_USERNAME_TENANT_MAP),
      }
    : undefined;

  const smsTwilio =
    isNonEmpty(env.TWILIO_ACCOUNT_SID) && isNonEmpty(env.TWILIO_AUTH_TOKEN)
      ? {
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          fromNumberDefault: isNonEmpty(env.TWILIO_FROM_NUMBER) ? env.TWILIO_FROM_NUMBER : undefined,
          fromNumberByTenant: parseTenantMap(env.TWILIO_PHONE_TENANT_MAP),
        }
      : undefined;

  const push = isNonEmpty(env.FIREBASE_PROJECT_ID)
    ? {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }
    : undefined;

  const whatsapp =
    isNonEmpty(env.TWILIO_ACCOUNT_SID) &&
    isNonEmpty(env.TWILIO_AUTH_TOKEN) &&
    isNonEmpty(env.TWILIO_WHATSAPP_NUMBER)
      ? {
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          whatsappNumber: env.TWILIO_WHATSAPP_NUMBER,
        }
      : undefined;

  return Object.freeze({ email, smsAfricasTalking, smsTwilio, push, whatsapp });
}

/**
 * Build the per-tenant ProviderConfig from the platform snapshot, applying the
 * per-tenant override maps. Returns null when the tenant has NO configurable
 * external channel (honest-degrade — the in-app terminal still works).
 */
export function buildTenantProviderConfig(
  tenantId: string,
  creds: PlatformProviderCredentials,
): ProviderConfig | null {
  const config: ProviderConfig = { tenantId: tenantId as ProviderConfig['tenantId'] };
  let hasChannel = false;

  if (creds.email) {
    config.email = creds.email;
    hasChannel = true;
  }

  // SMS: Africa's Talking first (the launch-market rail), else Twilio. Each
  // honours its per-tenant override map; falls back to the platform default.
  if (creds.smsAfricasTalking) {
    const username = creds.smsAfricasTalking.usernameByTenant[tenantId] ?? creds.smsAfricasTalking.usernameDefault;
    if (isNonEmpty(username)) {
      config.sms = { provider: 'africastalking', apiKey: creds.smsAfricasTalking.apiKey, username };
      hasChannel = true;
    }
  }
  if (!config.sms && creds.smsTwilio) {
    const fromNumber = creds.smsTwilio.fromNumberByTenant[tenantId] ?? creds.smsTwilio.fromNumberDefault;
    if (isNonEmpty(fromNumber)) {
      config.sms = {
        provider: 'twilio',
        accountSid: creds.smsTwilio.accountSid,
        authToken: creds.smsTwilio.authToken,
        fromNumber,
      };
      hasChannel = true;
    }
  }

  if (creds.push) {
    config.push = creds.push;
    hasChannel = true;
  }
  if (creds.whatsapp) {
    config.whatsapp = creds.whatsapp;
    hasChannel = true;
  }

  return hasChannel ? config : null;
}

export interface RegisterTenantProvidersDeps {
  readonly db: ProviderCredentialsDbLike;
  readonly creds: PlatformProviderCredentials;
  readonly logger: ProviderCredentialsLogger;
  /** Injectable for tests; defaults to the real registerProviderConfig. */
  readonly register?: (config: ProviderConfig) => void;
}

export interface RegisterTenantProvidersResult {
  readonly tenantsScanned: number;
  readonly tenantsConfigured: number;
  readonly channelsEnabled: ReadonlyArray<string>;
}

function activeTenantRows(res: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const rows = (res as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * Bootstrap loader: register provider credentials for every active tenant.
 * Call ONCE at gateway startup, BEFORE the reminder/notification crons start.
 * Honest-degrade: a db fault or a credential-less tenant never throws.
 */
export async function registerTenantNotificationProviders(
  deps: RegisterTenantProvidersDeps,
): Promise<RegisterTenantProvidersResult> {
  const enabled = new Set<string>();

  // No platform credentials at all → nothing to register; in-app stays the
  // terminal hop. Surface it so the gap is observable in production logs.
  const c = deps.creds;
  if (!c.email && !c.smsAfricasTalking && !c.smsTwilio && !c.push && !c.whatsapp) {
    deps.logger.warn(
      {},
      'notification-providers: no external provider credentials in env — all channels degrade to the in-app inbox terminal',
    );
    return { tenantsScanned: 0, tenantsConfigured: 0, channelsEnabled: [] };
  }

  // Resolve the registrar. Injected in tests; in prod lazy-import the barrel
  // (already loaded at bootstrap) so this module stays import-light + testable.
  let register = deps.register;
  if (!register) {
    try {
      const mod = await import('@bossnyumba/notifications-service');
      register = mod.registerProviderConfig;
    } catch (err) {
      deps.logger.warn(
        { err: String(err) },
        'notification-providers: could not load registerProviderConfig — skipped (degrades to in-app)',
      );
      return { tenantsScanned: 0, tenantsConfigured: 0, channelsEnabled: [] };
    }
  }

  let rows: ReadonlyArray<Record<string, unknown>>;
  try {
    const { sql } = await import('drizzle-orm');
    const res = await deps.db.execute(sql`SELECT id FROM tenants WHERE is_active = TRUE`);
    rows = activeTenantRows(res);
  } catch (err) {
    deps.logger.warn(
      { err: String(err) },
      'notification-providers: active-tenant lookup failed — provider registration skipped (degrades to in-app)',
    );
    return { tenantsScanned: 0, tenantsConfigured: 0, channelsEnabled: [] };
  }

  let configured = 0;
  for (const row of rows) {
    const tenantId = row['id'];
    if (!isNonEmpty(tenantId)) continue;
    const config = buildTenantProviderConfig(tenantId, c);
    if (!config) continue;
    try {
      register(config);
      configured += 1;
      if (config.email) enabled.add('email');
      if (config.sms) enabled.add('sms');
      if (config.push) enabled.add('push');
      if (config.whatsapp) enabled.add('whatsapp');
    } catch (err) {
      // One tenant's registration failing must not abort the rest.
      deps.logger.warn(
        { err: String(err), tenantId },
        'notification-providers: registerProviderConfig failed for tenant — skipped',
      );
    }
  }

  deps.logger.info(
    { tenantsScanned: rows.length, tenantsConfigured: configured, channelsEnabled: [...enabled] },
    'notification-providers: tenant provider credentials registered',
  );
  return {
    tenantsScanned: rows.length,
    tenantsConfigured: configured,
    channelsEnabled: Object.freeze([...enabled]),
  };
}
