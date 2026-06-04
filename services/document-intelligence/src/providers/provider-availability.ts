/**
 * OCR provider availability detection (KI-014).
 *
 * Pure, side-effect-light helpers that decide WHICH OCR adapter the
 * composition root should construct, based on two independent signals:
 *
 *   1. Credentials  — present in the injected env snapshot (+ tenantRegion).
 *   2. SDK installed — the OPTIONAL cloud dep can be dynamically imported.
 *
 * `@aws-sdk/client-textract` and `@google-cloud/vision` are treated as
 * OPTIONAL peer deps: the probe is a guarded dynamic import, so when a dep
 * is absent the adapter simply reports "unavailable" and selection falls
 * through to the next candidate, finally to the `mock` stub fallback.
 *
 * No `process.env` is read here — callers pass an env snapshot from the
 * composition / bootstrap seam. No module-level side effects, no logging:
 * this file is deterministic and unit-testable with injected fakes.
 */

import { z } from 'zod';
import type { OCRProvider } from '../types/index.js';
import type {
  AwsTextractConfig,
  GoogleVisionConfig,
  MockProviderConfig,
  OcrProviderConfig,
} from './types.js';

/** SDK module specifiers for the optional cloud deps. */
export const TEXTRACT_SDK_MODULE = '@aws-sdk/client-textract' as const;
export const VISION_SDK_MODULE = '@google-cloud/vision' as const;

/**
 * Injectable dynamic importer. Defaults to the native `import()`; tests pass
 * a fake so no real optional dep is ever required to install.
 */
export type ModuleImporter = (specifier: string) => Promise<unknown>;

const defaultImporter: ModuleImporter = (specifier) =>
  import(/* @vite-ignore */ specifier);

/**
 * Boundary schema for the env signals we consume. Everything is optional —
 * absence is a valid, expected state (key-less dev / CI).
 */
const AvailabilityEnvSchema = z
  .object({
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_PROFILE: z.string().optional(),
    AWS_WEB_IDENTITY_TOKEN_FILE: z.string().optional(),
    GOOGLE_PROJECT_ID: z.string().optional(),
    GCLOUD_PROJECT: z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
    GOOGLE_CREDENTIALS_JSON: z.string().optional(),
    OCR_DEFAULT_LANGUAGE: z.string().optional(),
  })
  .passthrough();

export type AvailabilityEnv = z.input<typeof AvailabilityEnvSchema>;

export interface ResolveOcrOptions {
  /** Env snapshot from the composition seam. */
  readonly env: AvailabilityEnv;
  /**
   * Per-tenant AWS region (from `tenants.region`). Takes precedence over
   * `env.AWS_REGION` for data-residency, mirroring the explicit factory path.
   */
  readonly tenantRegion?: string;
  /** Injectable SDK importer — tests pass a fake. */
  readonly importer?: ModuleImporter;
}

/** Outcome of credential + SDK probing for a single cloud provider. */
export interface ProviderAvailability {
  readonly provider: Extract<OCRProvider, 'aws_textract' | 'google_vision'>;
  readonly credentialsPresent: boolean;
  readonly sdkInstalled: boolean;
  readonly available: boolean;
  /** Human-readable reason when not available (for health/log surfaces). */
  readonly reason?: string;
}

/** The config the composition root should construct, plus why it was chosen. */
export interface ResolvedOcrSelection {
  readonly config: OcrProviderConfig;
  readonly selected: OCRProvider;
  /** Per-candidate probe detail — useful for /healthz and structured logs. */
  readonly candidates: ReadonlyArray<ProviderAvailability>;
  /** True when neither cloud provider was available and we fell back to mock. */
  readonly usedFallback: boolean;
}

/** Trim helper that treats empty / whitespace-only strings as absent. */
function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** AWS region resolution: tenantRegion wins, then env.AWS_REGION. */
export function resolveAwsRegion(
  env: AvailabilityEnv,
  tenantRegion?: string
): string | null {
  if (present(tenantRegion)) return tenantRegion.trim();
  if (present(env.AWS_REGION)) return env.AWS_REGION.trim();
  return null;
}

/**
 * Textract is credential-ready when a region resolves AND some credential
 * source is present (static keys, a shared profile, or web-identity/IRSA).
 */
export function detectTextractCredentials(
  env: AvailabilityEnv,
  tenantRegion?: string
): boolean {
  const region = resolveAwsRegion(env, tenantRegion);
  if (!region) return false;
  const hasStaticKeys =
    present(env.AWS_ACCESS_KEY_ID) && present(env.AWS_SECRET_ACCESS_KEY);
  return (
    hasStaticKeys ||
    present(env.AWS_PROFILE) ||
    present(env.AWS_WEB_IDENTITY_TOKEN_FILE)
  );
}

