/**
 * Communications domain skills:
 *  - skill.comms.draft_tenant_notice — wrapper that extends swahili_draft
 *    with multi-channel targeting (whatsapp/sms/email) + delivery preview
 *  - skill.comms.draft_campaign      — vacancy / lead-nurture campaign plan
 */

import { z } from 'zod';
import { ToolHandler } from '../../orchestrator/tool-dispatcher.js';
import { draftNotice, NoticeKindSchema, LocaleSchema } from '../kenya/swahili-draft.js';

// ---------------------------------------------------------------------------
// skill.comms.draft_tenant_notice
// ---------------------------------------------------------------------------

export const ChannelSchema = z.enum(['whatsapp', 'sms', 'email']);
export type Channel = z.infer<typeof ChannelSchema>;

export const TenantNoticeParamsSchema = z.object({
  kind: NoticeKindSchema,
  locale: LocaleSchema.default('sw'),
  recipients: z.array(
    z.object({
      tenantId: z.string().min(1),
      tenantName: z.string().min(1),
      unitLabel: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      preferredChannel: ChannelSchema.optional(),
    })
  ),
  defaults: z.object({
    amountKes: z.number().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    reason: z.string().optional(),
    propertyName: z.string().optional(),
  }).default({}),
  defaultChannel: ChannelSchema.default('whatsapp'),
});

export interface TenantNoticeDraft {
  tenantId: string;
  tenantName: string;
  channel: Channel;
  subject: string;
  body: string;
  /** For SMS, body is auto-truncated to 160 chars and flagged. */
  truncated?: boolean;
}

export interface TenantNoticeBatch {
  kind: string;
  locale: string;
  drafts: TenantNoticeDraft[];
  byChannel: Record<Channel, number>;
  recipientsWithoutContact: string[];
}

export function draftTenantNotices(
  params: z.infer<typeof TenantNoticeParamsSchema>
): TenantNoticeBatch {
  const byChannel: Record<Channel, number> = { whatsapp: 0, sms: 0, email: 0 };
  const recipientsWithoutContact: string[] = [];
  const drafts: TenantNoticeDraft[] = [];

  for (const r of params.recipients) {
    const channel =
      r.preferredChannel ??
      (r.phone ? params.defaultChannel : r.email ? 'email' : params.defaultChannel);

    if (
      (channel === 'email' && !r.email) ||
      ((channel === 'whatsapp' || channel === 'sms') && !r.phone)
    ) {
      recipientsWithoutContact.push(r.tenantId);
      continue;
    }

    const notice = draftNotice({
      kind: params.kind,
      locale: params.locale,
      tenantName: r.tenantName,
      unitLabel: r.unitLabel,
      amountKes: params.defaults.amountKes,
      date: params.defaults.date,
      time: params.defaults.time,
      reason: params.defaults.reason,
      propertyName: params.defaults.propertyName,
    });

    let body = notice.body;
    let truncated = false;
    if (channel === 'sms' && body.length > 160) {
      body = body.slice(0, 157) + '...';
      truncated = true;
    }

    byChannel[channel]++;
    drafts.push({
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      channel,
      subject: notice.subject,
      body,
      truncated: truncated || undefined,
    });
  }

  return {
    kind: params.kind,
    locale: params.locale,
    drafts,
    byChannel,
    recipientsWithoutContact,
  };
}

export const draftTenantNoticeTool: ToolHandler = {
  name: 'skill.comms.draft_tenant_notice',
  description:
    'Draft a tenant notice batch across multiple recipients in Swahili/English/Sheng, routed to WhatsApp/SMS/Email. SMS auto-truncates to 160 chars. Flags recipients with no contact channel.',
  parameters: {
    type: 'object',
    required: ['kind', 'recipients'],
    properties: {
      kind: { type: 'string' },
      locale: { type: 'string' },
      recipients: { type: 'array', items: { type: 'object' } },
      defaults: { type: 'object' },
      defaultChannel: { type: 'string' },
    },
  },
  async execute(params) {
    const parsed = TenantNoticeParamsSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const result = draftTenantNotices(parsed.data);
    return {
      ok: true,
      data: result,
      evidenceSummary: `Drafted ${result.drafts.length} notices (${result.kind}, ${result.locale}); ${result.recipientsWithoutContact.length} skipped (no contact).`,
    };
  },
};

// ---------------------------------------------------------------------------
// skill.comms.draft_campaign
// ---------------------------------------------------------------------------

export const CampaignParamsSchema = z.object({
  goal: z.enum(['vacancy_fill', 'lead_nurture', 'owner_acquisition', 'renewal_push']),
  targetAudienceSize: z.number().int().positive().default(100),
  channels: z.array(ChannelSchema).min(1).default(['whatsapp']),
  propertyName: z.string().default('BossNyumba'),
  startDate: z.string().optional(),
  budgetKes: z.number().nonnegative().default(0),
  locale: LocaleSchema.default('sw'),
});

export interface CampaignStep {
  step: number;
  daysFromStart: number;
  channel: Channel;
  intent: string;
  messageTemplate: string;
  expectedResponseRate: number;
}

export interface CampaignPlan {
  goal: string;
  steps: CampaignStep[];
  estimatedConversion: number;
  estimatedCostKes: number;
  kpis: string[];
}

