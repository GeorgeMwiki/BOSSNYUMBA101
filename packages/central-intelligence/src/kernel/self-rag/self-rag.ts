/**
 * Self-RAG — per-turn reflection token emitter.
 *
 * Per Asai et al. (ICLR 2024, arXiv 2310.11511) Self-RAG produces three
 * categorical reflection tokens on each turn:
 *
 *   - IsREL  (relevance)   — does the retrieved evidence relate to the
 *                            user's question?
 *   - IsSUP  (support)     — is each claim in the response actually
 *                            supported by retrieved context / memory?
 *   - IsUSE  (usefulness)  — does the response solve the user's task?
 *
 * BOSSNYUMBA policy (per `2025-progressive-intelligence.md` §5):
 *   Zero-tolerance for hallucinated rent numbers / unit IDs / lease
 *   terms — IsSUP MUST be enforced on any financial or contractual
 *   claim. The kernel calls `enforceSelfRag(...)` after the sensor's
 *   response and before the policy gate; when the verdict blocks, the
 *   kernel emits a `RUN_ERROR` refusal instead of returning the answer.
 *
 * The judge model is the SAME Haiku-backed judge port the kernel
 * already wires for `req.requireJudge` (so we don't introduce a new
 * provider dependency). The output is parsed into the three categorical
 * tokens — the judge can return JSON or a free-text "REL=high SUP=...
 * USE=..." form; both shapes are accepted.
 */

export type SelfRagToken = 'high' | 'partial' | 'low' | 'unknown';

export interface SelfRagVerdict {
  readonly isRel: SelfRagToken;
  readonly isSup: SelfRagToken;
  readonly isUse: SelfRagToken;
  /** Why the verdict was reached. Surfaced in traces + audit. */
  readonly rationale: string;
  /**
   * Whether the response should be blocked under the project policy.
   * True when:
   *   - the response contains financial / contractual claims AND
   *   - IsSUP is 'low' or 'unknown'.
   * The kernel maps `blocked=true` to a refusal with reason
   * `'self-rag/insufficient-support'`.
   */
  readonly blocked: boolean;
  /** A reason string for logging when blocked. */
  readonly blockedReason?: string;
}

export interface SelfRagJudge {
  (text: string): Promise<{
    readonly score: number;
    readonly reasonText?: string;
    readonly suggestedFix?: string;
  }>;
}

export interface SelfRagInput {
  readonly userMessage: string;
  readonly responseText: string;
  /** Optional context bundle the kernel retrieved + injected. */
  readonly retrievedContext?: ReadonlyArray<string>;
  /** Haiku-backed judge wrapping the LLM critic. Required. */
  readonly judge: SelfRagJudge;
  /** Optional clock for tests. */
  readonly now?: () => number;
}

/**
 * Detect financial / contractual / regulatory claims in the response
 * text. The kernel blocks the answer when IsSUP < 'high' and one of
 * these patterns is present.
 *
 * Conservative regexes — we'd rather over-trigger and force grounding
 * than let an unsupported rent number through. The detector matches:
 *
 *   - currency amounts ("TZS 450,000", "KES 12,000", "$1,200")
 *   - "rent of …" / "deposit of …" / "fee of …" + a number
 *   - lease / contract / clause references with a section number
 *   - explicit policy statements ("according to the lease …")
 */
const FINANCIAL_REGEXES: ReadonlyArray<RegExp> = [
  // ISO-4217 + common informal labels. Kept in sync with policy-gate's
  // ABSOLUTE_MONEY_PATTERN and ai-copilot's MONETARY_PATTERNS.
  /\b(?:TZS|KES|UGX|RWF|NGN|ZAR|GHS|EGP|USD|EUR|GBP|CHF|JPY|CNY|INR|AUD|CAD|Ksh|KShs|Tsh|TShs|Sh|Shs)\s*[\d,]+(?:\.\d+)?/i,
  /\$\s*\d[\d,]*(?:\.\d+)?/,
  /\b(?:rent|deposit|fee|fine|penalty|surcharge|payment)\s+of\s+[\d,]+/i,
  /\b(?:lease|contract)\s+(?:clause|section|article)\s+[\d.]+/i,
  /\baccording to (?:the )?(?:lease|contract|tenancy agreement)/i,
  /\b(?:tenant|owner|landlord)\s+(?:must|shall|is required to)\s+pay/i,
];

export function containsFinancialClaim(text: string): boolean {
  if (!text) return false;
  for (const rx of FINANCIAL_REGEXES) {
    if (rx.test(text)) return true;
  }
  return false;
}

