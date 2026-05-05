/**
 * Sovereign composition root — wires the central-intelligence brain
 * kernel into a production-ready SovereignBrain singleton.
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
  type SovereignBrain,
  type Sensor,
  type SubstrateSinks,
} from '@bossnyumba/central-intelligence';
import {
  createKernelSubstrateService,
  createKernelMemoryService,
  createPgApprovalStore,
} from '@bossnyumba/database';
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
// Per-tenant cache. The kernel itself is stateless except for the
// 60s thought cache; we still cache one SovereignBrain per scope so
// the sensor router and approval store re-use connections.
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<SovereignBrain>>();

export interface SovereignScope {
  readonly tenantId: string | null;
}

function scopeKey(scope: SovereignScope): string {
  return scope.tenantId ?? '__platform__';
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
  // autoHaikuJudge defaults to true in compose; we leave it unset.

  return composeSovereign(mutable as Parameters<typeof composeSovereign>[0]);
}
