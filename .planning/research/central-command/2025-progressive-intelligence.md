# Progressive Intelligence Research — 2025-2026

**Researched:** 2026-05-15
**Mode:** Ecosystem
**Confidence:** HIGH (Letta, Mem0, Zep, Self-RAG, Voyager, Reflexion, DSPy, LoRA, ChatGPT Memory, LangSmith, sleep-time-compute all verified against primary sources / arXiv / vendor docs)

Question: How does BOSSNYUMBA's brain become "always learning, always updating"
— every chat, every admin action, every feedback signal makes the brain smarter
— without expensive full retraining?

---

## 1. Memory architecture for an "always-learning" brain

Production-grade memory in 2025-2026 has converged on a 4-tier hierarchy inspired
by cognitive science (Tulving) but implemented as discrete services:

| Tier | Cognitive analogue | What it stores | Latency | Frameworks |
|------|--------------------|----------------|---------|------------|
| **Working / Core** | RAM | Active turn + pinned facts about tenant/user | ms | Letta core_memory blocks, ChatGPT "saved memories" |
| **Episodic** | Hippocampus | Verbatim turns, tool calls, outcomes (with timestamp + trace_id) | 10–100 ms | Letta `recall_memory`, Zep episode subgraph, Mem0 raw |
| **Semantic** | Cortex | Distilled entities, relations, facts ("Unit 4B has chronic leak") | 50–200 ms | Zep Graphiti, Mem0 entity graph, MemGPT archival |
| **Procedural** | Cerebellum / basal-ganglia | Reusable skills, prompts, workflows, code | 10 ms (registry) | Voyager skill library, DSPy compiled programs, LoRA adapters |
| **Reflective** | Prefrontal cortex | Self-critique notes ("last time I forgot to convert TZS→USD") | 50 ms | Reflexion buffer, Claude "dreaming" memos |

Best mapping for BOSSNYUMBA property management:
- **Letta / MemGPT** is the cleanest mental model for tenant-scoped agents because
  every block is namespaced and the model itself decides what to promote (LLM as OS).
- **Zep / Graphiti** wins for property-management specifically because units,
  tenants, contracts, payments, and maintenance tickets are *entities with
  validity windows*. "Tenant X lived in 4B from Jan-Mar" must be queryable as
  "true at time T". Graphiti's bi-temporal validity model (valid-time +
  transaction-time) is exactly the model BOSSNYUMBA needs.
- **Mem0** is the cheapest single-pass extractor and is now AWS Agent SDK's
  default — useful as the ADD-only ingestion stage feeding Zep.

Recommended composite: **Mem0-style single-pass extractor → Zep/Graphiti
tenant-scoped temporal KG → Letta-style core blocks for active context →
Voyager-style skill registry for procedural** (BOSSNYUMBA already has
`packages/ai-copilot/src/memory/{semantic-memory,memory-decay,memory-extractor}.ts`
plus `services/consolidation-worker` — this is exactly the right shape, but
missing the temporal graph layer and skill registry).

---

## 2. Continuous learning loop — per-turn / hourly / nightly

Production systems run a tiered cadence. Anything that touches model weights is
slow and risky; anything that touches prompts/memory/retrieval is fast and safe.

| Cadence | What runs | Why now | Cost / risk |
|---------|-----------|---------|-------------|
| **Per-turn (sync, <100 ms)** | Retrieve memory, route, generate, run reflection token (Self-RAG IsREL/IsSUP/IsUSE), emit trace + thumbs widget | The agent must decide *during the turn* whether to retrieve and whether its own answer is supported | Token cost only, no training |
| **Per-turn (async)** | Mem0 ADD pass — extract facts from the just-completed turn; push to episodic | Memory must be ready before the *next* turn | One small LLM call per turn |
| **Hourly** | LangSmith/LangFuse pipeline: aggregate low-thumbs traces, rule-based alerts, LLM-as-judge over 1% sample | Drift detection; surface regression fast | Cheap |
| **Nightly (sleep-time)** | Reflexion summarisation, Voyager skill-library curation, Zep entity consolidation/community detection, memory decay | Compress today's interactions into reusable semantic + procedural memory | One big batch LLM job |
| **Weekly** | DSPy MIPROv2 / GEPA prompt recompilation against newly-labelled traces; eval against frozen golden set | Compound prompt improvements without weight changes | GPU-free, hours |
| **Monthly (only if drift demands)** | QLoRA adapter retrain on curated high-signal data; A/B vs base | Encode patterns prompts cannot express | $50–500 per adapter; risk of catastrophic forgetting |

