/**
 * In-process Inngest runtime — the consumer/serve side that the hand-rolled
 * `POST /api/v1/inngest` webhook dispatches to (`services.inngestRuntime`).
 *
 * The api-gateway verifies the Inngest HMAC signature, parses the event, then
 * calls `runtime.handle({ name, data, id })`. This runtime maps `event.name`
 * → the registered `DurableFunctionDefinition` whose trigger matches, and
 * invokes its handler with a `DurableFunctionContext`. That binds the durable
 * function bodies (the 3 `durableLoopActuators.definitions` + the task-agent /
 * eviction defs) to a live execution path so an enqueued event is no longer
 * black-holed.
 *
 * Step semantics (IMPORTANT — what is and isn't durable here)
 * ----------------------------------------------------------
 * A real Inngest worker supplies a `step` that MEMOIZES `step.run` across
 * replays and TRULY SUSPENDS on `step.sleepUntil` (the function is parked and
 * a fresh HTTP invocation resumes it). This in-process runtime cannot do that
 * over a single stateless webhook request — there is no control plane to park
 * the function and call us back. So:
 *
 *   - `step.run(id, fn)` runs `fn` immediately and memoizes WITHIN this one
 *     invocation (a body that references the same step id twice gets the same
 *     value). It is NOT memoized across process restarts.
 *   - `step.sleepUntil(id, wakeAt)` resolves IMMEDIATELY (no real suspend).
 *     A bounded poll loop (the monitor function) would therefore run all its
 *     ticks back-to-back inside one request.
 *
 * Consequence: this runtime makes the durable producer/consumer path
 * CODE-COMPLETE (events route to handlers, bodies execute, runners fire), but
 * crash-resilient suspend/resume + true long-horizon sleeps still require a
 * deployed Inngest worker. That is the intended deploy-gate. For the default
 * (no-Inngest) deployment the orchestrator's wake/monitor run via the
 * IN-PROCESS supervisor (`in-process-wake-scheduler.ts`), not this runtime.
 *
 * Decoupling: imports ONLY the structural Inngest port types. No concrete
 * `inngest`, kernel, or Drizzle import — type-checks without the SDK.
 */

import type {
  DurableFunctionContext,
  DurableFunctionDefinition,
  DurableStepLike,
} from './inngest-client.js';

/** Structural logger — same shape the other durable modules accept. */
export interface InProcessInngestRuntimeLogger {
  info?(meta: object, msg: string): void;
  warn?(meta: object, msg: string): void;
  error?(meta: object, msg: string): void;
}

/** The event envelope the webhook hands us (mirrors `InngestRuntime.handle`). */
export interface InngestRuntimeEvent {
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly id?: string;
}

/** Result envelope the webhook serialises back to the Inngest control plane. */
export interface InngestRuntimeResult {
  readonly ok: true;
  readonly result?: unknown;
}

/** The runtime port the composition root binds to `services.inngestRuntime`. */
export interface InProcessInngestRuntime {
  handle(event: InngestRuntimeEvent): Promise<InngestRuntimeResult>;
  /** Event names this runtime can route (diagnostics / boot log). */
  readonly registeredEvents: ReadonlyArray<string>;
}

export interface InProcessInngestRuntimeDeps {
  /**
   * Every durable function definition the gateway registers. The runtime
   * indexes them by their `trigger.event` name. Cron-triggered defs are
   * skipped (no event name to route by). Later defs win on a name collision
   * (the caller controls registration order).
   */
  readonly definitions: ReadonlyArray<DurableFunctionDefinition>;
  readonly logger?: InProcessInngestRuntimeLogger;
}

/**
 * Build the in-process step executor. `run` executes + memoizes within the
 * single invocation; `sleepUntil` is an immediate no-op (see the module
 * header for why true suspend needs a deployed worker).
 */
function createInProcessStep(): DurableStepLike {
  const memo = new Map<string, unknown>();
  return {
    async run<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
      if (memo.has(id)) return memo.get(id) as T;
      const value = await fn();
      memo.set(id, value);
      return value;
    },
    async sleepUntil(_id: string, _isoTimestamp: string): Promise<void> {
      // No real suspend in-process — resolve immediately. A deployed Inngest
      // worker parks the function here instead.
      return undefined;
    },
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Compose the in-process Inngest runtime. Routes an incoming event to the
 * matching function handler and runs its body with an in-process step.
 *
 * `handle` rejects (the webhook turns it into a 500) when no function is
 * registered for the event name OR the handler throws — both are real
 * dispatch faults the control plane should retry, not silent successes.
 */
export function createInProcessInngestRuntime(
  deps: InProcessInngestRuntimeDeps,
): InProcessInngestRuntime {
  const byEvent = new Map<string, DurableFunctionDefinition>();
  for (const def of deps.definitions) {
    const trigger = def.trigger as { event?: string; cron?: string };
    if (typeof trigger.event === 'string' && trigger.event.length > 0) {
      byEvent.set(trigger.event, def);
    }
  }
  const registeredEvents = [...byEvent.keys()];

  return {
    registeredEvents,
    async handle(event: InngestRuntimeEvent): Promise<InngestRuntimeResult> {
      const def = byEvent.get(event.name);
      if (!def) {
        // No registered function for this event — surface as a fault so the
        // webhook returns 500 and the control plane can alert, rather than
        // ACKing a dropped event.
        deps.logger?.warn?.(
          { eventName: event.name, eventId: event.id, registered: registeredEvents },
          'in-process-inngest-runtime: no function registered for event',
        );
        throw new Error(
          `no durable function registered for event '${event.name}'`,
        );
      }
      const ctx: DurableFunctionContext = {
        event: { name: event.name, data: event.data, id: event.id },
        step: createInProcessStep(),
        ...(event.id ? { runId: event.id } : {}),
      };
      try {
        const result = await def.handler(ctx);
        deps.logger?.info?.(
          { eventName: event.name, eventId: event.id, functionId: def.id },
          'in-process-inngest-runtime: function handled event',
        );
        return { ok: true, result };
      } catch (err) {
        deps.logger?.error?.(
          { eventName: event.name, eventId: event.id, functionId: def.id, err: errMessage(err) },
          'in-process-inngest-runtime: function handler failed',
        );
        // Re-throw — the webhook maps this to 500 (INNGEST_DISPATCH_FAILED)
        // so the delivery is retried, not silently lost.
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  };
}
