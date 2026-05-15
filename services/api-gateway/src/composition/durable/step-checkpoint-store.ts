/**
 * step-checkpoint-store — thin adapter on top of
 * `AgencyRunCheckpointsService` (packages/database) for the durable
 * runner.
 *
 * Why a separate adapter and not the raw service?
 *
 *   1. The runner shouldn't know about Drizzle. The service exposes
 *      typed methods; the runner expresses INTENT (`pending(...)`,
 *      `running(...)`, `success(...)`, `failure(...)`, `paused(...)`)
 *      and the adapter maps INTENT → service calls.
 *   2. Tests can swap a recording in-memory store without spinning up
 *      a real DB. The runner takes a port, not a concrete service.
 *   3. The recovery worker uses the SAME port to look up stuck rows —
 *      keeping the abstraction one layer above the service prevents
 *      stale-driver bugs when one of the two paths diverges.
 *
 * The port shape mirrors the service's public surface 1:1; the
 * default factory adapts the production service. In-memory test
 * stores can be hand-rolled and dropped into the runner without
 * implementing the full Drizzle service interface.
 */
// Resolve the database service types via `ReturnType<typeof factory>`
// to dodge the `import type {...}` → namespace TS quirk that affects
// NodeNext consumers of the `@bossnyumba/database` barrel (see
// `services/api-gateway/src/composition/market-surveillance-wiring.ts`
// for the precedent).
import { createAgencyRunCheckpointsService } from '@bossnyumba/database';

type AgencyRunCheckpointsService = ReturnType<
  typeof createAgencyRunCheckpointsService
>;
type AgencyCheckpointRow = Awaited<
  ReturnType<AgencyRunCheckpointsService['getById']>
> extends infer R
  ? Exclude<R, null>
  : never;

export interface CheckpointPendingArgs {
  readonly tenantId: string;
  readonly runId: string;
  readonly goalId: string;
  readonly stepIndex: number;
  readonly stepName: string;
  readonly inputPayload: Record<string, unknown>;
}

/**
 * Durable runner's view of the checkpoint store. The runner calls
 * `pending(...)` BEFORE each step, then transitions via the
 * outcome-specific methods. Crash recovery uses `stuckRunning(...)`.
 */
export interface StepCheckpointStore {
  pending(args: CheckpointPendingArgs): Promise<{ id: string }>;
  running(id: string): Promise<void>;
  success(id: string, output: Record<string, unknown> | null): Promise<void>;
  failure(id: string, errorMessage: string): Promise<void>;
  paused(id: string, errorMessage: string): Promise<void>;
  listForRun(runId: string): Promise<ReadonlyArray<AgencyCheckpointRow>>;
  stuckRunning(args: {
    readonly olderThan: Date;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AgencyCheckpointRow>>;
  /** Lookup helper — used by recovery to inspect a checkpoint before
   *  re-running its step. */
  getById(id: string): Promise<AgencyCheckpointRow | null>;
}

/**
 * Adapt the Drizzle-backed AgencyRunCheckpointsService to the
 * runner's `StepCheckpointStore` port. Pure 1:1 method routing — no
 * additional state, no caching, no transformation.
 */
export function createStepCheckpointStore(
  svc: AgencyRunCheckpointsService,
): StepCheckpointStore {
  return {
    pending: (args) => svc.recordPending(args),
    running: (id) => svc.recordRunning(id),
    success: (id, output) => svc.recordSuccess(id, output),
    failure: (id, errorMessage) => svc.recordFailure(id, errorMessage),
    paused: (id, errorMessage) => svc.recordPaused(id, errorMessage),
    listForRun: (runId) => svc.listForRun(runId),
    stuckRunning: (args) => svc.listStuckRunning(args),
    getById: (id) => svc.getById(id),
  };
}