Sources: Reflexion (Shinn et al., arXiv 2303.11366), Self-RAG (Asai et al., ICLR
2024), Anthropic "dreaming" / sleep-time compute (April 2025 paper), DSPy GEPA
(July 2025), Mem0 ECAI 2025 paper, LangSmith Automation Rules (2025).

This maps almost 1:1 onto BOSSNYUMBA's existing layout: per-turn lives in the
Jarvis stream path; nightly is `services/consolidation-worker`
(`k8s/consolidation-worker-cron.yaml`); weekly is the missing piece.

---

## 3. Feedback signal collection — mapping to FeedbackThumbs (PR #56)

The single most important production lesson from 2025: **explicit feedback is <1%
of interactions**. RLUF (Reinforcement Learning from User Feedback, arXiv
2505.14946) and ICML 2025 "Implicit User Feedback in Human-LLM Dialogues" both
show implicit signals carry the bulk of the information — but they are noisier.

The existing `FeedbackThumbs` component already covers explicit. The progressive
brain must also capture:

| Signal | Type | Strength | Where in BOSSNYUMBA to capture |
|--------|------|----------|--------------------------------|
| Thumbs-up / down | Explicit | High (rare) | Existing — link to `trace_id` |
| Free-text feedback | Explicit | Highest (rarest) | Add modal on thumbs-down |
| Copy-to-clipboard on AI answer | Implicit | High (user found it useful) | `apps/*/components/AIResponse` |
| Re-prompt within 30s ("no, what I meant…") | Implicit | High (negative) | Conversation turn gap analysis |
| Edit-and-resubmit of agent-generated draft (lease, maintenance ticket, listing) | Implicit | Very high (granular correction signal) | Agency action diff vs final saved row |
| Admin override of agent-suggested action | Implicit | Critical (this is "RLHF on rails") | Already audited in event stream — needs labelling |
| Time-to-resolution after AI suggestion | Implicit | Medium (proxy for usefulness) | Tickets / chats — outcome attribution |
| Tenant follow-up question rate | Implicit | Medium (proxy for clarity) | Turn count per session |
| Abandonment mid-turn | Implicit | Medium (frustration) | Stream cancellation |
| Tool-call failure rate | Internal | High | Agency port emits — already there |
| Eval scores (existing 222 evals) | Internal | High | Already in CI |

Critical: every signal must carry `tenant_id`, `user_role`, `surface`, `trace_id`,
and `agent_action_id` so feedback can be back-attached to the exact prompt
template + memory bundle + skill that produced it. Without that join key,
feedback is unusable for learning.

Source: Langfuse User Feedback docs (2025), Nebuly LLM feedback loop guide,
Anthropic engineering blog on evals.

---

## 4. Skill library growth — Voyager-style for property management

Voyager (Wang et al., arXiv 2305.16291) demonstrated that an agent in Minecraft
gets 3.3× more items and unlocks tech 15.3× faster than baselines purely by
**writing JavaScript skills it discovers work and indexing them by embedding of
the natural-language description**. No fine-tuning — pure procedural memory.

For BOSSNYUMBA the skill library is:

- A namespaced (per-tenant + global) registry of validated workflows the brain
  has *succeeded* with: "draft late-rent reminder in Swahili respecting grace
  period", "compute prorated charge when tenant moves mid-month", "escalate
  maintenance ticket #priority=P1 within 2h SLA".
- Each entry stores: NL description, embedding, structured tool-call template,
  success count, failure count, last-used timestamp, owning-tenant scope, code
  hash.
- Promotion criteria: a sequence of tool calls becomes a skill when (a) it
  recurs ≥N times, (b) ≥M of those carry thumbs-up or successful outcome, and
  (c) consolidation-worker confirms the I/O signature is stable.
