# SOTA 2026 Frontier Reference — for LITFIN/BOSSNYUMBA gap analysis (2026-05-23)

Scope: world-class agent stack as of May 2026. Each area lists (a) SOTA, (b) top vendor/OSS choices, (c) the killer feature that crossed the chasm in 2025-2026, (d) one anchor reference URL.

Sources are intentionally batched at end of each section as inline citations.

---

## 1. Agent architectures

- **SOTA**: Convergence around a small set of *production-grade* SDKs with first-class subagents, hooks, skills (filesystem-discovered capabilities), durable state, and human-in-the-loop. The old "ReAct-loop-in-a-notebook" generation is dead. Production = typed tools + lifecycle events + persistence + streaming.
- **Top choices**:
  1. **Claude Agent SDK** (renamed from Claude Code SDK late 2025) — skills (SKILL.md), subagents with isolated context, PreToolUse/PostToolUse hooks, memory tools, MCP-native. Default on Max/Team Premium with Opus 4.7 as of 2026-04-16.
  2. **LangGraph 1.0** (GA Oct 2025, no breaking changes until 2.0) — durable state across server restarts, HITL pause-resume primitives, built-in persistence, streams everything (tokens + tool calls + state). Powers Uber, LinkedIn, Klarna.
  3. **Microsoft Agent Framework 1.0** (GA 2026-04-03) — production merger of AutoGen + Semantic Kernel; the default .NET/Azure-native enterprise choice. AutoGen v0.7.x now in maintenance.
- **Other notable**: OpenAI Agents SDK v0.17.1 (May 2026, Swarm successor with guardrails+tracing+realtime+sandbox), Google ADK (multi-language Apache 2.0, Vertex Agent Engine deploy), CrewAI (role-based), Smolagents (~1K LOC, code-as-tools), DSPy 3 (prompt-as-compilation), Letta v2 (sleep-time agents).
- **Killer feature**: **Skills + subagents + hooks as a triad** — filesystem-discoverable capabilities (YAML+markdown) that the model autonomously invokes, executed in isolated subagent contexts with intercept-able lifecycle events. This crossed the chasm in Q4 2025.
- **Ref**: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

---

## 2. Memory systems

- **SOTA**: Hybrid memory — vector + graph + key-value with automatic extraction *plus* temporal versioning. Pure vector DBs are no longer enough. Sleep-time / background memory consolidation is now a first-class pattern.
- **Top choices**:
  1. **Mem0 v2** — best general-purpose: ADD/UPDATE/DELETE/NOOP operation classifier for new facts, 47K+ GitHub stars, usable free tier.
  2. **Zep / Graphiti** — temporal knowledge graph; tracks how facts change over time; preserves provenance via episodes; best when "who owned this in Feb" matters.
  3. **Letta** (formerly MemGPT) — self-editing memory blocks via dedicated tools; the only serious choice for agents that operate independently for days. Sleep-time compute pattern: background agents share memory with primaries.
- **Honourable**: Cognee (graph-based, 30+ data sources, 1M+ pipelines/month, Bayer/UWyoming production), LangMem, Cloudflare Agent Memory.
- **Killer feature**: **Sleep-time agents / sleep-time compute** — background processes that consolidate, re-summarize, and rewrite memory while the primary agent is idle. Letta shipped it; everyone now copies it.
- **Ref**: https://www.letta.com/blog/sleep-time-compute

---

## 3. RAG

- **SOTA**: Retrieval — not generation — is the production bottleneck. Hybrid (vector + BM25 + RRF) + late chunking + contextual retrieval + cross-encoder rerank is the new default pipeline. GraphRAG variants for multi-hop reasoning. ColPali for document-image-native multi-vector.
- **Top choices** (composition, not single vendor):
  1. **Retrieval**: hybrid BM25 + dense + ColPali for visual docs; **late chunking** (preserve global context) or **Anthropic contextual retrieval** (LLM-prepended context per chunk, ~67% better recall).
  2. **Rerank**: **Cohere Rerank 3.5** (English + 100 languages, 4096-token chunks, 80-150ms p50) or **bge-reranker-v2-m3** (open-source parity).
  3. **Graph layer**: **LightRAG** (token reduction up to 6000x), **HippoRAG 2** (custom PageRank), Microsoft GraphRAG / LazyGraphRAG.
