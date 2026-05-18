/**
 * Auto-rollback engine — converts an SLO-monitor verdict into a concrete
 * receipt + side-effects (canary stage update, handoff queue insert,
 * sovereign-ledger snapshot restore).
 *
 * The engine itself is pure; it delegates side-effects to two ports:
 *   - `CanaryStageStore.update(subMd, tenantId, newStage)`
 *   - `HandoffQueuePort.enqueue(entry)`
 *   - `SubMdRevertPort.revert(subMd, tenantId, reason)` — out-of-band;
 *     called only on `kill-and-rollback`.
 */

import type {
  AutoRollbackReceipt,
  CanaryStage,
  HandoffQueueEntry,
  SloMonitorVerdict,
  SubMdSlo,
} from '../types.js';

export interface CanaryStageStore {
  update(
    subMd: string,
    tenantId: string | null,
    newStage: CanaryStage,
  ): Promise<void>;
}

export interface HandoffQueuePort {
  enqueue(entry: HandoffQueueEntry): Promise<void>;
}

export interface SubMdRevertPort {
  revert(
    subMd: string,
    tenantId: string | null,
    reason: string,
  ): Promise<void>;
}

export interface AutoRollbackDeps {
  readonly canaryStore: CanaryStageStore;
  readonly handoffQueue: HandoffQueuePort;
  readonly revertPort: SubMdRevertPort;
  /** Injectable clock so tests are deterministic. */
  readonly now?: () => Date;
  /** Injectable ID generator. */
  readonly newId?: () => string;
}

export interface AutoRollbackInput {
  readonly slo: SubMdSlo;
  readonly verdict: SloMonitorVerdict;
  /**
   * The in-flight request that was running when the breach fired. If
   * present and the action is `handoff` or `kill-and-rollback`, this is
   * what gets queued for a human.
   */
  readonly inFlightRequest?: {
    readonly tenantId: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly priority?: HandoffQueueEntry['priority'];
  };
}

/**
 * Execute the auto-rollback action implied by the verdict. Returns a
 * receipt — the wire-side adapter writes that to the audit chain.
 */
export async function executeAutoRollback(
  input: AutoRollbackInput,
  deps: AutoRollbackDeps,
): Promise<AutoRollbackReceipt> {
  const now = (deps.now ?? (() => new Date()))();
  const isoNow = now.toISOString();

  const fromStage = input.slo.canaryStage;

  if (input.verdict.action === 'no-op') {
    return Object.freeze({
      subMd: input.slo.subMd,
      tenantId: input.slo.tenantId,
      fromStage,
      toStage: fromStage,
      action: 'warn',
      reason: 'no-op: no breach',
      handoffQueued: false,
      timestamp: isoNow,
    });
  }

  if (input.verdict.action === 'warn') {
    return Object.freeze({
      subMd: input.slo.subMd,
      tenantId: input.slo.tenantId,
      fromStage,
      toStage: fromStage,
      action: 'warn',
      reason: input.verdict.reason,
      handoffQueued: false,
      timestamp: isoNow,
    });
  }

  if (input.verdict.action === 'reduce-traffic') {
    const next = input.verdict.nextStage ?? fromStage;
    await deps.canaryStore.update(input.slo.subMd, input.slo.tenantId, next);
    return Object.freeze({
      subMd: input.slo.subMd,
      tenantId: input.slo.tenantId,
      fromStage,
      toStage: next,
      action: 'reduce-traffic',
      reason: input.verdict.reason,
      handoffQueued: false,
      timestamp: isoNow,
    });
  }

  if (input.verdict.action === 'handoff') {
    await deps.canaryStore.update(input.slo.subMd, input.slo.tenantId, 'shadow');
    let queued = false;
    if (input.inFlightRequest) {
      const newId = deps.newId ?? defaultIdGen;
      const entry: HandoffQueueEntry = Object.freeze({
        id: newId(),
        subMd: input.slo.subMd,
        tenantId: input.inFlightRequest.tenantId,
        originalRequest: input.inFlightRequest.payload,
        reason: input.verdict.reason,
        queuedAt: isoNow,
        priority: input.inFlightRequest.priority ?? 'P2',
        status: 'queued',
      });
      await deps.handoffQueue.enqueue(entry);
      queued = true;
    }
    return Object.freeze({
      subMd: input.slo.subMd,
      tenantId: input.slo.tenantId,
      fromStage,
      toStage: 'shadow',
      action: 'handoff',
      reason: input.verdict.reason,
      handoffQueued: queued,
      timestamp: isoNow,
    });
  }

  // kill-and-rollback — terminal
  await deps.canaryStore.update(input.slo.subMd, input.slo.tenantId, 'shadow');
  await deps.revertPort.revert(input.slo.subMd, input.slo.tenantId, input.verdict.reason);

  let queued = false;
  if (input.inFlightRequest) {
    const newId = deps.newId ?? defaultIdGen;
    const entry: HandoffQueueEntry = Object.freeze({
      id: newId(),
      subMd: input.slo.subMd,
      tenantId: input.inFlightRequest.tenantId,
      originalRequest: input.inFlightRequest.payload,
      reason: input.verdict.reason,
      queuedAt: isoNow,
      priority: input.inFlightRequest.priority ?? 'P1',
      status: 'queued',
    });
    await deps.handoffQueue.enqueue(entry);
    queued = true;
  }

  return Object.freeze({
    subMd: input.slo.subMd,
    tenantId: input.slo.tenantId,
    fromStage,
    toStage: 'disabled',
    action: 'kill-and-rollback',
    reason: input.verdict.reason,
    handoffQueued: queued,
    timestamp: isoNow,
  });
}

function defaultIdGen(): string {
  // crypto.randomUUID is universally available in Node 18+; tests inject.
  return globalThis.crypto.randomUUID();
}
