/**
 * Four-eye approval gate — sovereign-tier write actions require TWO
 * distinct authorised approvers before the kernel will hand the
 * action to the executor.
 *
 * The gate has three states:
 *
 *   - 'pending'   — proposed by the AI; needs first approver
 *   - 'one-eye'   — first approver has signed; needs second
 *   - 'approved'  — both signatures present; executor may run
 *   - 'rejected'  — any approver vetoed
 *   - 'expired'   — TTL elapsed without second signature
 *
 * Each approval is bound to a specific actor user id; the SAME user
 * cannot satisfy both eyes. The proposer is also disqualified from
 * approving (no self-approval).
 *
 * Pure data structure with an injectable clock; persistence is
 * orthogonal — the gateway wires a Drizzle-backed store at the
 * composition root.
 */

import { randomUUID } from 'crypto';

export type ApprovalStatus =
  | 'pending'
  | 'one-eye'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface ProposedAction {
  readonly id: string;
  readonly proposerUserId: string;
  readonly thoughtId: string;
  /** Human-readable summary the approver sees. */
  readonly summary: string;
  /** Tool/operation that will run on approval. */
  readonly toolName: string;
  /** Opaque payload — schema-validated by the executor at run-time. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly stakes: 'medium' | 'high' | 'critical';
  readonly proposedAt: string;
  readonly expiresAt: string;
}

export interface ApprovalSignature {
  readonly approverUserId: string;
  readonly verdict: 'approve' | 'reject';
  readonly comment: string | null;
  readonly signedAt: string;
}

export interface ApprovalRecord {
  readonly action: ProposedAction;
  readonly status: ApprovalStatus;
  readonly signatures: ReadonlyArray<ApprovalSignature>;
}

export interface ApprovalGate {
  propose(args: Omit<ProposedAction, 'id' | 'proposedAt' | 'expiresAt'>): Promise<ApprovalRecord>;
  sign(args: { actionId: string; approverUserId: string; verdict: 'approve' | 'reject'; comment?: string }): Promise<ApprovalRecord>;
  get(actionId: string): Promise<ApprovalRecord | null>;
  list(filter?: { status?: ApprovalStatus }): Promise<ReadonlyArray<ApprovalRecord>>;
}

export interface ApprovalStore {
  put(record: ApprovalRecord): Promise<void>;
  get(actionId: string): Promise<ApprovalRecord | null>;
  list(filter?: { status?: ApprovalStatus }): Promise<ReadonlyArray<ApprovalRecord>>;
}

export interface ApprovalGateDeps {
  readonly store: ApprovalStore;
  readonly clock?: () => Date;
  readonly defaultTtlMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createApprovalGate(deps: ApprovalGateDeps): ApprovalGate {
  const clock = deps.clock ?? (() => new Date());
  const ttl = deps.defaultTtlMs ?? DEFAULT_TTL_MS;

  return {
    async propose(args) {
      const now = clock();
      const action: ProposedAction = {
        ...args,
        id: randomUUID(),
        proposedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl).toISOString(),
      };
      const record: ApprovalRecord = {
        action,
        status: 'pending',
        signatures: [],
      };
      await deps.store.put(record);
      return record;
    },

    async sign({ actionId, approverUserId, verdict, comment }) {
      const existing = await deps.store.get(actionId);
      if (!existing) throw new Error(`unknown action: ${actionId}`);

      const now = clock();
      // Refresh status against TTL before signing.
      const refreshed = refreshStatus(existing, now);
      if (
        refreshed.status === 'approved' ||
        refreshed.status === 'rejected' ||
        refreshed.status === 'expired'
      ) {
        return refreshed;
      }

      if (approverUserId === existing.action.proposerUserId) {
        throw new Error('proposer cannot self-approve');
      }
      if (refreshed.signatures.some((s) => s.approverUserId === approverUserId)) {
        throw new Error('approver has already signed');
      }

      const signature: ApprovalSignature = {
        approverUserId,
        verdict,
        comment: comment ?? null,
        signedAt: now.toISOString(),
      };

      let nextStatus: ApprovalStatus;
      if (verdict === 'reject') {
        nextStatus = 'rejected';
      } else {
        const approveCount = refreshed.signatures.filter((s) => s.verdict === 'approve').length + 1;
        nextStatus = approveCount >= 2 ? 'approved' : 'one-eye';
      }

      const next: ApprovalRecord = {
        action: refreshed.action,
        status: nextStatus,
        signatures: [...refreshed.signatures, signature],
      };
      await deps.store.put(next);
      return next;
    },

    async get(actionId) {
      const record = await deps.store.get(actionId);
      if (!record) return null;
      const refreshed = refreshStatus(record, clock());
      if (refreshed !== record) await deps.store.put(refreshed);
      return refreshed;
    },

    async list(filter) {
      return deps.store.list(filter);
    },
  };
}

function refreshStatus(record: ApprovalRecord, now: Date): ApprovalRecord {
  if (record.status === 'approved' || record.status === 'rejected') return record;
  if (Date.parse(record.action.expiresAt) <= now.getTime()) {
    return { ...record, status: 'expired' };
  }
  return record;
}

/** In-memory store for tests / dev. */
export function createInMemoryApprovalStore(): ApprovalStore {
  const map = new Map<string, ApprovalRecord>();
  return {
    async put(record) {
      map.set(record.action.id, record);
    },
    async get(actionId) {
      return map.get(actionId) ?? null;
    },
    async list(filter) {
      const all = [...map.values()];
      if (!filter?.status) return all;
      return all.filter((r) => r.status === filter.status);
    },
  };
}
