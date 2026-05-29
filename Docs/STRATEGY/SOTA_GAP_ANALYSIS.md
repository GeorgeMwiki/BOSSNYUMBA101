# SOTA Gap Analysis — BossNyumba — 2026-05-26

> A brutally honest, PhD-level audit of where BossNyumba sits versus the
> 2025–2026 state of the art in agentic AI, knowledge representation,
> learning, multimodality, real-world action, and property-tech
> deployment. This document is for the founder and investors. No
> marketing fluff, no diplomatic phrasing. If a wave is scaffold-only
> and the spec promises orchestration of orchestrators, that gap is
> stated plainly. Every external claim is cited.
>
> **Port note.** Ported from `Borjie/Docs/STRATEGY/SOTA_GAP_ANALYSIS.md`
> with brand rename and property-tech focus on section 6.

**Author method.** Filesystem audit of `Docs/DESIGN/`, `packages/`, and
`services/` on the `chore/wz2-ci-followup` branch; 14 web searches
across the 10 SOTA dimensions; cross-reference against the
`Borjie/Docs/STRATEGY/CAPABILITY_BOOST_VISION.md` parent thesis.
Closure-cost estimates use a T-shirt scale (S ≤ 1 week, M ≤ 1 month,
L ≤ 1 quarter, XL ≥ 1 quarter).

**Sibling docs.** This is the parent (BossNyumba) port of the Borjie
SOTA gap analysis. BossNyumba is the property-tech parent; Borjie is
the mining hard-fork. The 10 SOTA dimensions are identical; the domain
section (#6) is property-tech focused.

---

## 1. Executive summary — the 10 P0 gaps

BossNyumba has out-paced almost every competing African property-tech
startup on the *surface area* of capability: 127 packages, 26 services,
13 design specs (smaller than Borjie's 22; the parent intentionally
defers some specs that originated downstream), and 1,763 test files.
But surface area is not depth. Six of the most strategically important
2026 SOTA primitives are either missing entirely from our dependency
graph or stubbed at a spec-only level.

The 10 highest-leverage P0 gaps, ranked by closure ROI:

1. **Test-time-compute reasoning (o1/o3-style) is not in the kernel.**
   `extended-reasoning` and `reasoning-substrate` packages exist as
   scaffold; no MCTS-over-tool-calls, no process-reward model, no
   verifier loop. SOTA agents win on `WebArena` at 68%+ via online RL
   plus PRM-guided MCTS — we have none of these primitives wired
   ([Latent Space / Noam Brown on multi-agent civilizations][s1],
   [ACM / AgentPRM][s2]).
2. **GraphRAG is not the retrieval default.** `knowledge-graph` and
   `memory-v2` are present but the dominant retrieval path is still
   pgvector. SOTA 2026 production stacks use hierarchical community
   summaries over Neo4j/LanceDB graphs for global queries, vector for
   local ([LanceDB / GraphRAG hierarchical][s3]).
3. **No verifier-based RL post-training loop.** No GRPO / DAPO / RLVR
   implementation. SOTA teams ship verifier-RL for any task with a
   structured-output check — exactly our lease-renewal, maintenance-
   triage, and tenant-screening use-cases ([dev.to / RLHF in 2026][s4],
   [llm-stats / Post-training 2026][s5]).
4. **MCP is one-way only.** We expose internal MCP servers
   (`mcp-server-firs`, `nggis`, `nin`, `opay`, `process-intel`) but
   consume few external MCPs. As of March 2026 there are 10,000+
   public MCP servers and 97 M installs — BossNyumba is missing a
   top-tier connector layer ([WorkOS / MCP in 2026][s6]).
5. **No mechanistic-interpretability or calibration layer.**
   `bias-handling` and `ethics-framework` packages exist; no sparse-
   autoencoder probes, no Brier-score calibration on advisor outputs.
   Constitutional AI has matured into production but our
   `compliance-pack` doesn't have a SAE-feature dashboard ([MIT Tech
   Review / Mechinterp 2026][s7]).
6. **Voice + computer-use is spec-only.** `voice-agent` service exists
   but uses an older Realtime API surface; no Gemini Live integration,
   no parallel Computer-Use agent fleet. Sonnet 4.6 + Gemini 3.1 Flash
   Live are the 2026 voice-stack baseline ([Safina / Gemini 3.1 Flash
   Live][s8]).
