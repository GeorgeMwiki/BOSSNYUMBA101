/**
 * BOSSNYUMBA AI audit hash chain — Wave-11 AI security hardening.
 *
 * Tamper-evident append-only audit log. Each turn gets a SHA-256 hash of
 * (sequenceId, prevHash, payload). A single mutated row breaks the chain
 * on verify(). The repository port is storage-agnostic so tests can use an
 * in-memory map and production can bind the drizzle ai_audit_chain table.
 *
 * No floats, no mutation, no hidden clocks — everything is injectable.
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HashedAuditEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly sequenceId: number;
  readonly turnId: string;
  readonly sessionId: string | null;
  readonly action: string;
  readonly prevHash: string;
  readonly thisHash: string;
  readonly payloadRef: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface AppendAuditInput {
  readonly tenantId: string;
  readonly turnId: string;
  readonly action: string;
  readonly sessionId?: string;
  readonly payloadRef?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface ChainVerificationResult {
  readonly valid: boolean;
  readonly entriesChecked: number;
  readonly brokenAt?: number;
  readonly error?: string;
}

export interface AuditChainRepository {
  insertEntry(entry: HashedAuditEntry): Promise<HashedAuditEntry>;
  /** Return the most recent entry (by sequenceId) for a tenant, or null. */
  getLatest(tenantId: string): Promise<HashedAuditEntry | null>;
  listByTenant(
    tenantId: string,
    options?: { readonly fromSeq?: number; readonly limit?: number },
  ): Promise<readonly HashedAuditEntry[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GENESIS_PREV_HASH =
  'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Canonicalise + hash a single audit entry. Pure — same inputs always return
 * the same hash.
 */
export function hashAuditPayload(params: {
  readonly sequenceId: number;
  readonly prevHash: string;
  readonly tenantId: string;
  readonly turnId: string;
  readonly action: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}): string {
  const serialised = JSON.stringify({
    sequenceId: params.sequenceId,
    prevHash: params.prevHash,
    tenantId: params.tenantId,
    turnId: params.turnId,
    action: params.action,
    payload: params.payload,
    timestamp: params.timestamp,
  });
  return createHash('sha256').update(serialised).digest('hex');
}

function validateNonEmpty(value: string | undefined, field: string): void {
  if (!value || value.trim() === '') {
    throw new Error(`audit-hash-chain: ${field} is required`);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface AuditHashChainDeps {
  readonly repo: AuditChainRepository;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export interface AuditHashChain {
  append(input: AppendAuditInput): Promise<HashedAuditEntry>;
  verify(tenantId: string): Promise<ChainVerificationResult>;
  listEntries(
    tenantId: string,
    options?: { readonly fromSeq?: number; readonly limit?: number },
  ): Promise<readonly HashedAuditEntry[]>;
}

export function createAuditHashChain(deps: AuditHashChainDeps): AuditHashChain {
  const now = deps.now ?? (() => new Date());
  const genId =
    deps.idGenerator ??
    (() => `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);

  return {
    async append(input) {
      validateNonEmpty(input.tenantId, 'tenantId');
      validateNonEmpty(input.turnId, 'turnId');
      validateNonEmpty(input.action, 'action');

      const latest = await deps.repo.getLatest(input.tenantId);
      const sequenceId = (latest?.sequenceId ?? 0) + 1;
      const prevHash = latest?.thisHash ?? GENESIS_PREV_HASH;
      const timestamp = now().toISOString();
      const payload = input.payload ? { ...input.payload } : {};

      const thisHash = hashAuditPayload({
        sequenceId,
        prevHash,
        tenantId: input.tenantId,
        turnId: input.turnId,
        action: input.action,
        payload,
        timestamp,
      });

      const entry: HashedAuditEntry = {
        id: genId(),
        tenantId: input.tenantId,
        sequenceId,
        turnId: input.turnId,
        sessionId: input.sessionId ?? null,
        action: input.action,
        prevHash,
        thisHash,
        payloadRef: input.payloadRef ?? null,
        payload,
        createdAt: timestamp,
      };

      return deps.repo.insertEntry(entry);
    },

    async verify(tenantId) {
      validateNonEmpty(tenantId, 'tenantId');
      const entries = await deps.repo.listByTenant(tenantId);
      if (entries.length === 0) {
        return { valid: true, entriesChecked: 0 };
      }

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (i > 0 && entry.sequenceId !== entries[i - 1].sequenceId + 1) {
          return {
            valid: false,
            entriesChecked: i + 1,
            brokenAt: entry.sequenceId,
            error: `Sequence gap at ${entry.sequenceId}`,
          };
        }

        const expectedPrev =
          i === 0 ? GENESIS_PREV_HASH : entries[i - 1].thisHash;
        if (entry.prevHash !== expectedPrev) {
          return {
            valid: false,
            entriesChecked: i + 1,
            brokenAt: entry.sequenceId,
            error: `prevHash mismatch at ${entry.sequenceId}`,
          };
        }

        const expectedHash = hashAuditPayload({
          sequenceId: entry.sequenceId,
          prevHash: entry.prevHash,
          tenantId: entry.tenantId,
          turnId: entry.turnId,
          action: entry.action,
          payload: entry.payload,
          timestamp: entry.createdAt,
        });
        if (expectedHash !== entry.thisHash) {
          return {
            valid: false,
            entriesChecked: i + 1,
            brokenAt: entry.sequenceId,
            error: `payload mutated at sequence ${entry.sequenceId}`,
          };
        }
      }

      return { valid: true, entriesChecked: entries.length };
    },

    async listEntries(tenantId, options) {
      validateNonEmpty(tenantId, 'tenantId');
      return deps.repo.listByTenant(tenantId, options);
    },
  };
}

/**
 * Tiny in-memory repository for tests. Not exported from the package barrel.
 */
export function createInMemoryAuditChainRepo(): AuditChainRepository & {
  readonly entries: readonly HashedAuditEntry[];
  tamperAt(index: number, mutation: Partial<HashedAuditEntry>): void;
} {
  const rows: HashedAuditEntry[] = [];
  return {
    get entries() {
      return rows.map((r) => ({ ...r, payload: { ...r.payload } }));
    },
    async insertEntry(entry) {
      rows.push({ ...entry, payload: { ...entry.payload } });
      return { ...entry, payload: { ...entry.payload } };
    },
    async getLatest(tenantId) {
      const scoped = rows.filter((r) => r.tenantId === tenantId);
      if (scoped.length === 0) return null;
      const last = scoped[scoped.length - 1];
      return { ...last, payload: { ...last.payload } };
    },
    async listByTenant(tenantId, options) {
      const fromSeq = options?.fromSeq ?? 0;
      const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
      return rows
        .filter((r) => r.tenantId === tenantId && r.sequenceId >= fromSeq)
        .slice(0, limit)
        .map((r) => ({ ...r, payload: { ...r.payload } }));
    },
    tamperAt(index, mutation) {
      if (index < 0 || index >= rows.length) return;
      rows[index] = { ...rows[index], ...mutation } as HashedAuditEntry;
    },
  };
}
