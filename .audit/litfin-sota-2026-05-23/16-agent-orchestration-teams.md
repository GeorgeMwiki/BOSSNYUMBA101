# Agent Orchestration Teams — SOTA 2026 Research

> Research date: 2026-05-23  
> Goal: turn BOSSNYUMBA's AI from a copilot mosaic into a **digital property-management company** — 20-100+ agents that plan, analyse, execute, and learn as reliably as a real team.  
> Scope: state-of-the-art (May 2026), framework-by-framework, pattern-by-pattern, then mapped onto BOSSNYUMBA's actual packages.

---

## 0. TL;DR — the five claims that drive this audit

1. **Hierarchical wins** in production. Supervisor anchors goal-alignment; swarm drifts. (Digital Applied, 2026 taxonomy; LangGraph docs.)
2. **Durable execution is non-optional** for long-horizon agent teams. LangGraph, Pydantic AI, OpenAI Agents SDK have all adopted it as a first-class feature in 2026; Temporal/Restate/Inngest/Cloudflare/Vercel/AWS now ship it natively.
3. **A2A + MCP are the two-protocol stack** for multi-vendor agent interop. 150+ orgs; LF-governed; v1.0 with Signed Agent Cards.
4. **Prompt caching + parallel tool use** are now the highest-ROI cost levers — 40-90% off input tokens with no quality loss.
5. **Sleep-time compute** (Letta) lets agents *keep thinking* between user turns — pre-warming memory, pre-computing recommendations. This is what makes 24/7 "ambient team" work.

---

## 1. Orchestration framework landscape (May 2026)

### 1.1 Claude Agent SDK (Anthropic) — *MCP-native, file-based agents*

| Primitive | What it is | BOSSNYUMBA fit |
|---|---|---|
| **Skill** | Markdown file `.claude/skills/<name>/SKILL.md` invoked as slash command | Already mirrored in `ai-copilot/src/skills/{admin,domain,estate,graph,kenya,org}/` — formalise the catalog as a Markdown bundle |
| **Subagent** | Specialised instance with own context window, tool restrictions, hooks | Maps to our `personas` + `task-agents` — we should adopt the *isolated context window* semantics |
| **Hook** | Event-driven deterministic script around tool calls / session boundaries | We have ad-hoc gates; should be wired as a uniform `hookBus` (PreToolUse, PostToolUse, Stop) |
| **Memory** | Subagent-owned MD knowledge that persists across conversations | We have `ai-copilot/src/memory/` and `dp-memory/` — extend with per-subagent block |

