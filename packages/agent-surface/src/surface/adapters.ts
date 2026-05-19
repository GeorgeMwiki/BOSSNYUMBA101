/**
 * Five surface adapters — each implements `SurfaceAdapter<R>` for its
 * concrete rendering shape.
 *
 * All adapters MUST be pure: marshal(turn) is a function of `turn` only.
 * State lives in `ConversationStore`, never inside the adapter.
 */

import { SURFACE_CAPABILITIES } from './capabilities.js';
import { canRenderNatively, summariseRichPart } from './degrade.js';
import type {
  AgentTurn,
  EmailRendering,
  MobileRendering,
  RichPart,
  SmsRendering,
  SurfaceAdapter,
  TurnAttachment,
  WebRendering,
  WhatsAppRendering,
} from './types.js';
import type { Citation } from '../types.js';

// ──────────────────────────────────────────────────────────────────────
// Web adapter
// ──────────────────────────────────────────────────────────────────────

export const WebSurface: SurfaceAdapter<WebRendering> = {
  kind: 'web',
  capabilities: SURFACE_CAPABILITIES.web,
  marshal(turn: AgentTurn): WebRendering {
    return {
      surface: 'web',
      text: clampLen(turn.text, SURFACE_CAPABILITIES.web.maxLengthChars),
      richParts: turn.richParts ?? [],
      citations: turn.citations ?? [],
      attachments: turn.attachments ?? [],
    };
  },
};

// ──────────────────────────────────────────────────────────────────────
// Mobile adapter — identical shape to Web. Kept distinct so the
// rendering layer can apply mobile-specific layout downstream.
// ──────────────────────────────────────────────────────────────────────

export const MobileSurface: SurfaceAdapter<MobileRendering> = {
  kind: 'mobile',
  capabilities: SURFACE_CAPABILITIES.mobile,
  marshal(turn: AgentTurn): MobileRendering {
    return {
      surface: 'mobile',
      text: clampLen(turn.text, SURFACE_CAPABILITIES.mobile.maxLengthChars),
      richParts: turn.richParts ?? [],
      citations: turn.citations ?? [],
      attachments: turn.attachments ?? [],
    };
  },
};

// ──────────────────────────────────────────────────────────────────────
// WhatsApp adapter
//
// Rich parts → summarised inline.
// Images in attachments → kept.
// Citations → numbered footnote at the foot.
// ──────────────────────────────────────────────────────────────────────

export const WhatsAppSurface: SurfaceAdapter<WhatsAppRendering> = {
  kind: 'whatsapp',
  capabilities: SURFACE_CAPABILITIES.whatsapp,
  marshal(turn: AgentTurn): WhatsAppRendering {
    const body = buildWhatsAppBody(turn);
    return {
      surface: 'whatsapp',
      body: clampLen(body, SURFACE_CAPABILITIES.whatsapp.maxLengthChars),
      imageAttachments: (turn.attachments ?? []).filter((a) => a.mimeType.startsWith('image/')),
      citationsFootnote: renderCitationFootnote(turn.citations),
    };
  },
};

function buildWhatsAppBody(turn: AgentTurn): string {
  const lines: string[] = [turn.text];
  if (turn.richParts && turn.richParts.length > 0) {
    for (const p of turn.richParts) {
      if (!canRenderNatively('whatsapp', p)) {
        lines.push(summariseRichPart(p));
      }
    }
  }
  const foot = renderCitationFootnote(turn.citations);
  if (foot.length > 0) {
    lines.push('');
    lines.push(foot);
  }
  return lines.join('\n');
}

function renderCitationFootnote(cites: ReadonlyArray<Citation> | undefined): string {
  if (!cites || cites.length === 0) return '';
  return cites
    .slice(0, 9)
    .map((c, i) => {
      const idx = i + 1;
      const label = c.label;
      const loc = c.sourceLocator ? ` (${c.sourceLocator})` : '';
      return `[${idx}] ${label}${loc}`;
    })
    .join('\n');
}

// ──────────────────────────────────────────────────────────────────────
// SMS adapter
//
// Text only. Drop rich parts (with single-line summary), drop
// attachments, drop citations beyond the first. SMS body is hard-capped
// at 1000 chars; we also report part-count for billing.
// ──────────────────────────────────────────────────────────────────────

export const SmsSurface: SurfaceAdapter<SmsRendering> = {
  kind: 'sms',
  capabilities: SURFACE_CAPABILITIES.sms,
  marshal(turn: AgentTurn): SmsRendering {
    const summary = buildSmsBody(turn);
    const clamped = clampLen(summary, SURFACE_CAPABILITIES.sms.maxLengthChars);
    return {
      surface: 'sms',
      body: clamped,
      parts: smsParts(clamped),
    };
  },
};

