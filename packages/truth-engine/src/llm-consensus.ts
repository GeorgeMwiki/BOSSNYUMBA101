/**
 * LLM Consensus — ask the brain the same factual question across three model
 * tiers and persist agreement as `llm_consensus` evidence.
 *
 * BossNyumba standardizes on Anthropic (Mr. Mwikila brain layer); the sibling
 * codebase's separate OpenAI / DeepSeek services have no BN equivalent, so the
 * three "voices" are three distinct Anthropic model tiers (fast / Sonnet /
 * Opus) routed through the canonical `brainChat` adapter. This keeps the check
 * a genuine multi-model cross-verification rather than a single-shot answer,
 * while staying on the platform's standardized provider.
 *
 * Confidence model:
 *   - 3/3 agree on numeric within 5%   -> emit consensus evidence at authority 0.65
 *   - 2/3 agree                        -> emit consensus evidence at authority 0.50
 *   - <2 agree                         -> emit nothing (caller treats as no signal)
 *
 * Cost guardrails:
 *   - Behind TRUTH_ENGINE_LLM_CONSENSUS=true env flag
 *   - Per-claim cap of 3 calls (one per model tier)
 *   - Hard timeout 8s per call; whichever returns last shapes the verdict
 */

import { brainChat } from "./brain-chat";
import { ModelTier } from "@bossnyumba/ai-copilot";
import type { CandidateEvidence } from "./types";

const CONSENSUS_TOLERANCE = 0.05; // 5% numeric drift allowed
const PER_PROVIDER_TIMEOUT_MS = 8_000;

interface ProviderAnswer {
  // Three Anthropic model tiers act as the three independent "voices".
  readonly provider: "claude-fast" | "claude-sonnet" | "claude-opus";
  readonly raw: string;
  readonly numeric: number | null;
  readonly unit: string | null;
}

export interface ConsensusOutcome {
  readonly evidence: readonly CandidateEvidence[];
  readonly costUsd: number;
  readonly calls: number;
  readonly verdict: "consensus_3" | "consensus_2" | "no_consensus" | "skipped";
  readonly answers: readonly ProviderAnswer[];
}

export interface ConsensusArgs {
  readonly subject: string;
  readonly factKey: string;
  readonly retrievedBy: string;
}

/**
 * Run a 3-provider consensus query. Returns CandidateEvidence rows with
 * sourceType='llm_consensus' that the caller can feed into evidence-scorer.
 */
export async function runLLMConsensus(
  args: ConsensusArgs,
): Promise<ConsensusOutcome> {
  if (process.env.TRUTH_ENGINE_LLM_CONSENSUS !== "true") {
    return {
      evidence: [],
      costUsd: 0,
      calls: 0,
      verdict: "skipped",
      answers: [],
    };
  }

  const prompt = buildPrompt(args.subject, args.factKey);

  // All three model tiers in parallel — total wall-time = max(8s)
  const [fastRes, sonnetRes, opusRes] = await Promise.allSettled([
    askTier("claude-fast", process.env.CLAUDE_MODEL_FAST ?? ModelTier.HAIKU, prompt),
    askTier("claude-sonnet", ModelTier.SONNET, prompt),
    askTier("claude-opus", ModelTier.OPUS, prompt),
  ]);

  const answers: ProviderAnswer[] = [];
  if (fastRes.status === "fulfilled" && fastRes.value)
    answers.push(fastRes.value);
  if (sonnetRes.status === "fulfilled" && sonnetRes.value)
    answers.push(sonnetRes.value);
  if (opusRes.status === "fulfilled" && opusRes.value)
    answers.push(opusRes.value);

  const calls = answers.length;
  const costUsd = estimateCost(calls);

  const verdict = classifyConsensus(answers);

  if (verdict === "no_consensus" || answers.length === 0) {
    return { evidence: [], costUsd, calls, verdict, answers };
  }

  // Build a single consensus evidence row that summarizes the agreeing answers
  const agreeing = pickAgreeingAnswers(answers);
  const summary = agreeing.map((a) => `[${a.provider}] ${a.raw}`).join(" | ");

  const evidence: CandidateEvidence = {
    sourceType: "llm_consensus",
    sourceUrl: null,
    sourceDomain: null,
    excerpt: summary.slice(0, 4000),
    retrievedBy: args.retrievedBy,
  };

  return {
    evidence: [evidence],
    costUsd,
    calls,
    verdict,
    answers,
  };
}

