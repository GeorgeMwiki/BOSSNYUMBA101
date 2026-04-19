/**
 * BOSSNYUMBA AI heartbeat engine — Wave-11.
 *
 * Pure, testable tick loop. Every active Brain instance calls `tick()` at a
 * configurable cadence (default 30 s). On each tick the engine does FIVE
 * things, in this order:
 *
 *   1. Put expired junior sessions to sleep (memo directive).
 *   2. Probe upstream LLM health (fire-and-forget).
 *   3. Roll the per-tenant cost ledger so summaries stay fresh.
 *   4. Emit telemetry via an injected observer.
 *   5. Sweep memory decay for each active tenant.
 *
 * The engine is deliberately clock-driven (takes an injected `now()`) so it
 * is fully testable without real timers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JuniorSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly lastActivityAt: number;
  readonly awake: boolean;
}

export interface HeartbeatTickInput {
  readonly juniors: readonly JuniorSession[];
  readonly activeTenantIds: readonly string[];
}

export interface HeartbeatTickResult {
  readonly tickAt: number;
  readonly juniorsPutToSleep: readonly string[];
  readonly juniorsKeptAwake: readonly string[];
  readonly llmHealthy: boolean;
  readonly ledgersRolled: number;
  readonly memorySweeps: number;
}

export interface HeartbeatDeps {
  readonly now: () => number;
  readonly juniorIdleMs?: number;
  readonly probeLlmHealth?: () => Promise<boolean>;
  readonly rollLedger?: (tenantId: string) => Promise<void>;
  readonly sweepMemoryForTenant?: (tenantId: string) => Promise<void>;
  readonly onJuniorSleep?: (sessionId: string) => void;
  readonly onJuniorWake?: (sessionId: string) => void;
  readonly telemetry?: (event: HeartbeatTickResult) => void;
}

export interface HeartbeatEngine {
  tick(input: HeartbeatTickInput): Promise<HeartbeatTickResult>;
  wake(sessionId: string): void;
  /** Cadence in ms suggested to schedulers wiring this engine. */
  readonly cadenceMs: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_JUNIOR_IDLE_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_HEARTBEAT_CADENCE_MS = 30 * 1000; // 30 seconds

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface HeartbeatEngineOptions {
  readonly cadenceMs?: number;
}

export function createHeartbeatEngine(
  deps: HeartbeatDeps,
  options: HeartbeatEngineOptions = {},
): HeartbeatEngine {
  const idleMs = deps.juniorIdleMs ?? DEFAULT_JUNIOR_IDLE_MS;
  const cadenceMs = options.cadenceMs ?? DEFAULT_HEARTBEAT_CADENCE_MS;
  const explicitlyWoken = new Set<string>();

  return {
    cadenceMs,

    wake(sessionId) {
      if (!sessionId) return;
      explicitlyWoken.add(sessionId);
      deps.onJuniorWake?.(sessionId);
    },

    async tick(input) {
      const tickAt = deps.now();

      const juniorsPutToSleep: string[] = [];
      const juniorsKeptAwake: string[] = [];

      for (const j of input.juniors) {
        if (explicitlyWoken.has(j.sessionId)) {
          juniorsKeptAwake.push(j.sessionId);
          explicitlyWoken.delete(j.sessionId);
          continue;
        }
        const idleFor = tickAt - j.lastActivityAt;
        if (j.awake && idleFor >= idleMs) {
          juniorsPutToSleep.push(j.sessionId);
          deps.onJuniorSleep?.(j.sessionId);
        } else if (j.awake) {
          juniorsKeptAwake.push(j.sessionId);
        }
      }

      // LLM health probe — never throws.
      let llmHealthy = true;
      if (deps.probeLlmHealth) {
        try {
          llmHealthy = await deps.probeLlmHealth();
        } catch {
          llmHealthy = false;
        }
      }

      // Roll ledgers per active tenant.
      let ledgersRolled = 0;
      if (deps.rollLedger) {
        for (const tenantId of input.activeTenantIds) {
          try {
            await deps.rollLedger(tenantId);
            ledgersRolled += 1;
          } catch {
            // Non-fatal; next tick retries.
          }
        }
      }

      // Memory decay sweep.
      let memorySweeps = 0;
      if (deps.sweepMemoryForTenant) {
        for (const tenantId of input.activeTenantIds) {
          try {
            await deps.sweepMemoryForTenant(tenantId);
            memorySweeps += 1;
          } catch {
            // Non-fatal; next tick retries.
          }
        }
      }

      const result: HeartbeatTickResult = {
        tickAt,
        juniorsPutToSleep,
        juniorsKeptAwake,
        llmHealthy,
        ledgersRolled,
        memorySweeps,
      };

      if (deps.telemetry) {
        try {
          deps.telemetry(result);
        } catch {
          // Telemetry must never crash the tick.
        }
      }

      return result;
    },
  };
}
