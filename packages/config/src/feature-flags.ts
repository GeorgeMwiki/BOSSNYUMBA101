/**
 * Feature Flags — BOSSNYUMBA
 * ============================================================================
 *
 * A small, dependency-free feature flag API. Resolution order (highest first):
 *
 *   1. Environment variable override     (e.g. FF_AI_COPILOT=true/false/1/0)
 *   2. Database lookup (`feature_flags`) (if a loader is registered)
 *   3. Static default                    (defaults to `false`)
 *
 * The database layer is intentionally decoupled: consumers register a loader
 * via {@link registerFeatureFlagLoader} during app bootstrap. If no loader is
 * registered (or the table does not exist yet) the call is skipped.
 *
 * Usage:
 *
 *   import { isEnabled, FF } from '@bossnyumba/config/feature-flags';
 *
 *   if (await isEnabled(FF.AI_COPILOT, tenantId, userId)) {
 *     ...
 *   }
 *
 * See `packages/config/README.md` for the full reference.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Known flags
// ---------------------------------------------------------------------------

/** All feature flag names understood by the platform. */
export const KNOWN_FLAGS = [
  'FF_AI_COPILOT',
  'FF_OFFLINE_MODE',
  'FF_VOICE_REPORTS',
  'FF_PORTFOLIO_MAP',
  'FF_AI_BRIEFINGS',
  'FF_MULTI_ORG_SWITCHER',
  'FF_ETIMS_INTEGRATION',
  'FF_TRA_INTEGRATION',
  'FF_PUSH_NOTIFICATIONS',
] as const;

export type FeatureFlagName = (typeof KNOWN_FLAGS)[number];

/** Convenient constant access: `FF.AI_COPILOT`, `FF.OFFLINE_MODE`, ... */
export const FF = {
  AI_COPILOT: 'FF_AI_COPILOT',
  OFFLINE_MODE: 'FF_OFFLINE_MODE',
  VOICE_REPORTS: 'FF_VOICE_REPORTS',
  PORTFOLIO_MAP: 'FF_PORTFOLIO_MAP',
  AI_BRIEFINGS: 'FF_AI_BRIEFINGS',
  MULTI_ORG_SWITCHER: 'FF_MULTI_ORG_SWITCHER',
  ETIMS_INTEGRATION: 'FF_ETIMS_INTEGRATION',
  TRA_INTEGRATION: 'FF_TRA_INTEGRATION',
  PUSH_NOTIFICATIONS: 'FF_PUSH_NOTIFICATIONS',
} as const satisfies Record<string, FeatureFlagName>;

/** Metadata describing each known flag. Pure data — no runtime effects. */
export interface FlagDescriptor {
  name: FeatureFlagName;
  description: string;
  defaultValue: boolean;
  /** Rough maturity indicator for the feature gated by this flag. */
  maturity: 'shipped' | 'scaffolded' | 'planned';
}

export const FLAG_REGISTRY: Record<FeatureFlagName, FlagDescriptor> = {
  FF_AI_COPILOT: {
    name: 'FF_AI_COPILOT',
    description: 'AI Copilot sidebar (chat + context suggestions) in owner / admin portals.',
    defaultValue: false,
    maturity: 'scaffolded',
  },
  FF_OFFLINE_MODE: {
    name: 'FF_OFFLINE_MODE',
    description: 'Offline-first capture + sync for field inspections (estate manager app).',
    defaultValue: false,
    maturity: 'planned',
  },
  FF_VOICE_REPORTS: {
    name: 'FF_VOICE_REPORTS',
    description: 'ElevenLabs / Whisper powered voice dictation for maintenance and inspection reports.',
    defaultValue: false,
    maturity: 'scaffolded',
  },
  FF_PORTFOLIO_MAP: {
    name: 'FF_PORTFOLIO_MAP',
    description: 'Geo map view of the owner portfolio with occupancy / revenue overlays.',
    defaultValue: false,
    maturity: 'scaffolded',
  },
  FF_AI_BRIEFINGS: {
    name: 'FF_AI_BRIEFINGS',
    description: 'Daily AI-generated owner briefing email/push summarising portfolio KPIs.',
    defaultValue: false,
    maturity: 'planned',
  },
  FF_MULTI_ORG_SWITCHER: {
    name: 'FF_MULTI_ORG_SWITCHER',
    description: 'Org switcher UI for users who belong to multiple tenants (admin + owner portal).',
    defaultValue: false,
    maturity: 'scaffolded',
  },
  FF_ETIMS_INTEGRATION: {
    name: 'FF_ETIMS_INTEGRATION',
    description: 'KRA eTIMS integration (Kenya electronic tax invoicing).',
    defaultValue: false,
    maturity: 'planned',
  },
  FF_TRA_INTEGRATION: {
    name: 'FF_TRA_INTEGRATION',
    description: 'Tanzania Revenue Authority (TRA) integration for EFD-compliant receipts.',
    defaultValue: false,
    maturity: 'planned',
  },
  FF_PUSH_NOTIFICATIONS: {
    name: 'FF_PUSH_NOTIFICATIONS',
    description: 'FCM/APNS push notifications for mobile + browser clients.',
    defaultValue: false,
    maturity: 'scaffolded',
  },
};