SDK is `@anthropic-ai/claude-agent-sdk` (TS) / `claude-agent-sdk` (Py). The TS variant is the cleanest path for our monorepo. ([Anthropic docs](https://platform.claude.com/docs/en/agent-sdk/claude-code-features))

### 1.2 LangGraph 1.0 (LangChain) — *graph-state runtime, supervisor pattern, time-travel*

- **Runtime**: StateGraph with checkpointer; snapshot at every step, organised into *threads*.
- **Supervisor pattern**: central node routes via LLM reasoning; collects worker outputs; decides next-step or terminate. Production-proven at Klarna, Uber, LinkedIn, Replit, AppFolio.
- **Swarm**: decentralised handoffs; LangGraph Swarm package; agents decide independently when to engage.
- **Time-travel**: rewind state, patch, replay — *killer feature* for debugging multi-agent loops and audit-trail reconstruction.
- **Status**: 90M+ monthly downloads; default runtime for all LangChain agents.

### 1.3 Microsoft Agent Framework 1.0 (April 2026) — *unifies Semantic Kernel + AutoGen*

- **Declarative YAML**: agents, tools, memory, orchestration topology in version-controlled YAML loaded via single API call.
- **Replaces**: Semantic Kernel and AutoGen, both in maintenance mode.
- **Runtime**: .NET + Python, OpenTelemetry-native, asynchronous actor model (carried over from AutoGen v0.4).
- **Killer feature for us**: YAML-as-source-of-truth for an entire agent org chart — fits BOSSNYUMBA's compliance-plugin model.

### 1.4 OpenAI Agents SDK (v0.17.1, May 2026) — *handoffs as core primitive*

- **Primitives**: Agents (LLM + tools), Agents-as-tools / Handoffs, Tracing, Approvals, Resume bookkeeping.
- **2026 adds**: Sandboxing, long-horizon harness, subagents and code mode coming.
- **`@openai/agents` (TS)**: same primitives, JS-native.
- **Sweet spot**: simplest API; great for production agents that mostly route → execute → return.

### 1.5 Google ADK — *workflow agents + dynamic LLM transfer*

- **Workflow agents**: Sequential / Parallel / Loop — deterministic pipelines.
- **LlmAgent transfer**: LLM-driven dynamic routing for adaptive behaviour.
- **Languages**: Python 2.0 beta, Java 1.0, Go 1.0 (with OTel + self-healing plugins + HITL security), Kotlin 0.1.0.
- **Multi-agent**: hierarchical composition is native (specialist teams collaborate and delegate).

### 1.6 AutoGen 0.5+ → Microsoft Agent Framework — *maintenance mode*

- Async actor runtime, OTel-native (v0.4 rewrite).
- Use cases now route through MAF; stays alive for research/prototyping.

### 1.7 DSPy 3.x + GEPA (2025-2026) — *programs > prompts*

- **DSPy** treats agents as *programs* with optimisable signatures.
- **GEPA** (Genetic-Pareto, Agrawal 2025): reflective prompt evolution that outperforms RL fine-tuning, sample-efficient, maintains Pareto frontier of candidate prompts.
- **Use for us**: optimising the system prompts of high-volume personas (Estate Manager, Tenant Assistant, Owner Advisor) against tenant-specific golden scenarios.

### 1.8 CrewAI v0.8+ — *role-based teams, sequential or hierarchical*

- Agents declared with `role`, `goal`, `backstory`, `tools`.
- Process modes: **Sequential** (in order) and **Hierarchical** (manager agent dynamically assigns tasks, reviews outputs).
- Strong opinions, low ceremony. Good for prototyping the team-of-agents narrative.

### 1.9 Smolagents (HuggingFace) — *code agents, 1k LoC*

- Defining feature: agents write **Python code** instead of JSON tool calls → 30% fewer LLM steps, 44.2% on GAIA (vs 7% for GPT-4-Turbo).
- Sandboxes: E2B, Modal, Docker, Pyodide+Deno WASM, Blaxel.
- Use for us: a *code-mode* fallback for skills that today require multi-tool orchestration (e.g. M-PESA reconciliation, KRA rental summary).

### 1.10 Letta v2 — *sleep-time agents, memory blocks*

- **Memory blocks**: labelled context-window sections with character limits, sharable across agents.
- **Sleep-time agents**: background agents that share memory with a primary, mutate it asynchronously between user turns.
- **Why it matters**: lets BOSSNYUMBA *pre-compute* an Estate Manager's morning briefing while the manager sleeps, *anticipate* tenant questions, *consolidate* memory after every conversation. This is the missing piece for a 24/7 ambient team.

### 1.11 Pydantic AI v1 — *type-safe, dependency-injected*

- 16.5k+ stars; v1.85.1 (April 2026).
- Type-safe outputs, structured validation, dependency injection for testability.
- Benchmark: 160 LoC vs LangGraph 280 vs CrewAI 420 for the same agent.
- Use for us: Python-side agents where strict schema compliance matters (compliance, accounting, screening).

### 1.12 Mastra (TypeScript, Vercel) — *full toolkit, TS-first*

- 22k+ stars in 15 months, 300k+ weekly npm, v1.0 January 2026.
- Built on Vercel AI SDK; bundles agents, workflows, memory, evals, observability.
- Zod-typed `createAgent`, `createTool`, `createWorkflow` primitives.
- **Strongest TypeScript story for us** — our monorepo is TS, our gateway is Hono/Fastify, our frontend is Next. Mastra is the cleanest framework-shaped peer to what we've hand-rolled.

### 1.13 Inngest — *durable workflows + agent skills*

- Steps are first-class durable units (LLM call = step, tool call = step).
- **Checkpointing** released 2026 → near-zero inter-step latency while keeping durability.
- **Agent Skills** (Feb 2026): pre-built skills for Claude Code / Cursor / Windsurf.
- Use for us: durable execution sidecar for `task-agents/executor.ts` and the new `intelligence-orchestrator`.

### 1.14 Restate.dev — *lightweight durable execution, virtual objects*

- Sidecar that intercepts HTTP and adds durability; no separate cluster.
- Restate Cloud public 2025 with usage-based pricing.
- LangGraph, Pydantic AI, OpenAI Agents SDK have all adopted durable execution as first-class.
- Use for us: an alternative to Inngest if we want service-boundary durability rather than queue-style background jobs.

### 1.15 Temporal — *the production reference*

- Most battle-tested durable-workflow platform.
- 2026 added serverless option (Temporal Replay 2026).
- For mission-critical, multi-day workflows (eviction lifecycle, monthly close, owner statement run).

---

## 2. Multi-agent design patterns (2026 consensus)

### 2.1 Orchestrator-worker (supervisor) — **DEFAULT CHOICE**

Central LLM-driven node decomposes the task, delegates to workers, integrates results. Subtasks aren't pre-defined — emerge from input. Anthropic's coding agent uses this for GitHub issues.

**Use in BOSSNYUMBA for**: every multi-skill task (vacancy→lease, monthly-close, arrears ladder, eviction lifecycle).

### 2.2 Hierarchical (CEO → managers → ICs)

CEO-agent → domain-manager-agents (Marketing, Leasing, Accounting, Maintenance, Evictions, Owner-Relations) → IC-agents (specialist task-agents).

**Use in BOSSNYUMBA for**: the entire **digital company** mental model. This is the org chart in §3 below.

### 2.3 Debate / dialectic / jury

Two+ agents disagreeing surfaces errors. Computationally expensive — use sparingly.

**Use in BOSSNYUMBA for**: high-stakes one-way actions (eviction notice, court filing, tenant blacklist). Two-agent jury + judge.

### 2.4 Reflection / critique / revise

Generator → critic → revise loop. Effective when clear evaluation criteria exist.

**Use in BOSSNYUMBA for**: drafted communications (arrears notices, owner statements, marketing copy). We already have `ai-copilot/src/learning-loop/reflection.ts`.

### 2.5 Sleep-time / background

Agents continue thinking between user turns; mutate shared memory blocks; pre-compute next likely interactions.

**Use in BOSSNYUMBA for**: morning briefings, arrears recompute, risk re-score, M-PESA polling, calendar prep. We have `ai-copilot/src/background-intelligence/` and `ai-copilot/src/heartbeat/` — perfect substrate.

### 2.6 Swarm (decentralised handoffs)

Agents handoff control without supervisor. *Drifts in production* — use only for research/exploration.

**Use in BOSSNYUMBA for**: not as the primary topology. Useful as fallback inside a single domain (e.g. Maintenance dispatch → multiple vendors negotiate).

### 2.7 Plan-execute-replan

Planner creates strategy; executors run; debate validates at decision points; replan triggers on N consecutive step failures or contradicted assumptions.

**Use in BOSSNYUMBA for**: monthly close, owner-portfolio strategy, capital-expenditure planning.

### 2.8 LATS (Language Agent Tree Search)

Six-op cycle: select → expand → evaluate → simulate → backpropagate → reflect. MCTS over agent trajectories. 92.7% HumanEval pass@1; 75.9 WebShop without gradient updates.

**Use in BOSSNYUMBA for**: complex multi-step decisions where a wrong early choice is expensive — vendor selection, tenant placement, capital-expenditure prioritisation.

### 2.9 Voyager — *ever-growing skill library*

Three components: auto-curriculum, executable-code skill library, iterative self-verifying prompt loop. 3.3x more unique items, 15.3x faster milestones than prior SOTA.

**Use in BOSSNYUMBA for**: organic skill growth — when a task-agent figures out a new reconciliation pattern, persist it as a callable skill. Our `ai-copilot/src/skills/kenya/` is the seed of this.

### 2.10 Augmented LLM (Anthropic baseline)

One LLM + retrieval + tools + memory. **Start here** — Anthropic's #1 design rule: *use the simplest architecture that plausibly works.*

---

## 3. A2A protocol (April 2025 → 2026)

- **Transport**: HTTP + Server-Sent Events + JSON-RPC 2.0.
- **Capability discovery**: **Agent Card** at `/.well-known/agent.json`.
- **Governance**: Donated to Linux Foundation June 2025; 150+ orgs; v1.0 with **Signed Agent Cards**; AP2 extension shipping.
- **Production deployments**: Microsoft, AWS, Salesforce, SAP, ServiceNow.
- **Stack position**: A2A = agent↔agent; MCP = agent↔tool. Both required.

**BOSSNYUMBA status**: we already serve an Agent Card via `packages/agent-platform/src/agent-card.ts` — capability-advertisement-ready. **Gap**: no signed-card support; no A2A task-lifecycle endpoints; no AP2 (payments) extension.

---

## 4. Anthropic's "Building effective agents" — refreshed 2026

Five workflow patterns:

| Pattern | When to use | BOSSNYUMBA mapping |
|---|---|---|
| **Augmented LLM** | First default. Single agent + tools + memory. | Tenant Assistant, Public Guide |
| **Prompt chain** | Known fixed sequence | Letter generation, monthly close steps |
| **Routing** | Classify → specialise | `personas/persona-router.ts` already |
| **Parallelisation** | Independent subtasks; aggregate | Portfolio-wide risk re-score, fleet-wide inspection generation |
| **Orchestrator-worker** | Subtasks emerge from input | Coworker, Migration Wizard, Owner Advisor |
| **Evaluator-optimiser** | Iterative refinement against clear criteria | Comms drafting, lease abstraction, vendor scoring |

Anthropic's overarching rule (still 2026): **start with the simplest architecture that plausibly works**.

---

## 5. Long-horizon reliability — benchmarks (May 2026)

| Benchmark | Measures | Current leaders |
|---|---|---|
| **TAU-bench Retail / Airline** (τ²-bench) | Tool-agent-user multi-turn enterprise dialog under policy | Sierra-research, 25+ models evaluated; orchestrator-worker scaffolding consistently +12-18pp over naked ReAct |
| **GAIA** (Princeton HAL) | General assistant reasoning | Claude Sonnet 4.5 — **74.6%** |
| **SWE-Bench Verified** | Real GitHub-issue resolution | Claude Opus 4.7 — **87.6%** |
| **WebArena / AgentBench** | Web navigation, multi-app tasks | (varies; orchestration topology dominates) |

The **2026 consensus**: the five core agent benchmarks measure different things and should *never* be collapsed into a single ranking. The score lift from orchestrator-worker + reflection + checkpointing is **bigger than the score lift from changing the underlying model.**

---

## 6. Cost-efficient orchestration

1. **Prompt caching** (Anthropic explicit `cache_control`): writes 1.25× normal, reads **10%** of normal input rate (90% discount). 5-min TTL default; 1-hour option at higher write cost. **40-90% input-token reduction** on agent loops + RAG.
2. **Parallel tool use** (Claude 3.5+): up to 4 tool calls in a single LLM turn — saves the round-trip.
3. **Batch API**: another 50% off on top of caching → combined up to **95% cost cut**.
4. **Speculative decoding** (via providers like Together AI): up to 3× throughput for high-volume agent loops.
5. **Model routing**: Haiku for triage/router, Sonnet for execution, Opus only for adversarial review.

**BOSSNYUMBA gap**: `ai-copilot/src/cost-ledger.ts` exists; **no explicit `cache_control` markers** on persona system prompts.

---

## 7. Sleep-time agents (Letta 2026)

> *"Letting models think during downtime."*

A sleep-time agent shares one or more memory blocks with a primary agent, runs in the background, rewrites memory asynchronously. Use cases:

- **Pre-warming**: while the Estate Manager sleeps, sleep-time agent reads overnight M-PESA settlements, recomputes arrears curves, drafts the morning briefing.
- **Anticipation**: after a tenant conversation closes, sleep-time agent predicts the next two likely questions and pre-loads the answers into memory.
- **Consolidation**: every N user turns, sleep-time agent compresses thread → episodic memory → semantic memory.

**BOSSNYUMBA fit**: `ai-copilot/src/heartbeat/`, `ai-copilot/src/background-intelligence/`, `ai-copilot/src/proactive-loop/`, `ai-copilot/src/ambient-brain/` are the substrate. **Gap**: no shared *memory block* model; no explicit primary↔sleep-time pairing.

---

## 8. Human-in-the-loop (HITL) patterns

| Pattern | Trigger | Production discipline |
|---|---|---|
| **Approve-before-execute** | Action above tenant risk floor | Queue → approver → resume from same state (OpenAI Agents SDK ships this) |
| **Escalate-on-low-confidence** | Model confidence < threshold | Hand off to specialist or human |
| **Learn-from-rejection** | Reviewer rejects proposed action | Capture as eval-set example; nightly retrain prompt via GEPA |
| **Tier-laddered autonomy** | Tenant config sets cap per domain | We already have this in `autonomy-governance/caps/` |

**EU AI Act August 2026 deadline** makes demonstrable HITL a *legal requirement* for high-risk autonomous agents — eviction, payment-plan, tenant-data-export all qualify.

**BOSSNYUMBA fit**: `autonomy-governance` is the foundation; `ai-copilot/src/approval-grants/`, `ai-copilot/src/governance/`, `ai-copilot/src/services/review-service.ts` already implement the hold-execute-resume cycle. **Gap**: rejections are *not* yet structured into a training corpus.

---

## 9. Agent observability — 2026 platform comparison

| Platform | Strength | OTel-native? |
|---|---|---|
| **Langfuse** | Open source (MIT), prompt-centric, datasets/evals | Yes |
| **LangSmith** | Tight LangGraph integration, Studio UI, time-travel debugging | Partial |
| **Arize Phoenix** | Open source, OpenInference semantic conventions | Yes — leader |
| **Braintrust** | Eval-first; tracing bolted on | Yes |
| **Helicone / Galileo / Laminar** | Specialist tooling — proxy, eval, latency | Varies |

**OpenTelemetry GenAI semantic conventions** (GenAI SIG since April 2024): unified attribute names for LLM calls, agent steps, vector DB queries, tokens, cost, quality metrics. Most attributes still *experimental* as of March 2026 but stabilising fast.

**The exit-strategy rule**: instrument on OTel-compliant conventions → swap backends without code changes. **All new BOSSNYUMBA agent instrumentation should target `gen_ai.*` attributes.**

**BOSSNYUMBA status**: we have `packages/observability/` and `ai-copilot/src/audit-trail/` — but no `gen_ai.*` OTel emission.

---

## 10. Production reliability — durable execution

- **Temporal**: most battle-tested. Use for eviction (multi-day, multi-actor), monthly close, owner statement runs.
- **Restate**: lightweight sidecar; service-boundary durability. Use for individual task-agents.
- **Inngest**: step-as-unit with 2026 checkpointing for near-zero latency. Use for our task-agent registry.
- **Cloudflare Workflows / Vercel WorkflowDevKit / AWS Durable Functions**: cloud-platform-native options that came GA late 2025.
- **Built-in to frameworks**: LangGraph, Pydantic AI, OpenAI Agents SDK now ship durable execution.

**BOSSNYUMBA gap**: `task-agents/executor.ts` is *not* durable. A crash mid-cron retries the whole batch instead of resuming from the last completed agent. **Adopting Inngest or Restate is the single biggest reliability lift.**

---

## 11. Digital Property-Management Company — proposed org chart

```
                    ┌───────────────────────────────┐
                    │  ESTATE MANAGER (Mr. Mwikila) │   ← CEO-tier persona
                    │  ai-copilot/src/personas      │
                    └───────────────┬───────────────┘
                                    │ delegates via HandoffPacket
        ┌──────────────┬────────────┼────────────┬────────────┬────────────┐
        │              │            │            │            │            │
   ┌────▼────┐   ┌─────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
   │ Marketing│   │ Leasing  │  │ Finance │  │  Maint  │  │ Evict.  │  │  Owner  │
   │ Manager  │   │ Manager  │  │ Manager │  │ Manager │  │ Manager │  │ Manager │
   └────┬─────┘   └────┬─────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
        │              │             │            │            │            │
  ┌─────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
  │ vacancy-   │ │ negotiation│ │ rent-    │ │maint-    │ │ arrears- │ │ owner-   │
  │ marketer   │ │ -open      │ │ reminder │ │ triage   │ │ ladder   │ │ advisor  │
  │ listing-   │ │ -counter   │ │ late-fee │ │ work-    │ │ -tick    │ │ owner-   │
  │ writer     │ │ -close     │ │ payment- │ │ order-   │ │ payment- │ │ statement│
  │ campaign-  │ │ lease-     │ │ plan     │ │ assign   │ │ plan-    │ │ ROI-     │
  │ sentry     │ │ abstract   │ │ vendor-  │ │ vendor-  │ │ proposer │ │ analyst  │
  │            │ │ inspection │ │ invoice  │ │ scorecard│ │ notice-  │ │ briefing │
  │            │ │ -scheduler │ │ approver │ │ proactive│ │ drafter  │ │ -gen     │
  │            │ │ application│ │ M-PESA   │ │ -maint-  │ │ court-   │ │ portfolio│
  │            │ │ -screener  │ │ reconcile│ │ alert    │ │ filing   │ │ strategy │
  └────────────┘ └────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                                                                              │
                                         ┌────────────────────────────────────┘
                                         │
                                  ┌──────▼──────┐
                                  │ Sleep-time  │   ← shared memory block,
                                  │  agents     │     pre-computes briefings,
                                  │ (per dept)  │     consolidates threads
                                  └─────────────┘

                          Cross-cutting horizontal services:
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ COWORKER (employee-facing chat) │ TENANT ASSISTANT │ PUBLIC GUIDE │     │
   │ MIGRATION WIZARD │ CLASSROOM TUTOR │ SOVEREIGN ADMIN │ PLATFORM SOV.   │
   └─────────────────────────────────────────────────────────────────────────┘

   Governance plane (every action gated):
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ AutonomyPolicy ─→ Caps ─→ SLO ─→ Canary ─→ Review ─→ Auto-rollback     │
   │           (autonomy-governance package — already shipped)               │
   └─────────────────────────────────────────────────────────────────────────┘

   Memory plane:
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ semantic-memory │ episodic threads │ dp-memory │ memory-decay │         │
   │ shared memory blocks (per dept) │ skill library (Kenya, finance, etc.) │
   └─────────────────────────────────────────────────────────────────────────┘
```

### Existing agent inventory (in repo today)

- **8 personas** (`ai-copilot/src/personas/`): Estate Manager, Coworker, Owner Advisor, Tenant Assistant, Public Guide, Bossnyumba Studio, Sub-persona Router, Migration Wizard family.
- **15 task-agents** (`ai-copilot/src/task-agents/agents/`): rent-reminder, late-fee-calculator, lease-renewal-scheduler, move-out-notice, inspection-reminder, vendor-invoice-approver, tenant-sentiment-monitor, arrears-ladder-tick, insurance-expiry-monitor, license-expiry-monitor, utility-meter-reading-reminder, vacancy-marketer, proactive-maintenance-alert, cross-tenant-churn-risk, payment-plan-proposer.
- **2 copilots** (`ai-copilot/src/copilots/`): maintenance-triage, migration-wizard.
- **5 orchestrators** (`ai-copilot/src/orchestrators/`): vacancy-to-lease, monthly-close, arrears-ladder, move-out, tender-to-contract.
- **Junior AI factory** (`ai-copilot/src/junior-ai-factory/`): self-service narrow-scope juniors with policy-subset inheritance and lifecycle caps.

**Total today: ~30 agents across 6 layers.** Goal: 60-100 across this org chart by end-2026.

---

## 12. Reference architecture: planner → workers → judge → memory → escalation

```
USER  ────▶ ┌─────────────────────────────────────────────────────────────┐
            │                  GATEWAY  (api-gateway)                      │
            │   - Auth, rate-limit, idempotency (agent-platform)           │
            │   - Tenant context resolution                                │
            │   - Cost-ledger pre-check                                    │
            └──────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────────────────────┐
            │           BRAIN KERNEL (central-intelligence)               │
            │   - identity / persona selection                            │
            │   - policy gate (cost ceilings, business hours, RBAC)       │
            │   - inviolable check (hard "never do this" set)             │
            │   - self-awareness module inventory                         │
            └──────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────────────────────┐
            │   PLANNER  (ai-copilot/src/orchestrator/orchestrator.ts)    │
            │   - emits TurnRequest                                        │
            │   - classifies intent (intent-router.ts)                    │
            │   - selects primary persona                                  │
            │   - decomposes into work units                               │
            └──┬────────────┬────────────┬─────────────────────────┬─────┘
               │            │            │                         │
               ▼            ▼            ▼                         ▼
            ┌─────┐     ┌─────┐      ┌─────┐                  ┌───────┐
            │WORK│     │WORK│      │WORK│  ...               │JUDGE  │
            │  1  │     │  2  │      │  N  │                  │(LLM   │
            │     │     │     │      │     │                  │ Judge)│
            │tool │     │tool │      │tool │                  │       │
            │calls│     │calls│      │calls│                  │ eval/ │
            │via  │     │via  │      │via  │                  │ scenario│
            │MCP  │     │MCP  │      │MCP  │                  │ runner│
            └──┬──┘     └──┬──┘      └──┬──┘                  └───┬───┘
               │           │            │                         │
               └───────────┴────────────┴─────────┬───────────────┘
                                                  │
                                                  ▼
            ┌─────────────────────────────────────────────────────────────┐
            │      AGGREGATOR + EVALUATOR-OPTIMISER LOOP                  │
            │   - re-prompt failing workers (max iterations)              │
            │   - emit reflection record                                  │
            │   - capture outcome (learning-loop/outcome-capture.ts)      │
            └──────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────────────────────┐
            │   AUTONOMY GATE  (autonomy-governance)                      │
            │   - tenant cap check (caps/)                                │
            │   - SLO check (slo/)                                        │
            │   - canary ramp (slo/canary-controller.ts)                  │
            │   - auto-rollback if SLO breached                           │
            └──────────────────┬──────────────────────────────────────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
            ┌──────────┐              ┌──────────────┐
            │  EXECUTE │              │   ESCALATE   │
            │ (durable │              │   (handoff/  │
            │ workflow │              │handoff-queue │
            │ via      │              │ to-human)    │
            │ Inngest/ │              │              │
            │ Restate) │              │ → exception- │
            └────┬─────┘              │   inbox      │
                 │                    └──────┬───────┘
                 ▼                           │
            ┌────────────────────────────────▼────────┐
            │   MEMORY UPDATE                          │
            │   - semantic-memory                      │
            │   - dp-memory (differentially-private)   │
            │   - episodic thread store                │
            │   - shared memory block (per dept)       │
            └────────────────────┬─────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────┐
            │   AUDIT + OBSERVABILITY                  │
            │   - audit-trail/                         │
            │   - autonomous-action-audit.ts           │
            │   - OTel gen_ai.* span emission          │
            │   - cost-ledger.ts increment             │
            └─────────────────────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────┐
            │   SLEEP-TIME AGENTS (between turns)     │
            │   - consolidate memory                  │
            │   - pre-warm next likely intents        │
            │   - re-run risk scores                  │
            │   - draft pending briefings             │
            └─────────────────────────────────────────┘
```

---

## 13. Ten concrete orchestration patterns to ship in BOSSNYUMBA

| # | Pattern | Where it goes | Effort | Payoff |
|---|---|---|---|---|
| 1 | **Supervisor pattern at department level** — wrap Marketing / Leasing / Finance / Maintenance / Evictions / Owner-Relations as supervisor-agents over current task-agents | New `ai-copilot/src/orchestrators/dept-supervisors/` | M | Replaces ad-hoc fan-out; gives the "team" mental model |
| 2 | **Durable execution** — wrap `task-agents/executor.ts` with Inngest or Restate; every step (LLM call, tool call, DB write) becomes resumable | `task-agents/executor.ts` | M | Crash-resilient cron; multi-day workflows (eviction, monthly close) |
| 3 | **Time-travel checkpoints on the orchestrator** — checkpointer at every persona-turn boundary, named threads, replay endpoint | `ai-copilot/src/orchestrator/orchestrator.ts` + new `checkpoint-store.ts` | M | Audit, debugging, training-data extraction |
| 4 | **Sleep-time agents per department** — one background agent per dept, shared memory block with the department supervisor, runs on `heartbeat` cron | New `ai-copilot/src/sleep-time/` | M | Morning briefings, anticipation, memory consolidation |
| 5 | **Signed Agent Cards + A2A task lifecycle** — extend `agent-platform/src/agent-card.ts` with JWS signatures and `/a2a/tasks/*` endpoints (create, get, cancel) | `agent-platform/` | S | Multi-vendor interop; Salesforce/SAP/ServiceNow integration |
| 6 | **Evaluator-optimiser loop on comms drafting** — every persona that drafts text (notices, statements, marketing) routes through a judge before send; rejections → eval set | `ai-copilot/src/copilots/`, learning-loop | S | Quality lift on the highest-tenant-visible surface |
| 7 | **OTel `gen_ai.*` span emission** — instrument every persona turn, tool call, advisor consultation; backend pluggable (start Langfuse / Phoenix) | `ai-copilot/src/providers/`, `observability/` | M | Vendor-agnostic observability; SOC2 + EU-AI-Act audit |
| 8 | **Prompt-cache markers on all persona system prompts** — Anthropic `cache_control: {type:"ephemeral"}` on the static prefix; 1-hour TTL on Estate-Manager prompts; per-tenant cache scope | `personas/system-prompts.ts`, `providers/anthropic.ts` | S | 40-90% input-token cost cut |
| 9 | **GEPA-style prompt optimisation against golden scenarios** — wire `eval/golden-scenarios.ts` into a GEPA-or-DSPy nightly job that proposes prompt mutations, judge scores them, top-frontier candidates ship to shadow mode | New `ai-copilot/src/prompt-optimiser/` | L | Quality lift without manual prompt-tuning |
| 10 | **Learn-from-rejection corpus** — every Review-Service rejection writes a structured (input, proposed-action, reviewer-edit, reviewer-comment) row → nightly used as DPO/preference-pairs for prompt rewriting; closes the autonomy loop | `services/review-service.ts` + new `learning-loop/rejection-corpus.ts` | M | Required for EU-AI-Act compliance; compounding quality |

---

## 14. What BOSSNYUMBA already has — and the gap

| Capability | Status | Where |
|---|---|---|
| Personas + persona router | **DONE** | `ai-copilot/src/personas/` |
| 15 task-agents + registry + executor | **DONE** | `ai-copilot/src/task-agents/` |
| End-to-end orchestrators (5) | **DONE** | `ai-copilot/src/orchestrators/` |
| Domain copilots (2) | **DONE** | `ai-copilot/src/copilots/` |
| Junior-AI factory (self-service narrow juniors) | **DONE** | `ai-copilot/src/junior-ai-factory/` |
| Autonomy caps + SLO + canary + auto-rollback | **DONE** | `autonomy-governance/` |
| Handoff packets + handoff-to-human queue | **DONE** | `autonomy-governance/handoff/`, `ai-copilot/src/thread/handoff-packet.ts` |
| Cost ledger + budget guard | **DONE** | `ai-copilot/src/cost-ledger.ts` |
| Audit-trail per autonomous action | **DONE** | `ai-copilot/src/audit-trail/`, `autonomy/autonomous-action-audit.ts` |
| Review service (approve-before-execute) | **DONE** | `ai-copilot/src/services/review-service.ts` |
| Inviolable check / policy gate | **DONE** | `central-intelligence/src/kernel/` |
| Eval golden scenarios + judge | **DONE** | `ai-copilot/src/eval/` |
| Background intelligence / heartbeat / ambient brain | **DONE** | `ai-copilot/src/background-intelligence/`, `heartbeat/`, `ambient-brain/`, `proactive-loop/` |
| Memory (semantic, dp, decay, extractor) | **DONE** | `ai-copilot/src/memory/`, `dp-memory/` |
| Skill library (Kenya, finance, leasing, comms, ...) | **DONE** | `ai-copilot/src/skills/` |
| Agent Card (A2A capability advertisement) | **PARTIAL** | `agent-platform/src/agent-card.ts` — no signing, no task endpoints |
| MCP server | **DONE** | `packages/mcp-server/` |
| ─── | ─── | ─── |
| **Department supervisors** (CEO→manager→IC) | **GAP** | New `dept-supervisors/` |
| **Durable execution** (Inngest/Restate/Temporal) | **GAP** | Wrap `task-agents/executor.ts` |
| **Time-travel checkpoints** | **GAP** | New checkpoint-store |
| **Sleep-time agents with shared memory blocks** | **PARTIAL** | Substrate exists in `heartbeat/`/`background-intelligence/`; no shared-memory-block model |
| **Signed Agent Cards + A2A task lifecycle** | **GAP** | Extend `agent-platform/` |
| **OTel `gen_ai.*` instrumentation** | **GAP** | Add to providers + observability |
| **Prompt-cache markers** | **GAP** | Add to `providers/anthropic.ts` + persona prompts |
| **GEPA / DSPy prompt optimisation** | **GAP** | New `prompt-optimiser/` |
| **Learn-from-rejection corpus** | **GAP** | Extend review-service + learning-loop |
| **Voyager-style skill auto-discovery** | **GAP** | Currently skills are hand-written; need auto-extract from successful agent runs |
| **LATS-style tree-search for high-stakes decisions** | **GAP** | Vendor selection, tenant placement, capex prioritisation |

---

## 15. Sources

- [Claude Agent SDK — Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Agent Teams, Subagents, and MCP: The 2026 Playbook (Developers Digest)](https://www.developersdigest.tech/blog/claude-code-agent-teams-subagents-2026)
- [Inside Claude Code, The Architecture Behind Tools, Memory, Hooks, and MCP](https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/)
- [LangGraph Supervisor Patterns 2026](https://www.lifetideshub.com/langgraph-supervisor-patterns-2026/)
- [LangGraph Checkpointing: Persistence and Time Travel](https://callsphere.ai/blog/langgraph-checkpointing-persistence-time-travel-agent-workflows)
- [LangGraph Multi-Agent: Supervisor, Swarm & Network (machinelearningplus)](https://machinelearningplus.com/gen-ai/langgraph-multi-agent-systems-supervisor-swarm-network/)
- [Microsoft Agent Framework Version 1.0 (devblogs.microsoft.com)](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/)
- [Microsoft Ships Production-Ready Agent Framework 1.0 (Visual Studio Magazine, April 2026)](https://visualstudiomagazine.com/articles/2026/04/06/microsoft-ships-production-ready-agent-framework-1-0-for-net-and-python.aspx)
- [Microsoft Agent Framework GA: AutoGen + Semantic Kernel Unified](https://jangwook.net/en/blog/en/microsoft-agent-framework-ga-production-strategy/)
- [OpenAI Agents SDK (Python)](https://openai.github.io/openai-agents-python/)
- [The Next Evolution of the OpenAI Agents SDK — April 2026](https://www.openlinksw.com/data/html/openai-agents-sdk-next-evolution-infographic.html)
- [OpenAI Upgrades Its Agents SDK With Sandboxing (DevOps.com)](https://devops.com/openai-upgrades-its-agents-sdk-with-sandboxing-and-a-new-model-harness/)
- [Comprehensive Guide to Building AI Agents Using Google ADK](https://www.firecrawl.dev/blog/google-adk-multi-agent-tutorial)
- [ADK Go 1.0 Arrives! (Google Developers Blog)](https://developers.googleblog.com/adk-go-10-arrives/)
- [Announcing the Agent2Agent Protocol (A2A) — Google Developers](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Protocol Explained: 150+ Organizations in One Year (Stellagent)](https://stellagent.ai/insights/a2a-protocol-google-agent-to-agent)
- [AI Agent Protocol Ecosystem Map 2026 (Digital Applied)](https://www.digitalapplied.com/blog/ai-agent-protocol-ecosystem-map-2026-mcp-a2a-acp-ucp)
- [Letta — Memory Blocks](https://www.letta.com/blog/memory-blocks)
- [Letta — Sleep-time agents (docs)](https://docs.letta.com/guides/agents/architectures/sleeptime/)
- [Letta — Sleep-time Compute (blog)](https://www.letta.com/blog/sleep-time-compute)
- [Anthropic — Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents)
- [Building with Agentic AI: Anthropic's 5 Essential Architect Patterns (Medium, March 2026)](https://aisolutionarchitect.medium.com/building-with-agentic-ai-anthropics-5-essential-architect-patterns-02f9e791b118)
- [AI Benchmarks 2026: Top Evaluations and Their Limits (Kili)](https://kili-technology.com/blog/ai-benchmarks-guide-the-top-evaluations-in-2026-and-why-theyre-not-enough)
- [Agent Benchmark Leaderboard 2026: AgentBench, SWE-bench, GAIA](https://benchmarkingagents.com/agent-benchmarks/)
- [τ²-Bench GitHub (sierra-research)](https://github.com/sierra-research/tau2-bench)
- [DSPy GEPA Optimizer Overview](https://dspy.ai/api/optimizers/GEPA/overview/)
- [GEPA — Reflective Prompt Evolution (GitHub)](https://github.com/gepa-ai/gepa)
- [What is CrewAI? Multi-Agent Framework Explained in 2026](https://futureagi.com/blog/what-is-crewai-2026)
- [CrewAI Multi-Agent Workflow Guide (QubitTool)](https://qubittool.com/blog/crewai-multi-agent-workflow-guide)
- [Smolagents (HuggingFace GitHub)](https://github.com/huggingface/smolagents)
- [Introducing smolagents (HuggingFace blog)](https://huggingface.co/blog/smolagents)
- [AutoGen (microsoft GitHub)](https://github.com/microsoft/autogen)
- [AutoGen Distributed Agent Runtime](https://microsoft.github.io/autogen/dev//user-guide/core-user-guide/framework/distributed-agent-runtime.html)
- [Pydantic AI (GitHub)](https://github.com/pydantic/pydantic-ai)
- [PydanticAI v1: Rewriting the Python Agent Stack (AgentMarketCap)](https://agentmarketcap.ai/blog/2026/04/06/pydanticai-python-agent-framework-langgraph-crewai-comparison)
- [Mastra (mastra.ai)](https://mastra.ai/)
- [Mastra in 2026: What It Is, When to Use It (dev.to)](https://dev.to/gabrielanhaia/mastra-in-2026-what-it-is-when-to-use-it-and-how-it-compares-2go1)
- [Mastra (Vercel docs)](https://vercel.com/docs/ai-gateway/ecosystem/framework-integrations/mastra)
- [Inngest — Durable Workflows](https://www.inngest.com/uses/durable-workflows)
- [Durable Execution: The Key to Harnessing AI Agents in Production (Inngest blog)](https://www.inngest.com/blog/durable-execution-key-to-harnessing-ai-agents)
- [Introducing Checkpointing: Near-zero latency for durable workflows (Inngest)](https://www.inngest.com/blog/introducing-checkpointing)
- [Temporal vs Restate vs Windmill 2026 (PkgPulse)](https://www.pkgpulse.com/guides/temporal-vs-restate-vs-windmill-durable-workflow-2026)
- [Durable Execution Patterns for AI Agents (Zylos Research, Feb 2026)](https://zylos.ai/research/2026-02-17-durable-execution-ai-agents)
- [Language Agent Tree Search (Emergent Mind)](https://www.emergentmind.com/topics/language-agent-tree-search-lats)
- [LATS arxiv paper (2310.04406)](https://arxiv.org/abs/2310.04406)
- [Voyager (MineDojo) — Open-Ended Embodied Agent](https://github.com/minedojo/voyager)
- [Top 6 Agent Observability Platforms 2026 (Laminar)](https://laminar.sh/article/2026-04-23-top-6-agent-observability-platforms)
- [OpenTelemetry GenAI Semantic Conventions (dev.to)](https://dev.to/x4nent/opentelemetry-genai-semantic-conventions-the-standard-for-llm-observability-1o2a)
- [OpenTelemetry GenAI Conventions: April 2026 State of Play (CallSphere)](https://callsphere.ai/blog/td30-fw-opentelemetry-genai-conventions-april-2026-guide)
- [Anthropic Prompt Caching in 2026 (AI Checker Hub)](https://aicheckerhub.com/anthropic-prompt-caching-2026-cost-latency-guide)
- [AI Agent Cost Optimization Guide 2026 (Moltbook-AI)](https://moltbook-ai.com/posts/ai-agent-cost-optimization-2026)
- [Don't Break the Cache (arxiv)](https://arxiv.org/abs/2601.06007)
- [Human-in-the-Loop AI Agents: Approvals, Escalation, Safe Autonomy (Medium, April 2026)](https://medium.com/@arvisionlab/human-in-the-loop-ai-agents-how-to-add-approvals-escalation-and-safe-autonomy-in-production-0a21e359781c)
- [Designing Human-in-the-Loop for Agentic Workflows (Medium, March 2026)](https://medium.com/@AlignX_AI/designing-human-in-the-loop-for-agentic-workflows-079faec737ed)
- [Agent Architecture Patterns: 2026 taxonomy (Digital Applied)](https://www.digitalapplied.com/blog/agent-architecture-patterns-taxonomy-2026)
- [Multi-Agent AI Patterns for Developers (Medium, April 2026)](https://dassum.medium.com/multi-agent-ai-patterns-for-developers-pick-the-right-pattern-for-the-right-problem-8f03ef476b45)
- [Agentic Design Patterns: The 2026 Guide (Sitepoint)](https://www.sitepoint.com/the-definitive-guide-to-agentic-design-patterns-in-2026/)
- [Agent Orchestration Patterns: Swarm vs Mesh vs Hierarchical (Gurusup)](https://gurusup.com/blog/agent-orchestration-patterns)
