/**
 * Server-side Brain bootstrap for Next.js routes.
 *
 * Production policy:
 *  - Reads `ANTHROPIC_API_KEY`, `SUPABASE_*`, and `DATABASE_URL` from env.
 *  - Throws `BrainConfigError` if any required env is missing — no silent
 *    fallback, no mock provider.
 *  - Maintains a `BrainRegistry` keyed by tenant id so each tenant has its
 *    own ThreadStore facade.
 *  - Verifies the request's `Authorization: Bearer <token>` against
 *    Supabase JWT and projects it onto the Brain's auth contexts.
 */

import {
  createBrain,
  BrainRegistry,
  type Brain,
  PostgresThreadStoreBackend,
  type BrainAuthPrincipal,
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
} from '@bossnyumba/ai-copilot';
import {
  createDatabaseClient,
  BrainThreadRepository,
} from '@bossnyumba/database';

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
let registryCache: BrainRegistry | null = null;

function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

function brainRegistry(): BrainRegistry {
  if (registryCache) return registryCache;
  const e = env();
  // Single shared Postgres connection. Per-tenant Brain caching is at the
  // ThreadStore-facade level, not the connection level.
  const db = createDatabaseClient(e.DATABASE_URL);
  registryCache = new BrainRegistry((tenantId) => {
    const repo = new BrainThreadRepository(db);
    const backend = new PostgresThreadStoreBackend(repo, () => tenantId);
    return createBrain({
      anthropic: {
        apiKey: e.ANTHROPIC_API_KEY,
        baseUrl: e.ANTHROPIC_BASE_URL,
        defaultModel: e.ANTHROPIC_MODEL_DEFAULT,
      },
      threadStoreBackend: backend,
    });
  });
  return registryCache;
}

/**
 * Verify the incoming request, return the Brain instance for the tenant +
 * the projected (tenant, actor, viewer) contexts.
 *
 * Throws SupabaseAuthError on missing/invalid JWT — handlers translate to a
 * 401/403 response.
 */
export async function brainForRequest(req: Request): Promise<{
  brain: Brain;
  tenant: ReturnType<typeof principalToBrainContexts>['tenant'];
  actor: ReturnType<typeof principalToBrainContexts>['actor'];
  viewer: ReturnType<typeof principalToBrainContexts>['viewer'];
  principal: BrainAuthPrincipal;
}> {
  const e = env();
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
  const principal = await verifySupabaseJwt(token, {
    jwtSecret: e.SUPABASE_JWT_SECRET,
    defaultEnvironment: 'production',
  });
  const brain = brainRegistry().for(principal.tenantId);
  const ctx = principalToBrainContexts(principal);
  return { brain, ...ctx, principal };
}

/**
 * Translate a thrown error into an HTTP response code + body.
 */
export function errorToResponse(err: unknown): { status: number; body: { error: string; code: string } } {
  if (err instanceof SupabaseAuthError) {
    return { status: err.status, body: { error: err.message, code: 'AUTH' } };
  }
  if (err instanceof BrainConfigError) {
    return {
      status: 503,
      body: { error: err.message, code: 'BRAIN_NOT_CONFIGURED' },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, body: { error: message, code: 'INTERNAL' } };
}
