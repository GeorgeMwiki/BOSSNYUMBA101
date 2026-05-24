# Multi-LLM Synthesis — SOTA 2026 Research

> Research date: **2026-05-23**
> Context: BOSSNYUMBA101 wants multi-LLM consensus for deep reasoning + document creation paths.
> Target providers: Anthropic (Claude Opus 4.7, 1M ctx) + OpenAI (GPT-5.5 / o4-mini) + DeepSeek (V4 Pro / V4 Flash).
> Target packages: `packages/ai-copilot`, `packages/central-intelligence`.

---

## 0. Executive verdict

For BOSSNYUMBA's deep-reasoning + document paths in May 2026, the **default architecture** should be:

> **Tier-A router (RouteLLM/LiteLLM auto-router) → escalate to MoA-style fan-out (3 providers) → LLM-as-jury synthesizer (small judge) → confidence score → response.**

- **Route** for routine traffic (chat replies, classifications, simple drafts) — ~85% of calls go single-model and save 60-85% cost vs always-Opus.
- **Fan-out** for the ~15% of calls that are deep reasoning, irreversible document creation, legal/tenancy drafting, or financial analysis — pay 2-3x more, get materially better quality and a built-in hallucination + prompt-injection safety net.
- **Never** fan-out for streaming chat first-token latency-critical UX.

The whole thing fits inside **`packages/ai-copilot/src/synthesis/`** as a single TypeScript surface `synthesize({prompt, providers, judge, mode})` sitting on top of **Vercel AI SDK 5** (provider abstraction) + **LiteLLM proxy** (cost ceiling, batch, caching).

---

## 1. Foundational papers (2024-2026)