function buildSmsBody(turn: AgentTurn): string {
  const parts: string[] = [turn.text];
  if (turn.richParts && turn.richParts.length > 0) {
    for (const p of turn.richParts) parts.push(summariseRichPart(p));
  }
  if (turn.citations && turn.citations.length > 0) {
    const first = turn.citations[0];
    if (first) parts.push(`Ref: ${first.label}`);
  }
  return parts.join(' ');
}

/** SMS "parts" — 160 chars GSM7, 153 if concatenated. We use 153 as
 *  the per-part char count once a message exceeds 160 chars. */
function smsParts(body: string): number {
  const len = body.length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

// ──────────────────────────────────────────────────────────────────────
// Email adapter
//
// HTML body (tables and KPI grids render natively). Plain-text fallback
// always present.
// ──────────────────────────────────────────────────────────────────────

export const EmailSurface: SurfaceAdapter<EmailRendering> = {
  kind: 'email',
  capabilities: SURFACE_CAPABILITIES.email,
  marshal(turn: AgentTurn): EmailRendering {
    const subject = deriveSubject(turn);
    return {
      surface: 'email',
      subject,
      htmlBody: buildEmailHtml(turn),
      plainBody: buildEmailPlain(turn),
      attachments: turn.attachments ?? [],
    };
  },
};

function deriveSubject(turn: AgentTurn): string {
  const firstLine = turn.text.split('\n')[0]?.trim() ?? '';
  if (firstLine.length === 0) return 'Message from BOSSNYUMBA';
  return firstLine.length > 78 ? firstLine.slice(0, 75) + '...' : firstLine;
}

function buildEmailHtml(turn: AgentTurn): string {
  const parts: string[] = [];
  parts.push(`<p>${escapeHtml(turn.text).replace(/\n/g, '<br>')}</p>`);
  if (turn.richParts) {
    for (const rp of turn.richParts) {
      if (canRenderNatively('email', rp)) {
        parts.push(renderEmailNative(rp));
      } else {
        parts.push(`<p><em>${escapeHtml(summariseRichPart(rp))}</em></p>`);
      }
    }
  }
  if (turn.citations && turn.citations.length > 0) {
    parts.push(renderEmailCitations(turn.citations));
  }
  return `<!doctype html><html><body>${parts.join('')}</body></html>`;
}

function buildEmailPlain(turn: AgentTurn): string {
  const parts: string[] = [turn.text];
  if (turn.richParts) {
    for (const rp of turn.richParts) parts.push(summariseRichPart(rp));
  }
  if (turn.citations && turn.citations.length > 0) {
    parts.push('');
    parts.push('References:');
    for (const [i, c] of turn.citations.entries()) {
      parts.push(`  [${i + 1}] ${c.label}${c.sourceLocator ? ' (' + c.sourceLocator + ')' : ''}`);
    }
  }
  return parts.join('\n');
}

function renderEmailNative(rp: RichPart): string {
  if (rp.kind === 'data-table') {
    const cols = Array.isArray(rp['columns']) ? (rp['columns'] as unknown[]) : [];
    const rows = Array.isArray(rp['rows']) ? (rp['rows'] as unknown[]) : [];
    const head = cols
      .map((c) => {
        if (typeof c === 'object' && c !== null && 'header' in (c as Record<string, unknown>)) {
          return `<th>${escapeHtml(String((c as Record<string, unknown>)['header']))}</th>`;
        }
        return `<th>${escapeHtml(String(c))}</th>`;
      })
      .join('');
    const body = rows
      .map((r) => {
        if (typeof r !== 'object' || r === null) return '';
        const cells = cols
          .map((c) => {
            const key = typeof c === 'object' && c !== null ? (c as Record<string, unknown>)['accessorKey'] : c;
            const v = (r as Record<string, unknown>)[String(key)];
            return `<td>${escapeHtml(String(v ?? ''))}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  if (rp.kind === 'kpi-grid') {
    const tiles = Array.isArray(rp['tiles']) ? (rp['tiles'] as unknown[]) : [];
    const cells = tiles
      .map((t) => {
        if (typeof t !== 'object' || t === null) return '';
        const lbl = String((t as Record<string, unknown>)['label'] ?? '');
        const val = String((t as Record<string, unknown>)['value'] ?? '');
        return `<td><strong>${escapeHtml(lbl)}:</strong> ${escapeHtml(val)}</td>`;
      })
      .join('');
    return `<table><tr>${cells}</tr></table>`;
  }
  return '';
}

function renderEmailCitations(cites: ReadonlyArray<Citation>): string {
  const items = cites
    .map((c, i) => {
      const loc = c.sourceLocator ? ` (${escapeHtml(c.sourceLocator)})` : '';
      return `<li>[${i + 1}] ${escapeHtml(c.label)}${loc}</li>`;
    })
    .join('');
  return `<h4>References</h4><ol>${items}</ol>`;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function clampLen(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)) + '...';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Re-export attachment + Citation types for downstream consumers.
export type { TurnAttachment, Citation };
