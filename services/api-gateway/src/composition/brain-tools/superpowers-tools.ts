/**
 * BossNyumba Superpowers — Wave SUPERPOWERS brain tool catalog.
 *
 * Chat-callable tools that turn Mr. Mwikila from an answerer into an
 * actor on the owner's UI. Ported from Borjie's superpowers-tools.ts,
 * retailored for the real-estate domain:
 *
 *   - bossnyumba.ui.share_view       — generate shareable / time-limited link
 *   - bossnyumba.ui.bulk_action      — operate on many entities at once
 *   - bossnyumba.ui.undo_last_action — generic undo within a 5-min window
 *   - bossnyumba.ui.prefill_form     — fill a form from chat-derived data
 *
 * Persona: T1 owner_strategist plus T2 admin_strategist (so the
 * BossNyumba admin console can dogfood the same surface). T3..T5 are
 * deliberately excluded — field workers and customer concierges never
 * share or pin on the owner's behalf.
 *
 * Discipline:
 *   - Write tools (share / bulk / undo / prefill) are MEDIUM stakes,
 *     isWrite=true so the gate hash-chains audit.
 *   - bulk_action carries `requiresPolicyRuleLiteral=true` so the
 *     policy gate refuses any reason-resolver generalisation
 *     (per CLAUDE.md hard rule).
 *   - All WRITE tools inject chat provenance via withChatProvenance.
 *   - Handler bodies never log secrets — the HTTP client adapter
 *     redacts via the classification scrubber.
 *
 * Real-estate entity vocabulary differs from Borjie:
 *   share targets — lease_draft / lease / unit_listing / invoice /
 *                   statement / inspection / maintenance_case /
 *                   document / reminder / valuation_report.
 *   bulk targets  — leases / invoices / maintenance_cases / reminders /
 *                   inspections.
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const OWNER_AND_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

// ────────────────────────────────────────────────────────────────────
// 1) bossnyumba.ui.share_view — generate shareable link
// ────────────────────────────────────────────────────────────────────

const ShareInput = z
  .object({
    entityType: z.enum([
      'lease_draft',
      'lease',
      'unit_listing',
      'invoice',
      'statement',
      'inspection',
      'maintenance_case',
      'document',
      'reminder',
      'valuation_report',
    ]),
    entityId: z.string().min(1).max(120),
    recipients: z.array(z.string().email()).max(10).optional(),
    expiresInHours: z.number().int().min(1).max(720).default(168), // 7d default
    permission: z.enum(['read', 'comment', 'edit']).default('read'),
    reason: z.string().min(1).max(400).optional(),
  })
  .strict();

const ShareOutput = z
  .object({
    shareLinkId: z.string(),
    token: z.string(),
    url: z.string(),
    expiresAt: z.string(),
    dispatched: z.number().int().nonnegative(),
  })
  .strict();

export const uiShareViewTool: PersonaToolDescriptor<
  typeof ShareInput,
  typeof ShareOutput
> = {
  id: 'bossnyumba.ui.share_view',
  name: 'Generate a shareable link for an entity',
  description:
    'Mint a time-limited share token for a lease / unit listing / invoice ' +
    '/ statement / inspection report etc. Optionally dispatch the link to ' +
    "one or more recipients via email. Use when the owner asks to 'send " +
    "the April rent statement to my CPA', 'share this lease draft with my " +
    "co-owner', or 'send this maintenance invoice to the tenant'.",
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ShareInput,
  outputSchema: ShareOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      throw new Error('bossnyumba.ui.share_view requires httpClient');
    }
    const body = withChatProvenance(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        recipients: input.recipients ?? [],
        expiresInHours: input.expiresInHours,
        permission: input.permission,
        ...(input.reason && { reason: input.reason }),
      },
      ctx,
    );
    return client.post<{
      shareLinkId: string;
      token: string;
      url: string;
      expiresAt: string;
      dispatched: number;
    }>('/owner/share-links', body);
  },
};

// ────────────────────────────────────────────────────────────────────
// 2) bossnyumba.ui.bulk_action — operate on many entities at once
// ────────────────────────────────────────────────────────────────────

const BulkInput = z
  .object({
    entityType: z.enum([
      'leases',
      'invoices',
      'maintenance_cases',
      'reminders',
      'inspections',
    ]),
    ids: z.array(z.string().min(1).max(120)).min(1).max(100),
    action: z.enum([
      // leases.*
      'mark_rent_paid',
      'send_renewal_notice',
      // invoices.*
      'export_tax_statement',
      // maintenance_cases.*
      'close_ticket',
      'acknowledge',
      // reminders.*
      'snooze',
      // inspections.*
      'archive',
    ]),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    reason: z.string().min(1).max(400),
  })
  .strict();

const BulkOutput = z
  .object({
    accepted: z.boolean(),
    processed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    undoJournalIds: z.array(z.string()),
  })
  .strict();

export const uiBulkActionTool: PersonaToolDescriptor<
  typeof BulkInput,
  typeof BulkOutput
> = {
  id: 'bossnyumba.ui.bulk_action',
  name: 'Apply an action to many entities at once',
  description:
    'Operate on a batch of entities in one call. Allowed combinations: ' +
    'leases.mark_rent_paid, leases.send_renewal_notice, invoices.' +
    'export_tax_statement, maintenance_cases.close_ticket, ' +
    'maintenance_cases.acknowledge, reminders.snooze, inspections.archive. ' +
    'Owner sees a confirmation card listing the N entities + the action ' +
    "before it fires. Use when the owner asks 'mark April rent paid for " +
    "every Westlands lease' or 'snooze every reminder until next Monday'.",
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: BulkInput,
  outputSchema: BulkOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  // HIGH-risk policy prefix: bulk writes touch many rows and must hit
  // literal policy rules; no reason-resolver generalisation allowed
  // (CLAUDE.md hard rule).
  requiresPolicyRuleLiteral: true,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      throw new Error('bossnyumba.ui.bulk_action requires httpClient');
    }
    const body = withChatProvenance(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        entityType: input.entityType,
        ids: input.ids,
        action: input.action,
        payload: input.payload ?? {},
        reason: input.reason,
      },
      ctx,
    );
    return client.post<{
      accepted: boolean;
      processed: number;
      failed: number;
      undoJournalIds: string[];
    }>('/owner/superpowers/bulk-action', body);
  },
};

// ────────────────────────────────────────────────────────────────────
// 3) bossnyumba.ui.undo_last_action — reverse the most recent write
// ────────────────────────────────────────────────────────────────────

const UndoInput = z
  .object({
    entityRef: z
      .object({
        entityType: z.string().min(1).max(60),
        entityId: z.string().min(1).max(120),
      })
      .strict()
      .optional(),
    reason: z.string().min(1).max(400).optional(),
  })
  .strict();

const UndoOutput = z
  .object({
    undone: z.boolean(),
    journalId: z.string().nullable(),
    actionKind: z.string().nullable(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
  })
  .strict();

export const uiUndoLastActionTool: PersonaToolDescriptor<
  typeof UndoInput,
  typeof UndoOutput
> = {
  id: 'bossnyumba.ui.undo_last_action',
  name: 'Undo the most recent write within the 5-min window',
  description:
    'Reverse the most recent un-undone write the current actor made ' +
    'within the configured undo window (default 5 min). If `entityRef` ' +
    "is supplied, undoes the last action on that specific entity. " +
    'Replays the `before_state` snapshot from the undo journal. Use when ' +
    "the owner says 'undo that' or 'wait, undo the rent-paid mark on " +
    "Westlands 3-bed'.",
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: UndoInput,
  outputSchema: UndoOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      throw new Error('bossnyumba.ui.undo_last_action requires httpClient');
    }
    const body = withChatProvenance(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        ...(input.entityRef && { entityRef: input.entityRef }),
        ...(input.reason && { reason: input.reason }),
      },
      ctx,
    );
    return client.post<{
      undone: boolean;
      journalId: string | null;
      actionKind: string | null;
      entityType: string | null;
      entityId: string | null;
    }>('/owner/undo-journal/undo-last', body);
  },
};

// ────────────────────────────────────────────────────────────────────
// 4) bossnyumba.ui.prefill_form — fill a form from chat-derived data
// ────────────────────────────────────────────────────────────────────

const PrefillInput = z
  .object({
    formId: z.string().min(1).max(120),
    values: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
    submitOnAccept: z.boolean().optional().default(false),
    reason: z.string().min(1).max(400).optional(),
  })
  .strict();

const PrefillOutput = z
  .object({
    accepted: z.boolean(),
    formId: z.string(),
    valueCount: z.number().int().nonnegative(),
    emittedAt: z.string(),
  })
  .strict();

export const uiPrefillTool: PersonaToolDescriptor<
  typeof PrefillInput,
  typeof PrefillOutput
> = {
  id: 'bossnyumba.ui.prefill_form',
  name: 'Pre-fill a form from chat-derived data',
  description:
    'Push values into a specific form (by formId) that the owner has ' +
    "open or will open next. Owner sees a 'Mr. Mwikila pre-filled this' " +
    'pill at the top of the form and reviews before submitting. Use when ' +
    'data has been gathered conversationally and the form would otherwise ' +
    "force the owner to re-type — e.g. 'tenant gave me their move-in " +
    "date and emergency contact, prefill the lease form'.",
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: PrefillInput,
  outputSchema: PrefillOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      // No HTTP client — degrade to local ack so the chat flow still
      // emits the prefill chip via SSE. The audit chain still records
      // the WRITE because handler hash-chains via the gate.
      return {
        accepted: true,
        formId: input.formId,
        valueCount: Object.keys(input.values).length,
        emittedAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        formId: input.formId,
        values: input.values,
        submitOnAccept: input.submitOnAccept ?? false,
        ...(input.reason && { reason: input.reason }),
      },
      ctx,
    );
    const res = await client.post<{
      data?: {
        accepted?: boolean;
        formId?: string;
        valueCount?: number;
        emittedAt?: string;
      };
    }>('/owner/superpowers/prefill', body);
    const row = res.data ?? {};
    return {
      accepted: Boolean(row.accepted ?? true),
      formId: String(row.formId ?? input.formId),
      valueCount: Number(row.valueCount ?? Object.keys(input.values).length),
      emittedAt: String(row.emittedAt ?? new Date().toISOString()),
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// Catalog export — included by `buildPersonaToolHandlers` in index.ts.
// ────────────────────────────────────────────────────────────────────

export const SUPERPOWERS_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  uiShareViewTool,
  uiBulkActionTool,
  uiUndoLastActionTool,
  uiPrefillTool,
]);
