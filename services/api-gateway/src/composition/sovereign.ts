/**
 * Sovereign composition root — wires the central-intelligence brain
 * kernel into a production-ready SovereignBrain singleton.
 *
 * Architecture overview — see `.planning/jarvis-architecture.md` for
 * the full Nyumba Mind reference: portal/persona/tier matrix, scope
 * lattice, grounding pyramid, per-user privacy guarantees, and the
 * 0114/0115 migration roster.
 *
 * Env-driven boot:
 *
 *   ANTHROPIC_API_KEY  → real Claude Opus/Sonnet/Haiku sensors via
 *                        @anthropic-ai/sdk; otherwise an in-process
 *                        stub sensor is used so dev / CI can still
 *                        boot without the SDK installed.
 *   DATABASE_URL       → Drizzle-backed kernel substrate sinks
 *                        (kernel_cot_reservoir, kernel_persona_drift_
 *                        events, kernel_provenance) and a
 *                        Postgres-backed sovereign_approvals store;
 *                        otherwise in-memory sinks.
 *
 * This module is the single source of truth for how the api-gateway
 * boots the sovereign AI. It returns one cached SovereignBrain per
 * tenantId so each tenant's audit trail is isolated. Platform-tier
 * (no tenant) shares a separate cache key.
 */

import {
  composeSovereign,
  createDpCohortSource,
  type PersonaBrandingOverride,
  type PersonaBrandingResolver,
  type SovereignBrain,
  type Sensor,
  type SubstrateSinks,
} from '@bossnyumba/central-intelligence';
import {
  createDpAggregator,
  createCryptoNoiseSource,
} from '@bossnyumba/graph-privacy';
import {
  createKernelSubstrateService,
  createKernelMemoryService,
  createKernelGroundingProvider,
  createPersonaBrandingService,
  createPgApprovalStore,
  createPgTenantAggregateSource,
  createPgPlatformBudgetLedger,
} from '@bossnyumba/database';

// Visibility role — mirrored locally so this composition root doesn't
// need a type-only barrel export from `@bossnyumba/database` (TS
// NodeNext + isolatedModules + cross-package source-types resolution
// can be picky about transitive `type` re-exports). Keep the union in
// lock-step with `GroundingViewRole` in
// `packages/database/src/services/kernel-grounding.service.ts`.
type SovereignRole = 'tenant' | 'manager' | 'owner' | 'org-admin' | 'sovereign';
import { getDb } from './db-client';

// ---------------------------------------------------------------------------
// Anthropic SDK loader — optional. We only require the SDK when the
// caller actually wants real sensors (ANTHROPIC_API_KEY set). The
// import is dynamic so the gateway can boot in environments without
// the SDK installed.
// ---------------------------------------------------------------------------

type AnthropicMessagesClient = Parameters<
  (typeof import('@bossnyumba/central-intelligence'))['createAnthropicSensor']
>[0];

let anthropicSingleton: AnthropicMessagesClient | null | undefined;

async function loadAnthropicClient(): Promise<AnthropicMessagesClient | null> {
  if (anthropicSingleton !== undefined) return anthropicSingleton;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    anthropicSingleton = null;
    return null;
  }
  try {
    const mod = await import('@anthropic-ai/sdk');
    const Anthropic = (mod.default ?? mod) as unknown as new (cfg: {
      apiKey: string;
    }) => AnthropicMessagesClient;
    anthropicSingleton = new Anthropic({ apiKey: key });
    return anthropicSingleton;
  } catch (err) {
    // SDK not installed — log once and fall back.
    console.warn(
      'sovereign-composition: @anthropic-ai/sdk not loadable; falling back to stub sensor',
      err instanceof Error ? err.message : err,
    );
    anthropicSingleton = null;
    return null;
  }
}