7. **Durable orchestration is missing.** Long-running agent runs
   (Apollo Gauntlet, Brain Evolution Worker) do not use Temporal or
   Inngest. Process restart loses session state. This blocks
   `long-horizon-agent` from real production use.
8. **Continual + federated learning is not even spec'd.** Property
   managers in Lagos and Nairobi will never let raw tenant-screening
   corpora leave the tenant boundary; without a federated DPO loop,
   every per-tenant advisor adaptation has to round-trip through
   manual SFT ([arxiv / FedPDPO][s9]).
9. **No Swahili / Yoruba / Hausa / low-resource fine-tune track.**
   Tanzania's national AI strategy anchors on Kiswahili NLP;
   Nigeria's anchors on Yoruba/Hausa/Igbo ([UNESCO / Tanzania
   readiness][s10]). We ship English prompts only. This is the single
   largest moat we are leaving on the table for any well-funded
   competitor.
10. **No production reliability shadow-deploy.** `observability` and
    `litfin-port-observability-extra` packages emit OTel traces but we
    do not run guarded releases or shadow LLM call mirroring. Langfuse
    plus LaunchDarkly Guarded Releases is the 2026 baseline
    ([LaunchDarkly + Langfuse guide][s11]).

The recommended response — sequenced into waves 19A–24F below — closes
the top six gaps inside one quarter and the remaining four inside two.

---

## 2. BossNyumba's current architecture inventory

A snapshot at audit time (counts from `ls -1 | wc -l`):

| Layer | Count | Notes |
|------:|------:|-------|
| Design specs (`Docs/DESIGN/`) | 13 | Includes CAPABILITIES_UNIFICATION, ANTICIPATORY_UX, JUNIOR_ARCHITECTURE, ORG_HIERARCHY_TERMINOLOGY (newest port) |
| Strategy docs (`Docs/STRATEGY/`) | 1 | This file (newly created) |
| Packages (`packages/`) | 127 | Includes 20+ AI/brain-tier packages |
| Services (`services/`) | 26 | Including `apollo-gauntlet-runner`, `brain-evolution-worker`, `voice-agent`, multiple Nigerian/East-African MCP servers |
| Apps (web) | 7 | admin-portal, admin-platform-portal, owner-portal, customer-app, estate-manager-app, tenant-portal, marketing |
| Apps (mobile) | 1 Flutter shell + 2 stub | Greenfield mobile surface |
| Drizzle table definitions | 290 | 139 migration files |
| API gateway HTTP methods | 1,807 | (GET+POST+PUT+PATCH+DELETE) |
| Test files | 1,763 | (raw count; coverage % unknown without a profile run) |

The **AI/brain tier** is the same dense stack as Borjie:
`agent-orchestrator`, `agent-platform`, `agent-runtime`, `agentic-os`,
`brain-llm-router`, `brain-self-awareness`, `central-intelligence`,
`extended-reasoning`, `reasoning-substrate`, `scientific-discovery`,
`self-codegen`, `memory-v2`, `module-orchestrator`, `module-spec-engine`,
`long-horizon-agent`, `autonomy-governance`, `disclosure-layer`,
`compliance-pack`. Property-specific add-ons: `estate-auto-management`,
`estate-department-advisor`, `lifecycle-advisor`, `green-angle-advisor`,
`sustainability-advisor`, `carbon-market`, `acquisition-advisor`,
`expansion-advisor`, `lpms-connector`, `market-intelligence`,
`parcel-service`.

The **honest critique** is the same as Borjie's: this density is
mostly specification plus interface. The *runtime depth* per package
averages ~600 LoC. Several packages with grand titles (`agentic-os`,
`central-intelligence`, `scientific-discovery`) are still skeletons
with TODO comments where the orchestration loop should live. See
section 5 for a wave-by-wave honesty table.

---

## 3. Ten SOTA dimensions — gap, cost, recommended approach

Gap rating: **1 = match SOTA, 2 = close behind, 3 = noticeable lag,
4 = wide lag, 5 = wide-open gap**. Cost: S/M/L/XL as defined above.

### 3.1 Reasoning (tree-of-thought, self-consistency, MCTS on LLMs, o1/o3)

**SOTA 2026.** Reasoning-native models (o1, o3, DeepSeek-R1, Gemini
2.0 Thinking, Claude 4.7 extended-thinking) plus inference-time MCTS
guided by a process-reward model (PRM) saturate `MATH-500` and push
`AIME` past human-olympiad ceilings ([academia.edu / TTC scaling][s12],
[Latent Space / Noam Brown][s1]). THINKPRM beats LLM-as-judge using
8 K synthetic step labels ([arxiv / Process Reward Models That Think][s13]).

