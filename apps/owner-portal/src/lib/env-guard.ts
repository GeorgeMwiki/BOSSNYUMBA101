/**
 * Build-time / module-load environment guard for the owner-portal.
 *
 * Any client that reads a public base URL should resolve it through
 * `requirePublicBaseUrl()` so production builds fail loud when a
 * deployer forgets to set the env var. The localhost fallback exists
 * only for dev — it never silently runs in production.
 *
 * owner-portal is a Vite SPA, so env vars are surfaced through
 * `import.meta.env` at runtime (Vite inlines `import.meta.env.PROD` to
 * a constant at build time). We read the requested key from there,
 * falling back to `process.env` for SSR / test contexts where
 * `import.meta.env` is absent — the same dual-read pattern used by
 * `src/lib/observability.ts`.
 *
 * Mirrors the `requirePublicBaseUrl` contract in
 * apps/marketing/src/lib/env-guard.ts (Next) so the apps behave
 * identically when an env var is missing; the only difference is the
 * Vite-native env source.
 */

type EnvBag = Readonly<Record<string, string | undefined>>;

function readEnvBag(): EnvBag {
  const metaEnv = (import.meta as unknown as { env?: EnvBag }).env;
  if (metaEnv) return metaEnv;
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvBag;
  }
  return {};
}

function isProduction(): boolean {
  const metaEnv = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
  if (metaEnv && typeof metaEnv.PROD === 'boolean') return metaEnv.PROD;
  return (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'production'
  );
}

export function requirePublicBaseUrl(
  envName: string,
  devFallback: string,
): string {
  const fromEnv = readEnvBag()[envName]?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  if (isProduction()) {
    throw new Error(
      `${envName} is required in production builds of owner-portal.`,
    );
  }
  return devFallback;
}