- Retrieval at inference: top-5 by embedding similarity to current intent,
  injected into the prompt as "you have previously succeeded with these
  patterns".

This is the layer BOSSNYUMBA's brain is currently missing. The consolidation
worker compresses memory but doesn't promote successful trace-clusters into
named callable skills. Adding `packages/central-intelligence/src/skill-library`
with a small Postgres table + pgvector index is the highest-leverage upgrade.

---

## 5. Reflection cycle — Reflexion + Self-RAG + Constitutional AI

Three patterns to compose:

- **Per-turn Self-RAG critique** — emit IsREL (was retrieved evidence relevant?),
  IsSUP (does the answer cite supporting evidence?), IsUSE (is the answer
  useful?). Self-RAG achieved the lowest hallucination rate (5.8%) across 12 RAG
  variants in 2025 MDPI study. For BOSSNYUMBA: zero-tolerance for hallucinated
  rent numbers / unit IDs / lease terms — IsSUP must be enforced on any
  financial or contractual claim.
- **Per-session Reflexion** — at session end, the agent writes a short verbal
  reflection ("I assumed the tenant meant Unit 4B but they said 4F; next time
  ask before fuzzy-matching"). Stored in reflective tier, retrieved at start of
  next session with same tenant. Reflexion delivers +22% on AlfWorld, +20% on
  HotPotQA, +11% on HumanEval *without any weight updates*.
- **Per-batch Constitutional / RLAIF** — define BOSSNYUMBA's constitution (TZ
  Rental Act compliance, GDPR, no rent advice without disclaimer, currency
  preferences user-chain). Have a critic model score nightly samples against the
  constitution and feed pass/fail into the prompt optimisation cycle.

---

## 6. Sleep-time compute — mapping to K2.2 consolidation worker

Anthropic's April 2025 "sleep-time compute" paper and the "Claude dreaming"
roll-out describe exactly what `services/consolidation-worker` should do.
Current consolidation logic should grow into a multi-stage nightly job:

1. **Ingest** — pull the day's traces, thumbs, overrides, edit-diffs.
2. **Cluster** — group by intent / failure mode (embedding clustering).
3. **Reflect** — for each cluster, run an LLM critic to write a 1-paragraph
   "what went well / what failed / what to do next time".
4. **Promote** — if a cluster shows recurring success, lift it to skill library;
   if recurring failure, generate a prompt patch + add a regression eval.
5. **Decay** — apply decay to semantic-memory entries un-touched for N days
   (existing `memory-decay.ts` is the right hook).
6. **Consolidate** — Zep-style community detection on the entity graph; merge
   duplicate "Tenant John Mwangi" nodes.
7. **Re-embed** — re-embed promoted facts with the current embedding model
   version to keep retrieval consistent.
8. **Publish** — emit a "brain delta" event so other services can refresh caches.

All of this is external-memory only — the base model never changes. This is the
correct first step before any LoRA work.

Sources: Anthropic dreaming feature (Mindstudio blog 2025), Sleep-time Compute
paper (April 2025), Letta v1 agent re-architecture (2025).

---

## 7. Top 10 specific upgrades, ranked by impact / effort