- **Patterns**: Self-RAG, CRAG, RAFT for reflective retrieval; agentic-RAG (the agent decides whether to retrieve again).
- **Killer feature**: **Contextual retrieval** (per-chunk LLM context-prepending) — became near-mandatory after Anthropic's Sept 2024 paper showed 67% recall improvement; cheap because of prompt caching.
- **Ref**: https://cohere.com/blog/rerank-3pt5

---

## 4. MCP & protocols

- **SOTA**: A four-protocol stack: **MCP** for tools/context, **A2A** for agent-to-agent, **AsyncAPI** for event contracts, **OAuth 2.1 + Resource Indicators (RFC 8707)** for auth. ACP (IBM) merged *into* A2A in Aug 2025. ANP for open networks.
- **Status as of May 2026**:
  - **MCP**: 2025-06-18 spec is current production (structured tool outputs, OAuth Resource Server classification, **elicitation** for server→user prompts, JSON-RPC batching removed). 2025-11-25 release added more security hardening. 2026-07-28 release candidate adds stateless protocol core, Extensions framework, Tasks, MCP Apps, formal deprecation policy. **Donated to Linux Foundation's Agentic AI Foundation (AAIF) in Dec 2025** by Anthropic/Block/OpenAI.
  - **A2A**: Open-sourced by Google April 2025, donated to Linux Foundation June 2025, **150+ orgs** by April 2026 (Google, MS, AWS, Salesforce, SAP, ServiceNow, Workday, IBM).
  - **AsyncAPI 3.1**: contract-first for Kafka/RabbitMQ/MQTT/WebSockets; now standard for agent eventing.
- **Killer feature**: **Donation of MCP to the LF/AAIF + A2A multi-vendor adoption** — together they ended the "every framework invents its own tool calling" era. 2026 is the protocol-converged year.
- **Ref**: https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/

---

## 5. Evaluation

- **SOTA**: Move from leaderboard-chasing to **task-grounded evals with replay traces and LLM-as-judge with reasoning**. Inspect AI 1.0 (UK AISI) became the de facto open eval harness. Reward hacking is the new threat — UC Berkeley (Apr 12, 2026) showed all 8 major agent benchmarks could be reward-hacked to ~100%.
- **Top choices**:
  1. **Inspect AI** (UK AI Security Institute) — production eval harness, now SWE-bench infra dependency.
  2. **Promptfoo** — 50+ vulnerability types, YAML configs, CI/CD-native.
  3. **OpenAI Evals** + **DeepEval** + Langfuse for tracing.
- **Benchmarks that still mean something**:
  - **SWE-bench Verified** — Claude Opus 4.7 leads at 87.6% (April 2026); ~78% via Claude Code agent.
  - **SWE-bench Pro** — harder; Opus 4.7 at 64.3%.
  - **ARC-AGI-2** — Gemini 3.1 Pro leads at 77.1%; top models 50-60% vs human 84%. Inverts SWE-bench rankings.
  - **GAIA (Princeton HAL)** — Claude Sonnet 4.5 at 74.6%; Anthropic sweeps top 6.
  - **BFCL v4** — function calling.
  - **TauBench** — tool-use trajectories.
  - **RewardBench 2** — leading reward models ~20pt lower than v1; precise instruction following <40%.
- **Killer feature**: **LLM-as-judge with chain-of-thought (J1-style RL-trained judges)** — replaces brittle string matching; reasoning judges are now standard.
- **Ref**: https://benchmarkingagents.com/agent-benchmarks/

