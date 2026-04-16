/**
 * Brain — production factory.
 *
 * Composes Orchestrator + PersonaRegistry + ThreadStore + ToolDispatcher +
 * AdvisorExecutor + Anthropic provider into a single Brain instance.
 *
 * Production policy (no fakes):
 *  - `createBrain` requires real Anthropic credentials. There is NO mock
 *    fallback. If `ANTHROPIC_API_KEY` is missing, it throws.
 *  - `createBrain` requires a `threadStoreBackend` for shared / persistent
 *    state. The in-memory store remains available for unit tests via
 *    `createBrainForTesting`, which is the explicit test-only surface.
 *  - Per-tenant caching is the responsibility of `BrainRegistry` so each
 *    tenant gets its own ThreadStore facade and governance counters.
 */

import {
  AnthropicProvider,
  AnthropicProviderConfig,
} from './providers/anthropic.js';
import { MockAIProvider } from './providers/ai-provider.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import { ToolDispatcher } from './orchestrator/tool-dispatcher.js';
import {
  InMemoryThreadStore,
  ThreadStore,
  ThreadStoreBackend,
} from './thread/thread-store.js';
import {
  PersonaRegistry,
  Persona,
} from './personas/persona.js';
import { DEFAULT_PERSONAE } from './personas/personas.catalog.js';
import { registerDefaultSkills } from './skills/index.js';
import { GraphToolkitLike } from './skills/graph/index.js';
import { ReviewService, createReviewService } from './services/review-service.js';
import {
  AIGovernanceService,
  createAIGovernanceService,
} from './governance/ai-governance.js';

// ---------------------------------------------------------------------------
// Production Brain — strict
// ---------------------------------------------------------------------------

export interface BrainConfig {
  /**
   * Anthropic API config. Required in production. Pass `undefined` only via
   * `createBrainForTesting` which forces mock providers explicitly.
   */
  anthropic: AnthropicProviderConfig;

  /**
   * Persistent thread-store backend. Required. For persistence-free unit
   * tests use `createBrainForTesting` which injects InMemoryThreadStore.
   */
  threadStoreBackend: ThreadStoreBackend;

  /** Override default personae (e.g. tenant customization). */
  personaOverrides?: Persona[];
  /** Existing governance service to share with the rest of AICopilot. */
  governance?: AIGovernanceService;
  /** Existing review service to share with the rest of AICopilot. */
  reviewService?: ReviewService;
  /** Graph toolkit from @bossnyumba/graph-sync for graph tool wiring. */
  graphToolkit?: GraphToolkitLike;
  /** Default per-turn token budget (cost ceiling). */
  defaultTokenBudget?: number;
}

export interface Brain {
  orchestrator: Orchestrator;
  personas: PersonaRegistry;
  threads: ThreadStore;
  tools: ToolDispatcher;
  governance: AIGovernanceService;
  reviewService: ReviewService;
  /** Underlying executor provider — exposed for health checks. */
  executor: AnthropicProvider;
}

/**
 * Production Brain factory. Throws if Anthropic config or thread-store backend
 * is missing.
 */
export function createBrain(cfg: BrainConfig): Brain {
  if (!cfg.anthropic?.apiKey) {
    throw new Error(
      'createBrain: anthropic.apiKey is required (set ANTHROPIC_API_KEY). ' +
        'For unit tests, use createBrainForTesting.'
    );
  }
  if (!cfg.threadStoreBackend) {
    throw new Error(
      'createBrain: threadStoreBackend is required. Pass a Postgres-backed ' +
        'PostgresThreadStoreBackend for production.'
    );
  }

  // Providers — both executor and advisor share the same AnthropicProvider
  // instance; the AdvisorExecutor selects the model id (Sonnet vs Opus).
  const executor = new AnthropicProvider(cfg.anthropic);
  const advisor = executor;

  const personas = new PersonaRegistry();
  for (const p of DEFAULT_PERSONAE) personas.register(p);
  if (cfg.personaOverrides) for (const p of cfg.personaOverrides) personas.register(p);

  const threads = new ThreadStore(cfg.threadStoreBackend);

  const governance = cfg.governance ?? createAIGovernanceService();
  const reviewService = cfg.reviewService ?? createReviewService();

  const tools = new ToolDispatcher(threads);
  registerDefaultSkills(tools, { graphToolkit: cfg.graphToolkit });

  const orchestrator = new Orchestrator({
    personas,
    threads,
    tools,
    reviewService,
    governance,
    executorProvider: executor,
    advisorProvider: advisor,
    defaultTokenBudget: cfg.defaultTokenBudget,
  });

  return { orchestrator, personas, threads, tools, governance, reviewService, executor };
}

