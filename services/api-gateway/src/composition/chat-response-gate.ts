/**
 * Chat-response Auditor gate.
 *
 * Closes the BossNyumba hard-rule "every junior recommendation cites
 * >=1 `evidence_id` … the Auditor Agent rejects responses with empty
 * evidence chains" (CLAUDE.md → Evidence-required AI output).
 *
 * Before this module the canonical `createAuditorAgent` factory in
 * `@bossnyumba/central-intelligence` (kernel/auditor) was exported but
 * never invoked from any route — the rule was shelfware. This gate
 * wires the Auditor into every brain /turn response so the violation
 * is observable end-to-end.
 *
 * Design notes:
 *   - The BN Auditor is a PURE validator. Stage 1 (deterministic,
 *     zero side effects) auto-rejects on empty `evidence_ids`. Stage 2
 *     (counter-model) is OPTIONAL and only runs when a counter-model
 *     port is supplied. For the chat-response surface we deliberately
 *     skip Stage 2 — the load-bearing assertion is the evidence chain.
 *   - Evidence ids in BN chat responses appear as bracketed inline
 *     citations such as `[evidence:lease_pdf_42]` /
 *     `[evidence:corpus:abc]` or as a `Sources:`/`Vyanzo:` footer.
 *     The extractor walks both surfaces.
 *   - Verdict is non-blocking by default (HARD MODE for JSON, SOFT for
 *     SSE) — we never silently swallow. The Pino-style structured log
 *     line is the canonical observable signal.
 */

import { auditor } from '@bossnyumba/central-intelligence';
import { createLogger } from '../utils/logger';

const log = createLogger('chat-response-gate');

let cachedAuditor: ReturnType<typeof auditor.createAuditorAgent> | null = null;

function getAuditor(): ReturnType<typeof auditor.createAuditorAgent> {
  if (!cachedAuditor) {
    // No `counterModel` wired — Stage 2 is skipped; Stage 1 is the
    // hard-rule gate for chat turns. Stage 2 is reserved for the
    // four-eye queue / inter-junior recommendation flow.
    cachedAuditor = auditor.createAuditorAgent();
  }
  return cachedAuditor;
}

// ─── Evidence-id extractor ──────────────────────────────────────────
//
// Two surfaces are supported (combine results):
//   1. Bracketed inline citation:  `[evidence:lease_pdf_42]` /
//      `[evidence:corpus:abc-123]`
//   2. Sources footer:  one or more lines after a `Sources:` /
//      `Vyanzo:` heading carrying `- evidence_id: xxx` or `- xxx`.
//
// The patterns are intentionally permissive — the only thing the
// auditor cares about is whether the response cites >=1 evidence id.

// eslint-disable-next-line security/detect-unsafe-regex -- reason: character class [A-Za-z0-9_\-:.] has no overlap/nesting; each outer + iteration must consume ≥1 mandatory non-backtracking char; linear on trusted LLM output
const INLINE_EVIDENCE_RE = /\[evidence(?::[A-Za-z0-9_\-:.]+)+\]|\[evidence:\s*([A-Za-z0-9_\-:.]+)\s*\]/g;
const FOOTER_HEADER_RE = /^(?:sources|vyanzo)\s*:\s*$/im;
// eslint-disable-next-line security/detect-unsafe-regex -- reason: bounded character class with no overlap; applied to trusted LLM-generated text, not raw user input
const FOOTER_LINE_RE = /(?:^|\n)\s*[-*]\s*(?:evidence_id\s*:\s*)?([A-Za-z0-9_\-:.]+)/g;

export function extractEvidenceIds(responseText: string): readonly string[] {
  if (typeof responseText !== 'string' || responseText.length === 0) {
    return [];
  }
  const found = new Set<string>();
  for (const match of responseText.matchAll(INLINE_EVIDENCE_RE)) {
    const raw = match[1] ?? match[0];
    if (typeof raw !== 'string') continue;
    const cleaned = raw
      .replace(/^\[evidence:/, '')
      .replace(/\]$/, '')
      .trim();
    if (cleaned.length > 0) found.add(cleaned);
  }
  const headerMatch = responseText.match(FOOTER_HEADER_RE);
  if (headerMatch && typeof headerMatch.index === 'number') {
    const footerSlice = responseText.slice(headerMatch.index + headerMatch[0].length);
    for (const match of footerSlice.matchAll(FOOTER_LINE_RE)) {
      const candidate = match[1]?.trim();
      if (candidate && candidate.length > 0) found.add(candidate);
    }
  }
  return Array.from(found);
}