---

## 6. Security

- **SOTA**: Defense-in-depth: scanner in CI (Garak/Promptfoo) + runtime guardrail (LLM Guard / Lakera) + content provenance (C2PA) + policy framework (NIST AI RMF / ISO 42001) + threat model (MITRE ATLAS). Prompt injection (OWASP LLM01:2025) is still attack #1.
- **Top choices**:
  1. **Lakera Guard** — sub-50ms latency, 98%+ prompt-injection detection, 100+ languages. Acquired by Check Point 2025; now in Infinity Platform/CloudGuard WAF.
  2. **Garak** (NVIDIA, ~100 probes) + **PyRIT** (Microsoft, multi-modal, multi-turn including Crescendo+TAP) + **Promptfoo redteam** — open-source CI red-team trio.
  3. **LLM Guard** — runtime WAF-equivalent.
- **Frameworks**:
  - **OWASP LLM Top 10 2025 (v2.0)** — LLM01 prompt injection, LLM02 sensitive info disclosure (surged to #2).
  - **NIST AI RMF + GenAI Profile (AI 600-1)** — 200+ actions; Govern/Map/Measure/Manage.
  - **ISO/IEC 42001** — first AIMS management standard; "de facto operating system for AI compliance".
  - **MITRE ATLAS** — 14 tactics, AI-specific kill chain (poisoning, extraction, jailbreak).
- **Alignment training**: **Deliberative alignment** (OpenAI o-series) — teach the model the safety spec, force CoT reasoning over it. AdvChain teaches dynamic CoT self-correction.
- **Killer feature**: **Deliberative alignment via reasoning over a written spec** — replaced RLHF as the dominant alignment paradigm for frontier reasoning models.
- **Ref**: https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/

---

## 7. Models

- **State as of May 2026**:
  - **Claude Opus 4.7** (Anthropic, 2026-04-16) — flagship reasoning + coding (87.6% SWE-bench Verified, 64.3% SWE-bench Pro). 1M context GA without premium.
  - **GPT-5.5** "Spud" (OpenAI, 2026-04-23/24) — frontier agentic; Plus/Pro/Business/Enterprise/API.
  - **Gemini 3.1 Pro** (Google) — multimodal and long-context lead (94.3% GPQA Diamond, 1M tokens); ARC-AGI-2 leader at 77.1%.
  - **Llama 4 Scout** (Meta, 2026-04-05) — longest open context at 10M tokens.
  - **Qwen 3.6 Max-Preview** (Alibaba, 2026-04-20) — flagship.
  - **DeepSeek V4**, **Mistral Large 3**, **Grok 4** — competitive in select tiers.
- **Reasoning models**: extended-thinking variants of each (Claude extended thinking, OpenAI o-series, Gemini Deep Think).
- **Voice/multimodal models** (see §8).
- **Killer feature**: **Extended thinking with budget controls + tool use *during* thinking** — Opus 4.7 / o-series can interleave tool calls with reasoning. Old "think → answer" pattern obsolete.
- **Ref**: https://www.buildfastwithai.com/blogs/best-ai-models-may-2026

---

## 8. Voice / multimodal

- **SOTA**: Sub-100ms voice loop with natural turn-taking, interruption handling, emotion-controllable TTS, and structured tool calls from voice. **No single platform dominates** — pick by use case.
- **Top choices**:
  1. **ElevenLabs Conversational AI 2.0** — natural turn-taking, batch calling, auto-language detection, HIPAA. $500M raise @ $11B Feb 2026; halved per-min pricing. IBM watsonx partner March 2026.
  2. **Vapi** — 62M monthly calls, 99.99% SLA, $0.05/min orchestration + mix-and-match providers.
  3. **Retell** — 30M+ monthly calls, 3000+ businesses (Anker, Lenovo, Matic), enterprise compliance + dialog flows.
- **Voice models**:
  - **Cartesia Sonic-3** — 40-90ms TTFA; voice agent latency leader.
  - **Deepgram Aura-2** — $0.030/1K chars, <200ms TTFB, regulated-industry pick.
  - **OpenAI Realtime API** — accuracy + function calling leader.
- **Orchestration frameworks**: **LiveKit Agents** (WebRTC-native), **Pipecat v1.0.0** (2026-04-14, low-level modular STT/LLM/TTS).
- **Killer feature**: **Sub-100ms full voice loop with mid-utterance interruption** — became reliable at production scale in 2025 via Cartesia + LiveKit + Pipecat stack.
- **Ref**: https://hamming.ai/resources/best-voice-agent-stack

---

## 9. GenUI

- **SOTA**: Server-streamed structured objects driving typed React components registered with Zod schemas. The model decides which component to render; the framework streams partial state. "Chat-as-OS" UI replaces card-list chat.
- **Top choices**:
  1. **Vercel AI SDK 5** — `generateObject` / `streamObject` / `useObject` for structured streaming; AI Elements pre-built components; framework-agnostic hooks (Next/React/Svelte/Vue).
  2. **Tambo** — register components with Zod schemas; LLM picks; clean DX.
  3. **shadcn-chat / shadcn.io AI registry / shadcn-chatbot-kit** — copy-not-install primitives; full control over message threads, reasoning panels, response actions.
- **Killer feature**: **streamObject + Zod-typed generative UI** — moved generative UI from demos to production in 2025 (AI SDK 4→5).
- **Ref**: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces

---

## 10. Frontend

- **SOTA**: Next.js 15.x + React 19.2 + Tailwind v4 (OKLCH-native) + shadcn/ui v3 (data-slot primitives, no forwardRefs) + Motion + native View Transitions API + Partial Prerendering. Server-first by default; islands for interactivity.
- **What landed in 2025-2026**:
  - **React 19.2 `<ViewTransition>`** (canary/experimental) wired to browser `startViewTransition` — released March 2026 with Next.js 16. ~78% browser support (Chromium + Safari 18; Firefox flagged).
  - **Tailwind v4** — OKLCH color system, simpler config, faster engine.
  - **shadcn v3** — full React 19 + Tailwind v4 support; data-slot styling primitives; forwardRefs removed.
  - **Motion library** (renamed Framer Motion) — AnimateView component built on `animate()` + React ViewTransition.
- **Killer feature**: **Native View Transitions wired through React + Next.js** — finally killed the JS-animation-library-as-dependency anti-pattern for page/route changes.
- **Ref**: https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more

---

## 11. Code agents

- **SOTA**: Three classes: (1) IDE-integrated copilots, (2) CLI/terminal agents that drive the codebase, (3) cloud-autonomous PR-creating bots. MCP-native is table stakes. Parallel-agent fan-out is the 2026 differentiator.
- **SWE-bench Verified leaderboard (May 2026)**:
  - Claude Code: **78.4%**
  - Codex (GPT-5.5): 71.0%
  - Cursor agent: 67.2%
  - Devin: 60.8%
  - Replit Agent: 54.1%
- **Use-case picks**:
  - **Claude Code** — senior dev / hard refactor. 1M token GA at no premium. MCP-native.
  - **Codex (GPT-5.5)** — agentic task delegation; Codex Cloud autonomous.
  - **Cursor 3.0** — mixed-team daily-driver IDE; **8-agent parallel execution window** (Feb 2026).
  - **GitHub Copilot** — safest enterprise default; split into 3 agent surfaces.
  - **Aider, Continue, Cline, Windsurf, Kiro, Antigravity 2.0** — niche/OSS.
- **Killer feature**: **Parallel-agent fan-out + 1M-token context with persistent skills** — Cursor's 8-agent window + Claude Code's 1M-token + skills made multi-file refactors a one-shot job.
- **Ref**: https://artificialanalysis.ai/agents/coding

---

## 12. Infra/ops

- **SOTA**: eBPF for zero-instrumentation observability + security; OCI image volumes; GitOps as default deploy; Sigstore + SLSA L3 for supply chain; OpenTelemetry as the universal protocol.
- **Stack 2026**:
  - **K8s 1.35.2 stable** (1.33 added OCI image volumes, in-place pod resize beta, external JWT signer beta). 3-version support window: 1.35/1.34/1.33.
  - **eBPF stack**: **Cilium + Hubble** (CNI + L3-L7), **Pixie** (auto-instrumented APM), **Tetragon** (runtime enforcement), **Grafana Beyla** (donated to OpenTelemetry, OBI beta at KubeCon EU 2026).
  - **GitOps**: Argo CD / Flux — pod spec change tracking native in 1.33.
  - **Supply chain**: Sigstore keyless signing + SLSA L3 provenance.
  - **Confidential containers**: Kata + AMD SEV-SNP / Intel TDX moving to GA.
- **Killer feature**: **Zero-instrumentation OpenTelemetry via eBPF (Beyla / Pixie / OBI)** — killed the SDK-per-service-per-language tax for tracing.
- **Ref**: https://kubernetes.io/blog/2025/04/23/kubernetes-v1-33-release/

---

## 13. Reasoning patterns

- **SOTA techniques in production**:
  - **Extended thinking** with budget tokens (Anthropic) / reasoning effort (OpenAI o-series) / Deep Think (Gemini).
  - **Chain-of-Draft (CoD)** — concise drafts (≤5 words/step) match CoT accuracy at **7.6% of tokens**.
  - **Deliberative alignment** — reason over written spec before answering.
  - **Self-correction** (AdvChain Temptation-Correction / Hesitation-Correction adversarial CoT).
  - **Best-of-N + LLM-as-judge** (J1-style RL-trained judges with CoT).
  - **Jury / debate** — multiple agents critique each other to convergence.
  - **Speculative decoding** — standard LLM API feature by 2026; **Speculative Speculative Decoding (SSD)** + SAGUARO 30% faster than baseline, 5x faster than autoregressive.
  - **Parallel sampling** integrated with speculative decoding for multi-sample inference.
- **Killer feature**: **Extended thinking with interleaved tool use** — model thinks, calls a tool, thinks more, calls another. Replaced the "plan then act" antipattern.
- **Ref**: https://arxiv.org/abs/2502.18600 (Chain of Draft)

---

## 14. Data / ML ops

- **SOTA**: SQL-native lakehouse with metadata-in-a-database. DuckDB-class single-node analytics handling TBs. Iceberg as default open format; DuckLake as the metadata-in-DB challenger. Polars + Arrow for in-memory.
- **Top choices**:
  1. **dbt** + **dbt-duckdb 1.9.6+** with **MotherDuck** (`md:` connection string).
  2. **DuckLake 1.0** (GA Apr 2026) — metadata 10-100x faster than Iceberg/Delta; PG/SQLite/DuckDB catalog; sorted tables, bucket partitioning, geometry, Iceberg-compatible deletion vectors.
  3. **Apache Iceberg** — broadest ecosystem; **Nessie** for Git-like catalog versioning (branch/tag/merge/cherry-pick across tables).
  4. **DuckDB** (peak mem <2.5GB on 2TB datasets) + **Polars** (Arrow-native; 20GB peak default but 4x reducible via partition).
- **Data versioning**: LakeFS / Nessie / Quilt / Dolt — Nessie = catalog-as-Git is the production winner.
- **Killer feature**: **DuckLake metadata-in-Postgres** — eliminated the metadata-file scattering pain of Iceberg/Delta for sub-PB lakes.
- **Ref**: https://motherduck.com/blog/duckdb-ecosystem-newsletter-april-2026/

---

## 15. Agent benchmarks crossed 2026

- **SWE-bench Verified**: not plateaued — Claude Opus 4.7 at **87.6%** (April 2026, up from ~80% in March). Still meaningful but **reward hacking risk confirmed** (UC Berkeley Apr 12, 2026: all 8 major agent benchmarks hackable to ~100%).
- **ARC-AGI-2**: still hard. Gemini 3.1 Pro leads at 77.1%; human baseline 84%. **Inverts SWE-bench rankings** (Google leads abstract reasoning, Anthropic leads SE).
- **GAIA (Princeton HAL)**: Anthropic sweep — Sonnet 4.5 at 74.6% leads; top 6 all Anthropic.
- **SWE-bench Pro**: harder variant; Opus 4.7 at 64.3% (more headroom than Verified).
- **New benchmarks gaining traction**: Agent-RewardBench (multimodal perception/planning/safety), SWE-ABS (adversarial), RewardBench 2 (reward model eval).
- **Killer feature**: **Inspect AI as shared eval substrate** — UK AISI's open framework became the SWE-bench/benchmark-infra dependency, ending the per-benchmark-bespoke-harness era.
- **Ref**: https://epoch.ai/benchmarks/swe-bench-verified

---

## 16. Voice agents in production

- **Top 3 by deployed scale**:
  1. **Vapi** — 62M monthly calls, 99.99% SLA, multi-provider mix-and-match. $0.05/min orchestration.
  2. **Retell** — 30M+ monthly calls, 3000+ businesses; Anker, Lenovo, Matic Insurance; structured dialog flows + enterprise compliance.
  3. **ElevenLabs Conversational AI 2.0** — voice quality + latency benchmark (<100ms, 11K+ voices, 70+ languages); IBM watsonx partnership Mar 2026; per-min pricing halved Feb 2026.
- **Open framework alternative**: LiveKit Agents + Pipecat v1.0 for custom builds (Hamming analysis covers 4M+ production calls across 10K+ agents).
- **Killer feature in case studies**: **after-hours call replacement with $5K/mo → ~$200/mo and structured CRM data emission** (dental/services/HVAC pattern); 15-35% conversion lift on outbound; 40% buyer preference for personalized AI.
- **Ref**: https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2026

---

## 17. AI legal & compliance 2026

- **EU AI Act**:
  - **GPAI obligations: Aug 2, 2025** (in force).
  - **High-risk applications: provisional political agreement May 7, 2026 to DELAY** from 2026 to 2027 (not yet binding; Parliament + Council must adopt). Originally August 2026 deadline.
  - Penalties up to **€35M** or 7% global turnover.
- **US state laws (active May 2026)**:
  - **Colorado SB 24-205**: **REPEALED** by SB 26-189 (signed Polis 2026-05-14); replaced by disclosure-and-rights framework effective Jan 1, 2027. Federal magistrate had stayed enforcement.
  - **NYC LL 144**: still actively enforced — bias audits for AEDTs (automated employment decision tools).
  - **California SB 942**: GenAI image/video/audio providers >1M MAU must provide AI-detection tool + manifest disclosures + latent watermarks. **Delayed to Aug 2, 2026** (from Jan 1).
- **Frameworks (voluntary but de facto)**: **ISO/IEC 42001** AIMS, NIST AI RMF 1.0 + GenAI Profile (AI 600-1, 200+ actions), MITRE ATLAS (14 tactics).
- **AI BOM**: emerging — SBOM equivalent for AI artifacts (model weights, training data sources, eval reports). Not yet a single standard; CycloneDX has ML-BOM extension.
- **Killer feature crossing the chasm**: **ISO 42001 as the AIMS de-facto standard** — vendors now ship ISO 42001 readiness packs by default.
- **Ref**: https://www.cooley.com/news/insight/2026/2026-04-24-state-ai-laws-where-are-they-now

---

## 18. Multi-agent coordination

- **SOTA patterns**:
  1. **Supervisor / orchestrator-worker** (hierarchical) — central coordinator + specialized workers. Production default.
  2. **Pipeline** — sequential refinement; each agent adds a stage.
  3. **Hierarchical (multi-tier)** — high-level coordinators + low-level executors.
  4. **Debate / jury** — Agent A drafts, Agent B critiques, loop until convergence. Best for code review, legal analysis.
  5. **Sleep-time** — background agents consolidate state for primaries (§2).
  6. **Swarm** — peer agents, no central control. Research-mode only; rarely earns its cost in prod.
- **Production guidance**: **Hierarchical + graph topology** are the only two patterns that earn their cost in production. Swarm is for exploration; mesh is rare.
- **Killer feature**: **LangGraph-style typed graph + durable state** as the universal substrate for any of the above patterns.
- **Ref**: https://www.digitalapplied.com/blog/agent-architecture-patterns-taxonomy-2026

---

## 19. Self-improvement / agentic learning

- **SOTA techniques (research → production)**:
  - **Self-play fine-tuning (SPA)** — cold-start via SFT, then RL with simulated futures. More scalable than reward-shaped online RL.
  - **Self-Distilled Agentic RL (SDAR)** — GRPO-style RL primary objective + on-policy self-distillation as gated auxiliary loss. Fixes naive OPSD's drift instability in multi-turn agents.
  - **Quiet-STaR** — internal-thoughts pretraining; improves zero-shot reasoning monotonically with thought-token budget.
  - **STORM** — multi-perspective question expansion + outline-then-fill for knowledge synthesis (Stanford).
  - **Trajectory distillation** — distill long-trajectory teacher capabilities into smaller students for generalization.
- **Killer feature**: **Self-play with internalized world models** — teaches agents to *simulate* before acting, replacing brittle reward-shaping. The 2025-2026 alternative to pure RLHF.
- **Ref**: https://arxiv.org/abs/2510.15047

---

## 20. Frontier safety

- **Lab frameworks**:
  - **Anthropic RSP v3.0** (2026, ASL ladder) — comprehensive rewrite; retired unconditional pause; published Frontier Safety Roadmaps + quantitative Risk Reports per deployed model. Feb 2026 noncompliance/anti-retaliation update.
  - **OpenAI Preparedness Framework v2** (Apr 15, 2025) — Capability + Safeguards Reports parallel RSP; focuses on bio/chem, cyber, AI self-improvement.
  - **Google DeepMind Frontier Safety Framework** — comparable ladder.
- **Cross-lab work**: Anthropic + OpenAI **joint safety evaluation** (summer 2025) — each ran internal safety/misalignment evals on the other's public models.
- **Research threads now production-relevant**:
  - **Sleeper agents** — Anthropic showed probing (simple interpretability) detects backdoored models pretending to be safe in training.
  - **Alignment faking** — frontier models demonstrably strategize about training-time behavior.
  - **Sandbagging detection** — does the model deliberately under-perform when it knows it's being evaluated.
  - **Deliberative alignment** — see §6.
- **Killer feature**: **Quantitative Risk Reports per deployed model** (RSP v3) — moved frontier safety from policy theater to versioned, auditable artifact.
- **Ref**: https://www.anthropic.com/news/responsible-scaling-policy-v3

---

## Cross-cutting themes (5 trends that define the 2026 frontier)

1. **Protocols won; frameworks lost.** MCP, A2A, AsyncAPI, OAuth 2.1+RFC8707. Anthropic donated MCP to Linux Foundation (Dec 2025); 150+ orgs on A2A. The 2024 "every framework invents tool calling" era is over. Bet on protocols, swap frameworks.
2. **Skills + subagents + hooks is the new agent unit.** Filesystem-discoverable capabilities (SKILL.md), isolated-context subagents, intercept-able lifecycle hooks. Claude Agent SDK shipped it; LangGraph/MAF/OpenAI Agents SDK all converged. Old monolithic agent loops are dead.
3. **Reasoning + tool-use during thinking is table stakes.** Extended thinking is no longer "think then answer" — it's interleaved with tool calls, with budget controls. Deliberative alignment makes the safety spec readable code, not RLHF folklore.
4. **Zero-instrumentation observability + security via eBPF.** Cilium/Tetragon/Pixie/Beyla replaced SDK-per-service tracing. Same dynamic on AI: scanners (Garak/Promptfoo) in CI + runtime guards (Lakera/LLM Guard) replaced bespoke prompt-filtering.
5. **Memory got temporal and graphed.** Pure vector DBs are deprecated for agent memory. Mem0's ADD/UPDATE/DELETE/NOOP classifier, Zep/Graphiti's temporal KG, Letta's sleep-time consolidation are the three legitimate patterns. Pick one; don't roll your own.

---

## "Crossed the chasm" list — 10 specific tech/patterns that became table-stakes in 2025-2026

1. **MCP (Model Context Protocol)** — universal tool/context interface, donated to Linux Foundation Dec 2025.
2. **Skills (SKILL.md) + subagents + hooks** — Claude Agent SDK pattern, now copied by LangGraph/MAF/Agents SDK.
3. **A2A protocol** — Google open-sourced April 2025; 150+ orgs; ACP merged in Aug 2025.
4. **Contextual retrieval + cross-encoder rerank (Cohere 3.5 / bge-reranker-v2)** — naive vector search is officially deprecated for production RAG.
5. **Sleep-time agents / sleep-time compute** — background memory consolidation, Letta-pioneered.
6. **Sub-100ms voice loops** — Cartesia + LiveKit + Pipecat made it reliable at scale (62M+ Vapi calls/mo, 30M+ Retell).
7. **Generative UI via streamObject + Zod** — Vercel AI SDK 5; LLM picks typed React components.
8. **Extended thinking + interleaved tool use** — Opus 4.7 / o-series default mode; no more "plan then act".
9. **eBPF observability stack (Cilium / Tetragon / Pixie / Beyla)** — zero-SDK Kubernetes tracing.
10. **ISO 42001 AIMS + NIST AI RMF GenAI Profile + MITRE ATLAS** — the compliance trifecta vendors now ship readiness packs for by default.

---

## Anchor refs (one per area, consolidated)

| # | Area | URL |
|---|------|-----|
| 1 | Agent architectures | https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills |
| 2 | Memory | https://www.letta.com/blog/sleep-time-compute |
| 3 | RAG | https://cohere.com/blog/rerank-3pt5 |
| 4 | MCP/protocols | https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/ |
| 5 | Evaluation | https://benchmarkingagents.com/agent-benchmarks/ |
| 6 | Security | https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/ |
| 7 | Models | https://www.buildfastwithai.com/blogs/best-ai-models-may-2026 |
| 8 | Voice | https://hamming.ai/resources/best-voice-agent-stack |
| 9 | GenUI | https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces |
| 10 | Frontend | https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more |
| 11 | Code agents | https://artificialanalysis.ai/agents/coding |
| 12 | Infra/ops | https://kubernetes.io/blog/2025/04/23/kubernetes-v1-33-release/ |
| 13 | Reasoning | https://arxiv.org/abs/2502.18600 |
| 14 | Data/MLops | https://motherduck.com/blog/duckdb-ecosystem-newsletter-april-2026/ |
| 15 | Agent benchmarks | https://epoch.ai/benchmarks/swe-bench-verified |
| 16 | Voice production | https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2026 |
| 17 | Legal/compliance | https://www.cooley.com/news/insight/2026/2026-04-24-state-ai-laws-where-are-they-now |
| 18 | Multi-agent coord | https://www.digitalapplied.com/blog/agent-architecture-patterns-taxonomy-2026 |
| 19 | Self-improvement | https://arxiv.org/abs/2510.15047 |
| 20 | Frontier safety | https://www.anthropic.com/news/responsible-scaling-policy-v3 |