**BossNyumba state.** `packages/extended-reasoning` and
`reasoning-substrate` are scaffold; `central-intelligence/kernel/` has
cot-reservoir, debate, reflexion modules but no PRM, no MCTS over
tool calls, no process-step scoring. The kernel hand-rolls its own
loop instead of consuming a verifier.

**Gap rating: 4 (wide lag). Cost: L. Approach:** add
`packages/process-reward-model` (small fine-tuned model, scored per
step), wire MCTS into `agent-orchestrator` for any task with a
verifier (lease renewal, maintenance triage, rent collection,
compliance filing). Use self-consistency for narrative tasks.

### 3.2 Knowledge representation (GraphRAG, hierarchical retrieval, long context)

**SOTA 2026.** Hybrid GraphRAG + long-context: global queries hit
hierarchical community summaries over a Neo4j/LanceDB graph; local
queries hit vector. 1 M-token context windows are useful for single-
document deep reads but ~1,250× cost vs RAG and 30–60× slower
([TianPan / Long-context vs RAG][s14], [LanceDB / GraphRAG][s3]).

**BossNyumba state.** `knowledge-graph`, `memory-v2`, `graph-sync`,
`graph-privacy` packages exist. Primary retrieval is pgvector +
per-tenant scope. No community-level summaries, no graph-hop reasoning
across the corpus, no per-query routing between graph and vector
retrievers.

**Gap rating: 4. Cost: M.** Approach: ship a `graph-rag-router`
package; build community summaries in `consolidation-worker`'s sleep
pass; expose a `/retrieve` endpoint that chooses graph-global vs
vector-local based on query class.

### 3.3 Learning (RLHF/DPO, continual, federated)

**SOTA 2026.** The post-training stack is modular: SFT → DPO/SimPO/KTO
→ GRPO/DAPO/RLVR for verifiable rewards. Federated personalised DPO
(FedPDPO) is now the standard pattern when raw data cannot leave the
tenant ([dev.to / RLHF in 2026][s4], [arxiv / FedPDPO][s9]).

**BossNyumba state.** Zero post-training pipeline.
`brain-evolution-worker` service exists but no live SFT or DPO. The
"self-improving" claim is a spec promise, not running code.

**Gap rating: 5 (wide-open). Cost: L.** Approach: ship a
`post-training-pipeline` package — SFT first using Anthropic fine-tune
API and an in-house RLVR loop on regulatory-form correctness (FIRS,
NIN, NGGIS). Federated DPO is a 2027 deferral, but the *data-
collection* schema must land in 2026 so the eventual federated round-
trip is trivial.

### 3.4 Multi-agent (MoE, MCP, Computer Use, verifiers, swarms)

**SOTA 2026.** MoE inference (Kimi K2.6 with 1.04 T params, 32 B
active) plus 100–300 parallel sub-agents coordinated via a single
orchestrator and 4,000-step swarms is now production-feasible
([Serenities / Kimi K2.5][s15]). MCP is the de-facto wire protocol —
97 M installs, 10,000+ public servers ([WorkOS / MCP 2026][s6]).

**BossNyumba state.** `agent-orchestrator`, `agent-platform`, five
internal MCP servers (`firs`, `nggis`, `nin`, `opay`, `process-intel`).
No external MCP consumption. No swarm pattern; the dispatch-router
serialises tasks.

**Gap rating: 3. Cost: M.** Approach: ship `packages/swarm-runtime`
on top of `agent-orchestrator`; add MCP-client wiring for ≥10 public
servers (filesystem, github, slack, sentry, google-workspace, etc.).

### 3.5 Safety + evaluation (Constitutional AI, mech interp, calibration)

**SOTA 2026.** Constitutional AI is in production at Anthropic;
sparse-autoencoder feature dashboards (Anthropic Microscope) are
shipping; calibration is evaluated in three layers — technical
faithfulness, operational utility, governance-readiness ([MIT Tech
Review / Mechinterp 2026][s7], [UST / AI interpretability 2026][s16]).

**BossNyumba state.** `compliance-pack`, `bias-handling`,
`ethics-framework`, `disclosure-layer`, `autonomy-governance`,
`audit-hash-chain`, `security-audit`, `fairness-eval`, and
`four-eye-approval` in the brain kernel. No SAE probes, no Brier-score
calibration, no live ETHICS dashboard.