// ---------------------------------------------------------------------------
// Test surface — explicit opt-in to mock providers + in-memory store
// ---------------------------------------------------------------------------

export interface BrainForTestingConfig {
  personaOverrides?: Persona[];
  graphToolkit?: GraphToolkitLike;
  defaultTokenBudget?: number;
}

/**
 * Test-only Brain. Uses MockAIProvider + InMemoryThreadStore. The fact that
 * this lives in a separately-named export is the production safety net —
 * `createBrain` cannot accidentally pick up mocks.
 */
export function createBrainForTesting(cfg: BrainForTestingConfig = {}): Brain {
  const executor = new MockAIProvider() as unknown as AnthropicProvider;
  const personas = new PersonaRegistry();
  for (const p of DEFAULT_PERSONAE) personas.register(p);
  if (cfg.personaOverrides) for (const p of cfg.personaOverrides) personas.register(p);
  const threads = new ThreadStore(new InMemoryThreadStore());
  const governance = createAIGovernanceService();
  const reviewService = createReviewService();
  const tools = new ToolDispatcher(threads);
  registerDefaultSkills(tools, { graphToolkit: cfg.graphToolkit });
  const orchestrator = new Orchestrator({
    personas,
    threads,
    tools,
    reviewService,
    governance,
    executorProvider: executor,
    advisorProvider: executor,
    defaultTokenBudget: cfg.defaultTokenBudget,
  });
  return { orchestrator, personas, threads, tools, governance, reviewService, executor };
}

// ---------------------------------------------------------------------------
// Per-tenant Brain registry
// ---------------------------------------------------------------------------

/**
 * Per-tenant Brain cache. Each tenant gets its own ThreadStore facade so
 * conversation state never leaks across tenants. The Orchestrator and
 * AdvisorExecutor are stateless and could be shared, but we keep one
 * orchestrator per tenant so governance + review services can carry
 * tenant-scoped configuration in future without API changes.
 *
 * The factory you pass is invoked lazily on first use for a given tenant.
 */
export class BrainRegistry {
  private brains = new Map<string, Brain>();

  constructor(
    private readonly factoryForTenant: (tenantId: string) => Brain
  ) {}

  for(tenantId: string): Brain {
    const cached = this.brains.get(tenantId);
    if (cached) return cached;
    const fresh = this.factoryForTenant(tenantId);
    this.brains.set(tenantId, fresh);
    return fresh;
  }

  /**
   * Drop a tenant's cached Brain. Used after configuration changes (e.g.
   * tenant updates persona overrides).
   */
  invalidate(tenantId: string): void {
    this.brains.delete(tenantId);
  }

  /** Number of currently cached Brains — useful for ops dashboards. */
  size(): number {
    return this.brains.size;
  }
}

// ---------------------------------------------------------------------------
// Brain health check
// ---------------------------------------------------------------------------

export interface BrainHealth {
  ok: boolean;
  /** Anthropic Messages API reachable. */
  anthropicReachable: boolean;
  /** Thread-store backend reachable. */
  threadStoreReachable: boolean;
  /** Tool dispatcher count of registered handlers. */
  toolCount: number;
  /** Persona templates registered. */
  personaCount: number;
  /** Last checked. */
  checkedAt: string;
  /** First failure message (if any). */
  failure?: string;
}

export async function checkBrainHealth(brain: Brain): Promise<BrainHealth> {
  let anthropicReachable = false;
  let threadStoreReachable = false;
  let failure: string | undefined;
  try {
    anthropicReachable = await brain.executor.healthCheck();
  } catch (e) {
    failure = `anthropic: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    // Cheap probe — list zero threads for a synthetic tenant.
    await brain.threads.listThreads('__healthcheck__', { limit: 1 });
    threadStoreReachable = true;
  } catch (e) {
    failure = failure ?? `thread_store: ${e instanceof Error ? e.message : String(e)}`;
  }
  const ok = anthropicReachable && threadStoreReachable;
  return {
    ok,
    anthropicReachable,
    threadStoreReachable,
    toolCount: brain.tools.list().length,
    personaCount: brain.personas.list().length,
    checkedAt: new Date().toISOString(),
    failure,
  };
}
