/**
 * Brain — convenience factory that composes the Orchestrator with a default
 * PersonaRegistry, ThreadStore, ToolDispatcher, and AdvisorExecutor.
 *
 * This is the single entrypoint for hosts that want "just give me the Brain"
 * without hand-wiring every subsystem. It amplifies `AICopilot` — it does not
 * replace it. Existing copilot invocations still work through `AICopilot`;
 * the Brain lives next to it.
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
import { ReviewService, createReviewService } from './services/review-service.js';
import {
  AIGovernanceService,
  createAIGovernanceService,
} from './governance/ai-governance.js';

export interface BrainConfig {
  /** Anthropic API config (required for production). */
  anthropic?: AnthropicProviderConfig;
  /** Use mock providers — for tests / CI. */
  useMockProviders?: boolean;
  /** Plug in a Postgres-backed thread store implementation. */
  threadStoreBackend?: ThreadStoreBackend;
  /** Override default personae (e.g. tenant customization). */
  personaOverrides?: Persona[];
  /** Existing governance service to share with the rest of AICopilot. */
  governance?: AIGovernanceService;
  /** Existing review service to share with the rest of AICopilot. */
  reviewService?: ReviewService;
}

export interface Brain {
  orchestrator: Orchestrator;
  personas: PersonaRegistry;
  threads: ThreadStore;
  tools: ToolDispatcher;
  governance: AIGovernanceService;
  reviewService: ReviewService;
}

/**
 * Create a fully-wired Brain.
 */
export function createBrain(cfg: BrainConfig = {}): Brain {
  // Providers
  const executor = cfg.useMockProviders
    ? new MockAIProvider()
    : cfg.anthropic
      ? new AnthropicProvider(cfg.anthropic)
      : new MockAIProvider();
  const advisor = cfg.useMockProviders
    ? new MockAIProvider()
    : cfg.anthropic
      ? new AnthropicProvider(cfg.anthropic)
      : new MockAIProvider();

  // Personas
  const personas = new PersonaRegistry();
  for (const p of DEFAULT_PERSONAE) personas.register(p);
  if (cfg.personaOverrides) {
    for (const p of cfg.personaOverrides) personas.register(p);
  }

  // Thread store
  const threads = new ThreadStore(
    cfg.threadStoreBackend ?? new InMemoryThreadStore()
  );

  // Governance + review services
  const governance = cfg.governance ?? createAIGovernanceService();
  const reviewService = cfg.reviewService ?? createReviewService();

  // Tool dispatcher (skills register themselves)
  const tools = new ToolDispatcher(threads);
  registerDefaultSkills(tools);

  // Orchestrator
  const orchestrator = new Orchestrator({
    personas,
    threads,
    tools,
    reviewService,
    governance,
    executorProvider: executor,
    advisorProvider: advisor,
  });

  return {
    orchestrator,
    personas,
    threads,
    tools,
    governance,
    reviewService,
  };
}