function createStubSensor(): Sensor {
  return {
    id: 'stub-sensor',
    modelId: 'stub-model',
    priority: 99,
    capabilities: ['fast'],
    async call(args) {
      return {
        text: `[stub sensor — set ANTHROPIC_API_KEY for live AI] You said: ${args.userMessage.slice(0, 200)}`,
        thought: null,
        toolCalls: [],
        latencyMs: 0,
        modelId: 'stub-model',
        sensorId: 'stub-sensor',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Per-(tenant, user) cache. Each BossNyumba user gets their own
// personalised Nyumba Mind: the kernel is stateless except for the 60s
// thought cache, but the grounding provider's role-aware filters are
// baked in at composition time, so we MUST key the SovereignBrain
// cache by both tenantId and userId (and role, conservatively) — not
// just tenantId. Keying only by tenant would let an org-admin and a
// resident in the same tenant accidentally share each other's brains.
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<SovereignBrain>>();

export interface SovereignScope {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly role?: SovereignRole;
}

function scopeKey(scope: SovereignScope): string {
  const t = scope.tenantId ?? '__platform__';
  const u = scope.userId ?? '__nouser__';
  const r = scope.role ?? '__norole__';
  return `${t}::${u}::${r}`;
}

export async function getSovereignBrain(
  scope: SovereignScope,
): Promise<SovereignBrain> {
  const key = scopeKey(scope);
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = build(scope);
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}

/** Test-only / hot-reload escape hatch. */
export function resetSovereignBrainCache(): void {
  cache.clear();
  anthropicSingleton = undefined;
}

async function build(scope: SovereignScope): Promise<SovereignBrain> {
  const db = getDb();

  // Substrate sinks — Drizzle-backed when DB is up; otherwise the
  // composeSovereign default (in-memory) is used.
  let substrateSinks: SubstrateSinks | undefined;
  let approvalStore: ReturnType<typeof createPgApprovalStore> | undefined;
  let priorTurnsLoader: ((threadId: string) => Promise<ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>>) | undefined;
  let recentTurnCounter: ((threadId: string) => Promise<number>) | undefined;
  let groundingFacts:
    | { fetch: (a: { userMessage: string; tier: string; limit: number }) => Promise<ReadonlyArray<unknown>> }
    | undefined;
  let cohortSource: ReturnType<typeof createDpCohortSource> | undefined;
  let brandingResolver: PersonaBrandingResolver | undefined;
  if (db) {
    const svc = createKernelSubstrateService(db, { tenantId: scope.tenantId });
    substrateSinks = {
      cot: svc.cot,
      drift: svc.drift,
      provenance: svc.provenance,
    };
    approvalStore = createPgApprovalStore(db, { tenantId: scope.tenantId });
    const memory = createKernelMemoryService(db, { tenantId: scope.tenantId });
    priorTurnsLoader = (threadId) => memory.loadPriorTurns(threadId);
    recentTurnCounter = (threadId) => memory.countRecentUserTurns(threadId);
    // Role-scoped grounding facts (occupancy, work-orders, leases).
    // The provider applies the role's visibility filter (resident →
    // own lease; manager → assigned properties; owner → owned
    // properties; org-admin → tenant-wide; sovereign → empty).
    // Platform-tier (no tenantId) gets nothing from this source —
    // industry-tier grounding rides on the DP cohort source instead.
    groundingFacts = createKernelGroundingProvider(db, {
      tenantId: scope.tenantId,
      userId: scope.userId,
      role: scope.role,
    });

    // Persona branding resolver — Drizzle-backed override lookup
    // keyed by (tenantId, surface). The persistence service returns
    // the persisted shape; we adapt it to the kernel port's narrower
    // PersonaBrandingOverride view (only the fields the kernel cares
    // about). Lookups for null tenantId (platform-tier) are short-
    // circuited to null inside the resolver.
    const brandingService = createPersonaBrandingService(db);
    brandingResolver = {
      async resolve({ tenantId, surface }) {
        if (!tenantId) return null;
        const row = await brandingService.get(tenantId, surface).catch(() => null);
        if (!row) return null;
        const override: PersonaBrandingOverride = {
          ...(row.displayName ? { displayName: row.displayName } : {}),
          ...(row.openingPreamble ? { openingPreamble: row.openingPreamble } : {}),
          ...(row.voiceProfileId ? { voiceProfileId: row.voiceProfileId } : {}),
        };
        // If the row exists but every field is null/empty, treat as
        // no-override so the kernel keeps the surface default verbatim.
        if (!override.displayName && !override.openingPreamble && !override.voiceProfileId) {
          return null;
        }
        return override;
      },
    };

    // DP cohort source — only when a privacy-budget envelope is
    // configured. Activation is gated by PRIVACY_BUDGET_EPSILON; an
    // unset/zero/non-numeric value disables the channel and the
    // kernel falls back to skipping cohort signals.
    const dpAggregator = maybeBuildDpAggregator(db);
    if (dpAggregator) {
      cohortSource = createDpCohortSource({
        // The kernel's `DpAggregator` is a narrow duck of the
        // production aggregator (which keeps strict types like
        // `DpAggregateOutcome`); the bridge below preserves the
        // runtime contract. Cast at the boundary.
        aggregator: dpAggregator as Parameters<typeof createDpCohortSource>[0]['aggregator'],
        authContext: {
          actorUserId: scope.userId ?? 'unknown',
          actorRoles: scope.role ? [scope.role] : [],
        },
      });
    }
  }

  // Sensors — Anthropic when key is set; otherwise a clearly-marked stub.
  const anthropic = await loadAnthropicClient();

  const mutable: Record<string, unknown> = {};
  if (anthropic) mutable.anthropicClient = anthropic;
  else mutable.extraSensors = [createStubSensor()];
  if (substrateSinks) mutable.substrateSinks = substrateSinks;
  if (approvalStore) mutable.approvalStore = approvalStore;
  if (priorTurnsLoader) mutable.priorTurnsLoader = priorTurnsLoader;
  if (recentTurnCounter) mutable.recentTurnCounter = recentTurnCounter;
  if (groundingFacts) mutable.groundingFacts = groundingFacts;
  if (cohortSource) mutable.cohortSource = cohortSource;
  if (brandingResolver) mutable.brandingResolver = brandingResolver;
  // autoHaikuJudge defaults to true in compose; we leave it unset.

  return composeSovereign(mutable as Parameters<typeof composeSovereign>[0]);
}

// ---------------------------------------------------------------------------
// DP aggregator builder — gated on PRIVACY_BUDGET_EPSILON. The kernel's
// `createDpCohortSource` ducks the aggregator's auth shape down to
// `{ actorUserId, actorRoles }`; the production aggregator expects
// `{ kind: 'platform', actorUserId, roles }`. We bridge the two with a
// thin wrapper so the kernel can keep its contract narrow while the
// aggregator stays strict.
// ---------------------------------------------------------------------------

interface KernelAuthContext {
  readonly actorUserId: string;
  readonly actorRoles: ReadonlyArray<string>;
}

function maybeBuildDpAggregator(
  db: NonNullable<ReturnType<typeof getDb>>,
): { aggregate: (q: unknown, ctx: KernelAuthContext) => Promise<unknown> } | undefined {
  const raw = process.env.PRIVACY_BUDGET_EPSILON?.trim();
  if (!raw) return undefined;
  const totalEpsilon = Number(raw);
  if (!Number.isFinite(totalEpsilon) || totalEpsilon <= 0) return undefined;

  const tenantSource = createPgTenantAggregateSource(db);
  // Postgres-backed ledger so cohort DP-aggregator budget consumption
  // survives api-gateway restarts (migration 0116). The in-memory
  // ledger remains the fallback when `db` is null — see the wider
  // build() guard on `if (db) { ... }`. The PgBudgetLedgerShape is
  // duck-compatible with the graph-privacy `PlatformBudgetLedger`
  // port; cast at the boundary so this composition root doesn't pull
  // in a transitive type-only re-export from @bossnyumba/database.
  const ledger = createPgPlatformBudgetLedger(db, {
    totalEpsilon,
    totalDelta: 1e-6,
  }) as unknown as Parameters<typeof createDpAggregator>[0]['ledger'];
  const noise = createCryptoNoiseSource();
  const aggregator = createDpAggregator({ tenantSource, ledger, noise });

  // Bridge: kernel feeds `{ actorUserId, actorRoles }`; the strict
  // aggregator wants `{ kind: 'platform', actorUserId, roles }`.
  return {
    aggregate(q, ctx) {
      return aggregator.aggregate(q as Parameters<typeof aggregator.aggregate>[0], {
        kind: 'platform',
        actorUserId: ctx.actorUserId,
        roles: ctx.actorRoles,
      });
    },
  };
}