**Gap rating: 3. Cost: M.** Approach: add
`packages/calibration-monitor` (Brier + ECE per advisor per task
class) and `packages/saes-probe` (small open-weights SAE on top of
fine-tuned advisor outputs).

### 3.6 Multimodality (Gemini Live, Voice Engine, VLA models)

**SOTA 2026.** Gemini 3.1 Flash Live offers 90+ language realtime
voice; RT-2 / Gemini Robotics / GR00T N1 / π0 are the production VLA
stack for robotics ([Safina / Gemini 3.1 Flash Live][s8], [Internet-
Pros / VLA models 2026][s17]). For our domain (property), voice +
image matter most; VLA-style action is overkill until field-mobile
inspector workflows are shipped.

**BossNyumba state.** `voice-agent`, `audio-capture`,
`audio-logics-litfin`, `media-generation`, `content-studio`,
`document-ai` packages. Voice agent uses an older OpenAI Realtime API
surface. No Gemini Live, no on-device whisper-vector spell-check, no
Swahili/Yoruba STT/TTS.

**Gap rating: 4. Cost: M.** Approach: dual-provider voice agent
(Anthropic + Gemini Live), Swahili/Yoruba STT/TTS evaluation gauntlet,
route realtime hops through Gemini Live for latency.

### 3.7 Real-world action (computer use, browser automation, voice calls)

**SOTA 2026.** Claude Mythos Preview leads `WebArena` at 68.7%;
Browser Use ships at 89.1% on `WebVoyager`. WAREX shows severe
degradation under bot-defence, Cloudflare, DataDome ([awesomeagents
/ benchmarks][s18], [arxiv / WAREX][s19]).

**BossNyumba state.** `browser-perception`, `action-runtime`,
`dispatch-router`, `probe-runners` packages. No production Browser
Use / Computer Use loop yet. Apollo Gauntlet runs synthetic
gauntlets, not live browser action.

**Gap rating: 4. Cost: L.** Approach: stand up a
`services/browser-action-fleet` (managed Chrome containers, Browser
Use as the harness), focus initial domain on FIRS portal, NGGIS land
records, and OPay reconciliation. The Nigerian property-tax web-form
economy is exactly the high-value ROI surface for browser-action
agents.

### 3.8 Production reliability (Langfuse, shadow deploy, guarded releases)

**SOTA 2026.** Langfuse over OTel is the 2026 default LLM
observability stack; LaunchDarkly Guarded Releases is the canonical
shadow-deploy pattern; preferred deployment is Kubernetes (Helm)
([Langfuse / OTel][s20], [LaunchDarkly + Langfuse guide][s11]).

**BossNyumba state.** `observability`, `litfin-port-observability-extra`
emit OTel traces. No Langfuse, no guarded releases, no shadow LLM
mirror, no per-tenant model A/B harness.

**Gap rating: 3. Cost: S.** Approach: deploy Langfuse self-hosted
(Helm), wire OTel exporters, add a `packages/shadow-deploy` thin
client.

### 3.9 Cutting-edge frontiers (test-time compute, speculative decoding, neuro-symbolic)

**SOTA 2026.** SAGUARO + Jakiro speculative decoding deliver 5× over
autoregressive at parity ([arxiv / Speculative Speculative Decoding][s21]).
Neuro-symbolic systems (Permion, SynaLinks) embed neural reasoning
inside finite-state machines with schema-constrained decoding
([cogentinfo / Year of neuro-symbolic AI 2026][s22]).

**BossNyumba state.** None. Our `extended-reasoning` package is a
thin shell over the LLM provider's own thinking mode.

**Gap rating: 4. Cost: L.** Approach: defer speculative decoding (we
host nothing yet — provider concern). Adopt neuro-symbolic schema-
constrained decoding for any compliance-form-fill task (FIRS, NGGIS,
NIN): combine JSON-schema enforcement + DSL constraints + LLM
completion.

### 3.10 Domain-specific (property AI, mining AI, East/West Africa)

**SOTA 2026.** Property AI: AppFolio Realm-X + Yardi Chat IQ + Entrata
Leasing AI saving 10 h/week per user with agentic triage and dispatch;
maintenance triage reduces emergency call costs by up to 30%
([AppFolio / Best PM software 2026][s25], [Haven / Third-party PM AI
2026][s26]). African AI: Tanzania anchors on Kiswahili, Nigeria on
Yoruba/Hausa/Igbo; Africa Mining Week 2026 centres on AI exploration
([UNESCO / Tanzania readiness][s10], [tech.africa / African Mining
Week 2026][s27]).