/** Vision is credential-ready when a project AND a credential source resolve. */
export function detectVisionCredentials(env: AvailabilityEnv): boolean {
  const hasProject = present(env.GOOGLE_PROJECT_ID) || present(env.GCLOUD_PROJECT);
  const hasCreds =
    present(env.GOOGLE_APPLICATION_CREDENTIALS) ||
    present(env.GOOGLE_CREDENTIALS_JSON);
  return hasProject && hasCreds;
}

/**
 * Probe whether an OPTIONAL SDK is installed via a guarded dynamic import.
 * Never throws — a missing module resolves to `false`.
 */
export async function isSdkInstalled(
  moduleName: string,
  importer: ModuleImporter = defaultImporter
): Promise<boolean> {
  try {
    const mod = await importer(moduleName);
    return mod != null;
  } catch {
    return false;
  }
}

/**
 * Resolve the OCR provider config the composition root should build.
 *
 * Precedence: AWS Textract → Google Vision → `mock` stub fallback. A cloud
 * provider is chosen only when BOTH its credentials and its SDK are present;
 * otherwise we fall through. When neither cloud provider is available we
 * return the `mock` stub so key-less dev / CI keeps working.
 *
 * This function NEVER throws on absence — the production no-fixture-leak gate
 * lives at the factory seam (`getOcrProviderAuto`), which inspects
 * `usedFallback` and refuses to serve fixture data to real tenants.
 */
export async function resolveAvailableOcrConfig(
  options: ResolveOcrOptions
): Promise<ResolvedOcrSelection> {
  const env = AvailabilityEnvSchema.parse(options.env);
  const importer = options.importer ?? defaultImporter;
  const language = present(env.OCR_DEFAULT_LANGUAGE)
    ? env.OCR_DEFAULT_LANGUAGE
    : undefined;

  const textract = await probeTextract(env, options.tenantRegion, importer);
  const vision = await probeVision(env, importer);
  const candidates: ReadonlyArray<ProviderAvailability> = [textract, vision];

  if (textract.available) {
    const region = resolveAwsRegion(env, options.tenantRegion);
    // `available` implies a region resolved; assert for the type system.
    if (!region) {
      throw new Error('resolveAwsRegion returned null for an available Textract candidate');
    }
    const config: AwsTextractConfig = {
      provider: 'aws_textract',
      region,
      accessKeyId: present(env.AWS_ACCESS_KEY_ID) ? env.AWS_ACCESS_KEY_ID : undefined,
      secretAccessKey: present(env.AWS_SECRET_ACCESS_KEY)
        ? env.AWS_SECRET_ACCESS_KEY
        : undefined,
      defaultLanguage: language,
    };
    return {
      config,
      selected: 'aws_textract',
      candidates,
      usedFallback: false,
    };
  }

  if (vision.available) {
    const projectId = present(env.GOOGLE_PROJECT_ID)
      ? env.GOOGLE_PROJECT_ID
      : (env.GCLOUD_PROJECT as string);
    const config: GoogleVisionConfig = {
      provider: 'google_vision',
      projectId,
      keyFilename: present(env.GOOGLE_APPLICATION_CREDENTIALS)
        ? env.GOOGLE_APPLICATION_CREDENTIALS
        : undefined,
      defaultLanguage: language,
    };
    return {
      config,
      selected: 'google_vision',
      candidates,
      usedFallback: false,
    };
  }

  const fallback: MockProviderConfig = {
    provider: 'mock',
    defaultLanguage: language,
  };
  return {
    config: fallback,
    selected: 'mock',
    candidates,
    usedFallback: true,
  };
}

async function probeTextract(
  env: AvailabilityEnv,
  tenantRegion: string | undefined,
  importer: ModuleImporter
): Promise<ProviderAvailability> {
  const credentialsPresent = detectTextractCredentials(env, tenantRegion);
  const sdkInstalled = credentialsPresent
    ? await isSdkInstalled(TEXTRACT_SDK_MODULE, importer)
    : false;
  return {
    provider: 'aws_textract',
    credentialsPresent,
    sdkInstalled,
    available: credentialsPresent && sdkInstalled,
    reason: unavailableReason(credentialsPresent, sdkInstalled, TEXTRACT_SDK_MODULE),
  };
}

async function probeVision(
  env: AvailabilityEnv,
  importer: ModuleImporter
): Promise<ProviderAvailability> {
  const credentialsPresent = detectVisionCredentials(env);
  const sdkInstalled = credentialsPresent
    ? await isSdkInstalled(VISION_SDK_MODULE, importer)
    : false;
  return {
    provider: 'google_vision',
    credentialsPresent,
    sdkInstalled,
    available: credentialsPresent && sdkInstalled,
    reason: unavailableReason(credentialsPresent, sdkInstalled, VISION_SDK_MODULE),
  };
}

function unavailableReason(
  credentialsPresent: boolean,
  sdkInstalled: boolean,
  moduleName: string
): string | undefined {
  if (credentialsPresent && sdkInstalled) return undefined;
  if (!credentialsPresent) return 'credentials not configured';
  return `${moduleName} not installed`;
}