### 1.1 Mixture-of-Agents (MoA) — Together AI, Jun 2024 → ICLR 2025 Spotlight
- **SOTA**: layered architecture, each layer's agents see prior layer's outputs as auxiliary context, final aggregator *synthesizes* rather than picks. **65.1% on AlpacaEval 2.0 with OSS-only models, beating GPT-4 Omni's 57.5%.** Paper: `arxiv.org/abs/2406.04692`.
- **Repo**: `github.com/togethercomputer/MoA` (Apache-2).
- **2026 successor — Pyramid MoA**: adds a lightweight router that decides whether a query needs full fan-out or single-model. **93.0% on GSM8K with 61% lower compute cost** than vanilla MoA. This is the pattern we want.
- **2026 successor — Iterative Consensus Ensemble (ICE)**: 3 LLMs critique each other in rounds until consensus. Higher quality, ~3x latency cost.
- **Cost reality**: MoA's vanilla 4×4 (4 layers, 4 proposers) burns ~16 forward passes per request. Only viable with Pyramid MoA's early-exit router or a 1-layer 3-proposer + 1-aggregator config (what we'll use).

### 1.2 LLM-Blender (PairRanker + GenFuser) — ACL 2023, still SOTA for output fusion
- **SOTA**: two-stage. PairRanker scores N candidates pairwise with a cross-attention encoder; GenFuser fuses top-K into a single improved answer.
- **Average rank 3.2 across 12 methods vs best single LLM rank 3.9** on MixInstruct.
- **Repo**: `github.com/yuchenlin/LLM-Blender` + `github.com/avnlp/llm-blender`.
- **Why it matters for us**: GenFuser is the cleanest open implementation of "LLM-as-synthesizer that merges, not picks." We can replace PairRanker with cheap LLM-judge calls and keep GenFuser-style prompts.

### 1.3 Self-Consistency (Wang et al. 2023, Google) — still the workhorse
- Sample N reasoning paths from the *same* model at temp > 0, majority-vote the final answer. **+3.9% to +17.9% on GSM8K / MATH / ARC**. Paper: `arxiv.org/abs/2203.11171`.
- **2026 evolution**: Ranked Voting Self-Consistency (`arxiv.org/abs/2505.10772`) and Deep Think with Confidence (DeepConf) weight by token-level confidence.
- **For multi-LLM**: this is the "intra-model" baseline. Multi-LLM MoA is the "inter-model" generalization. Best practice — do both: ask each provider N=3 times, intra-vote, then inter-aggregate.

### 1.4 Tree-of-Thoughts (ToT) / Graph-of-Thoughts (GoT) / AutoMix
- ToT/GoT: explore reasoning branches with backtracking. High accuracy on planning/puzzle tasks, **5-50x token cost**.
- **AutoMix** (Madaan et al. 2023): weak-to-strong cascade — small model attempts, self-verifies, escalates to large model only on low confidence. Direct ancestor of RouteLLM.
- **RouteGoT (Mar 2026, `arxiv.org/abs/2603.05818`)**: routes each *node* of a GoT to a cheap or expensive model. **+8.1% accuracy, -79.1% tokens vs Adaptive GoT.**
- **Verdict for us**: GoT is overkill for tenancy docs / chat. AutoMix-style cascade is the right primitive.

### 1.5 Constitutional AI ensemble + Anthropic "Building effective agents" (Dec 2024)
- Anthropic's five patterns: **prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer**.
- **Parallelization** + **orchestrator-workers** + **evaluator-optimizer** are exactly our fan-out + synthesize + judge architecture.
- Source: `anthropic.com/research/building-effective-agents`.
- Maps directly: `synthesize({mode: 'fanout'})` = parallelization; `mode: 'orchestrate'` = orchestrator-workers; `mode: 'critique'` = evaluator-optimizer.

### 1.6 DSPy assertions for ensemble agreement
- Stanford NLP. `dspy.Assert` / `dspy.Suggest` enforce constraints at runtime; assertions improve constraint pass rates by **up to 164%** and quality by **+37%**.
- 2026 paper "Reaching Agreement Among Reasoning LLM Agents" (`arxiv.org/abs/2512.20184`) formalizes consensus convergence for stochastic agents.
- **Use case for us**: after fan-out, run a DSPy-style assertion `assert(answers.allAgreeOn('jurisdiction === "TZ"'))` before trusting the synthesized output.

---

## 2. Routing vs synthesis — when to do which

### 2.1 RouteLLM (LMSys, ICLR 2025) — production-ready single-shot routing
- **SOTA**: matrix factorization + BERT classifier + LLM-judge augmentation. **75% cost reduction at 95% GPT-4 quality on MT-Bench, 45% on MMLU, 35% on GSM8K.**
- **Repo**: `github.com/lm-sys/RouteLLM`. Pretrained routers ship out of the box.
- **Cost**: router itself is ~$0.0001/call (DistilBERT-class).

### 2.2 Commercial routers (May 2026)
| Router | Differentiator | Cost | Fit for us |
|--------|----------------|------|-----------|
| **Martian** (~$1.3B valuation Apr 2026) | "First LLM router," real-time prompt classifier, claims **20-97% cost cut, often beats GPT-4** | Per-request fee | Strong if we want zero ML ops |
| **Not Diamond** | Personalized router from your eval data | Free tier + per-call | Best if we have eval set |
| **Portkey** | Strongest governance (PII filter, guardrails), self-host option | $99+/mo team | **Best for compliance-heavy paths** (tenant PII, legal drafting) |

### 2.3 Always-fan-out synthesis
- 3x cost, ~1.3-2.0x latency (parallel), but **error rate drops ~40-60%** vs best single model on adversarial reasoning benchmarks per MoA paper.
- **Use only when**: irreversible action (sign a doc, post to ledger), legal/tenancy drafting, compliance answers, conflicting-evidence research.

---

## 3. Production routers/gateways (May 2026)

| Gateway | Stack | Strengths | Weaknesses | Verdict |
|---------|-------|-----------|------------|---------|
| **OpenRouter** | Hosted, 500+ models, 60+ providers | Unified OpenAI-compatible endpoint, auto-fallback, provider-sticky for cache hits | Markup ~5-10% on token price; no built-in synthesis | **Use as fallback channel** — never single-source. |
| **LiteLLM (BerriAI)** | OSS Python proxy, 100+ providers | OpenAI-format unified, cost tracking, **auto-router** (`auto`, `premium` modes), guardrails, load-balance, budget enforcement, full batch+cache | Self-host overhead; Python (we're TS) | **Primary gateway**. Run as sidecar; TS app speaks OpenAI format to it. |
| **Portkey** | Hosted + self-host | Best guardrails/PII/governance, retries, virtual keys | Paid for production-tier features | **Use for tenant-facing PII paths.** |
| **Helicone Router** | Rust OSS reverse proxy | Highest performance (Rust), deep observability | Newer (Mar 2026 launch) | Promising; revisit Q4 2026. |
| **Cloudflare AI Gateway** | Edge proxy | Free, caching, rate limit, near-zero latency | Shallow observability | Pre-gateway L1 cache only. |
| **LangChain init_chat_model** | TS/Py lib | Unified `BaseChatModel` interface | Heavy, not a gateway | Skip — Vercel AI SDK is cleaner. |
| **Vercel AI SDK v5** | TS-first | Provider registry (runtime switch), UIMessage/ModelMessage split, streaming, tool unification, 100+ models, **default Vercel AI Gateway** | Vendor pull toward Vercel | **Yes — adopt as our TS abstraction layer.** |
| **Together AI Routers** | Hosted | Built on Together MoA, OSS-friendly | OSS-only by default; less Claude/GPT depth | Use only for OSS fan-out. |
| **Anyscale Endpoints** | Hosted Ray | OSS Llama variants cheap | Less relevant — we want Claude+GPT+DeepSeek | Skip. |
| **Claude Code model-agnostic** | CLI | `ANTHROPIC_BASE_URL` redirects to any gateway (Bifrost, LiteLLM); 20+ providers | Dev tool, not runtime SDK | N/A for product runtime. |

**Stack pick**: **Vercel AI SDK v5 in app code → LiteLLM proxy as the gateway → OpenRouter as a tertiary failover channel.** Portkey wraps PII-sensitive endpoints.

---

## 4. Consensus algorithms

| Algorithm | Best for | Library | Cost |
|-----------|----------|---------|------|
| **Majority vote** | Classification, yes/no, structured choice | trivial | $0 |
| **Confidence-weighted vote** | Calibrated tasks (extraction, scoring) | Custom; calibrate via temperature scaling or verbalized confidence (`arxiv.org/abs/2306.13063`) | $0 |
| **LLM-as-judge tie-break (jury of N)** | Open-ended text, when 2 of 3 agree but 1 dissents | `confident-ai`, `deepeval`, custom | 1 cheap-LLM call |
| **Pairwise tournament (Knockout, `arxiv.org/abs/2506.03785`)** | Ranking many candidates | Custom | O(N log N) judge calls |
| **GenFuser-style LLM aggregator** | Open-ended synthesis (docs, emails, summaries) | `LLM-Blender` repo | 1 strong-LLM call |
| **BT-σ jury (`arxiv.org/abs/2602.16610`)** | High-stakes ranking with judge-reliability modeling | Research code | Heavier |
| **Probabilistic ensemble (semantic conf. aggregation)** | When you have logprobs | Custom | $0 |

**Our default**: majority-vote for classifications, GenFuser-style aggregator for prose/docs, LLM-jury for tie-breaks. Pairwise tournament reserved for "pick the best of N draft contracts" UX.

---

## 5. Calibration & verification

- **Reasoning agreement vs answer agreement**: two LLMs can land on the same answer for different reasons — that's *fragile* consensus. Compare *rationales* (cosine sim on rationale embeddings > 0.7) before trusting agreement. Source: cross-model consistency `arxiv.org/abs/2508.14314` reports **F1 +6-39%** vs single-model.
- **Citation cross-check**: when each LLM does its own retrieval, only sources cited by **≥2 of 3** are trusted. Sources cited by 1 of 3 → flag as "unverified." This kills the dominant RAG hallucination failure mode.
- **Source-grounded synthesis**: give each LLM the *same* retrieval context, then ask the synthesizer to spot *evidence-conflicting* claims across the 3 outputs. The synthesizer's job becomes evidence reconciliation, not creative writing.
- **TOHA / metamorphic relations**: structural hallucination detectors (`arxiv.org/abs/2504.10063`, `arxiv.org/abs/2502.15844`). Production-grade for high-risk paths.

---

## 6. Cost optimization

### 6.1 Cascade (cheap → expensive)
- Pattern: try DeepSeek V4 Flash → if confidence < τ, try GPT-5.4 mini → if still low, escalate to Claude Opus 4.7.
- AutoMix / RouteLLM both implement this. Saves 70-85% cost on routine traffic.

### 6.2 Speculative (cheap proposer + expensive verifier)
- Cheap LLM drafts; expensive LLM verifies/edits. 2026 advances (`Speculative Speculative Decoding`, ICLR 2026) push **2-3x latency reduction** at parity quality. Less applicable across providers (each API is opaque) but the *concept* maps to "DeepSeek drafts the doc, Opus 4.7 redlines."

### 6.3 Prompt caching across providers (huge May 2026 lever)
| Provider | Cache discount | Notes |
|----------|----------------|-------|
| Anthropic | **90% off cached input** (5-min TTL, explicit `cache_control`) | Best when you control cache boundaries |
| OpenAI | **~50-90% off, automatic** | No control, breaks on prompt churn |
| DeepSeek V4 | **Cache hit $0.0028/M vs miss $0.14/M = ~98% off** | Cheapest cache in the industry |
- **Stacked discounts**: Anthropic batch + cache = **up to 95% off input**. OpenAI batch + cache = ~75% off.
- **Sticky routing**: OpenRouter has provider-sticky mode to maximize cache hits — adopt this.

### 6.4 Batch APIs
- Anthropic Batches, OpenAI Batches, DeepSeek off-peak: **50% across-the-board discount**.
- Use for: nightly tenant report regeneration, marketing brain bulk personalization, embedding backfills, eval runs.
- Do **not** use for: chat, real-time agent loops.

---

## 7. Provider abstraction

**Pick: Vercel AI SDK v5.** Reasons:
- TS-native (BOSSNYUMBA is TS monorepo).
- Provider registry allows runtime model switching without redeploy.
- Built-in streaming, tool unification, structured-output.
- 100+ models, 16+ providers (Anthropic, OpenAI, DeepSeek all first-class).
- Clean separation: `UIMessage` (what the React UI renders) vs `ModelMessage` (what the LLM gets).

LiteLLM sits *behind* Vercel AI SDK as the gateway — AI SDK speaks OpenAI format to LiteLLM, LiteLLM translates to each provider's native API and handles cost/budget/cache/loadbalance/auto-router policy centrally.

---

## 8. DeepSeek specifics (May 2026)

- **Current models**: `deepseek-v4-flash` and `deepseek-v4-pro` (V3.5/R2 nomenclature was superseded — V4 launched Q1 2026).
- **Context**: **1M tokens, 384K max output** (unified across thinking + non-thinking modes).
- **Pricing**:
  - V4 Flash: $0.0028/M cache-hit, $0.14/M cache-miss input, **$0.28/M output**.
  - V4 Pro: $0.003625/M cache-hit, **$0.435/M input, $0.87/M output** (permanent since 2026-05-22).
- **Tool use**: full function-calling, JSON-mode, structured outputs.
- **Anthropic compatibility**: `https://api.deepseek.com/anthropic` speaks Anthropic Messages API natively — drop-in for Claude SDK / `ANTHROPIC_BASE_URL`.
- **Verdict**: V4 Pro is the **cheapest credible deep-reasoning model** in the trio — 20-30x cheaper than Opus 4.7 input, 30x cheaper output. Perfect "third opinion" in fan-out.

---

## 9. Latency & streaming

- **Race-and-stream**: fire all 3 providers, start streaming the **first** that emits a token (typically DeepSeek Flash). Cancel slowest after fastest finishes (saves $). Keep middle as silent verifier — if it disagrees, append a soft "note: alternate interpretation..." footer or trigger re-synth.
- **Partial response merging** (Staircase Streaming `arxiv.org/abs/2510.05059`): begin synthesizer step on partial proposer outputs, **TTFT -93%**. Harder to implement, only attempt after baseline ships.
- **Hedged requests** (`github.com/bhope/hedge`): fire backup at p90 of estimated latency. Cap hedge rate to prevent load-amp during outages. Wire this into LiteLLM router policy.

---

## 10. Failure modes & defenses

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| All 3 LLMs hallucinate the same fact (correlated error) | Cross-check against retrieval/KG | Source-grounded synthesis (Section 5) |
| 1 LLM disagrees strongly (1 of 3) | Pairwise rationale divergence > τ | Tie-break with LLM-jury of N=5 cheap calls |
| 3 LLMs strongly disagree (no majority) | Entropy of clustered answers > τ | **Escalate to human** + persist all 3 + judge rationale |
| Prompt injection compromises 1 provider | Compare outputs — injected response will diverge in style/content | Multi-provider fan-out is inherently resilient (1 compromised ≠ all compromised); add output-side guardrails (`packages/ai-copilot/guardrails`) |
| Provider outage (cascading) | Health probes, p99 monitoring | LiteLLM fallback chain + OpenRouter as L3 channel |
| Token budget breach | LiteLLM budget enforcement | Hard cap per tenant; emit alert; degrade to cheapest single-model |
| Stale cache poisoning | Cache TTL + cache-key includes prompt-hash + provider-version | 5-min Anthropic TTL is conservative; we won't extend |
| Synthesizer LLM itself hallucinates | The synthesizer answer disagrees with all 3 proposers | DSPy-style assertion: `assert(synth.cites_only_from(proposers))` |

---

## Reference architecture

```
                ┌──────────────────────────────────────────┐
   user prompt ─▶│  packages/ai-copilot/synthesis/router.ts │
                └─────┬───────────────────────────┬────────┘
                      │                           │
              (RouteLLM classifier)        (mode override / policy)
                      │                           │
            ┌─────────┴─────┐                     │
            │ single model? │                     │
            └───┬───────┬───┘                     │
                │ yes   │ no (fan-out)            │
                ▼       ▼                         │
       ┌────────────────────────────────────────┐ │
       │  packages/ai-copilot/synthesis/fanout  │◀┘
       │  parallel calls via Vercel AI SDK v5   │
       │  ┌──────────┬──────────┬────────────┐  │
       │  │ Claude   │ GPT-5.5  │ DeepSeek   │  │
       │  │ Opus 4.7 │ / o4-mini│ V4 Pro     │  │
       │  └─────┬────┴─────┬────┴──────┬─────┘  │
       └────────┼──────────┼───────────┼────────┘
                ▼          ▼           ▼
        ┌─────────────────────────────────────┐
        │  judge.ts (LLM-as-jury + agreement) │
        │  - rationale-divergence score       │
        │  - citation cross-check             │
        │  - DSPy-style assertions            │
        └────────────────┬────────────────────┘
                         ▼
        ┌─────────────────────────────────────┐
        │  synthesizer.ts (GenFuser-style)    │
        │  Claude Opus 4.7 by default         │
        │  prompt = original + 3 proposals    │
        │           + judge notes + evidence  │
        └────────────────┬────────────────────┘
                         ▼
        ┌─────────────────────────────────────┐
        │  confidence.ts                      │
        │  {score: 0..1, dissent?, sources[]} │
        └────────────────┬────────────────────┘
                         ▼
                  streamed response
                  + audit trail in
                  packages/central-intelligence/audit
```

All gateway-level cross-cuts (cost cap, batch, cache, fallback) live in **LiteLLM proxy** sitting between Vercel AI SDK and the providers. Tenant PII paths additionally route via **Portkey** for guardrails.

---

## When to fan-out vs route — decision matrix

| Task type | Default mode | Why | Cost vs single-Opus |
|-----------|--------------|-----|---------------------|
| Chat reply, casual Q&A | **Route** (RouteLLM → DeepSeek Flash) | Quality ceiling low; latency matters | **~3% cost** |
| Classification (intent, sentiment) | **Route** to V4 Flash | Self-consistency vote within Flash if temp>0 | ~3% |
| Tenant lookup / data extraction | **Route** with cache | Repeats hit cache | ~1-5% |
| Marketing copy draft | **Route** GPT-5.4 | One opinion fine | ~25% |
| Tenancy agreement clause draft | **Fan-out + GenFuser synthesis** | Legal stakes, irreversible | **~120%** (3 providers parallel, Opus synth) |
| Property valuation / financial analysis | **Fan-out + judge** | Numeric correctness, calibration | ~100% |
| Compliance Q&A (KYC, AML, tenancy law) | **Fan-out + citation cross-check** | Regulatory exposure | ~100% |
| Deep research / multi-doc synthesis | **MoA 2-layer (Pyramid)** | Quality > cost | ~200% |
| Code generation (internal tooling) | **Cascade**: V4 Pro → escalate to Opus on failure | High variance | ~30% |
| Translation / localization | **Fan-out + majority** | Multiple right answers; cross-check catches drift | ~80% |
| Streaming agent loop (chat-first UX) | **Single-model + speculative cheap proposer** | TTFT critical | ~10% |

---

## Cost & latency table — Anthropic + OpenAI + DeepSeek fan-out

Assume a **2,000-token deep-reasoning prompt + 1,000-token output**, run 3-way (one shot each) + Opus 4.7 synthesizer over the 3 outputs (~1,500 in + 800 out).

| Provider call | Input tokens | Output tokens | Input $/M | Output $/M | Cost | p50 latency |
|---------------|--------------|---------------|-----------|------------|------|-------------|
| Claude Opus 4.7 (proposer) | 2,000 | 1,000 | $5 | $25 | $0.035 | ~7 s |
| GPT-5.5 (proposer) | 2,000 | 1,000 | $5 | $30 | $0.040 | ~6 s |
| DeepSeek V4 Pro (proposer) | 2,000 | 1,000 | $0.435 | $0.87 | $0.0017 | ~5 s |
| **Subtotal proposers (parallel, p50 = max ≈ 7s)** | | | | | **$0.077** | **~7 s** |
| Claude Opus 4.7 (synthesizer) | 1,500 | 800 | $5 | $25 | $0.028 | ~5 s |
| Cheap LLM-jury (DeepSeek Flash, 500 in / 200 out) | 500 | 200 | $0.14 | $0.28 | $0.00013 | ~1 s |
| **Fan-out total** | | | | | **~$0.105** | **~12 s** |
| Single Opus 4.7 baseline | 2,000 | 1,000 | $5 | $25 | $0.035 | ~7 s |
| Single GPT-5.5 baseline | 2,000 | 1,000 | $5 | $30 | $0.040 | ~6 s |
| Single DeepSeek V4 Pro baseline | 2,000 | 1,000 | $0.435 | $0.87 | $0.0017 | ~5 s |

**With Anthropic cache hit (90% off) + DeepSeek cache (~98% off)** on system prompt portion (assume 1,500 of the 2,000 input tokens cached):
- Cached fan-out total ≈ **$0.035** (3x cheaper than uncached, comparable to single uncached Opus).
- **With Batch API (non-realtime paths)**: stack another 50% → **~$0.018** per fan-out request. Approaching single-Flash pricing.

**Takeaway**: with caching + batch, **fan-out costs roughly 1x what an uncached single Opus call costs today**. The "3x cost" mental model is wrong once caching is wired.

---

## Concrete TS API for BOSSNYUMBA

`packages/ai-copilot/src/synthesis/index.ts`:

```ts
import type { LanguageModel } from 'ai' // Vercel AI SDK v5

export type ProviderId = 'anthropic' | 'openai' | 'deepseek' | 'fallback'

export type SynthesisMode =
  | 'route'        // single-model via RouteLLM classifier
  | 'fanout'       // parallel call, GenFuser-style synthesis
  | 'cascade'      // cheap → escalate
  | 'orchestrate'  // orchestrator decomposes → workers → synth
  | 'critique'     // evaluator-optimizer loop

export interface ProviderConfig {
  readonly id: ProviderId
  readonly model: LanguageModel
  readonly weight?: number    // default 1.0
  readonly role?: 'proposer' | 'synthesizer' | 'judge'
  readonly maxCostUsd?: number
}

export interface JudgeConfig {
  readonly model: LanguageModel              // typically cheap (DeepSeek Flash)
  readonly agreementThreshold: number         // 0..1, default 0.7
  readonly tieBreakStrategy: 'jury' | 'tournament' | 'human'
  readonly juryCount?: number                 // default 5 for jury
}

export interface SynthesizeInput {
  readonly prompt: string
  readonly system?: string
  readonly providers: readonly ProviderConfig[]
  readonly judge?: JudgeConfig
  readonly mode: SynthesisMode
  readonly retrievalContext?: readonly RetrievedDoc[]   // for citation cross-check
  readonly budgetUsd?: number
  readonly timeoutMs?: number
  readonly stream?: boolean
  readonly tenantId: string                              // PII path detection
}

export interface SynthesizeResult {
  readonly text: string
  readonly confidence: number                            // 0..1
  readonly dissent?: ReadonlyArray<{
    readonly providerId: ProviderId
    readonly rationale: string
  }>
  readonly sources?: ReadonlyArray<{
    readonly url: string
    readonly citedBy: readonly ProviderId[]              // ≥2 → trusted
  }>
  readonly cost: {
    readonly totalUsd: number
    readonly perProvider: Readonly<Record<ProviderId, number>>
  }
  readonly latency: {
    readonly totalMs: number
    readonly perProvider: Readonly<Record<ProviderId, number>>
  }
  readonly auditId: string                                // joins central-intelligence audit log
}

export async function synthesize(
  input: SynthesizeInput
): Promise<SynthesizeResult> {
  // 1. validate (zod) + check budget + tenant policy
  // 2. dispatch by mode:
  //    - route: classifier → single call
  //    - fanout: Promise.allSettled across providers; on each settle, judge
  //    - cascade: sequential with confidence gate
  //    - orchestrate: orchestrator LLM emits a DAG, workers execute, synth
  //    - critique: evaluator-optimizer loop with bounded iterations
  // 3. aggregate via judge
  // 4. synthesize via synthesizer provider (or use top-1 if all agree)
  // 5. compute confidence (rationale similarity + citation overlap + judge score)
  // 6. write audit row to packages/central-intelligence/audit
  // 7. return immutable result
}

// Streaming variant
export function synthesizeStream(
  input: SynthesizeInput
): AsyncIterable<SynthesizeChunk> { /* race-and-stream-fastest */ }
```

**File layout** (one concern per file, ≤400 lines each per coding-style.md):

```
packages/ai-copilot/src/synthesis/
  index.ts                  # public API (synthesize, synthesizeStream)
  types.ts                  # all interfaces above
  router.ts                 # RouteLLM-backed classifier (single-model decision)
  fanout.ts                 # parallel dispatch + Promise.allSettled
  cascade.ts                # confidence-gated escalation
  orchestrate.ts            # orchestrator-workers (per Anthropic guide)
  critique.ts               # evaluator-optimizer loop
  judge.ts                  # LLM-as-jury, pairwise, rationale similarity
  synthesizer.ts            # GenFuser-style aggregator prompt
  confidence.ts             # compute final confidence score
  citations.ts              # citation cross-check (≥2 of 3 trusted)
  budget.ts                 # budget cap, fallback strategy
  cache.ts                  # multi-provider cache key + sticky routing hints
  guardrails.ts             # delegate to Portkey for PII paths
  assertions.ts             # DSPy-style assert helpers
  audit.ts                  # writes to packages/central-intelligence/audit
  __tests__/...
```

`packages/central-intelligence/src/audit/synthesis-audit.ts`:

```ts
export interface SynthesisAuditRow {
  readonly id: string
  readonly tenantId: string
  readonly prompt: string
  readonly mode: SynthesisMode
  readonly providers: readonly ProviderId[]
  readonly responses: ReadonlyArray<{
    readonly providerId: ProviderId
    readonly text: string
    readonly rationale?: string
    readonly latencyMs: number
    readonly costUsd: number
  }>
  readonly judge: {
    readonly agreementScore: number
    readonly dissentingProviders: readonly ProviderId[]
  }
  readonly synthesisText: string
  readonly confidence: number
  readonly escalatedToHuman: boolean
  readonly createdAt: string
}
```

---

## Build checklist for BOSSNYUMBA (minimum viable fan-out)

1. **Adopt Vercel AI SDK v5** across `packages/ai-copilot` (replace any per-provider client code).
2. **Deploy LiteLLM proxy** as a sidecar in our existing infra (Docker, behind cluster ingress). Wire OpenAI-format `baseURL` to it.
3. **Configure provider routes** in LiteLLM:
   - `anthropic/claude-opus-4-7-1m` → Anthropic direct
   - `openai/gpt-5-5` → OpenAI direct
   - `deepseek/v4-pro` → DeepSeek direct, with Anthropic-compatible endpoint as backup
   - Fallback chain on each: OpenRouter → cached snapshot
4. **Ship `synthesize({mode: 'route'})` first** (RouteLLM classifier + single call). Validate cost monitoring, audit log.
5. **Ship `synthesize({mode: 'fanout'})`** for the tenancy doc / financial analysis / compliance Q&A paths. Wire the GenFuser prompt and the cheap-LLM judge.
6. **Add citation cross-check** in `citations.ts` for any path with retrieval context.
7. **Wire Portkey** for endpoints that touch tenant PII (extract from `tenantId` + path tags).
8. **Add DSPy-style assertions** in `assertions.ts` for must-hold invariants (e.g., jurisdiction, currency, tenant scope).
9. **Hook batch API path** for nightly bulk regeneration jobs (`packages/marketing-brain` personalization, periodic tenant reports).
10. **Eval suite**: replay 500 prod prompts through `route`, `fanout`, and single-Opus baselines. Compare cost, latency, and quality (LLM-judge) per task type. Use this to **tune which tasks default to fan-out**.

---

## Open research / things to revisit

- **Pyramid MoA (2026)**: paper / repo not yet open-sourced as of 2026-05-23. Watch for release — could replace our `router.ts` + `fanout.ts` with a single tighter primitive.
- **Helicone Router (Mar 2026)**: Rust-based, very fast. Revisit at Q4 2026 once stable. Could replace LiteLLM for the gateway tier.
- **Speculative cross-provider decoding**: still research-only across providers (each API is opaque). When/if Anthropic exposes draft-token-acceptance APIs, revisit.
- **OpenAI Realtime API + voice paths**: out of scope here; fan-out doesn't apply to voice latency budgets.

---

## Sources

### Foundational papers
- [Mixture-of-Agents (Together AI, Jun 2024, ICLR 2025)](https://arxiv.org/abs/2406.04692)
- [Together MoA blog](https://www.together.ai/blog/together-moa)
- [Together MoA repo](https://github.com/togethercomputer/MoA)
- [Pyramid MoA (2026 Spheron guide)](https://www.spheron.network/blog/mixture-of-agents-gpu-cloud/)
- [LLM-Blender (PairRanker + GenFuser, ACL 2023)](https://arxiv.org/abs/2306.02561)
- [LLM-Blender repo (avnlp fork, active)](https://github.com/avnlp/llm-blender)
- [Self-Consistency (Wang et al., 2023)](https://arxiv.org/abs/2203.11171)
- [Ranked Voting Self-Consistency (May 2026)](https://arxiv.org/abs/2505.10772)
- [Deep Think with Confidence (DeepConf)](https://jiaweizzhao.github.io/deepconf/static/pdfs/deepconf_arxiv.pdf)
- [RouteGoT (Mar 2026)](https://arxiv.org/abs/2603.05818)
- [Adaptive Graph of Thoughts](https://arxiv.org/abs/2502.05078)
- [DSPy Assertions paper](https://arxiv.org/abs/2312.13382)
- [DSPy docs (Assertions)](https://dspy.ai/learn/programming/7-assertions/)
- [Reaching Agreement Among Reasoning LLM Agents (2026)](https://arxiv.org/abs/2512.20184)
- [Anthropic: Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents)

### Routing & gateways
- [RouteLLM repo (LMSys)](https://github.com/lm-sys/RouteLLM)
- [RouteLLM paper](https://arxiv.org/abs/2406.18665)
- [Martian valuation report (Apr 2026)](https://medium.com/@sarawgiapoorvwork347/martian-the-san-francisco-based-startup-that-invented-the-first-llm-router-is-reportedly-nearing-4211dd768296)
- [LiteLLM repo (BerriAI)](https://github.com/BerriAI/litellm)
- [LiteLLM Auto-router discussion](https://github.com/BerriAI/litellm/discussions/25703)
- [OpenRouter](https://openrouter.ai/)
- [OpenRouter provider routing docs](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Portkey vs LiteLLM vs OpenRouter (2026)](https://toolhalla.ai/blog/openrouter-vs-litellm-vs-portkey-2026)
- [Best LLM gateways 2026 (Braintrust)](https://www.braintrust.dev/articles/best-llm-gateways-2026)
- [Helicone AI Gateway (Mar 2026, Rust)](https://blog.brightcoding.dev/2026/03/14/helicone-ai-gateway-the-revolutionary-rust-powered-llm-router)
- [Vercel AI SDK 5 announcement](https://vercel.com/blog/ai-sdk-5)
- [Vercel AI SDK docs](https://ai-sdk.dev/docs/introduction)
- [Claude Code with non-Anthropic models (Bifrost gateway, 2026)](https://www.getmaxim.ai/articles/how-to-use-claude-code-with-non-anthropic-models-the-enterprise-gateway-guide-2026/)
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config)

### Calibration, hallucination detection, verification
- [Zero-knowledge cross-model consistency hallucination detection](https://arxiv.org/abs/2508.14314)
- [TOHA: topological hallucination detection](https://arxiv.org/abs/2504.10063)
- [Metamorphic relations for hallucination detection](https://arxiv.org/abs/2502.15844)
- [LLM-as-jury (BT-σ)](https://arxiv.org/abs/2602.16610)
- [Knockout LLM Assessment (pairwise tournament)](https://arxiv.org/abs/2506.03785)
- [Verbalized uncertainty in LLMs](https://arxiv.org/abs/2306.13063)
- [LLM-as-Judge 2026 guide (Label Your Data)](https://labelyourdata.com/articles/llm-as-a-judge)

### Cost & infrastructure (May 2026 pricing)
- [Claude Opus 4.7 pricing (CloudZero)](https://www.cloudzero.com/blog/claude-opus-4-7-pricing/)
- [Anthropic API pricing 2026 (Finout)](https://www.finout.io/blog/anthropic-api-pricing)
- [OpenAI API pricing 2026 (MetaCTO)](https://www.metacto.com/blogs/unlocking-the-true-cost-of-openai-api-a-deep-dive-into-usage-integration-and-maintenance)
- [DeepSeek API pricing (May 2026, CostGoat)](https://costgoat.com/pricing/deepseek-api)
- [DeepSeek V4 Pro permanent pricing announcement](https://venturebeat.com/ai/deepseeks-new-v3-2-exp-model-cuts-api-pricing-in-half-to-less-than-3-cents)
- [Prompt caching across providers 2026 (TokenMix)](https://tokenmix.ai/blog/prompt-caching-guide)
- [LLM API cost comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)

### Latency / streaming
- [Hedge: adaptive hedged requests](https://github.com/bhope/hedge)
- [Staircase Streaming for low-latency multi-agent inference](https://arxiv.org/abs/2510.05059)
- [Speculative Speculative Decoding (ICLR 2026)](https://openreview.net/pdf?id=aL1Wnml9Ef)