**BossNyumba state.** Property: `estate-auto-management`,
`estate-department-advisor`, `lifecycle-advisor`, `green-angle-advisor`,
`sustainability-advisor`, `carbon-market`, `acquisition-advisor`,
`expansion-advisor`, `lpms-connector`, `market-intelligence`,
`parcel-service`. Compliance: `mcp-server-firs` (Federal Inland
Revenue), `mcp-server-nggis` (geospatial), `mcp-server-nin` (national
ID), `mcp-server-opay` (payments). No leasing-AI agent (AppFolio
Realm-X equivalent). No maintenance-triage agent (the single most-
cited AppFolio differentiator). No Swahili/Yoruba advisor lineage.

**Gap rating: 3 for property domain (we have surface area but the
two most-valuable agentic loops are missing); 5 for Swahili/Yoruba
(open goal). Cost: M.** Approach: ship `packages/leasing-ai` and
`packages/maintenance-triage-agent` by Q4 2026; ship Swahili/Yoruba
advisor lineages routed by `org-scope` terminology.

---

[s1]: https://www.latent.space/p/noam-brown "Latent Space — Scaling Test Time Compute, Noam Brown 2026"
[s2]: https://dl.acm.org/doi/10.1145/3774904.3792551 "ACM — AgentPRM: Process Reward Models for LLM Agents 2026"
[s3]: https://www.lancedb.com/blog/graphrag-hierarchical-approach-to-retrieval-augmented-generation "LanceDB — GraphRAG hierarchical retrieval"
[s4]: https://dev.to/saurabh_naik_b213f3bbeafe/rlhf-in-2026-when-to-pick-ppo-dpo-or-verifier-based-rl-542o "dev.to — RLHF in 2026: PPO vs DPO vs verifier-based RL"
[s5]: https://llm-stats.com/blog/research/post-training-techniques-2026 "llm-stats — Post-Training in 2026: GRPO, DAPO, RLVR & Beyond"
[s6]: https://workos.com/blog/everything-your-team-needs-to-know-about-mcp-in-2026 "WorkOS — Everything your team needs to know about MCP in 2026"
[s7]: https://www.technologyreview.com/2026/01/12/1130003/mechanistic-interpretability-ai-research-models-2026-breakthrough-technologies/ "MIT Tech Review — Mechanistic interpretability: 10 Breakthrough Technologies 2026"
[s8]: https://safina.ai/en/blog/gemini-3-1-flash-live-realtime-voice-ai/ "Safina — Gemini 3.1 Flash Live 2026"
[s9]: https://arxiv.org/abs/2603.19741 "arxiv — FedPDPO: Federated Personalized DPO for LLMs"
[s10]: https://www.unesco.org/en/articles/ai-ready-and-responsible-tanzania-unveils-national-assessment-africa-internet-governance-forum "UNESCO — Tanzania AI readiness assessment"
[s11]: https://dev.to/alexiskroberson/opentelemetry-for-llm-applications-a-practical-guide-with-launchdarkly-and-langfuse-1a3a "dev.to — OpenTelemetry for LLM apps: LaunchDarkly + Langfuse"
[s12]: https://www.academia.edu/165704995/Test_Time_Compute_Scaling_and_Reasoning_Models_Foundations_Benchmarks_and_Implications "Academia — Test-Time Compute Scaling and Reasoning Models 2026"
[s13]: https://arxiv.org/pdf/2504.16828 "arxiv — Process Reward Models That Think (THINKPRM)"
[s14]: https://tianpan.co/blog/2026-04-09-long-context-vs-rag-production-decision-framework "TianPan — Long-Context vs RAG: 1M-token decision framework 2026"
[s15]: https://serenitiesai.com/articles/kimi-k2-5-deep-review-agent-swarm-benchmarks-pricing-2026 "Serenities — Kimi K2.5 Agent Swarm 2026"
[s16]: https://www.ust.com/en/insights/ai-interpretability-explainability-2026-executive-view "UST — AI Interpretability 2026 Executive View"
[s17]: https://internet-pros.com/blog/vision-language-action-models-robotics-2026/ "Internet-Pros — VLA Models 2026"
[s18]: https://awesomeagents.ai/leaderboards/web-agent-benchmarks-leaderboard/ "Awesome Agents — Web Agent Benchmarks Leaderboard Apr 2026"
[s19]: https://arxiv.org/pdf/2510.03285 "arxiv — WAREX: Web Agent Reliability Evaluation"
[s20]: https://langfuse.com/integrations/native/opentelemetry "Langfuse — Native OpenTelemetry integration"
[s21]: https://arxiv.org/pdf/2603.03251 "arxiv — Speculative Speculative Decoding 2026"
[s22]: https://www.cogentinfo.com/resources/the-year-of-neuro-symbolic-ai-how-2026-makes-machines-actually-understand "Cogent — The Year of Neuro-Symbolic AI 2026"
[s23]: https://farmonaut.com/mining/remote-sensing-mineral-exploration-7-top-2026-advances "Farmonaut — Remote sensing mineral exploration 7 top 2026"
[s24]: https://farmonaut.com/mining/ni-43-101-report-essential-2026-mining-compliance-guide "Farmonaut — NI 43-101 compliance 2026"
[s25]: https://www.appfolio.com/blog/best-property-management-softwares-compared-2026 "AppFolio — Best property management software 2026"
[s26]: https://www.usehaven.ai/post/third-party-property-management-ai-ultimate-guide "Haven — Third-party PM AI 2026 Ultimate Guide"
[s27]: https://tech.africa/african-mining-week-2026-ai-exploration/ "tech.africa — African Mining Week 2026"

