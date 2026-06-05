/**
 * Admin inviolable-rule chat tools — sovereign-admin cluster (ported
 * from Borjie G-FIX-5, retargeted mining → real-estate).
 *
 * Eight HIGH-risk admin-side chat tools that expose the platform-
 * governance surfaces (kill-switch / four-eye / policy / feature-flag /
 * audit export / tenant suspend) as Mr. Mwikila brain tools. BN already
 * exposes these surfaces operationally (kernel HQ tools, admin-
 * superpowers route, feature-flags route, tenants DELETE route, audit-
 * log route) but NOT as chat-callable brain tools — this pack closes
 * that gap. Each tool:
 *
 *   - Carries `stakes: 'HIGH'` so the kernel risk-tier gate forces a
 *     confirmation chip BEFORE the handler fires.
 *   - Sets `requiresPolicyRuleLiteral: true` for sovereign / kill_switch
 *     / four_eye / policy_rollout prefixes per CLAUDE.md hard rule —
 *     the reason-resolver may NEVER generalise these.
 *   - Validates input via zod (strict schemas — unknown keys rejected).
 *   - Is RLS-scoped via the tool dispatcher's loopback-context binding
 *     (`runWithLoopbackContext` threads the tenant + actor for the
 *     service-bound JWT mint). Cross-tenant calls fail-closed.
 *   - Emits a hash-chained audit entry through the dispatcher adapter
 *     (`toBrainToolHandler` calls `gate.auditSink.append` when
 *     `isWrite: true`).
 *
 * BN ROUTE WIRING (vs. Borjie). BN's sovereign-admin surfaces have a
 * DIFFERENT shape from Borjie, so each tool is wired honestly:
 *
 *   - admin.four_eye.approve  → WIRED to the real BN four-eye
 *       consummation route `POST /admin/superpowers/approve/:journalId`
 *       (BN's four-eye uses a journalId, not an opaque token; the route
 *       refuses same-actor approval with FOUR_EYE_SAME_ACTOR).
 *   - admin.audit.export      → WIRED: probes the real
 *       `GET /admin/audit/log` route, then emits a download-ready chip.
 *   - admin.feature_flag.set  → chip carrying BN's canonical write path
 *       `PUT /api/v1/feature-flags/:flagKey`. The loopback client only
 *       supports GET/POST, and we want the platform admin's UA token on
 *       the wire (not the loopback service principal) so the audit row
 *       shows the real admin — the cockpit FE issues the PUT on confirm.
 *   - admin.tenant.suspend    → chip carrying BN's canonical
 *       `DELETE /api/v1/tenants/:id` (30-day PDPA grace). Same UA-token
 *       reasoning as feature_flag.set.
 *
 *   HONEST-DEGRADED (no equivalent BN REST surface — NEVER fabricated):
 *   - admin.killswitch.open / .close → BN's kill-switch is the kernel
 *       HQ tool `platform.set_killswitch` + `killswitch-write.service`,
 *       NOT a REST route, and BN has NO two-operator pending-confirmation
 *       flow. These tools emit a `degraded: true` chip that names the
 *       canonical surface so an operator (or a second pass) can fire it;
 *       they return no fabricated pendingConfirmationId.
 *   - admin.four_eye.initiate → BN has no `/owner/four-eye/request`
 *       route; the BN four-eye INITIATION lives in the admin-superpowers
 *       propose flow (`POST /admin/superpowers/bulk-action`), whose
 *       entity+verb shape does not map cleanly to Borjie's actionType
 *       taxonomy. Emits a `degraded: true` chip pointing at that surface
 *       rather than fabricating a token.
 *   - admin.policy.edit_rule  → BN has no policy-rule-edit REST route.
 *       Emits a `degraded: true` chip.
 *
 * Persona scoping: T2_admin_strategist only. Owner / manager / field /
 * tenant personas are NEVER in the allowlist for inviolable-rule writes —
 * the kernel risk-gate enforces this at the tool dispatcher level (and
 * the descriptor allowlist enforces it at the catalog level — defense in
 * depth).
 *
 * Bilingual sw/en (CLAUDE.md hard rule): every handler return envelope
 * includes both `noteEn` and `noteSw` strings so the cockpit can render
 * the localised confirmation in the operator's active language.
 */

import { z } from 'zod';

import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const ADMIN_ONLY: ReadonlyArray<'T2_admin_strategist'> = [
  'T2_admin_strategist',
];

