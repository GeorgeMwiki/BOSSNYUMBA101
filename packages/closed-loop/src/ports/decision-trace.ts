/**
 * Closed-Loop decision-trace port — internal LitFin shim.
 *
 * The LitFin source imported `@/core/litfin-ai/decision-trace`. That
 * module was never ported. This local shim implements just the surface
 * the runtime consumes:
 *
 *   - `TraceStore`           — persistence port
 *   - `InMemoryTraceStore`   — default sink used by tests + dev
 *   - `startTrace({...})`    — opens a trace, returns a recorder
 *   - `recorder.id`
 *   - `recorder.addReasoning(text)`
 *   - `recorder.finalize(decision, store)`
 *
 * The shim is intentionally minimal — it preserves IDs, reasoning, and
 * the final decision payload so the auditor can replay later. Callers
 * that need deeper provenance should wire the real audit-hash-chain
 * package (`@bossnyumba/audit-hash-chain`) on top.
 *
 * @module @bossnyumba/closed-loop/ports/decision-trace
 */

import { randomUUID } from "node:crypto";

export interface TraceRow {
  readonly id: string;
  readonly correlationId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly tier: string;
  readonly model: string;
  readonly modelTier: string;
  readonly input: Record<string, unknown>;
  readonly reasoning: ReadonlyArray<string>;
  readonly decision: Record<string, unknown>;
  readonly openedAt: number;
  readonly closedAt: number;
}

export interface TraceStore {
  save(row: TraceRow): Promise<void>;
}

export class InMemoryTraceStore implements TraceStore {
  readonly rows: TraceRow[] = [];

  async save(row: TraceRow): Promise<void> {
    this.rows.push(row);
  }
}

export interface StartTraceArgs {
  readonly correlationId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly tier: string;
  readonly model: string;
  readonly modelTier: string;
  readonly input: Record<string, unknown>;
  readonly clock?: () => number;
}

export interface TraceRecorder {
  readonly id: string;
  addReasoning(text: string): void;
  finalize(decision: Record<string, unknown>, store: TraceStore): Promise<void>;
}

export function startTrace(args: StartTraceArgs): TraceRecorder {
  const clock = args.clock ?? Date.now;
  const id = randomUUID();
  const openedAt = clock();
  const reasoning: string[] = [];
  let finalized = false;

  return {
    id,
    addReasoning(text: string): void {
      if (finalized) return;
      reasoning.push(text);
    },
    async finalize(
      decision: Record<string, unknown>,
      store: TraceStore,
    ): Promise<void> {
      if (finalized) return;
      finalized = true;
      const row: TraceRow = Object.freeze({
        id,
        correlationId: args.correlationId,
        sessionId: args.sessionId,
        userId: args.userId,
        tier: args.tier,
        model: args.model,
        modelTier: args.modelTier,
        input: { ...args.input },
        reasoning: Object.freeze([...reasoning]),
        decision: { ...decision },
        openedAt,
        closedAt: clock(),
      });
      await store.save(row);
    },
  };
}