---

## 4. Prioritised punch list

P-tier definitions: **P0** is a moat-or-die gap that blocks the
capability-boost thesis; **P1** is a strong differentiator a
competitor will close within 12 months if we don't; **P2** is a
polish item that shows up in the next big customer demo; **P3** is a
future-proofing hedge.

| # | Gap | Tier | Wave | Cost | Depends-on |
|---|-----|------|------|------|------------|
| 1 | PRM + MCTS reasoning loop | P0 | 19A | L | s3.1 |
| 2 | GraphRAG hierarchical retrieval router | P0 | 19B | M | knowledge-graph, consolidation-worker |
| 3 | Verifier-RL (RLVR) post-training pipeline | P0 | 19C | L | brain-evolution-worker |
| 4 | MCP external-client wiring (≥10 servers) | P0 | 19D | M | agent-orchestrator |
| 5 | Calibration + SAE-probe layer | P0 | 19E | M | bias-handling, ethics-framework |
| 6 | Gemini Live + Swahili/Yoruba STT/TTS | P0 | 19F | M | voice-agent, content-studio |
| 7 | Durable orchestration (Temporal) | P1 | 20A | M | long-horizon-agent |
| 8 | Browser-action fleet (FIRS, NGGIS, OPay) | P1 | 20B | L | browser-perception, action-runtime |
| 9 | Langfuse + guarded-release shadow deploy | P1 | 20C | S | observability |
| 10 | Cross-tenant leak test in CI | P1 | 20D | S | database, supabase-client |
| 11 | `leasing-ai` package (AppFolio Realm-X parity) | P1 | 20E | M | persona-runtime, brain-llm-router |
| 12 | `maintenance-triage-agent` (dispatch + close-loop) | P1 | 20F | M | dispatch-router, notifications, voice-agent |
| 13 | Schema-constrained neuro-symbolic decoder | P2 | 21A | M | compliance-pack, document-quality-guarantor |
| 14 | Lifecycle-advisor live wiring (acquisition→exit) | P2 | 21B | M | lifecycle-advisor, expansion-advisor |
| 15 | Swahili/Yoruba advisor lineages | P2 | 21C | M | persona-runtime, brain-llm-router |
| 16 | Federated DPO data-collection schema | P2 | 22A | S | brain-evolution-worker |
| 17 | Live SFT loop | P2 | 22B | L | brain-evolution-worker |
| 18 | Multi-tenant schema-per-tenant tier | P3 | 23A | XL | database |
| 19 | On-device GraphRAG (edge tenant) | P3 | 23B | L | knowledge-graph |
| 20 | Federated DPO live round-trip | P3 | 24B | XL | depends on 16 |

P0 cluster (19A–19F) closes the six top gaps inside one quarter.
P1 cluster (20A–20F) hardens production and ships the two
AppFolio-parity agentic loops (leasing-ai + maintenance-triage). P2
(21A–22B) widens the moat. P3 (23A–24B) is the long horizon — defer
unless a customer specifically asks.

---

## 5. Honest critique — spec ambition vs actual code state

This section is the part that gets uncomfortable. The BossNyumba
codebase has an unusually high spec-to-runtime-depth ratio. Several
packages with grand titles are scaffolds. The table below is brutal
but fair.

