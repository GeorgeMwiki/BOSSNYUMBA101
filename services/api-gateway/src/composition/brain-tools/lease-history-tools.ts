/**
 * PT-LH — Lease history brain tools (real-estate chain-of-custody).
 *
 * Mirrors the Borjie ops.chain_of_custody.* family, retailored to the
 * lease lifecycle. The two tools below let the LLM ground every claim
 * about a lease in the hash-chained `lease_history` table.
 *
 * - `lease_history.append_step` — HIGH stakes, isWrite=true. Inserts
 *   a new step (move_in, rent_payment, repair, complaint, renewal,
 *   transfer, move_out, inspection, etc.) bound by the caller's RLS
 *   tenant. Persists provenance via the embedded `withChatProvenance`
 *   shim so downstream auditors keep the chain accountable.
 *
 * - `lease_history.show_trace` — LOW stakes, read-only. Returns the
 *   ordered chain + verification result + latestHash so the owner
 *   cockpit can render the timeline + an explicit "chain verified"
 *   badge.
 *
 * Both tools are visible to OWNER (T1) / MANAGER (T3) / TENANT (T5)
 * personas. The tenant uses them to surface their own rent-payment
 * and inspection trail; the manager + owner consume them for audit.
 */

import { z } from 'zod';

import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';

const ALL_PERSONAS: ReadonlyArray<
  | 'T1_owner_strategist'
  | 'T3_module_manager'
  | 'T5_customer_concierge'
> = ['T1_owner_strategist', 'T3_module_manager', 'T5_customer_concierge'];

const LEASE_ACTION_VALUES = [
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
const LEASE_ACTOR_ROLES = [
  'landlord',
  'tenant',
  'manager',
  'admin',
  'system',
] as const;

/**
 * Inline provenance shim. Adds `provenance: { via: 'chat', sessionId,
 * turnId }` to a write body so the downstream audit row carries the
 * "via Mr. Mwikila" trail. Mirrors `provenance-injector.ts` in the
 * persona-tools branch tree; embedded here while the standalone
 * module is ported separately into ops.
 */
function withChatProvenance<T extends Record<string, unknown>>(
  body: T,
  ctx: PersonaToolHandlerContext,
): T & {
  provenance: {
    via: 'chat';
    sessionId: string | null;
    turnId: string | null;
    actorId: string;
  };
} {
  return {
    ...body,
    provenance: {
      via: 'chat',
      sessionId: ctx.chatSessionId ?? null,
      turnId: ctx.chatTurnId ?? null,
      actorId: ctx.actorId,
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// 1. lease_history.append_step
// ───────────────────────────────────────────────────────────────────

const AppendStepInput = z.object({
  leaseId: z.string().min(1).max(120),
  action: z.enum(LEASE_ACTION_VALUES),
  actorRole: z.enum(LEASE_ACTOR_ROLES),
  photoCid: z.string().min(8).max(500).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLon: z.number().min(-180).max(180).optional(),
  amount: z.number().nonnegative().optional(),
  currencyCode: z.string().min(3).max(8).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const AppendStepOutput = z.object({
  id: z.string(),
  stepIndex: z.number().int(),
  auditHash: z.string(),
  prevAuditHash: z.string(),
});

export const leaseHistoryAppendStepTool: PersonaToolDescriptor<
  typeof AppendStepInput,
  typeof AppendStepOutput
> = {
  id: 'lease_history.append_step',
  name: 'Lease history — append step (en) / Historia ya pango — ongeza hatua (sw)',
  description:
    'Append a new chain-of-custody step to a lease (move_in, rent_payment, ' +
    'repair, complaint, renewal, transfer, move_out, inspection, etc.). ' +
    'WRITE — hash-chained, append-only. Idempotent across retries via the ' +
    'underlying audit_hash recomputation.',
  personaSlugs: ALL_PERSONAS,
  inputSchema: AppendStepInput,
  outputSchema: AppendStepOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        stepIndex: 0,
        auditHash: '',
        prevAuditHash: '',
      };
    }
    const body = withChatProvenance(
      {
        action: input.action,
        actorRole: input.actorRole,
        photoCid: input.photoCid ?? null,
        locationLat: input.locationLat ?? null,
        locationLon: input.locationLon ?? null,
        amount: input.amount ?? null,
        currencyCode: input.currencyCode ?? null,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      id: string;
      stepIndex: number;
      auditHash: string;
      prevAuditHash: string;
    }>(
      `/leases/${encodeURIComponent(input.leaseId)}/history/steps`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// 2. lease_history.show_trace
// ───────────────────────────────────────────────────────────────────

const ShowTraceInput = z.object({
  leaseId: z.string().min(1).max(120),
  limit: z.number().int().positive().max(500).default(200),
});
const ShowTraceOutput = z.object({
  leaseId: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      stepIndex: z.number().int(),
      action: z.string(),
      actorId: z.string(),
      actorRole: z.string(),
      happenedAt: z.string(),
      photoCid: z.string().nullable(),
      locationLat: z.number().nullable(),
      locationLon: z.number().nullable(),
      amount: z.number().nullable(),
      currencyCode: z.string().nullable(),
      auditHash: z.string(),
      prevAuditHash: z.string(),
    }),
  ),
  verification: z.object({
    ok: z.boolean(),
    brokenAt: z.number().int().nullable(),
  }),
  latestHash: z.string(),
});

export const leaseHistoryShowTraceTool: PersonaToolDescriptor<
  typeof ShowTraceInput,
  typeof ShowTraceOutput
> = {
  id: 'lease_history.show_trace',
  name: 'Lease history — show trace (en) / Historia ya pango — onyesha mfululizo (sw)',
  description:
    'Return the hash-chained lease history timeline + tamper-verification ' +
    'result. Read-only — use when the owner / manager / tenant asks "what ' +
    'happened with this lease", "verify the rent ledger is intact", or ' +
    '"show me the move-in and move-out photos".',
  personaSlugs: ALL_PERSONAS,
  inputSchema: ShowTraceInput,
  outputSchema: ShowTraceOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        steps: [],
        verification: { ok: true, brokenAt: null },
        latestHash: '',
      };
    }
    return client.get<{
      leaseId: string;
      steps: Array<{
        id: string;
        stepIndex: number;
        action: string;
        actorId: string;
        actorRole: string;
        happenedAt: string;
        photoCid: string | null;
        locationLat: number | null;
        locationLon: number | null;
        amount: number | null;
        currencyCode: string | null;
        auditHash: string;
        prevAuditHash: string;
      }>;
      verification: { ok: boolean; brokenAt: number | null };
      latestHash: string;
    }>(`/leases/${encodeURIComponent(input.leaseId)}/history`, {
      query: { limit: String(input.limit) },
    });
  },
};

export const LEASE_HISTORY_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  leaseHistoryAppendStepTool,
  leaseHistoryShowTraceTool,
] as unknown as ReadonlyArray<PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>>);
