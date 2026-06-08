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
import {
  stripChatbotFeel,
  stripTheatreFromUncertainty,
  checkContinuity,
  checkPosition,
  checkSycophancy,
  checkBrevity,
  inferTurnKind,
} from '@bossnyumba/conversation-feel';
import type {
  ConversationContext,
  RecentTurn,
} from '@bossnyumba/conversation-feel';
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

// ─── Conversation-feel post-processing ──────────────────────────────
//
// `@bossnyumba/conversation-feel` is the ORIGIN of Mr. Mwikila's reply
// guards (sycophancy / honest-uncertainty / brevity / position /
// continuity). Until now the package was built but had zero importers in
// the runtime reply path — the guards were shelfware. This block wires
// them into the brain turn post-processing so every Markdown reply is
// cleaned of chatbot-feel filler before it leaves the gateway.
//
// Contract:
//   - FAIL-OPEN. A guard that throws never blocks the turn — the original
//     text is returned unchanged. The brain reply must always survive.
//   - LOCALE-PURE. The two text mutators applied here (`stripChatbotFeel`,
//     `stripTheatreFromUncertainty`) only *remove* matched filler; they
//     never inject English or Swahili copy. EN regexes simply do not
//     match SW output and vice-versa, so the EN/SW absolute toggle is
//     preserved by construction (no mixing introduced).
//   - The detection-only guards (continuity / position / sycophancy /
//     brevity) produce regen *signals* but do not rewrite text here; we
//     surface them as a single structured observability counter rather
//     than re-prompting the model inline (that stays a brain concern).

export interface ConversationFeelContextInput {
  /** The user's message that produced this response (drives continuity / position). */
  readonly userMessage?: string;
  /** Prior turns in the thread, oldest→newest, for continuity analysis. */
  readonly recentTurns?: ReadonlyArray<RecentTurn>;
  /** Zero-based turn index in the thread. */
  readonly turnIndex?: number;
}

export interface ConversationFeelResult {
  /** The cleaned reply (filler stripped). Equals input on any failure. */
  readonly cleaned: string;
  /** True when stripping changed the text. */
  readonly mutated: boolean;
  /** Names of detection guards that flagged a regen-worthy signal. */
  readonly regenSignals: readonly string[];
}

const PASSTHROUGH = (text: string): ConversationFeelResult => ({
  cleaned: text,
  mutated: false,
  regenSignals: [],
});

/**
 * Run the conversation-feel guards over a candidate brain reply.
 *
 * FAIL-OPEN by total isolation: any throw anywhere inside collapses to
 * the original text. Each guard is additionally wrapped so one throwing
 * guard cannot starve the others.
 */
export function cleanChatResponse(
  candidate: string,
  ctxInput: ConversationFeelContextInput = {},
): ConversationFeelResult {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return PASSTHROUGH(candidate ?? '');
  }
  try {
    // 1. Text mutators (silent fixes; locale-pure, removal-only).
    let working = candidate;
    try {
      working = stripChatbotFeel(working).stripped;
    } catch {
      working = candidate;
    }
    try {
      working = stripTheatreFromUncertainty(working);
    } catch {
      /* keep `working` as-is */
    }
    // Guard against a stripper that nuked all substance — never return empty.
    if (typeof working !== 'string' || working.trim().length === 0) {
      working = candidate;
    }
    const mutated = working !== candidate;

    // 2. Detection-only guards (observability signals; no rewrite here).
    const ctx = buildConversationContext(candidate, ctxInput);
    const regenSignals: string[] = [];
    runDetection('continuity-enforcer', regenSignals, () => {
      const r = checkContinuity(working, ctx);
      return !r.has_continuity && r.regen_instruction != null;
    });
    runDetection('position-taker', regenSignals, () => {
      const r = checkPosition(working, ctx);
      return r.regen_instruction != null;
    });
    runDetection('sycophancy-detector', regenSignals, () => {
      const r = checkSycophancy(working, ctx);
      return r.detected && r.regen_instruction != null;
    });
    runDetection('brevity-guard', regenSignals, () => {
      const turnKind = inferTurnKind(ctx.user_message, working);
      const r = checkBrevity(working, turnKind);
      return r.regen_instruction != null;
    });

    return { cleaned: working, mutated, regenSignals };
  } catch {
    // Total fail-open: any unexpected throw → original text untouched.
    return PASSTHROUGH(candidate);
  }
}

function runDetection(
  guard: string,
  sink: string[],
  probe: () => boolean,
): void {
  try {
    if (probe()) sink.push(guard);
  } catch {
    // A throwing detection guard is fail-open: contributes no signal.
  }
}

function buildConversationContext(
  userMessageFallbackSource: string,
  ctxInput: ConversationFeelContextInput,
): ConversationContext {
  // `portal` is part of the ported LitFin shape; for the BN chat surface
  // it only gates a couple of opinion heuristics. `admin` is the neutral
  // default. Tenant/locale never flow through this field.
  return {
    session_id: 'chat-response-gate',
    turn_index: ctxInput.turnIndex ?? 0,
    portal: 'admin',
    user_message: ctxInput.userMessage ?? '',
    recent_turns: ctxInput.recentTurns ?? [],
  };
}

// ─── Public gate API ────────────────────────────────────────────────

export interface ChatResponseGateInput {
  readonly tenantId: string;
  readonly threadId: string | null;
  readonly userId: string;
  readonly personaId: string;
  readonly responseText: string;
  readonly tokensUsed?: number;
  /** Optional conversation context to power the feel-guard detectors. */
  readonly conversationFeel?: ConversationFeelContextInput;
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
  /**
   * The brain reply after conversation-feel cleaning (filler stripped).
   * Callers SHOULD surface this in place of the raw `responseText`. On any
   * guard failure this equals the original text (fail-open).
   */
  readonly cleanedText: string;
  /** True when conversation-feel stripping changed the reply. */
  readonly cleaned: boolean;
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

  // Conversation-feel post-processing FIRST (fail-open): strip chatbot
  // filler before the reply is audited or returned. Stripping is
  // removal-only and never touches `[evidence:…]` brackets or the
  // `Sources:`/`Vyanzo:` footer, so the evidence chain below is unaffected.
  const feel = cleanChatResponse(input.responseText, input.conversationFeel);
  const cleanedText = feel.cleaned;

  const evidenceIds = extractEvidenceIds(cleanedText);
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
        payload: { responseText: cleanedText.slice(0, 2_000) },
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
    // Conversation-feel observability: whether filler was stripped and
    // which detection guards flagged a regen-worthy signal this turn.
    feel_cleaned: feel.mutated,
    feel_regen_signals: feel.regenSignals,
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
    cleanedText,
    cleaned: feel.mutated,
  };
}