const BASE_TEMPLATES: Record<
  'vacancy_fill' | 'lead_nurture' | 'owner_acquisition' | 'renewal_push',
  CampaignStep[]
> = {
  vacancy_fill: [
    { step: 1, daysFromStart: 0, channel: 'whatsapp', intent: 'introduce', messageTemplate: 'Announce vacancy + unique value prop', expectedResponseRate: 0.12 },
    { step: 2, daysFromStart: 3, channel: 'whatsapp', intent: 'incentive', messageTemplate: 'Share viewing incentive (early-bird discount)', expectedResponseRate: 0.18 },
    { step: 3, daysFromStart: 7, channel: 'sms', intent: 'scarcity', messageTemplate: 'Reinforce scarcity (X units left)', expectedResponseRate: 0.08 },
    { step: 4, daysFromStart: 14, channel: 'whatsapp', intent: 'social_proof', messageTemplate: 'Share resident testimonial', expectedResponseRate: 0.1 },
  ],
  lead_nurture: [
    { step: 1, daysFromStart: 0, channel: 'whatsapp', intent: 'welcome', messageTemplate: 'Welcome + set expectations', expectedResponseRate: 0.4 },
    { step: 2, daysFromStart: 2, channel: 'whatsapp', intent: 'qualify', messageTemplate: 'Ask 3 qualifying questions', expectedResponseRate: 0.3 },
    { step: 3, daysFromStart: 5, channel: 'email', intent: 'content', messageTemplate: 'Neighborhood guide', expectedResponseRate: 0.12 },
    { step: 4, daysFromStart: 9, channel: 'whatsapp', intent: 'cta', messageTemplate: 'Schedule viewing', expectedResponseRate: 0.15 },
  ],
  owner_acquisition: [
    { step: 1, daysFromStart: 0, channel: 'email', intent: 'introduce', messageTemplate: 'BossNyumba value prop for owners', expectedResponseRate: 0.06 },
    { step: 2, daysFromStart: 5, channel: 'whatsapp', intent: 'proof', messageTemplate: 'Case study + ROI numbers', expectedResponseRate: 0.08 },
    { step: 3, daysFromStart: 14, channel: 'whatsapp', intent: 'cta', messageTemplate: 'Book a 15-min consult', expectedResponseRate: 0.05 },
  ],
  renewal_push: [
    { step: 1, daysFromStart: 0, channel: 'whatsapp', intent: 'invite', messageTemplate: 'Lease renewal invitation', expectedResponseRate: 0.35 },
    { step: 2, daysFromStart: 7, channel: 'whatsapp', intent: 'terms', messageTemplate: 'Share renewal terms + incentive', expectedResponseRate: 0.25 },
    { step: 3, daysFromStart: 14, channel: 'email', intent: 'formal', messageTemplate: 'Formal renewal offer', expectedResponseRate: 0.4 },
  ],
};

export function buildCampaign(
  params: z.infer<typeof CampaignParamsSchema>
): CampaignPlan {
  const baseSteps = BASE_TEMPLATES[params.goal];
  // Filter to channels the campaign supports.
  const steps = baseSteps
    .filter((s) => params.channels.includes(s.channel))
    .map((s, i) => ({ ...s, step: i + 1 }));

  const conversion = steps.reduce(
    (acc, s) => acc + (1 - acc) * s.expectedResponseRate * 0.3,
    0
  );

  // Estimate channel cost per message (KES) — conservative.
  const costPerMsg: Record<Channel, number> = { whatsapp: 2, sms: 1.5, email: 0.3 };
  const costPerStep = steps.reduce(
    (s, step) => s + costPerMsg[step.channel] * params.targetAudienceSize,
    0
  );
  const estimatedCostKes = costPerStep;

  return {
    goal: params.goal,
    steps,
    estimatedConversion: conversion,
    estimatedCostKes,
    kpis: [
      'response_rate_per_step',
      'click_through_rate',
      'viewings_booked',
      'conversions',
      'cost_per_conversion_kes',
    ],
  };
}

export const draftCampaignTool: ToolHandler = {
  name: 'skill.comms.draft_campaign',
  description:
    'Build a multi-step communications campaign plan for vacancy fill / lead nurture / owner acquisition / renewal push. Returns step sequence, conversion estimate, cost, KPIs.',
  parameters: {
    type: 'object',
    required: ['goal'],
    properties: {
      goal: {
        type: 'string',
        enum: ['vacancy_fill', 'lead_nurture', 'owner_acquisition', 'renewal_push'],
      },
      targetAudienceSize: { type: 'number' },
      channels: { type: 'array', items: { type: 'string' } },
      propertyName: { type: 'string' },
      startDate: { type: 'string' },
      budgetKes: { type: 'number' },
      locale: { type: 'string' },
    },
  },
  async execute(params) {
    const parsed = CampaignParamsSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const result = buildCampaign(parsed.data);
    return {
      ok: true,
      data: result,
      evidenceSummary: `${result.goal} campaign: ${result.steps.length} steps; est ${(result.estimatedConversion * 100).toFixed(1)}% conversion; ~KES ${result.estimatedCostKes.toFixed(0)} cost.`,
    };
  },
};

export const COMMS_SKILL_TOOLS: ToolHandler[] = [
  draftTenantNoticeTool,
  draftCampaignTool,
];