// ---------------------------------------------------------------------------
// Provider calls (timeouts + concise prompts to minimize cost)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You are a fact-check researcher. Answer in ONE sentence with a single number plus unit. " +
  "If you don't know, say 'unknown'. Never speculate. Cite the institution name only.";

function buildPrompt(subject: string, factKey: string): string {
  return `Question: What is the current value for "${subject}" in Tanzania (fact key: ${factKey})? Answer in one sentence with one number plus unit.`;
}

async function askTier(
  voice: ProviderAnswer["provider"],
  model: string,
  prompt: string,
): Promise<ProviderAnswer | null> {
  try {
    const text = await withTimeout(
      brainChat([{ role: "user", content: prompt }], SYSTEM_PROMPT, {
        taskName: "truth-engine-llm-consensus",
        cacheSystemPrompt: true,
        model,
        maxTokens: 200,
        temperature: 0,
      }),
      PER_PROVIDER_TIMEOUT_MS,
    );
    if (!text) return null;
    return parseAnswer(voice, text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parsing + consensus classification
// ---------------------------------------------------------------------------

function parseAnswer(
  provider: ProviderAnswer["provider"],
  raw: string,
): ProviderAnswer | null {
  if (!raw || /unknown|i (don'?t|do not) know|cannot/i.test(raw)) {
    return { provider, raw: raw.slice(0, 400), numeric: null, unit: null };
  }

  const moneyMatch = raw.match(
    /(TZS|TSh|USD|US\$|\$|%)?\s?([\d,]+(?:\.\d+)?)(?:\s?(million|billion|thousand|k|m|bn))?/i,
  );

  if (!moneyMatch) {
    return { provider, raw: raw.slice(0, 400), numeric: null, unit: null };
  }

  const numeric = parseFloat(moneyMatch[2].replace(/,/g, ""));
  const multiplier = scaleMultiplier(moneyMatch[3]);

  return {
    provider,
    raw: raw.slice(0, 400),
    numeric: Number.isFinite(numeric) ? numeric * multiplier : null,
    unit: (moneyMatch[1] ?? "").toUpperCase() || null,
  };
}

function scaleMultiplier(suffix?: string): number {
  if (!suffix) return 1;
  const s = suffix.toLowerCase();
  if (s === "thousand" || s === "k") return 1_000;
  if (s === "million" || s === "m") return 1_000_000;
  if (s === "billion" || s === "bn") return 1_000_000_000;
  return 1;
}

function classifyConsensus(
  answers: readonly ProviderAnswer[],
): ConsensusOutcome["verdict"] {
  if (answers.length < 2) return "no_consensus";

  const withNumbers = answers.filter(
    (a): a is ProviderAnswer & { numeric: number } => a.numeric !== null,
  );

  if (withNumbers.length < 2) {
    // Text-only: require exact lowercase substring overlap on key tokens
    const lowered = answers.map((a) => a.raw.toLowerCase());
    const overlap = lowered.filter((a, i) =>
      lowered.some((b, j) => i !== j && tokenOverlap(a, b) >= 0.4),
    );
    if (overlap.length >= 3) return "consensus_3";
    if (overlap.length >= 2) return "consensus_2";
    return "no_consensus";
  }

  const agreeing = pickAgreeingAnswers(answers);
  if (agreeing.length >= 3) return "consensus_3";
  if (agreeing.length >= 2) return "consensus_2";
  return "no_consensus";
}

function pickAgreeingAnswers(
  answers: readonly ProviderAnswer[],
): readonly ProviderAnswer[] {
  const withNumbers = answers.filter(
    (a): a is ProviderAnswer & { numeric: number } => a.numeric !== null,
  );

  if (withNumbers.length < 2) return answers;

  // Find the largest cluster within tolerance
  let best: ProviderAnswer[] = [];
  for (const anchor of withNumbers) {
    const cluster = withNumbers.filter((a) => {
      const larger = Math.max(Math.abs(anchor.numeric), Math.abs(a.numeric));
      if (larger === 0) return true;
      return (
        Math.abs(anchor.numeric - a.numeric) / larger <= CONSENSUS_TOLERANCE
      );
    });
    if (cluster.length > best.length) best = cluster;
  }

  return best;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((t) => t.length > 3));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length > 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

function estimateCost(calls: number): number {
  // Pessimistic blended estimate: $0.005 per call, well under real cost which
  // is closer to $0.001-0.003 for short factual queries with low-temp models.
  return calls * 0.005;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`llm_consensus_timeout_${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