| # | Upgrade | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| 1 | **Wire FeedbackThumbs to trace_id + agent_action_id with implicit-signal sidecar (copy, re-prompt, edit-resubmit, override)** | 10/10 | S | Without join keys no other upgrade matters. RLUF / ICML 2025 evidence. |
| 2 | **Skill library (Voyager-style) with promotion from successful trace clusters** | 9/10 | M | New `central-intelligence/src/skill-library` package; pgvector. |
| 3 | **Self-RAG reflection tokens on every financial / contractual claim** | 9/10 | M | Lowest hallucination rate in production. Block answer if IsSUP=false. |
| 4 | **Reflexion buffer per (tenant, user) — write at session end, inject at session start** | 8/10 | S | Pure prompt-layer; verbal RL, no weights. |
| 5 | **Zep/Graphiti temporal entity graph** for tenant/unit/contract/payment with validity windows | 8/10 | L | +18.5% accuracy, -90% latency per Zep paper. Big rewrite of semantic-memory. |
| 6 | **Expand consolidation-worker into 8-stage sleep cycle** (ingest → cluster → reflect → promote → decay → consolidate → re-embed → publish) | 8/10 | M | Existing cron, new logic. |
| 7 | **DSPy compilation of prompts** with weekly GEPA/MIPROv2 against golden + new traces | 7/10 | M | Compound prompt gains without touching weights. Stanford GEPA July 2025. |
| 8 | **LangSmith-style automation rules**: auto-route low-thumbs → human review → dataset → eval; auto-promote high-thumbs → golden | 7/10 | S | Closes the loop. Most projects forget the routing. |
| 9 | **Tenant-scoped QLoRA adapters** for the top-3 tenants by volume once #1–6 are in | 6/10 | L | Only after prompt+memory ceiling is hit. QLoRA 90-95% of full-FT quality at 1/10 cost. |
| 10 | **Constitutional critic for nightly RLAIF labelling** (TZ Rental Act + GDPR + currency-chain) | 6/10 | M | Generates training pairs without humans; feeds DSPy + adapter loop. |

---

## 8. Anti-patterns to avoid

- **Catastrophic forgetting from naive fine-tuning.** Continual SFT on 1B-7B
  models is well-documented to rotate representational subspaces in intermediate
  layers and destroy prior capability (arXiv 2308.08747, arXiv 2504.01241).
  Mitigations: replay buffers, on-policy RL preferred over SFT, freeze most
  layers, prefer LoRA adapters over full fine-tunes, A/B every new adapter
  against frozen base before promotion.
- **Drift from biased feedback.** Thumbs-up correlates with retention but also
  with sycophancy. If you optimise prompts purely on thumbs-up you train a
  flatterer. Mitigations: combine explicit + implicit + outcome signals; weight
  by *outcome*-attributable signals (ticket resolved, rent paid) > implicit
  (copy) > explicit (thumbs).
- **Cost explosion from online learning.** Per-turn fine-tuning is almost always
  wrong. The cost curve is: prompt change (free) → memory write (cents) → DSPy
  recompile (dollars) → QLoRA adapter (tens-hundreds) → full FT (thousands).
  Walk down the cheap end first.
- **Unbounded memory growth.** Without decay + dedup + community merge, the
  semantic store becomes a noise generator. Zep's validity-window model and
  decay function are the answer — never delete, but mark invalidated.
- **Tenant cross-contamination.** Memory must be partitioned by `tenant_id` at
  every tier including embeddings. A skill learned in Tenant A must not leak to
  Tenant B unless explicitly promoted to a global namespace by an admin.
- **Reflection without action.** Reflexion buffers are worthless if not actually
  retrieved on the next turn. Build the retrieval, write the eval.
- **Optimising eval suite the model has seen.** Hold out a golden set the
  prompt-compiler never sees; rotate it.
- **Treating sleep-time compute as a model weight update.** It's an external
  memory update. The base model is immutable until you ship a new adapter
  through a separate release.

---

## Key sources

- Letta / MemGPT — https://docs.letta.com, https://www.letta.com/blog/letta-v1-agent
- Mem0 — arXiv 2504.19413, https://mem0.ai
- Zep / Graphiti — arXiv 2501.13956, https://blog.getzep.com/state-of-the-art-agent-memory/
- Reflexion — arXiv 2303.11366, NeurIPS 2023
- Voyager — arXiv 2305.16291, https://voyager.minedojo.org
- Self-RAG — arXiv 2310.11511, ICLR 2024
- STaR / V-STaR — arXiv 2203.14465, arXiv 2402.06457
- DSPy — https://dspy.ai, GEPA July 2025
- Constitutional AI — https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback
- ChatGPT Memory — https://openai.com/index/memory-and-new-controls-for-chatgpt/
- Sleep-time / "Claude dreaming" — Anthropic April 2025 paper; VentureBeat coverage
- RLUF / implicit feedback — arXiv 2505.14946, ICML 2025
- LangSmith / Langfuse — vendor docs 2025
- QLoRA in production — Introl, Truefoundry, Unsloth guides 2025
- Catastrophic forgetting — arXiv 2308.08747, arXiv 2504.01241, arXiv 2601.18699