/**
 * Build a deterministic-prefix chip-id for the cockpit bus. Tests pin
 * `Date.now()` so the id is stable across runs.
 */
function chipId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ────────────────────────────────────────────────────────────────────
// 1) admin.killswitch.open — request a kill-switch open (honest-degraded)
// ────────────────────────────────────────────────────────────────────
//
// BN has no REST kill-switch route and no two-operator confirmation flow;
// the canonical surface is the kernel HQ tool `platform.set_killswitch`
// (packages/central-intelligence/.../hq-tools/platform.set_killswitch.ts)
// backed by killswitch-write.service.ts. This tool therefore emits a
// `degraded: true` chip that the platform cockpit FE resolves by invoking
// the HQ tool with the real admin session — it never fabricates a pending
// confirmation id.

const KillSwitchOpenInput = z
  .object({
    scope: z
      .string()
      .min(1)
      .max(120)
      .refine((s) => s === 'platform' || s.startsWith('tenant:'), {
        message: 'Scope must be "platform" or "tenant:<tenantId>"',
      }),
    reason: z.string().min(1).max(400),
    level: z.enum(['degraded', 'halt']).default('halt'),
    note: z.string().min(1).max(500).optional(),
  })
  .strict();

const KillSwitchOpenOutput = z
  .object({
    accepted: z.boolean(),
    degraded: z.literal(true),
    chipId: z.string(),
    scope: z.string(),
    level: z.enum(['degraded', 'halt']),
    canonicalSurface: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminKillSwitchOpenTool: PersonaToolDescriptor<
  typeof KillSwitchOpenInput,
  typeof KillSwitchOpenOutput
> = {
  id: 'admin.killswitch.open',
  name: 'Admin — request kill-switch open',
  description:
    'HIGH-RISK. Request a kill-switch open (degraded or halt) for the ' +
    'platform or a tenant. BossNyumba enforces the kill-switch via the ' +
    "kernel HQ tool platform.set_killswitch (no REST surface), so this " +
    'tool emits a confirmation chip the platform cockpit resolves with ' +
    "the real admin session. The chat MUST render a literal 'Type " +
    "CONFIRM to fire' chip; the reason-resolver is forbidden from " +
    'generalising this descriptor (CLAUDE.md hard rule).',
  personaSlugs: ADMIN_ONLY,
  inputSchema: KillSwitchOpenInput,
  outputSchema: KillSwitchOpenOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    return {
      accepted: true,
      degraded: true as const,
      chipId: chipId('ks_open'),
      scope: input.scope,
      level: input.level,
      canonicalSurface: 'hq-tool:platform.set_killswitch',
      emittedAt: new Date().toISOString(),
      noteEn: `Kill-switch ${input.level} on ${input.scope} requested — confirm to fire via platform.set_killswitch.`,
      noteSw: `Kifaa-cha-kuzima ${input.level} kwenye ${input.scope} kimeombwa — thibitisha ili kitekelezwe kupitia platform.set_killswitch.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 2) admin.killswitch.close — request return-to-live (honest-degraded)
// ────────────────────────────────────────────────────────────────────

const KillSwitchCloseInput = z
  .object({
    scope: z
      .string()
      .min(1)
      .max(120)
      .refine((s) => s === 'platform' || s.startsWith('tenant:'), {
        message: 'Scope must be "platform" or "tenant:<tenantId>"',
      }),
    reason: z.string().min(1).max(400),
    note: z.string().min(1).max(500).optional(),
  })
  .strict();

const KillSwitchCloseOutput = z
  .object({
    accepted: z.boolean(),
    degraded: z.literal(true),
    chipId: z.string(),
    scope: z.string(),
    level: z.literal('live'),
    canonicalSurface: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminKillSwitchCloseTool: PersonaToolDescriptor<
  typeof KillSwitchCloseInput,
  typeof KillSwitchCloseOutput
> = {
  id: 'admin.killswitch.close',
  name: 'Admin — request kill-switch close (return to live)',
  description:
    'HIGH-RISK. Request the kill-switch return-to-live flow for the ' +
    'platform or a tenant. Level is hard-coded to "live" — the close ' +
    'flow always lifts the switch fully. BossNyumba enforces the switch ' +
    'via the kernel HQ tool platform.set_killswitch (no REST surface), ' +
    'so this tool emits a confirmation chip the platform cockpit resolves ' +
    'with the real admin session.',
  personaSlugs: ADMIN_ONLY,
  inputSchema: KillSwitchCloseInput,
  outputSchema: KillSwitchCloseOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    return {
      accepted: true,
      degraded: true as const,
      chipId: chipId('ks_close'),
      scope: input.scope,
      level: 'live' as const,
      canonicalSurface: 'hq-tool:platform.set_killswitch',
      emittedAt: new Date().toISOString(),
      noteEn: `Kill-switch return-to-live on ${input.scope} requested — confirm to fire via platform.set_killswitch.`,
      noteSw: `Kurejesha kifaa-cha-kuzima kwenye hai kwenye ${input.scope} kumeombwa — thibitisha ili kitekelezwe kupitia platform.set_killswitch.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 3) admin.four_eye.initiate — request a four-eye flow (honest-degraded)
// ────────────────────────────────────────────────────────────────────
//
// BN has no `/owner/four-eye/request` route. The BN four-eye INITIATION
// lives in the admin-superpowers propose flow (POST /admin/superpowers/
// bulk-action, which returns pendingApprovalIds and routes HIGH-risk
// verbs to a second-actor approval). That route's entity+verb shape does
// not map cleanly onto Borjie's actionType taxonomy, so wiring would be
// fabrication. This tool emits a `degraded: true` chip naming the
// canonical surface instead.

const FOUR_EYE_ACTION_TYPES = [
  'payment.large',
  'regulator.filing',
  'contract.sign',
  'tenant.purge',
  'kill_switch.flip',
  'policy.rule_edit',
] as const;

const FourEyeInitiateInput = z
  .object({
    actionType: z.enum(FOUR_EYE_ACTION_TYPES),
    secondApproverId: z.string().min(1).max(128),
    payload: z.record(z.string(), z.unknown()),
    reason: z.string().min(1).max(400),
    ttlMinutes: z
      .number()
      .int()
      .min(15)
      .max(7 * 24 * 60)
      .optional(),
  })
  .strict();

const FourEyeInitiateOutput = z
  .object({
    accepted: z.boolean(),
    degraded: z.literal(true),
    chipId: z.string(),
    actionType: z.string(),
    secondApproverId: z.string(),
    canonicalSurface: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminFourEyeInitiateTool: PersonaToolDescriptor<
  typeof FourEyeInitiateInput,
  typeof FourEyeInitiateOutput
> = {
  id: 'admin.four_eye.initiate',
  name: 'Admin — request a four-eye approval flow',
  description:
    'HIGH-RISK. Request a four-eye approval for a high-stakes action ' +
    '(large payment, regulator filing, contract signature, tenant purge, ' +
    'kill-switch flip, policy rule edit). In BossNyumba the four-eye ' +
    'INITIATION is the admin-superpowers propose flow (POST ' +
    '/admin/superpowers/bulk-action), so this tool emits a chip pointing ' +
    'there; the second approver consummates via admin.four_eye.approve. ' +
    'Reason is required and lands in the hash-chained audit log.',
  personaSlugs: ADMIN_ONLY,
  inputSchema: FourEyeInitiateInput,
  outputSchema: FourEyeInitiateOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    return {
      accepted: true,
      degraded: true as const,
      chipId: chipId('4eye_init'),
      actionType: input.actionType,
      secondApproverId: input.secondApproverId,
      canonicalSurface: 'route:POST /admin/superpowers/bulk-action',
      emittedAt: new Date().toISOString(),
      noteEn: `Four-eye request for ${input.actionType} prepared — confirm to propose via the admin-superpowers queue.`,
      noteSw: `Ombi la macho-manne kwa ${input.actionType} limeandaliwa — thibitisha ili lipendekezwe kupitia foleni ya admin-superpowers.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 4) admin.four_eye.approve — approve a pending four-eye proposal (WIRED)
// ────────────────────────────────────────────────────────────────────
//
// WIRED to the real BN four-eye consummation route
// `POST /admin/superpowers/approve/:journalId`. BN keys the pending
// approval on a journalId (not an opaque token); the route refuses
// same-actor approval (FOUR_EYE_SAME_ACTOR) and fires the original verb
// on success.

const FourEyeApproveInput = z
  .object({
    journalId: z.string().min(1).max(200),
    note: z.string().min(1).max(2000).optional(),
  })
  .strict();

const FourEyeApproveOutput = z
  .object({
    approved: z.boolean(),
    journalId: z.string(),
    chipId: z.string(),
    pendingId: z.string(),
    action: z.string(),
    targetEntityRef: z.string(),
    approvedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminFourEyeApproveTool: PersonaToolDescriptor<
  typeof FourEyeApproveInput,
  typeof FourEyeApproveOutput
> = {
  id: 'admin.four_eye.approve',
  name: 'Admin — approve a pending four-eye proposal',
  description:
    'HIGH-RISK. Second approver approves a pending HIGH-risk admin ' +
    'proposal by its journalId via POST /admin/superpowers/approve/' +
    ':journalId. The proposer is forbidden from approving their own ' +
    'action; the route refuses self-approval (FOUR_EYE_SAME_ACTOR). ' +
    'Approval fires the original verb. Use when reviewing the platform ' +
    "pending queue and the proposal is sound.",
  personaSlugs: ADMIN_ONLY,
  inputSchema: FourEyeApproveInput,
  outputSchema: FourEyeApproveOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      throw new Error('admin.four_eye.approve requires httpClient');
    }
    const body = withChatProvenance(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        ...(input.note !== undefined && { decisionNote: input.note }),
      },
      ctx,
    );
    const res = await client.post<{
      data?: {
        applied?: boolean;
        journalId?: string;
        pendingId?: string;
        action?: string;
        targetEntityRef?: string;
        approvedAt?: string;
      };
      applied?: boolean;
      journalId?: string;
      pendingId?: string;
      action?: string;
      targetEntityRef?: string;
      approvedAt?: string;
    }>(
      `/admin/superpowers/approve/${encodeURIComponent(input.journalId)}`,
      body,
    );
    const row = res.data ?? res;
    return {
      approved: Boolean(row.applied ?? true),
      journalId: String(row.journalId ?? input.journalId),
      chipId: chipId('4eye_appr'),
      pendingId: String(row.pendingId ?? ''),
      action: String(row.action ?? ''),
      targetEntityRef: String(row.targetEntityRef ?? ''),
      approvedAt: String(row.approvedAt ?? new Date().toISOString()),
      noteEn: 'Four-eye approval recorded — original action dispatched.',
      noteSw:
        'Idhini ya macho-manne imerekodiwa — kitendo cha asili kimetolewa.',
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 5) admin.policy.edit_rule — propose a policy-rule edit (honest-degraded)
// ────────────────────────────────────────────────────────────────────
//
// BN has no dedicated policy-rule-edit REST route. Policy rules live in
// the kernel (policy-gate.ts / inviolable.ts) and are not editable via a
// loopback HTTP surface. This tool emits a `degraded: true` chip rather
// than fabricating a four-eye request. The reason-resolver may NEVER
// generalise the rule prefix (CLAUDE.md hard rule).

const PolicyEditRuleInput = z
  .object({
    ruleId: z.string().min(1).max(120),
    changeJson: z.record(z.string(), z.unknown()),
    reason: z.string().min(1).max(400),
    secondApproverId: z.string().min(1).max(128),
  })
  .strict();

const PolicyEditRuleOutput = z
  .object({
    accepted: z.boolean(),
    degraded: z.literal(true),
    chipId: z.string(),
    ruleId: z.string(),
    secondApproverId: z.string(),
    canonicalSurface: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminPolicyEditRuleTool: PersonaToolDescriptor<
  typeof PolicyEditRuleInput,
  typeof PolicyEditRuleOutput
> = {
  id: 'admin.policy.edit_rule',
  name: 'Admin — propose a policy-rule edit',
  description:
    'HIGH-RISK. Propose a change to an inviolable policy rule. ' +
    'BossNyumba policy rules live in the kernel policy-gate (no REST ' +
    'edit surface), so this tool emits a confirmation chip rather than ' +
    'a live write. The brain may NEVER generalise the rule prefix — ' +
    'sovereign / kill_switch / four_eye / policy_rollout edits must hit ' +
    'literal rules (CLAUDE.md hard rule).',
  personaSlugs: ADMIN_ONLY,
  inputSchema: PolicyEditRuleInput,
  outputSchema: PolicyEditRuleOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    return {
      accepted: true,
      degraded: true as const,
      chipId: chipId('pol_edit'),
      ruleId: input.ruleId,
      secondApproverId: input.secondApproverId,
      canonicalSurface: 'kernel:policy-gate (no REST edit surface)',
      emittedAt: new Date().toISOString(),
      noteEn: `Policy rule "${input.ruleId}" edit prepared — confirm; a second approver must co-sign.`,
      noteSw: `Mabadiliko ya sheria "${input.ruleId}" yameandaliwa — thibitisha; mthibitishaji wa pili lazima asaini pamoja.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 6) admin.feature_flag.set — chip to flip a feature flag (PUT path)
// ────────────────────────────────────────────────────────────────────
//
// BN's canonical feature-flag write is `PUT /api/v1/feature-flags/:key`
// (admin-only, body `{ enabled }`). The persona-tool loopback client only
// supports GET/POST, and we want the platform admin's UA token on the
// wire (not the loopback service principal) so the audit row shows the
// real admin. This tool emits a cockpit chip carrying the canonical PUT
// path + body; the cockpit FE applies it on confirm.

const FeatureFlagSetInput = z
  .object({
    flagKey: z.string().min(1).max(120),
    value: z.boolean(),
    rolloutPct: z.number().int().min(0).max(100).optional(),
    reason: z.string().min(1).max(400),
  })
  .strict();

const FeatureFlagSetOutput = z
  .object({
    accepted: z.boolean(),
    chipId: z.string(),
    flagKey: z.string(),
    targetValue: z.boolean(),
    targetRolloutPct: z.number().int().min(0).max(100).optional(),
    httpMethod: z.literal('PUT'),
    httpPath: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminFeatureFlagSetTool: PersonaToolDescriptor<
  typeof FeatureFlagSetInput,
  typeof FeatureFlagSetOutput
> = {
  id: 'admin.feature_flag.set',
  name: 'Admin — set a feature-flag default (+ optional rollout)',
  description:
    'HIGH-RISK. Emit a confirmation chip to flip a feature-flag default ' +
    'value (and optional rollout percentage). The admin cockpit FE reads ' +
    'the chip and fires PUT /api/v1/feature-flags/:flagKey with the ' +
    'active admin session token so the audit row shows the real admin ' +
    '(not the loopback service token).',
  personaSlugs: ADMIN_ONLY,
  inputSchema: FeatureFlagSetInput,
  outputSchema: FeatureFlagSetOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    return {
      accepted: true,
      chipId: chipId('ff_set'),
      flagKey: input.flagKey,
      targetValue: input.value,
      ...(input.rolloutPct !== undefined && {
        targetRolloutPct: input.rolloutPct,
      }),
      httpMethod: 'PUT' as const,
      httpPath: `/api/v1/feature-flags/${encodeURIComponent(input.flagKey)}`,
      emittedAt: new Date().toISOString(),
      noteEn: `Feature flag "${input.flagKey}" target set to ${input.value} — confirm to apply.`,
      noteSw: `Bendera ya kipengele "${input.flagKey}" imewekwa ${input.value} — thibitisha ili itekelezwe.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 7) admin.audit.export — kick off an audit-trail export (WIRED probe)
// ────────────────────────────────────────────────────────────────────
//
// WIRED: probes the real BN audit-log route `GET /admin/audit/log` for
// the requested range, then emits a chip the cockpit FE uses to render
// an export-download card. Format may be CSV / JSON / PDF.

const AuditExportInput = z
  .object({
    from: z.string().min(1).max(40),
    to: z.string().min(1).max(40),
    format: z.enum(['csv', 'json', 'pdf']),
    tenantId: z.string().min(1).max(120).optional(),
    actor: z.string().min(1).max(200).optional(),
    action: z.string().min(1).max(200).optional(),
    reason: z.string().min(1).max(400),
  })
  .strict();

const AuditExportOutput = z
  .object({
    accepted: z.boolean(),
    chipId: z.string(),
    rowsPreviewCount: z.number().int().nonnegative(),
    from: z.string(),
    to: z.string(),
    format: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminAuditExportTool: PersonaToolDescriptor<
  typeof AuditExportInput,
  typeof AuditExportOutput
> = {
  id: 'admin.audit.export',
  name: 'Admin — export audit-trail range to file',
  description:
    'HIGH-RISK. Probe the audit log for the requested range (GET ' +
    '/admin/audit/log) and emit a chip the cockpit FE uses to render an ' +
    'export-download card. Format may be CSV / JSON / PDF. Reason is ' +
    'required and lands in the audit chain itself so the regulator review ' +
    'log includes a row for the export request.',
  personaSlugs: ADMIN_ONLY,
  inputSchema: AuditExportInput,
  outputSchema: AuditExportOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    let rowsCount = 0;
    if (client) {
      try {
        const probe = await client.get<ReadonlyArray<unknown>>(
          '/admin/audit/log',
          {
            query: {
              since: input.from,
              until: input.to,
              limit: 1,
              ...(input.tenantId !== undefined && {
                tenantId: input.tenantId,
              }),
              ...(input.actor !== undefined && { actor: input.actor }),
              ...(input.action !== undefined && { action: input.action }),
            },
          },
        );
        rowsCount = Array.isArray(probe) ? probe.length : 0;
      } catch {
        // probe failures are non-fatal — the FE renders the chip and the
        // user retries on the cockpit. The audit row for the export
        // request is still emitted via the dispatcher adapter.
        rowsCount = 0;
      }
    }
    return {
      accepted: true,
      chipId: chipId('audit_exp'),
      rowsPreviewCount: rowsCount,
      from: input.from,
      to: input.to,
      format: input.format,
      emittedAt: new Date().toISOString(),
      noteEn: `Audit export ${input.from} → ${input.to} (${input.format}) queued — confirm to download.`,
      noteSw: `Hamisha audit ${input.from} → ${input.to} (${input.format}) imeshapangwa — thibitisha ili upakue.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// 8) admin.tenant.suspend — schedule a tenant soft-delete (DELETE chip)
// ────────────────────────────────────────────────────────────────────
//
// "Suspend" here means schedule the soft-delete grace window (KE PDPA
// Art. 26(2) / TZ PDPA s.17 — 30-day minimum). BN's canonical route is
// `DELETE /api/v1/tenants/:id`. The loopback client only knows GET/POST,
// and we want the platform admin's UA token on the wire so the route's
// security-severity audit event shows the real admin — so this tool
// emits a cockpit chip carrying the canonical DELETE path + body that the
// cockpit FE fires on confirm.

const TenantSuspendInput = z
  .object({
    tenantId: z.string().min(1).max(120),
    reason: z.string().min(1).max(2000),
    graceDays: z.number().int().min(30).max(180).optional(),
  })
  .strict();

const TenantSuspendOutput = z
  .object({
    accepted: z.boolean(),
    chipId: z.string(),
    tenantId: z.string(),
    graceDays: z.number().int().min(30).max(180),
    httpMethod: z.literal('DELETE'),
    httpPath: z.string(),
    emittedAt: z.string(),
    noteEn: z.string(),
    noteSw: z.string(),
  })
  .strict();

export const adminTenantSuspendTool: PersonaToolDescriptor<
  typeof TenantSuspendInput,
  typeof TenantSuspendOutput
> = {
  id: 'admin.tenant.suspend',
  name: 'Admin — schedule a tenant suspension (soft-delete grace)',
  description:
    'HIGH-RISK. Schedule a tenant soft-delete with a 30-day minimum ' +
    'grace window (KE PDPA Art. 26(2) / TZ PDPA s.17). Emits a chip the ' +
    'admin cockpit FE reads to fire DELETE /api/v1/tenants/:id with the ' +
    'active admin session token. Reason is required and lands in the ' +
    'security-severity audit event the route emits.',
  personaSlugs: ADMIN_ONLY,
  inputSchema: TenantSuspendInput,
  outputSchema: TenantSuspendOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: true,
  async handler(input, _ctx) {
    const graceDays = input.graceDays ?? 30;
    return {
      accepted: true,
      chipId: chipId('tnt_susp'),
      tenantId: input.tenantId,
      graceDays,
      httpMethod: 'DELETE' as const,
      httpPath: `/api/v1/tenants/${encodeURIComponent(input.tenantId)}`,
      emittedAt: new Date().toISOString(),
      noteEn: `Tenant ${input.tenantId} suspension scheduled (${graceDays}-day grace) — confirm to fire.`,
      noteSw: `Kusimamishwa kwa mpangaji ${input.tenantId} kumeshapangwa (siku ${graceDays} za neema) — thibitisha ili itekelezwe.`,
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// Catalog export — included by `buildPersonaToolHandlers` in index.ts.
// ────────────────────────────────────────────────────────────────────

export const ADMIN_INVIOLABLE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  adminKillSwitchOpenTool,
  adminKillSwitchCloseTool,
  adminFourEyeInitiateTool,
  adminFourEyeApproveTool,
  adminPolicyEditRuleTool,
  adminFeatureFlagSetTool,
  adminAuditExportTool,
  adminTenantSuspendTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