| Package / Service | Spec promise | Actual code state | Verdict |
|-------------------|--------------|-------------------|---------|
| `central-intelligence` kernel | "40+ kernel modules" | Modules exist; runtime loop hand-rolled; no PRM | Scaffold-deep; production-shallow |
| `scientific-discovery` | "Hypothesis gen, experiment design" | Skeleton; TODO-heavy | Scaffold |
| `agentic-os` | "OS for agents" | Tutorial-grade | Scaffold |
| `self-codegen` | "Self-modifying code" | Generator stub | Half-built |
| `brain-evolution-worker` | "Brain evolves overnight" | Cron skeleton; no SFT/DPO | Scaffold |
| `apollo-gauntlet-runner` | "Adversarial gauntlets" | Synthetic gauntlet only; not wired to evolution worker | Half-built |
| `long-horizon-agent` | "Multi-day autonomous loops" | No durable engine; loses state on restart | Spec-only |
| `extended-reasoning` | "MCTS, ToT, SC, PRM" | Thin shim over provider extended-thinking | Spec-only |
| `voice-agent` | "Voice-native operator" | Older Realtime API | Half-built |
| `lifecycle-advisor`, `acquisition-advisor`, `expansion-advisor` | "Full property-lifecycle AI" | Module skeletons; no wired-in workflows | Scaffold |
| `estate-auto-management`, `estate-department-advisor` | "Estate manager AI" | Skeletons; depend on `org-scope` (recently ported) | Scaffold |
| `green-angle-advisor`, `sustainability-advisor`, `carbon-market` | "ESG/carbon AI" | Skeletons | Scaffold |
| `lpms-connector` | "Local property management system integration" | Connector spec; no live partner | Spec-only |
| `mcp-server-firs`, `nggis`, `nin`, `opay` | "Nigerian regulator MCPs" | Working server scaffolds; need live soak | Production-ready (light) |
| `org-scope`, `org-graph` | "Multi-level MD scope + terminology" | Recently ported (9def5521); production-ready | Production-ready |

**The single biggest divergence** between spec ambition and actual
code state is in the *self-improving* tier — every package claiming
self-modification (`self-codegen`, `brain-evolution-worker`,
`apollo-gauntlet-runner`) is either a stub or half-wired. We have the
chassis (gates, audit chain, mutation authority) without the engine
(SFT/DPO/RL loop). This is the most important honest admission to
investors.

The same applies to the **reasoning tier**: `extended-reasoning`,
`reasoning-substrate`, and the kernel debate/reflexion modules are a
chassis for o1-style reasoning — but the engine (PRM-guided MCTS over
tool calls) is missing. BossNyumba's current reasoning capability is
exactly what Claude 4.7 + extended thinking gives you out of the box;
we are not adding inference-time compute structure on top.

The **property-AI tier** is the other big gap: `estate-auto-management`,
`lifecycle-advisor`, `acquisition-advisor`, `expansion-advisor`,
`green-angle-advisor`, `sustainability-advisor` are *seven* major
advisor packages, and they are all scaffolds. The most cited
AppFolio/Yardi differentiators — agentic leasing assistant and
maintenance-triage agent — do not have dedicated packages yet.

Finally: **17 of 127 packages are litfin-port-*-extra** — legacy
imports from the litfin fork. A dead-code sweep is overdue.

---

## 6. Domain-specific gaps — property (BossNyumba's native domain)

We have unique surface area in African property-tech but the two
agentic loops that AppFolio cites as their 10-h/week saving — leasing
AI and maintenance triage — are not yet shipped as production
packages. The gaps:

- **Leasing AI parity (AppFolio Realm-X equivalent)**: a `leasing-ai`
  package that qualifies leads, schedules tours, manages follow-ups,
  drafts renewal communications. AppFolio reports 89% adoption +
  10-month ROI ([AppFolio / Best PM software 2026][s25]).
- **Maintenance-triage agent**: read tenant complaint → classify
  severity → dispatch vendor → notify resident → close loop. Reduces
  emergency call costs by up to 30% according to Haven Tech ([Haven /
  Third-party PM AI 2026][s26]).
- **Tenant-screening RLVR loop**: structured-output classification with
  legal-compliance verifier; ideal RLVR target.
- **Lifecycle-advisor wiring**: the package exists but the
  acquisition→entitlement→operation→exit workflow is not wired into a
  live tenant journey.
