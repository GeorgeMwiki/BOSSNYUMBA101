/**
 * KraFilingProfileCardView — status, due-date, payload preview,
 * action buttons for a KRA filing.
 *
 * The owner asks "show me my next KRA filing". The MD picks this
 * view, fetches the matching filing entity, and emits a
 * `markdown-card` (the profile body) plus a `prompt-suggestions`
 * block (the action affordances).
 *
 * Jurisdiction-aware: the registered `jurisdiction` attribute on
 * the J1 `kra-filing` entity drives which tax-authority labels
 * appear (KRA / TRA / URA). The renderer uses `data.authorityLabel`
 * — the fetcher resolves the jurisdiction → label mapping. We do
 * NOT hard-code "Kenya Revenue Authority" anywhere in the view.
 *
 * Action buttons emit `tool` actions back to the MD. The MD then
 * runs the appropriate filing-tool (file, defer, dispute, attach-
 * evidence) and the action receipt flows back into the chat.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type KraFilingStatus =
  | 'draft'
  | 'review-required'
  | 'submitted'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'closed';

export interface KraFilingQuery {
  readonly filingId?: string;
  readonly status?: KraFilingStatus;
}

export interface KraFilingData {
  readonly id: string;
  readonly authorityLabel: string;
  readonly jurisdiction: string;
  readonly filingPeriod: string;
  readonly filingTypeLabel: string;
  readonly status: KraFilingStatus;
  readonly dueDate: string;
  readonly amountDueCents: number;
  readonly currency: string;
  readonly summary: string;
  readonly payloadPreview: string;
  readonly attachmentsCount: number;
}

const ALLOWED_STATUSES: readonly KraFilingStatus[] = [
  'draft',
  'review-required',
  'submitted',
  'paid',
  'overdue',
  'disputed',
  'closed',
];

function validateKraFilingQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<KraFilingQuery> {
  if (query === undefined || query === null) {
    return { ok: true, query: {} };
  }
  if (typeof query !== 'object') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'query must be an object or null' },
    };
  }
  const q = query as Record<string, unknown>;

  const filingId = q['filingId'];
  if (filingId !== undefined && typeof filingId !== 'string') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'filingId must be a string' },
    };
  }

  const status = q['status'];
  if (status !== undefined && !ALLOWED_STATUSES.includes(status as KraFilingStatus)) {
    return {
      ok: false,
      reason: {
        kind: 'unknown-field',
        message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      },
    };
  }

  const out: KraFilingQuery = {
    ...(typeof filingId === 'string' ? { filingId } : {}),
    ...(typeof status === 'string' ? { status: status as KraFilingStatus } : {}),
  };
  return { ok: true, query: out };
}

function severityFor(status: KraFilingStatus): 'info' | 'warning' | 'success' | 'danger' {
  switch (status) {
    case 'paid':
    case 'closed':
      return 'success';
    case 'review-required':
      return 'warning';
    case 'overdue':
    case 'disputed':
      return 'danger';
    case 'draft':
    case 'submitted':
    default:
      return 'info';
  }
}

function renderKraFilingToBlocks(
  data: KraFilingData,
  _ctx: RenderContext,
): readonly AgUiUiPart[] {
  const amountDue = (data.amountDueCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: data.currency,
    minimumFractionDigits: 2,
  });
  const status = data.status.replace('-', ' ');

  const markdown =
    `**Authority:** ${data.authorityLabel} (${data.jurisdiction})\n\n` +
    `**Filing type:** ${data.filingTypeLabel}\n\n` +
    `**Period:** ${data.filingPeriod}\n\n` +
    `**Status:** ${status}\n\n` +
    `**Due:** ${data.dueDate}\n\n` +
    `**Amount due:** ${amountDue}\n\n` +
    `**Attachments:** ${data.attachmentsCount}\n\n` +
    `---\n\n` +
    `### Summary\n\n${data.summary}\n\n` +
    `### Payload preview\n\n\`\`\`\n${data.payloadPreview}\n\`\`\``;

  // Choose action buttons based on the current status. Each is a
  // `tool` action — when the owner taps one, the MD invokes the
  // named tool and the receipt flows back to chat.
  const actions: { label: string; prompt: string; kind: 'primary' | 'secondary' | 'destructive' }[] = [];
  if (data.status === 'draft' || data.status === 'review-required') {
    actions.push({
      label: 'Submit filing',
      prompt: `Submit KRA filing ${data.id} to ${data.authorityLabel}.`,
      kind: 'primary',
    });
  }
  if (data.status !== 'paid' && data.status !== 'closed') {
    actions.push({
      label: 'Attach evidence',
      prompt: `Attach supporting evidence to filing ${data.id}.`,
      kind: 'secondary',
    });
  }
  if (data.status === 'overdue' || data.status === 'submitted') {
    actions.push({
      label: 'Mark paid',
      prompt: `Mark filing ${data.id} as paid and attach the receipt.`,
      kind: 'primary',
    });
  }
  if (data.status === 'review-required' || data.status === 'overdue') {
    actions.push({
      label: 'Dispute',
      prompt: `Open a dispute on filing ${data.id} — I want to challenge the assessment.`,
      kind: 'destructive',
    });
  }

  const blocks: AgUiUiPart[] = [
    {
      kind: 'markdown-card',
      title: `Filing ${data.id} — ${data.filingTypeLabel}`,
      markdown,
      severity: severityFor(data.status),
    },
  ];
  if (actions.length > 0) {
    blocks.push({
      kind: 'prompt-suggestions',
      title: 'Actions',
      suggestions: actions,
    });
  }
  return blocks;
}

export const KraFilingProfileCardView: TabView<KraFilingQuery, KraFilingData> = {
  key: 'kra-filing.profile-card',
  label: 'Filing Detail',
  entity_type: 'kra-filing',
  view_kind: 'profile-card',
  defaultQuery: {},
  validateQuery: validateKraFilingQuery,
  renderToBlocks: renderKraFilingToBlocks,
  sort_order: 50,
  description:
    'Detail view of a single tax filing — status, due-date, payload preview, action ' +
    'buttons. Jurisdiction-aware: authority label is read from the entity, not ' +
    'hard-coded.',
};