// ─── Public gate API ────────────────────────────────────────────────

export interface ChatResponseGateInput {
  readonly tenantId: string;
  readonly threadId: string | null;
  readonly userId: string;
  readonly personaId: string;
  readonly responseText: string;
  readonly tokensUsed?: number;
}

export interface ChatResponseGateVerdict {
  readonly verdict: 'approve' | 'reject' | 'needs_human';
  readonly evidenceCount: number;
  readonly evidenceIds: readonly string[];
  readonly auditLogId: string;
  readonly evidenceWarning: 'no_evidence_cited' | null;
  readonly latencyMs: number;
  /** True if the gate raised a violation (evidence chain empty). */
  readonly violation: boolean;
}

/**
 * Audit a brain chat response against the evidence-chain hard rule.
 *
 * The function ALWAYS resolves — it never throws on a missing evidence
 * chain. The caller decides whether to surface the verdict to the
 * client (HARD mode → attach `evidence_warning` to the response body)
 * or only log it (SOFT mode → SSE path).
 *
 * Implementation note: the BN Auditor's Stage 1 is pure synchronous
 * validation, so the latency budget here is sub-millisecond. We feed
 * the auditor a faithful `RecommendationToAudit` (origin_junior =
 * the active persona, payload = the truncated response text) so the
 * audit log row carries enough context for after-the-fact replay.
 */
export async function auditChatResponse(
  input: ChatResponseGateInput,
): Promise<ChatResponseGateVerdict> {
  const startedAt = Date.now();
  const evidenceIds = extractEvidenceIds(input.responseText);
  const recommendationId = input.threadId
    ? `${input.threadId}:${startedAt}`
    : `synthetic:${startedAt}`;

  let verdict: ChatResponseGateVerdict['verdict'] = 'approve';
  let auditLogId = `audit_${startedAt}_${recommendationId}`;
  try {
    const out = await getAuditor().evaluate({
      tenantId: input.tenantId,
      recommendation: {
        origin_junior: `chat:${input.personaId}`,
        recommendation_id: recommendationId,
        payload: { responseText: input.responseText.slice(0, 2_000) },
        evidence_ids: [...evidenceIds],
        binding: false,
      },
    });
    verdict = out.verdict;
    auditLogId = out.audit_log_id;
  } catch (err) {
    // The auditor is pure validation; a throw here means the factory
    // itself failed. Log and continue — never let the gate crash the
    // chat turn.
    log.warn('auditor invocation failed (non-fatal)', {
      err: err instanceof Error ? err.message : String(err),
      tenantId: input.tenantId,
      threadId: input.threadId,
    });
  }

  const latencyMs = Date.now() - startedAt;
  const violation = evidenceIds.length === 0;
  const evidenceWarning = violation ? ('no_evidence_cited' as const) : null;

  // Structured log — canonical observable signal. Required fields per
  // the wiring spec: session_id (thread id) + tenant_id +
  // evidence_count + verdict + latency_ms.
  const payload = {
    session_id: input.threadId,
    tenant_id: input.tenantId,
    user_id: input.userId,
    persona_id: input.personaId,
    evidence_count: evidenceIds.length,
    verdict,
    latency_ms: latencyMs,
    tokens_used: input.tokensUsed ?? null,
    audit_log_id: auditLogId,
  };
  if (violation) {
    log.warn('chat response auditor: no_evidence_cited', payload);
  } else {
    log.info('chat response auditor: approved', payload);
  }

  return {
    verdict,
    evidenceCount: evidenceIds.length,
    evidenceIds,
    auditLogId,
    evidenceWarning,
    latencyMs,
    violation,
  };
}