- **Sustainability + carbon-market**: scaffolded packages
  (`green-angle-advisor`, `sustainability-advisor`, `carbon-market`)
  but no live data pipeline to a carbon registry.
- **Mining (inherited from Borjie fork)**: the BossNyumba parent does
  *not* expose mining advisors; those live exclusively in the Borjie
  hard-fork. The relevant gap is to refrain from adding mining
  packages back into BossNyumba (anti-bloat).
- **Swahili / Yoruba / Hausa**: Tanzania anchors on Kiswahili; Nigeria
  on Yoruba/Hausa/Igbo. We ship English only.

A separate property-mining decoupling decision matters: the parent
BossNyumba intentionally does not own mining packages, while Borjie
intentionally does not own property packages. The 17 `litfin-port-*`
packages are the cross-cutting shared layer; everything else should
diverge cleanly.

---

## 7. Six-month recommended roadmap

**Premise.** Close all six P0 gaps inside one quarter (Q3 2026);
harden production and ship P1 in Q4 2026; queue P2 for Q1 2027. Each
wave is 1–3 weeks of effort for one full-stack engineer plus partial
AI/ML lead.

| Wave | Weeks | Deliverable | Depends-on |
|------|-------|-------------|------------|
| **19A** | wk 1-3 | `packages/process-reward-model` + MCTS in `agent-orchestrator` for compliance-form filings (FIRS, NIN, NGGIS) | extended-reasoning, central-intelligence |
| **19B** | wk 2-4 | `graph-rag-router` + community summaries in `consolidation-worker` | knowledge-graph, memory-v2 |
| **19C** | wk 3-6 | `post-training-pipeline` — SFT first; RLVR loop on compliance-form correctness | brain-evolution-worker |
| **19D** | wk 4-5 | MCP external client + ≥10 public servers | agent-orchestrator |
| **19E** | wk 5-7 | `calibration-monitor` + SAE probe | bias-handling, ethics-framework |
| **19F** | wk 6-8 | Gemini Live + Swahili/Yoruba STT/TTS gauntlet | voice-agent |
| **20A** | wk 9-11 | Temporal in `long-horizon-agent`; durable Apollo Gauntlet | apollo-gauntlet-runner |
| **20B** | wk 10-13 | `services/browser-action-fleet` for FIRS, NGGIS, OPay | browser-perception, action-runtime |
| **20C** | wk 12-13 | Langfuse self-hosted + LaunchDarkly Guarded Releases | observability |
| **20D** | wk 13 | Cross-tenant leak CI test | database |
| **20E** | wk 13-16 | `packages/leasing-ai` — AppFolio Realm-X parity | persona-runtime, brain-llm-router |
| **20F** | wk 14-17 | `packages/maintenance-triage-agent` — full dispatch+close-loop | dispatch-router, notifications, voice-agent |
| **21A** | wk 18-20 | Schema-constrained neuro-symbolic decoder for compliance-form-fill | compliance-pack, document-quality-guarantor |
| **21B** | wk 19-21 | Lifecycle-advisor live wiring (acquisition→exit) | lifecycle-advisor, expansion-advisor |
| **21C** | wk 20-23 | Swahili/Yoruba advisor lineages | persona-runtime, brain-llm-router, org-scope |
| **22A** | wk 24 | Federated DPO data-collection schema | brain-evolution-worker |
| **22B** | wk 25-26 | Live SFT loop | brain-evolution-worker, mutation-authority |

Critical path is `19A → 19C → 22B` (reasoning loop → post-training
pipeline → live SFT). Property-parity-critical path is `20E + 20F`
(leasing-ai + maintenance-triage) — these are the demonstrable
AppFolio-parity loops investors will ask about.

**Buy-vs-build decisions.** Three big ones:
1. **Buy** Temporal Cloud or Inngest for durable orchestration (20A).
   Roll-your-own is ≥ 3 months.
2. **Build** the PRM (19A), GraphRAG router (19B), `leasing-ai` (20E),
   and `maintenance-triage-agent` (20F). They are the moat.
3. **Buy** Langfuse self-hosted (20C). Pareto-optimal.

**Reporting cadence.** Weekly wave-status note in `Docs/STRATEGY/`;
monthly investor update referencing this gap analysis + 6-month
roadmap; quarterly re-audit against this same SOTA dimension set.

---

## Sources cited

[s1]…[s27] above. Count: 27 distinct citations across 14 web searches,
all dated 2025–2026, all live URLs at audit time (2026-05-26).
