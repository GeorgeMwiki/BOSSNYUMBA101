/**
 * In-memory `DeferHookPort` — used for tests + dev.
 *
 * Production wires this against K-A's `defer` hook in the kernel
 * orchestrator. The in-memory version persists the defer payload
 * keyed by resumeToken so tests can simulate the external event
 * landing.
 */

import type {
  DeferHookPort,
  DeferRequest,
  DeferResponse,
  DeferResumePayload,
} from './index.js';

export interface InMemoryDeferHookDeps {
  readonly clock: { readonly nowMs: () => number };
  readonly tokenGen: () => string;
}

export function createInMemoryDeferHook(
  deps: InMemoryDeferHookDeps,
): DeferHookPort & {
  readonly pendingTokens: () => ReadonlyArray<string>;
  readonly recordApproval: (token: string, approvedBy: string) => void;
} {
  interface Entry {
    readonly resumeToken: string;
    readonly request: DeferRequest;
    readonly scheduledWakeAt?: string;
    approvedBy?: string;
    approvedAt?: string;
  }

  const entries = new Map<string, Entry>();

  return {
    requestDefer: async (request: DeferRequest): Promise<DeferResponse> => {
      const resumeToken = `def_${deps.tokenGen()}`;
      const entry: Entry = {
        resumeToken,
        request,
        ...(request.resumeAfterMs !== undefined
          ? {
              scheduledWakeAt: new Date(
                deps.clock.nowMs() + request.resumeAfterMs,
              ).toISOString(),
            }
          : {}),
      };
      entries.set(resumeToken, entry);
      return Object.freeze({
        resumeToken,
        ...(entry.scheduledWakeAt !== undefined
          ? { scheduledWakeAt: entry.scheduledWakeAt }
          : {}),
      });
    },
    resume: async (token: string): Promise<DeferResumePayload | null> => {
      const entry = entries.get(token);
      if (entry === undefined) {
        return null;
      }
      return Object.freeze({
        tenantId: entry.request.tenantId,
        correlationId: entry.request.correlationId,
        payload: entry.request.payload,
        ...(entry.approvedBy !== undefined ? { approvedBy: entry.approvedBy } : {}),
        ...(entry.approvedAt !== undefined ? { approvedAt: entry.approvedAt } : {}),
      });
    },
    pendingTokens: () => Object.freeze(Array.from(entries.keys())),
    recordApproval: (token: string, approvedBy: string) => {
      const entry = entries.get(token);
      if (entry === undefined) {
        return;
      }
      entry.approvedBy = approvedBy;
      entry.approvedAt = new Date(deps.clock.nowMs()).toISOString();
    },
  };
}
