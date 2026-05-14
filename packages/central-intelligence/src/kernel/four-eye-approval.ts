/**
 * Four-eye approval gate — sovereign-tier write actions require N
 * distinct authorised approvers from a declared set of role groups
 * before the kernel will hand the action to the executor.
 *
 * The gate has five lifecycle states:
 *
 *   - 'pending'   — proposed by the AI; awaiting first approver
 *   - 'one-eye'   — at least one approver has signed; quorum not yet reached
 *   - 'approved'  — quorum met across every declared role group
 *   - 'rejected'  — any approver vetoed
 *   - 'expired'   — TTL elapsed without quorum
 *
 * K5 parity upgrade: each proposed action carries an optional
 * `ApprovalPolicy` that declares how many approvers are required AND
 * from which role groups. Without a policy, the gate falls back to the
 * historical "any 2 distinct admins" baseline so existing callers keep
 * working.
 *
 * Role-group examples for property management:
 *   - eviction.propose:    1 compliance + 1 owner-relations + 1 property-manager
 *   - owner_payout.disburse: 1 ops + 1 compliance
 *   - kra.file_mri_return: 1 compliance + 1 owner-relations
 *
 * Each approval is bound to a specific actor user id; the SAME user
 * cannot satisfy two slots. The proposer is also disqualified unless
 * the policy explicitly opts in via `allowProposerSignature: true`.
 *
 * Pure data structure with an injectable clock + policy resolver;
 * persistence is orthogonal — the gateway wires a Drizzle-backed store
 * at the composition root.
 */

import { randomUUID } from 'crypto';

export type ApprovalStatus =
  | 'pending'
  | 'one-eye'
  | 'approved'
  | 'rejected'
  | 'expired';

// ─────────────────────────────────────────────────────────────────────
// Role-group quorum (K5 parity).
// ─────────────────────────────────────────────────────────────────────

export interface ApprovalRoleGroup {
  readonly name: string;
  /** How many distinct approvers from this group are required. */
  readonly minApprovers: number;
}

export interface ApprovalPolicy {
  /** Sum of roleGroups[*].minApprovers — denormalised for fast checks. */
  readonly minTotalApprovers: number;
  /** Per-group quorum. Non-empty. */
  readonly roleGroups: ReadonlyArray<ApprovalRoleGroup>;
  /** Approval window in minutes. Used to derive expiresAt. */
  readonly maxStaleMinutes: number;
  /** Recall window in minutes (0 = not recallable). */
  readonly recallWindowMinutes: number;
  /** Whether approvers must re-authenticate before signing. */
  readonly reAuthRequired: boolean;
  /** Max age in seconds for the re-auth proof. */
  readonly reAuthMaxAgeSeconds: number;
  /** When true the proposer can count as one of the approvers. */
  readonly allowProposerSignature: boolean;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = Object.freeze({
  minTotalApprovers: 2,
  roleGroups: [{ name: 'admin', minApprovers: 2 }],
  maxStaleMinutes: 24 * 60,
  recallWindowMinutes: 0,
  reAuthRequired: false,
  reAuthMaxAgeSeconds: 300,
  allowProposerSignature: false,
});

export interface ApprovalPolicyResolver {
  resolve(args: {
    readonly tenantId: string | null;
    readonly toolName: string;
  }): Promise<ApprovalPolicy>;
}

// ─────────────────────────────────────────────────────────────────────
// Action + signature shapes
// ─────────────────────────────────────────────────────────────────────

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
  /** Tenant scope of the action; null for platform-level actions. */
  readonly tenantId?: string | null;
  /** Policy snapshot captured at propose-time — immutable. */
  readonly policy: ApprovalPolicy;
}

export interface ApprovalSignature {
  readonly approverUserId: string;
  /** Role group the approver is signing AS. Must appear in policy.roleGroups. */
  readonly roleGroup: string;
  readonly verdict: 'approve' | 'reject';
  readonly comment: string | null;
  readonly signedAt: string;
  /** When the policy requires re-auth, the proof's ISO timestamp. */
  readonly reAuthAt?: string;
}

export interface ApprovalRecord {
  readonly action: ProposedAction;
  readonly status: ApprovalStatus;
  readonly signatures: ReadonlyArray<ApprovalSignature>;
}

// ─────────────────────────────────────────────────────────────────────
// Gate API
// ─────────────────────────────────────────────────────────────────────

export interface ProposeArgs {
  readonly proposerUserId: string;
  readonly thoughtId: string;
  readonly summary: string;
  readonly toolName: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly stakes: 'medium' | 'high' | 'critical';
  /** Tenant scope; null for platform-level actions. */
  readonly tenantId?: string | null;
  /**
   * Optional explicit policy snapshot. When provided, the resolver is
   * bypassed — useful for tests and for callers that have already loaded
   * the policy. When omitted, deps.policyResolver is consulted; if
   * neither is wired, DEFAULT_APPROVAL_POLICY is used.
   */
  readonly policy?: ApprovalPolicy;
}

