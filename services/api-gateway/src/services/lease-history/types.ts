/**
 * Lease history — real-estate chain-of-custody types.
 *
 * Every state-mutating step on a lease (move_in, rent_payment, repair,
 * complaint, renewal, transfer, move_out, inspection, etc.) is
 * recorded with provenance, actor, timestamp, optional geo coordinates,
 * and optional C2PA-signed photo cid. Hash-chained via
 * prev_audit_hash so each step embeds the chain it builds on.
 *
 * Mapping discipline (Borjie -> BossNyumba):
 *   mineral_chain_of_custody  ->  lease_history
 *   parcel handoff (mine→buyer) -> lease step (landlord→tenant→manager)
 *   sealed sample weight + grade -> rent amount + currency
 *   C2PA-signed photo (mineral)  -> C2PA-signed photo (unit/condition)
 *   audit_hash chain             -> audit_hash chain (verbatim)
 */

export const LEASE_HISTORY_ACTIONS = [
  'move_in',
  'rent_payment',
  'repair',
  'complaint',
  'renewal',
  'transfer',
  'move_out',
  'inspection',
  'arrears_notice',
  'rent_change',
  'sublet_grant',
  'eviction_notice',
] as const;
export type LeaseHistoryAction = (typeof LEASE_HISTORY_ACTIONS)[number];

export const LEASE_HISTORY_ACTOR_ROLES = [
  'landlord',
  'tenant',
  'manager',
  'admin',
  'system',
] as const;
export type LeaseHistoryActorRole =
  (typeof LEASE_HISTORY_ACTOR_ROLES)[number];

export interface AppendLeaseHistoryStepInput {
  readonly tenantId: string;
  readonly leaseId: string;
  readonly action: LeaseHistoryAction;
  readonly actorId: string;
  readonly actorRole: LeaseHistoryActorRole;
  /** Optional C2PA-signed photo content id (S3/IPFS). */
  readonly photoCid?: string;
  readonly locationLat?: number;
  readonly locationLon?: number;
  /** Optional currency-denominated amount for this step. */
  readonly amount?: number;
  readonly currencyCode?: string;
  /** Optional happened-at; defaults to now() on the DB. */
  readonly happenedAt?: string;
  /** Free-form provenance metadata persisted as jsonb. */
  readonly provenance?: Record<string, unknown>;
}

export interface LeaseHistoryStep {
  readonly id: string;
  readonly tenantId: string;
  readonly leaseId: string;
  readonly stepIndex: number;
  readonly action: LeaseHistoryAction;
  readonly actorId: string;
  readonly actorRole: LeaseHistoryActorRole;
  readonly happenedAt: string;
  readonly photoCid: string | null;
  readonly locationLat: number | null;
  readonly locationLon: number | null;
  readonly amount: number | null;
  readonly currencyCode: string | null;
  readonly auditHash: string;
  readonly prevAuditHash: string;
  readonly provenance: Record<string, unknown>;
}

export interface ShowLeaseTraceInput {
  readonly tenantId: string;
  readonly leaseId: string;
  readonly limit?: number;
}

export interface ShowLeaseTraceResult {
  readonly leaseId: string;
  readonly steps: ReadonlyArray<LeaseHistoryStep>;
  /**
   * Verification result. `ok=false` means the chain has been tampered
   * with — `brokenAt` is the first step index where prev_audit_hash
   * does not match the previous step's audit_hash.
   */
  readonly verification: {
    readonly ok: boolean;
    readonly brokenAt: number | null;
  };
  readonly latestHash: string;
}