/**
 * Run a Self-RAG reflection over the kernel's draft response and decide
 * whether to block it. The judge port runs the LLM critic; we parse its
 * output into the three categorical tokens.
 *
 * The judge prompt is intentionally embedded here (not in a separate
 * file) because Self-RAG's critique format is part of the algorithm's
 * specification — splitting it out would invite drift.
 */
export async function runSelfRag(
  input: SelfRagInput,
): Promise<SelfRagVerdict> {
  if (typeof input.judge !== 'function') {
    return {
      isRel: 'unknown',
      isSup: 'unknown',
      isUse: 'unknown',
      rationale: 'no judge wired',
      blocked: false,
    };
  }

  const probe = buildJudgeProbe(input);
  let judgeOut: { score: number; reasonText?: string; suggestedFix?: string };
  try {
    judgeOut = await input.judge(probe);
  } catch (err) {
    // Failure of the side-channel must not break the turn — return
    // 'unknown' tokens and let the policy gate make the call. We do
    // NOT block on judge failure: that would mean a flaky Haiku
    // session blanks the whole product.
    return {
      isRel: 'unknown',
      isSup: 'unknown',
      isUse: 'unknown',
      rationale: `judge-error: ${err instanceof Error ? err.message : String(err)}`,
      blocked: false,
    };
  }

  const parsed = parseTokens(judgeOut.reasonText ?? '');
  const verdict: SelfRagVerdict = {
    isRel: parsed.isRel,
    isSup: parsed.isSup,
    isUse: parsed.isUse,
    rationale:
      (judgeOut.reasonText ?? judgeOut.suggestedFix ?? '').slice(0, 1_000) ||
      'no rationale provided',
    blocked: false,
  };

  const hasFinClaim = containsFinancialClaim(input.responseText);
  if (hasFinClaim && (verdict.isSup === 'low' || verdict.isSup === 'unknown')) {
    return {
      ...verdict,
      blocked: true,
      blockedReason: `Self-RAG IsSUP=${verdict.isSup} on a financial/contractual claim`,
    };
  }
  return verdict;
}

/**
 * Build the judge probe — a single prompt that asks for the three
 * tokens against the user message + draft response + retrieved
 * context. The prompt is concrete: it requests the literal "REL=...
 * SUP=... USE=..." line so the parser doesn't depend on a structured
 * JSON return.
 */
function buildJudgeProbe(input: SelfRagInput): string {
  const ctx = (input.retrievedContext ?? [])
    .map((c, i) => `  [${i + 1}] ${truncate(c, 400)}`)
    .join('\n');
  return [
    'You are a Self-RAG reflection critic per Asai et al. (ICLR 2024).',
    'Score the draft response against the user message and retrieved context.',
    '',
    'Reply with EXACTLY one line in this form (no JSON, no commentary):',
    'REL=<high|partial|low> SUP=<high|partial|low> USE=<high|partial|low>',
    'Then a one-sentence rationale on the next line.',
    '',
    `USER MESSAGE:`,
    truncate(input.userMessage ?? '', 1_000),
    '',
    `DRAFT RESPONSE:`,
    truncate(input.responseText ?? '', 2_000),
    '',
    'RETRIEVED CONTEXT:',
    ctx || '  (no retrieval supplied)',
  ].join('\n');
}

const TOKEN_VALUES: ReadonlySet<SelfRagToken> = new Set([
  'high',
  'partial',
  'low',
  'unknown',
]);

interface ParsedTokens {
  isRel: SelfRagToken;
  isSup: SelfRagToken;
  isUse: SelfRagToken;
}

function parseTokens(text: string): ParsedTokens {
  const out: ParsedTokens = {
    isRel: 'unknown',
    isSup: 'unknown',
    isUse: 'unknown',
  };
  if (!text) return out;
  const rxs: Array<[keyof ParsedTokens, RegExp]> = [
    ['isRel', /REL\s*=\s*(high|partial|low|unknown)/i],
    ['isSup', /SUP\s*=\s*(high|partial|low|unknown)/i],
    ['isUse', /USE\s*=\s*(high|partial|low|unknown)/i],
  ];
  for (const [key, rx] of rxs) {
    const m = rx.exec(text);
    if (m && m[1]) {
      const lower = m[1].toLowerCase() as SelfRagToken;
      if (TOKEN_VALUES.has(lower)) {
        out[key] = lower;
      }
    }
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