// ---------------------------------------------------------------------------
// Context + loader contracts
// ---------------------------------------------------------------------------

export interface FlagContext {
  /** Tenant/organization the flag is being evaluated for. */
  tenantId?: string;
  /** User the flag is being evaluated for. */
  userId?: string;
}

/**
 * A database (or any remote) loader for feature flags. Implementers should
 * return `true` / `false` when the flag has been explicitly configured for the
 * given scope, or `undefined` to indicate "no opinion — fall through".
 *
 * Resolution precedence for loaders: user-scoped > tenant-scoped > global.
 */
export type FeatureFlagLoader = (
  flag: FeatureFlagName,
  ctx: FlagContext
) => Promise<boolean | undefined> | boolean | undefined;

let registeredLoader: FeatureFlagLoader | null = null;

/**
 * Register a DB-backed (or remote) loader. Pass `null` to unregister.
 * Call this once during application bootstrap.
 */
export function registerFeatureFlagLoader(loader: FeatureFlagLoader | null): void {
  registeredLoader = loader;
}

// ---------------------------------------------------------------------------
// Env parsing
// ---------------------------------------------------------------------------

const TRUTHY = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSY = new Set(['0', 'false', 'no', 'off', 'disabled']);

function parseEnvValue(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === '') return undefined;
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  return undefined;
}

/** Read a flag strictly from the environment. Returns `undefined` if not set. */
export function getEnvFlag(flag: FeatureFlagName): boolean | undefined {
  // Node.js / Vite-style env; safely access without blowing up in browser.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env: Record<string, string | undefined> =
    (typeof process !== 'undefined' && process.env) || {};
  return parseEnvValue(env[flag]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synchronous variant — checks env + static default only. Does NOT consult the
 * database loader (which is async). Prefer {@link isEnabled} when you can
 * await.
 */
export function isEnabledSync(
  flag: FeatureFlagName,
  _tenantId?: string,
  _userId?: string
): boolean {
  void _tenantId;
  void _userId;
  const envValue = getEnvFlag(flag);
  if (envValue !== undefined) return envValue;
  return FLAG_REGISTRY[flag]?.defaultValue ?? false;
}

/**
 * Check whether a feature flag is enabled for the given context. Resolution:
 *   env override > DB loader (user > tenant > global) > static default.
 */
export async function isEnabled(
  flag: FeatureFlagName,
  tenantId?: string,
  userId?: string
): Promise<boolean> {
  // 1. Environment override wins.
  const envValue = getEnvFlag(flag);
  if (envValue !== undefined) return envValue;

  // 2. Registered loader (DB / remote).
  if (registeredLoader) {
    try {
      const result = await registeredLoader(flag, { tenantId, userId });
      if (result !== undefined) return result;
    } catch {
      // Swallow loader failures — fall through to defaults so a bad DB can't
      // wedge the request path.
    }
  }

  // 3. Static default.
  return FLAG_REGISTRY[flag]?.defaultValue ?? false;
}

/** Return the currently-resolved state of every known flag (sync / env + defaults). */
export function snapshotFlags(): Record<FeatureFlagName, boolean> {
  const out = {} as Record<FeatureFlagName, boolean>;
  for (const flag of KNOWN_FLAGS) {
    out[flag] = isEnabledSync(flag);
  }
  return out;
}