export interface SignArgs {
  readonly actionId: string;
  readonly approverUserId: string;
  /**
   * Role group the approver is signing as. Must match one of
   * `action.policy.roleGroups[*].name`. Defaults to 'admin' for backwards
   * compatibility with the pre-K5 baseline policy.
   */
  readonly roleGroup?: string;
  readonly verdict: 'approve' | 'reject';
  readonly comment?: string;
  /**
   * Optional re-authentication proof. When `policy.reAuthRequired` is
   * true the proof MUST be present AND fresh (within
   * `policy.reAuthMaxAgeSeconds`). Carrier-agnostic shape — the gateway
   * verifies TOTP / WebAuthn upstream and passes the timestamp through.
   */
  readonly reAuth?: { readonly verifiedAt: string };
}

export interface ApprovalGate {
  propose(args: ProposeArgs): Promise<ApprovalRecord>;
  sign(args: SignArgs): Promise<ApprovalRecord>;
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
  /**
   * Legacy ttl knob — applied only when neither `args.policy` nor
   * `deps.policyResolver` produces a policy. Prefer the policy's
   * `maxStaleMinutes` for fresh code.
   */
  readonly defaultTtlMs?: number;
  /** Optional policy resolver consulted at propose-time. */
  readonly policyResolver?: ApprovalPolicyResolver;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────
// Quorum check — pure
// ─────────────────────────────────────────────────────────────────────

interface QuorumCheckResult {
  readonly satisfied: boolean;
  readonly perGroup: ReadonlyArray<{
    readonly name: string;
    readonly have: number;
    readonly need: number;
  }>;
}

function checkQuorum(
  policy: ApprovalPolicy,
  signatures: ReadonlyArray<ApprovalSignature>,
): QuorumCheckResult {
  const approvals = signatures.filter((s) => s.verdict === 'approve');
  const perGroup = policy.roleGroups.map((g) => ({
    name: g.name,
    have: approvals.filter((s) => s.roleGroup === g.name).length,
    need: g.minApprovers,
  }));
  const satisfied =
    approvals.length >= policy.minTotalApprovers &&
    perGroup.every((p) => p.have >= p.need);
  return { satisfied, perGroup };
}

function findGroup(
  policy: ApprovalPolicy,
  name: string | undefined,
): ApprovalRoleGroup | null {
  const target = name && name.trim().length > 0 ? name : 'admin';
  for (const g of policy.roleGroups) {
    if (g.name === target) return g;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export function createApprovalGate(deps: ApprovalGateDeps): ApprovalGate {
  const clock = deps.clock ?? (() => new Date());
  const legacyTtlMs = deps.defaultTtlMs ?? DEFAULT_TTL_MS;

  interface ResolvedPolicyContext {
    readonly policy: ApprovalPolicy;
    readonly source: 'explicit' | 'resolver' | 'legacy-default';
  }

  async function resolvePolicy(args: ProposeArgs): Promise<ResolvedPolicyContext> {
    if (args.policy) return { policy: args.policy, source: 'explicit' };
    if (deps.policyResolver) {
      try {
        const resolved = await deps.policyResolver.resolve({
          tenantId: args.tenantId ?? null,
          toolName: args.toolName,
        });
        return { policy: resolved, source: 'resolver' };
      } catch (error) {
        console.error('approval-gate: policyResolver failed, using default:', error);
      }
    }
    return { policy: DEFAULT_APPROVAL_POLICY, source: 'legacy-default' };
  }

  return {
    async propose(args) {
      const { policy, source } = await resolvePolicy(args);
      const now = clock();
      // For backward-compatible callers that pass `defaultTtlMs` to a gate
      // built without a policyResolver, honour the legacy millisecond TTL
      // exactly. Otherwise derive the TTL from the policy's
      // `maxStaleMinutes` field.
      const ttlMs =
        source === 'legacy-default'
          ? legacyTtlMs
          : policy.maxStaleMinutes * 60_000;
      const action: ProposedAction = {
        proposerUserId: args.proposerUserId,
        thoughtId: args.thoughtId,
        summary: args.summary,
        toolName: args.toolName,
        payload: args.payload,
        stakes: args.stakes,
        tenantId: args.tenantId ?? null,
        id: randomUUID(),
        proposedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        policy,
      };
      const record: ApprovalRecord = {
        action,
        status: 'pending',
        signatures: [],
      };
      await deps.store.put(record);
      return record;
    },

    async sign(args) {
      const existing = await deps.store.get(args.actionId);
      if (!existing) throw new Error(`unknown action: ${args.actionId}`);

      const now = clock();
      const refreshed = refreshStatus(existing, now);
      if (
        refreshed.status === 'approved' ||
        refreshed.status === 'rejected' ||
        refreshed.status === 'expired'
      ) {
        return refreshed;
      }

      const policy = refreshed.action.policy;

      // Self-approval — refused unless the policy opts in.
      if (
        args.approverUserId === refreshed.action.proposerUserId &&
        !policy.allowProposerSignature
      ) {
        throw new Error('proposer cannot self-approve');
      }

      // Duplicate signature by the same user.
      if (refreshed.signatures.some((s) => s.approverUserId === args.approverUserId)) {
        throw new Error('approver has already signed');
      }

      // Resolve the role group the approver is signing as.
      const group = findGroup(policy, args.roleGroup);
      if (!group) {
        throw new Error(
          `role-group "${args.roleGroup ?? 'admin'}" is not declared on this action's policy`,
        );
      }

      // For approvals (not rejections) the group must still have an open slot.
      if (args.verdict === 'approve') {
        const haveInGroup = refreshed.signatures.filter(
          (s) => s.verdict === 'approve' && s.roleGroup === group.name,
        ).length;
        if (haveInGroup >= group.minApprovers) {
          throw new Error(
            `role-group "${group.name}" already has its required ${group.minApprovers} approvals`,
          );
        }
      }

      // Re-auth enforcement.
      let reAuthAt: string | undefined;
      if (policy.reAuthRequired) {
        if (!args.reAuth || !args.reAuth.verifiedAt) {
          throw new Error('policy requires re-authentication before signing');
        }
        const verifiedAtMs = Date.parse(args.reAuth.verifiedAt);
        if (!Number.isFinite(verifiedAtMs)) {
          throw new Error('re-auth verifiedAt is not a valid ISO timestamp');
        }
        const ageSec = (now.getTime() - verifiedAtMs) / 1000;
        if (ageSec < 0 || ageSec > policy.reAuthMaxAgeSeconds) {
          throw new Error(
            `re-auth proof is stale (age=${Math.max(0, Math.round(ageSec))}s, max=${policy.reAuthMaxAgeSeconds}s)`,
          );
        }
        reAuthAt = args.reAuth.verifiedAt;
      }

      const signature: ApprovalSignature = {
        approverUserId: args.approverUserId,
        roleGroup: group.name,
        verdict: args.verdict,
        comment: args.comment ?? null,
        signedAt: now.toISOString(),
        ...(reAuthAt ? { reAuthAt } : {}),
      };

      const nextSignatures = [...refreshed.signatures, signature];

      let nextStatus: ApprovalStatus;
      if (args.verdict === 'reject') {
        nextStatus = 'rejected';
      } else {
        const quorum = checkQuorum(policy, nextSignatures);
        nextStatus = quorum.satisfied ? 'approved' : 'one-eye';
      }

      const next: ApprovalRecord = {
        action: refreshed.action,
        status: nextStatus,
        signatures: nextSignatures,
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

/**
 * Convenience builder for an ApprovalPolicy. Validates the per-group sum
 * matches `minTotalApprovers` at construction; throws on mismatch.
 */
export function buildApprovalPolicy(input: {
  readonly roleGroups: ReadonlyArray<ApprovalRoleGroup>;
  readonly maxStaleMinutes?: number;
  readonly recallWindowMinutes?: number;
  readonly reAuthRequired?: boolean;
  readonly reAuthMaxAgeSeconds?: number;
  readonly allowProposerSignature?: boolean;
}): ApprovalPolicy {
  if (!Array.isArray(input.roleGroups) || input.roleGroups.length === 0) {
    throw new Error('approval-policy: roleGroups must be a non-empty array');
  }
  const seen = new Set<string>();
  let minTotal = 0;
  for (const g of input.roleGroups) {
    if (!g.name || g.name.trim().length === 0) {
      throw new Error('approval-policy: roleGroup.name must be non-empty');
    }
    if (seen.has(g.name)) {
      throw new Error(`approval-policy: duplicate roleGroup.name "${g.name}"`);
    }
    seen.add(g.name);
    if (!Number.isInteger(g.minApprovers) || g.minApprovers < 1) {
      throw new Error(
        `approval-policy: roleGroup "${g.name}" minApprovers must be a positive integer`,
      );
    }
    minTotal += g.minApprovers;
  }
  if (minTotal > 5) {
    throw new Error('approval-policy: sum of minApprovers capped at 5');
  }
  return {
    minTotalApprovers: minTotal,
    roleGroups: input.roleGroups,
    maxStaleMinutes: input.maxStaleMinutes ?? 24 * 60,
    recallWindowMinutes: input.recallWindowMinutes ?? 0,
    reAuthRequired: input.reAuthRequired ?? false,
    reAuthMaxAgeSeconds: input.reAuthMaxAgeSeconds ?? 300,
    allowProposerSignature: input.allowProposerSignature ?? false,
  };
}
