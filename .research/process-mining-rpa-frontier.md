# Process Mining + RPA + Agentic BPM — Frontier Survey (2026-05-18)

Read-only research brief commissioned for BOSSNYUMBA101's central-intelligence kernel.
Scope: where the frontier sits for **observe → map → propose → automate** sub-agent
pipelines we want to deploy inside tenant property-management businesses.

---

## TL;DR

1. **Process discovery is solved for static logs, half-solved for streams.** Split Miner,
   Inductive Miner-infrequent (IMi), and the new Approximate Inductive Miner (AIM, 2023)
   are the three algorithms that dominate noisy-log benchmarks; for streaming logs the
   2025 AVOCADO challenge confirms no algorithm yet combines adaptive modelling,
   resource efficiency, drift detection, and noise resilience — pick the best two and
   ship.
2. **The "MCP server over a process-mining warehouse" pattern is now real.** Microsoft
   Power Automate Process Mining ships a 9-tool MCP server (April 2026); Celonis exposes
   the same surface via "AgentC." This is the exact integration shape our MD-kernel
   should expose to its sub-agents — we should clone the tool grammar verbatim
   (`get_processes`, `get_bottleneck_analysis`, `get_variants_with_metrics`,
   `get_correlation`).
3. **The vendor closest to our "junior-employee pipeline" is UiPath Maestro + Agent
   Builder (Sept 2025) followed closely by Pega GenAI Blueprint + Agentic Process
   Fabric (PegaWorld 2025).** UiPath wins the orchestration depth (case management,
   IXP, screenplay); Pega wins on the design-time loop (idea → workflow blueprint →
   running app); ServiceNow's L1 Service Desk Specialist (Q2 2026) is the only product
   targeting an actual headcount slot.
4. **Decagon's "Agent Operating Procedures" and Sierra's "constellation of models" are
   the two architectural ideas worth stealing.** AOPs are natural-language → compiled
   workflow ("SOP-as-code"); Sierra routes ~15 different models per agent step,
   redundant across providers. Both patterns directly map onto our `kernel/agency`
   executor + `tool-spec/hq-tools` design.
5. **The labour-displacement frontier is junior-employee work in narrow domains.**
   Klarna's "700 agents" claim is real-but-marketing (avoided hires, not laid-off
   workers — and by mid-2025 they walked it back). The credible
   junior-employee-replaceable surface today is: classification, lookups, refunds,
   identity verification, templated drafting, multi-step web form filling — graded by
   Tau2-bench (>90% on retail) and GAIA (74.6%); coding by SWE-Bench (Devin 13.86%
   baseline → much higher today). Long-tail desktop work still fails (WebArena ~71%
   even for SOTA).

---

## (1) Process mining algorithms — what's actually deployable

### Algorithm cheat-sheet

| Algorithm | Strength | Weakness | Streaming-capable? | Open-source impl | License |
|---|---|---|---|---|---|
| **Alpha Miner** (van der Aalst, 2003) | Simple, fast, theoretically clean | Breaks on noise/incomplete logs | No | `pm4py.discover_petri_net_alpha` | AGPL-3.0 (pm4py) |
| **Heuristic Miner** | Tolerates noise via frequency thresholds | Produces non-sound C-nets | No (batch) | `pm4py.discover_heuristics_net` | AGPL-3.0 |
| **Inductive Miner (IM)** (Leemans/Fahland/van der Aalst, 2013) | Always produces sound, block-structured models | Plain IM over-generalises | No | `pm4py.discover_petri_net_inductive` | AGPL-3.0 |
| **Inductive Miner – infrequent (IMi)** | Filters infrequent behaviour → 80% "happy-path" model | Tunable noise threshold is a knob | No | pm4py variant | AGPL-3.0 |
| **Approximate Inductive Miner (AIM)** (van Detten, ICPM 2023) | Better fitness/precision/size than Split Miner, no hyperparam tuning | Newer, less battle-tested | No | Reference impl on PADS RWTH | research |
| **Split Miner** (Augusto et al., 2017) | Best F-score + low complexity on benchmarks; BPMN output | Commercial heritage (Apromore); doesn't guarantee soundness | No | Apromore Community Edition | LGPL |
| **Evolutionary Tree Miner** | High precision/fitness via genetic search | Very slow | No | ProM plugin | GPL |
| **Timed Genetic-Inductive Miner (TGIPM)** (MDPI Systems 2025) | Handles incomplete + time-aware logs | Research-grade, no GA-ready impl | No | research code | research |
| **Online Miner / Lossy Counting variants** | True streaming discovery, bounded memory | Lower accuracy, weak on concept drift | **Yes** | pm4py `streaming` subpackage | AGPL-3.0 |
| **DCR-graph online discovery** | Declarative, handles drift natively | Different model shape (constraints, not flow) | **Yes** | DCRGraphs.net research code | mixed |
| **Prefix-alignment streaming conformance** | Online conformance, gives per-event deviation cost | Quadratic worst case | **Yes** | pm4py `streaming.algo.conformance.tbr` | AGPL-3.0 |

### What we should embed in `packages/central-intelligence/src/kernel/process-mining/`

Recommended stack (paragraph form):

We should wrap **three** discovery algorithms behind a single internal interface, picked
for complementary failure modes:

1. **Inductive Miner – infrequent (IMi)** as the default. It always returns a sound
   block-structured process tree, never deadlocks, and has a single readable knob
   (noise threshold ∈ [0,1]). This is the only algorithm that's safe to show a
   property owner without a process-mining expert in the loop.
2. **Split Miner** for the BPMN export path. When a tenant says "show me the
   workflow," they expect BPMN, not a Petri net. Split Miner ships native BPMN 2.0
   output and the lowest control-flow-complexity scores in published benchmarks. Note
   the LGPL boundary — we can call it across an OS boundary (Apromore CE jar via
   subprocess) but we should not statically link.
3. **Streaming token-based replay (TBR)** from pm4py's `streaming.algo.conformance.tbr`
   as our online drift monitor. Each tenant emits events into our event-bus; TBR over
   the IMi-discovered model gives a per-event fitness score, which feeds our
   `drift-detector.ts` and triggers "remap" cycles when the running process diverges
   from the agreed model.

We deliberately skip alpha-miner (toy), evolutionary tree miner (too slow for
multi-tenant), AIM (too new to bet on), and TGIPM (research-grade). pm4py exposes all
three under AGPL-3.0; for our SaaS deployment AGPL is fine because we never
distribute the binary to tenants — they consume the API. If we ever ship an on-prem
agent we will need PIS's commercial pm4py licence.

**Open question:** object-centric process mining (OCPM) and OCEL 2.0 are clearly the
future per van der Aalst (multiple 2024–2025 papers). Property management is
intrinsically multi-object: tenant ↔ unit ↔ lease ↔ payment ↔ work-order. We should
spike OCPM via pm4py's `pm4py.objects.ocel` namespace before locking in case-centric
event schemas — otherwise we'll have to re-emit logs in 18 months.

---

## (2) RPA vendors — who's converging on LLM-agentic?

| Vendor | 2024–26 agentic move | Strengths | Weaknesses | Pricing model |
|---|---|---|---|---|
| **UiPath** | **Maestro + Agent Builder + Studio + IXP + Screenplay** (FUSION 2025, Sept 30 2025); customer-LLM subscription via AI Trust Layer; Gemini 2.5 Flash/Pro built-in | Deepest catalogue (claims, loans, disputes); MCP plug-in support for coded agents; "Unified Audit 2.0" | Heavy platform, "RPA-first" mental model still leaks through; ROI proven on big-co processes, not SMB | Enterprise consumption (Robot Units / Agent Units) |
| **Automation Anywhere** | Automation Co-Pilot, Agentic Process Automation suite (2024); "AI Agent Studio" | Strong cloud-native bot fleet; document automation | Trailing UiPath on agentic narrative; less third-party model flexibility | Per-bot subscription + consumption |
| **Microsoft Power Automate** | **Process Mining MCP server** (April 2026 GA preview); Copilot Studio agents; "AI Builder" | MCP-first integration; lowest friction inside MS estate; Process Mining + Copilot fusion | Weaker desktop automation than UiPath; tied to Power Platform pricing | Per-user + per-flow + AI credits |
| **Pega** | **GenAI Blueprint** (Feb 2024) + **Agentic Process Fabric** (PegaWorld 2025) | Best design-time loop: idea → BPMN-like blueprint → running app; case-management heritage | Vertical lock-in; smaller external developer pool | Enterprise per-case-type |
| **Blue Prism (SS&C)** | Embedded GenAI extensions; survey-led "Agentic AI" repositioning | Strong governance, finance-vertical install base | Lagging on autonomous-agent narrative; mostly classical RPA | Enterprise |
| **WorkFusion** | Pre-packaged "AI Digital Workers" for AML/KYC | Vertical depth in financial crime; vetted models per role | Narrow vertical | Per-worker SaaS |
| **Kofax (Tungsten)** | TotalAgility + IDP heritage; GenAI add-ons | Strong document-IDP | Slower on agentic positioning | Enterprise |
| **ServiceNow** | **Now Assist + AI Agent Orchestrator** (GA March 2025); **L1 Service Desk AI Specialist** (Q2 2026) | Only vendor with a "buy a headcount slot" SKU; Workflow Data Fabric; rebranded as ServiceNow Otto | Locked into ServiceNow workflow estate | Per-agent / per-resolution |
| **Celonis** | **AgentC, Process Copilots, Orchestration Engine GA** (Celosphere 2025); Databricks partnership; "Context Model" | Best process-intelligence brain feeding the agents; OCPM | Less native automation muscle than UiPath; expensive | Consumption on data + agents |
| **Mimica, Skan AI** | Pure task-mining; export PDD/BPMN for downstream RPA | Computer-vision desktop observation; reads what users actually do | Not an automation engine — pairs with one | Per-desktop license |

**Where they win, where they lose to native LLM agents.** UiPath, Power Automate, and
Pega win wherever the work involves (a) regulated audit trails, (b) deep SAP/Oracle/
ServiceNow connectors that took man-decades to build, or (c) >100-step deterministic
flows. They lose to a thin Claude-computer-use + Temporal stack wherever (a) the
process touches <5 systems, (b) the company doesn't already pay six-figure RPA bills,
(c) the workflow needs LLM-grade judgement at most steps. For BOSSNYUMBA's tenants
(SMB property managers in TZ/EA) we're squarely in the latter zone — building on top
of UiPath would be over-engineering.

**Marketing flags** (claims we should not credit without proof): "autonomous agents
that learn your process" (UiPath), "self-improving digital workforce" (Automation
Anywhere), "AI agents that think and act like humans" (Pega). All three of these are
demo-driven, not deployment-grade per the 69% "AI projects never reach live ops" stat
from the Blue Prism / SS&C 2025 agentic survey.

---

## (3) Agentic BPM — closest products to our junior-pipeline vision

Our pipeline is: **observe → map → propose redesign → owner approves → automate**. The
vendors in order of fit:

### Tier 1 — closest fit

**UiPath (Maestro + Agent Builder + IXP + Screenplay), Sept 30 2025.**
- *Observe*: Task Mining (since 2020) + Communication Mining capture desktop and
  email activity into event streams.
- *Map*: Process Mining inside Maestro reconstructs the workflow graph.
- *Propose*: "Maestro Process Apps" surface bottlenecks and re-design suggestions —
  but the human still drives.
- *Approve / Automate*: Agent Builder + Studio compile the redesign into deployable
  agents. "Screenplay" lets a designer describe UI flows in natural language.
- **Gap vs. us**: there is no single "agent watches, agent proposes, owner taps
  approve, agent deploys" SKU — the boundaries are still product seams. We can
  collapse those seams because our tenants are smaller.

**Pega GenAI Blueprint + Agentic Process Fabric, PegaWorld 2025.**
- *Observe / Map*: weaker — Blueprint is design-time, not run-time observation.
- *Propose*: this is where Pega is strongest. "App ideas → interactive Blueprint" is
  exactly the redesign UX we need. The AI agent "automatically creates a structured
  workflow with the necessary steps."
- *Approve / Automate*: Pega's case-management runtime executes the Blueprint
  natively.
- **Gap vs. us**: built for enterprise PM-level designers, not for property-management
  owners. We need a UX that produces the same Blueprint output from a 30-second
  conversation with the owner.

### Tier 2 — partial fit

**Celonis (AgentC + Orchestration Engine GA + Process Copilots, 2025).**
- Best at *observe → map* (the original Celonis use case) and now extends to
  *orchestrate*, but the "propose redesign" and "deploy automation" steps assume a
  downstream UiPath/Power Automate/ServiceNow.
- **Steal**: their "Process Intelligence Graph" + "Context Model" as the data
  representation our sub-agents read from.

**Microsoft Power Automate Process Mining MCP + Copilot Studio (April 2026).**
- The closest available proof-of-concept of *map → propose* via a chat agent. The
  9-tool MCP server exposes:
  `get_processes`, `get_process_details`, `get_attribute_values`,
  `get_bottleneck_analysis`, `get_variants_with_metrics`, `get_edges_with_metrics`,
  `get_cases_with_metrics`, `get_process_overall_metrics`, `get_correlation`.
- The system prompt template in Microsoft's docs is gold — it tells the LLM exactly
  how to map natural-language queries to tool calls.
- **Gap**: no *observe* (assumes ingestion is already done) and no *deploy*
  (Copilot Studio agent answers questions; running automation is a separate Power
  Automate flow you write by hand).

**ServiceNow Now Assist + AI Agent Orchestrator + L1 Service Desk Specialist.**
- The only product willing to call itself an "AI employee" with a defined seat. L1
  Specialist ships Q2 2026; it's narrow (service desk) but it's the right *shape*.
- **Steal**: their "AI Specialist" naming and the L1/L2/L3 graduation rubric.

### What we should clone vs. beat

| Capability | Clone from | Beat by |
|---|---|---|
| MCP tool surface over process mining data | Microsoft Power Automate (9 tools) | Adding `propose_redesign(processId, owner_constraints)` and `deploy_automation(blueprintId)` tools |
| Design-time blueprint UX | Pega GenAI Blueprint | Conversational input from owner instead of business analyst |
| Run-time agent orchestration | UiPath Maestro / Celonis Orchestration Engine | Pin to Temporal (which we already have) instead of a proprietary runtime |
| "AOP" — natural-language SOPs compiled to executable workflows | Decagon AOPs | Generate the AOP from the mined process model, not hand-authored |
| Constellation of models | Sierra (15+ models, per-task routing, cross-provider redundancy) | Map directly onto our existing `central-intelligence/src/kernel/persona` + counter-model setup |
| Headcount-slot framing | ServiceNow L1 Specialist | Property-management vocab: "AI front-desk officer", "AI lease admin" |

---

## (4) Open-source building blocks

| Component | Install | License | Maintenance signal | Notes |
|---|---|---|---|---|
| **pm4py** | `pip install pm4py` (latest 2.7.22.2, Apr 2026) | AGPL-3.0 (commercial via PIS) | 151 GitHub releases; maintained by Fraunhofer/PIS spin-off | Discovery (alpha, IM, IMi, IMd, heuristic, ILP, correlation, prefix-tree, causal nets); conformance (token replay, alignments, footprints, decomposed alignments, log skeleton); streaming via `pm4py.streaming.*`; object-centric via `pm4py.objects.ocel` |
| **bupaR** | `install.packages("bupaR")` (CRAN) | GPL-2 / GPL-3 | Active R community | Built on dplyr idioms; weaker than pm4py for production but excellent for one-off exploration; we could expose bupaR-driven notebooks to platform analysts only, not customers |
| **Apromore Community Edition** | JAR / Docker (github.com/apromore/ApromoreCore) | LGPL-3.0 | Salesforce-backed since acquisition; Star Performer in Everest 2025 | Ships Split Miner, BPMN editor, Process Discoverer, Business Calendar; we can run it as a sidecar service |
| **ProM** | jar from promtools.org | various OSS | Mature but research-flavoured; UI is dated | Reference implementation for almost every published algorithm — keep as a fallback we can shell out to |
| **LangGraph** | `pip install langgraph` / `npm install @langchain/langgraph` | MIT | Active, production-leaning | Graph-based state machine; best for our deterministic-with-conditionals workflows. Our existing `kernel/agency/executor` is essentially a LangGraph-shaped runtime — we don't need to switch but should mirror their state-checkpoint pattern |
| **CrewAI** | `pip install crewai` | MIT | Active | Role-based agent metaphor ("Researcher + Writer + Editor"). Useful framing for our "junior employee" personas — but the runtime is too thin for production |
| **AutoGen (Microsoft)** | `pip install pyautogen` | MIT (Apache 2 in v0.4) | Active; v0.4 was a major rewrite | Conversational, group-chat patterns; weaker output guarantees than LangGraph |
| **Temporal** | `npm install @temporalio/client @temporalio/worker` | MIT | Active; OpenAI Agents SDK public-preview integration (Sept 2025) | Durable execution. Direct fit for our "owner approves → automate" path — checkpoints survive crashes/rate-limits |
| **Inngest** | `npm install inngest` | Apache 2.0 | Active | Step-function-shaped serverless durable execution; `step.ai.infer` is the right primitive for LLM-as-step. Worth considering as a lighter Temporal alternative for tenant-scope workflows |
| **OpenAI Agents SDK + Temporal integration** | OpenAI SDK + temporalio bridge | MIT | Public preview Sept 2025 | If we ever route to an OpenAI model, the durable bridge is free |
| **Microsoft Process Mining MCP server** (not OSS but free in Power Platform) | Power Platform connector | Microsoft EULA | GA preview April 2026 | The 9-tool MCP grammar is the de-facto standard now; even if we don't use the Microsoft server we should expose the same tool names so any MCP-aware agent works against our data |
| **MCP TypeScript SDK** | `npm install @modelcontextprotocol/sdk` | MIT | Anthropic-maintained, active | We already use this pattern in `kernel/tool-spec/hq-tools` |

### Vendor MCP exposure (per the user's question)

- **Microsoft Power Automate Process Mining** ships the 9-tool MCP server above. Yes.
- **UiPath**: Agent Builder coded agents have MCP plug-in support (per Sept 2025
  announcement) — outbound (their agent calls *your* MCP server). No public *inbound*
  MCP server over UiPath data as of May 2026.
- **Celonis**: REST API + GraphQL on Process Intelligence Graph; no published MCP
  server. The Databricks partnership (Nov 2025) suggests they'll go via Databricks
  MCP rather than ship their own.
- **ServiceNow**: Workflow Data Fabric exposes data API; no public MCP server yet.
- **Pega**: no MCP exposure published.

---

## (5) Klarna / Sierra / Decagon / Adept / Cognition — case-study deep-dive

### Klarna — the cautionary tale

**What they did.** Feb 2024 launched a GPT-4-class assistant with OpenAI, wired to
Klarna's account/transaction APIs and grounded in help-centre content. Low-confidence
or complex cases route to humans. 30-day metrics: 2.3M chats handled, equivalent to
700 FTE-of-work, 67% of conversations automated, projected $40M profit improvement.

**What worked.** Throughput, language coverage (35+), resolution time (-82%).

**What failed.** By mid-2025 CEO Sebastian Siemiatkowski told Bloomberg the strategy
had "gone too far" — quality dropped, human service was reinvested in as a "VIP
thing." The famous "700 agents replaced" number was avoided-hires-during-growth, not
actual layoffs.

**What we learn.** Even a textbook GPT-4 + RAG + tool-use stack at a tier-1 fintech
needs a graduated-autonomy ramp and a quality-floor SLO that gates how much of the
funnel goes to AI. **For us this means**: every junior-employee sub-agent must ship
with (a) a confidence threshold below which it hands off, and (b) a tenant-tunable
%-of-cases cap, even when the agent is "qualified." Our `four-eye-approval.ts` and
`continuous-grading.ts` are pointed in the right direction; this Klarna result is the
empirical justification.

### Sierra — the architecture to steal

**Constellation of models.** Sierra runs "15+ frontier, open-weight, and proprietary
models." They decompose each agent task by latency/precision/reasoning/tone
characteristics, route per-step, and provide cross-provider redundancy. The router
"auto-fails over to healthier alternatives if degradation occurs."

**Product velocity.** $100M ARR in 7 quarters; 40% of Fortune 50; "Agent Data
Platform" (Nov 2025) for persistent customer memory; "Ghostwriter" (March 2026)
generates agents from SOPs, call transcripts, and even **photos of whiteboard
sketches**.

**What we learn.** Two patterns map directly onto BOSSNYUMBA:
1. The Ghostwriter ingestion surface (audio + transcripts + photos) is exactly the
   raw material a property-manager owner can give us — we don't need clean process
   docs, we need to ingest WhatsApp screenshots and voice notes.
2. The constellation router is the right shape for our `persona.ts` +
   `counter-model/` layer. We're already partway there; this confirms the
   architectural direction.

### Decagon — AOPs are the missing primitive

**Agent Operating Procedures (AOPs).** Natural-language SOPs that **compile** into
validated workflows. "Verify the order. Process the return. Arrange the
replacement." Each step adapts based on customer + system state. AOPs reference
data, take actions, trigger other workflows. 3–6 week kickoff-to-production.

**Stack.** Azure-hosted multi-model architecture (off-the-shelf + fine-tuned),
deployed across regions for HA. Voice via ElevenLabs partnership (2025). $231M
raised, $1.5B valuation in mid-2025.

**What we learn.** Hand-written SOPs are how property managers actually document
their operations today. We should:
1. Build an **AOP DSL** (sketch in our `kernel/agency/goals/types.ts`) that compiles
   natural-language SOPs to executor steps with explicit guard/fallback nodes.
2. Critically, **generate the AOP from the mined process model**, not hand-author.
   This is the synthesis Decagon hasn't published — and it's the unlock for our
   pipeline.

### Adept — the lesson is "don't"

ACT-1 (Sept 2022) was the first compelling LLM-controls-a-browser demo. Adept raised
~$415M. June 2024 Amazon "acqui-hired" the founders + licensed the tech; investors
were paid out; Adept continues hollowed. Lesson: **browser-control-as-a-product is
brutal as a standalone bet**. The capability is now a feature of Claude (computer
use), GPT (Operator), Gemini. Don't build a generic browser-control product —
embed browser-control as a sub-tool inside vertical pipelines (ours).

### Cognition Labs — Devin and the SWE-Bench gradient

**Devin v1** (Mar 2024) hit 13.86% on SWE-Bench vs. 1.96% prior SOTA. **Devin 2.0**
(April 2025) dropped to $20/mo, ships an agent-native cloud IDE
(editor + terminal + sandboxed browser + planner). SWE-Bench scores by 2026 are
dramatically higher across the field (Claude Opus 4.6 tops Terminal-Bench 2.0).

**What we learn.** Two things:
1. **Cost-curve** — autonomous "junior" prices have collapsed from $500/mo (Devin v1)
   to $20/mo in 12 months. Our pricing model for sub-agent seats should assume
   another 5–10x cost reduction in the next 24 months.
2. **Agent IDE = agent runtime.** Devin's cloud IDE *is* its runtime. Our equivalent
   for property management is a tenant-scoped sandbox that includes: the tenant's
   PMS data, their email/WhatsApp inbox, their bank/M-Pesa API client. That's the
   "workplace" we provision when an owner hires a sub-agent.

---

## (6) The labour-displacement frontier

### Where AI credibly displaces junior labour today

From the Anthropic Economic Index (March 2026 report) and the agent-benchmarks
leaderboard:

- **Customer service**: Tau2-Bench Retail = 91.9% (Claude Opus 4.6); Tau2-Bench
  Telecom = 99.3%. Klarna lived experiment. Decagon production at Fortune 50 scale.
  **Verdict**: junior CS agents are credibly displaced in narrow domains with
  bounded action sets.
- **Sales enablement / lead qualification / cold email**: Anthropic's index calls
  this out as a doubling-in-prevalence workflow.
- **Market-monitoring / templated investment proposals**: same.
- **Coding tasks**: SWE-Bench Verified scores are now well above 60% for top frontier
  models; Terminal-Bench 2.0 led by Claude Opus 4.6. **Verdict**: junior SWE work
  on well-scoped tasks is credibly displaced today.
- **General multi-step web/file work (the GAIA shape)**: 74.6% (Claude Sonnet 4.5).
  Good enough for high-stakes-only-with-review.

### Where AI still fails as a junior

- **Long-horizon desktop work over arbitrary UIs**: WebArena tops out at ~71% even
  for SOTA. Long tail of forms, captchas, weird vendor portals — still brittle.
- **Anything requiring physical presence** (inspections, lock-outs, viewings —
  highly relevant for property management).
- **Edge-case judgement under ambiguity**: Klarna walked back exactly here.
- **Trust at high $-value steps**: the 78% of leaders who "don't always trust"
  agentic AI per the SS&C survey + 69% of projects that never reach prod.

### Benchmark → real-world predictivity for junior process automation

In rough order of how predictive each benchmark is of "this will work in a tenant
business":

1. **Tau2-Bench Retail / Telecom** — closest shape to junior CS / back-office work
   (multi-turn tool use, defined SOP, customer interaction). Most predictive.
2. **BFCL V4 (function calling)** — tool-call accuracy. Necessary but not
   sufficient.
3. **GAIA** — multi-step reasoning over web + files. Good proxy for "junior analyst"
   work.
4. **WebArena** — autonomous browser. Predicts the worst-case desktop-RPA-replacement
   scenarios.
5. **SWE-Bench** — junior SWE work, narrowly.
6. **AgentBench** — broader but noisier.

Important caveat from a UC Berkeley RDI audit: every one of these benchmarks can be
gamed. **We must run our own internal benchmark suite** on real (anonymised) tenant
event logs.

### East Africa / GovTech / SME context

Search returned no published RPA case studies for property management in TZ/KE.
General African fintech RPA adoption is real but bank-centric (account opening,
KYC, loan processing in SA / NG / EG banks). Property-management SaaS in EA is
greenfield for agentic AI — we are early.

Implication: we will not be able to point to a peer case study to a TZ landlord;
we have to ship a believable Klarna-scale anchor reference inside our own customer
base in the first 12 months.

---

## (7) BOSSNYUMBA gap map

For each frontier finding: **have / missing / integrate**.

### Process mining

- **Frontier**: Split Miner + IMi + streaming TBR cover ~90% of needs; OCPM is the
  forward direction; MCP-over-process-mining is the integration shape.
- **Have**: nothing yet — there's no `kernel/process-mining/` module.
- **Missing**: a process-mining layer that ingests our existing event ledger
  (`sovereign-action-ledger.schema.ts`) and produces (a) a discovered process model
  per tenant, per workflow type, (b) a streaming conformance signal that feeds
  `kernel/drift-detector.ts`, (c) an MCP-shaped tool surface so our sub-agents can
  query "what does this tenant's lease-onboarding actually look like?".
- **Integrate**: Wrap pm4py behind a Python sidecar service called from
  `packages/central-intelligence` via an internal contract. Mirror the Microsoft
  9-tool MCP grammar (`get_processes`, `get_bottleneck_analysis`, etc.) on our own
  internal MCP server. Optionally shell out to Apromore CE for BPMN export.

### Sub-agent runtime

- **Frontier**: durable execution (Temporal / Inngest) + per-task model routing
  (Sierra) + AOP-shaped natural-language workflows (Decagon).
- **Have**: `kernel/agency/executor`, `goal-tracker`, `four-eye-approval`,
  `policy-gate`, `awareness-scopes`, `counter-model` — the right *bones* are in place.
- **Missing**: (a) the constellation router is implicit in `persona.ts` but not
  formalised; (b) no AOP DSL — `goals/types.ts` is goal-shaped, not procedure-shaped;
  (c) no durable-execution substrate visible (worth checking Temporal or Inngest
  presence in `services/` before deciding).
- **Integrate**: Pin the agency executor on top of a durable runtime (Temporal first
  choice given OpenAI Agents SDK integration). Introduce an `aop` module that
  compiles natural-language SOPs → executor goal graphs with explicit guard +
  fallback edges.

### Observe → map → propose → automate pipeline

- **Frontier**: nobody has shipped the full single-product loop for SMB; UiPath +
  Pega + Celonis each cover ~60% of it. Sierra Ghostwriter is the closest analogue
  for fast onboarding (photos, transcripts → working agent).
- **Have**: `kernel/agency` is the right home for the *propose* and *automate* legs;
  `tool-spec/hq-tools` is the integration surface; `sovereign-action-ledger` is the
  *observe* substrate.
- **Missing**: the *map* leg entirely (no process mining), and the *propose* UX
  (no owner-facing redesign-review screen).
- **Integrate**: Build the pipeline as 5 explicit stages, each an MCP-tool surface so
  any sub-agent can drive any stage:
  1. `observe.*` — read from sovereign-action-ledger
  2. `mine.*` — pm4py-driven discovery + conformance (clone Microsoft's tool names)
  3. `propose.*` — generate redesign options + projected impact
  4. `approve.*` — owner-facing UI + `four-eye-approval` ledger
  5. `automate.*` — emit executor goal graphs + durable workflow definitions

### Constellation / counter-model

- **Frontier**: Sierra-style multi-model routing with cross-provider redundancy.
- **Have**: `counter-model/` directory exists; `persona/`, `critics/`, `debate/`
  suggest the right pattern is implicit.
- **Missing**: an explicit router with health monitoring + fallback per model.
- **Integrate**: formalise the model registry (per-task → model preference list with
  health probes), and route through it from the executor.

### Trust / governance / Klarna-failure-mode prevention

- **Frontier**: graduated autonomy + quality SLO + tenant-tunable %-cap.
- **Have**: `four-eye-approval`, `policy-gate`, `awareness-scopes`,
  `continuous-grading`, `killswitch`, `inviolable.ts` — strong governance bones.
- **Missing**: a per-tenant **autonomy-cap** (Klarna's missing feature) and a
  per-sub-agent **quality SLO** that triggers automatic rollback when grade drops.
- **Integrate**: extend `continuous-grading` to emit per-agent SLO breach events
  that the policy gate reads.

### Object-centric data

- **Frontier**: OCEL 2.0; van der Aalst calls it the enabler for generative /
  predictive / prescriptive AI in BPM.
- **Have**: a relational schema in `packages/database/src/schemas/` — case-centric
  by default.
- **Missing**: an object-centric event log schema that recognises that
  tenant ↔ unit ↔ lease ↔ payment ↔ work-order all participate in one event.
- **Integrate**: before locking in the event schema for v1, prototype an OCEL 2.0
  emitter alongside `sovereign-action-ledger`. Cost is low now and unbearable in 18
  months.

### Property-management-specific

- **Frontier**: EliseAI (multifamily, USA), Brickwise (YC 2025), Kolena (document
  workflows). All English-first, US-centric, no MCP / no embedded process mining.
- **Have**: vertical focus on EA / multi-tenant SaaS; sovereign-action-ledger
  positions us correctly.
- **Missing**: vertical-specific process templates (lease onboarding, maintenance
  routing, rent collection, eviction workflow, KRA filing) to seed the
  discovery-without-data case.
- **Integrate**: ship N preset workflow templates so a brand-new tenant gets a
  reasonable model from day one and the process miner refines it as events
  accumulate.

---

## (8) References

### Process mining algorithms (Section 1)

- [Event Logs and Process Models for Evaluating Discovery Algorithm Robustness under Noise — IEEE DataPort](https://ieee-dataport.org/documents/event-logs-and-process-models-evaluating-discovery-algorithm-robustness-under-noise)
- [Automated Discovery of Process Models from Event Logs: Review and Benchmark — arXiv 1705.02288](https://arxiv.org/pdf/1705.02288)
- [Advances in Process Optimization (survey) — arXiv 2301.10398](https://arxiv.org/html/2301.10398v2)
- [Reliable Process Tracking Under Incomplete Event Logs Using Timed Genetic-Inductive Process Mining — MDPI Systems 2025](https://www.mdpi.com/2079-8954/13/4/229)
- [AVOCADO: The Streaming Process Mining Challenge — arXiv 2510.17089](https://arxiv.org/html/2510.17089v2)
- [An Approximate Inductive Miner — van Detten, ICPM 2023](https://www.leemans.ch/publications/papers/icpm2023vandetten.pdf)
- [Split Miner: Discovering Accurate and Simple Business Process Models — ICDM 2017](https://kodu.ut.ee/~dumas/pubs/icdm2017-split-miner.pdf)
- [Object-Centric Process Mining: Unraveling the Fabric of Real Processes (van der Aalst) — MDPI Mathematics 2023](https://www.mdpi.com/2227-7390/11/12/2691)
- [No AI Without PI — Object-Centric Process Mining as the Enabler for Generative AI (van der Aalst)](https://www.researchgate.net/publication/394741383_No_AI_Without_PI_Object-Centric_Process_Mining_as_the_Enabler_for_Generative_Predictive_and_Prescriptive_Artificial_Intelligence)

### Open-source libs (Section 4)

- [PM4Py PyPI page](https://pypi.org/project/pm4py/)
- [PM4Py GitHub](https://github.com/process-intelligence-solutions/pm4py)
- [PM4Py streaming process mining docs](https://processintelligence.solutions/pm4py/examples/streaming-process-mining)
- [PM4Py API reference 2.7.16](https://processintelligence.solutions/static/api/2.7.16/api.html)
- [PM4Py implemented approaches](https://pm4py.fit.fraunhofer.de/implemented-approaches)
- [bupaR on bupaverse.github.io](https://bupaverse.github.io/bupaR/)
- [bupaR: Business Process Analysis in R — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0950705118305045)
- [Apromore Core GitHub](https://github.com/apromore/ApromoreCore)
- [Apromore BPMN docs](https://apromore.net/documentation/features/bpmn-miner/)

### Vendors (Sections 2–3)

- [UiPath FUSION 2025 product announcements](https://www.uipath.com/newsroom/uipath-accelerates-ai-transformation-with-agentic-automation-and-orchestration)
- [UiPath governance & security 2025.10 blog](https://www.uipath.com/blog/product-and-updates/agentic-enterprise-governance-and-security-2025-10-release)
- [UiPath Autopilot release notes 2025](https://docs.uipath.com/autopilot/automation-cloud/latest/release-notes/release-notes-2025)
- [Celonis platform overview](https://www.celonis.com/platform)
- [Celonis Celosphere 2025 platform innovations (Process Excellence Network)](https://www.processexcellencenetwork.com/process-mining/news/celonis-announces-new-platform-innovations-to-power-ai-driven-composable-enterprises)
- [SiliconANGLE: Celonis feeds AI agents with process intelligence data (Nov 2025)](https://siliconangle.com/2025/11/04/celonis-feeds-ai-agents-process-intelligence-data-enhance-operational-context/)
- [Microsoft Power Automate Process Mining MCP — create a Copilot Studio agent (April 2026)](https://learn.microsoft.com/en-us/power-automate/process-mining-mcp-create-cps-agent)
- [Microsoft Copilot in Process Mining process analytics docs](https://learn.microsoft.com/en-us/power-automate/process-mining-copilot-in-process-analytics)
- [Power Automate 2026 release wave 1](https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/power-automate/)
- [Pega GenAI Blueprint product page](https://www.pega.com/blueprint)
- [PegaWorld 2025 announcements (Futurum)](https://futurumgroup.com/insights/pegasystems-ai-announcements-at-pegaworld-2025/)
- [ServiceNow AI Agents product page](https://www.servicenow.com/products/ai-agents.html)
- [ServiceNow autonomous workforce governance (TechTarget)](https://www.techtarget.com/searchitoperations/news/366639250/ServiceNow-touts-AI-governance-for-its-Autonomous-Workforce)
- [Skan AI top 10 task mining tools 2025](https://www.skan.ai/the-10-best-task-mining-tools-in-2025)
- [Mimica product page](https://www.mimica.ai/product)

### Frameworks / runtime (Section 4)

- [LangGraph vs CrewAI vs AutoGen — DataCamp](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
- [Temporal AI page](https://temporal.io/solutions/ai)
- [Temporal blog: durable execution meets AI](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai)
- [Temporal + OpenAI Agents SDK preview (InfoQ Sept 2025)](https://www.infoq.com/news/2025/09/temporal-aiagent/)
- [Inngest blog: durable execution for AI agents](https://www.inngest.com/blog/durable-execution-key-to-harnessing-ai-agents)

### Case studies (Section 5)

- [Klarna: Klarna AI assistant handles two-thirds of customer service in first month](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/)
- [The Pragmatic Engineer: Klarna's AI chatbot — how revolutionary is it, really?](https://blog.pragmaticengineer.com/klarnas-ai-chatbot/)
- [Klarna AI: 67% of Customer Support Automated (Twig)](https://www.twig.so/blog/klarna-ai-customer-support-efficiency)
- [Sierra: Constellation of models](https://sierra.ai/blog/constellation-of-models)
- [Sierra: Agents as a service](https://sierra.ai/blog/agents-as-a-service)
- [Sierra product overview](https://sierra.ai/product)
- [Decagon AOPs product page](https://decagon.ai/product/aop)
- [Decagon: From manual SOPs to Agent Operating Procedures](https://decagon.ai/blog/from-sops-to-agent-operating-procedures)
- [Decagon Microsoft Startups customer story (production AI agent system)](https://www.zenml.io/llmops-database/building-a-production-ai-agent-system-for-customer-support)
- [Cognition: Introducing Devin](https://cognition.ai/blog/introducing-devin)
- [Cognition SWE-Bench technical report](https://cognition.ai/blog/swe-bench-technical-report)
- [Cognition SWE-Bench results GitHub](https://github.com/CognitionAI/devin-swebench-results)
- [TechCrunch: Amazon hires Adept founders + licenses tech (June 2024)](https://techcrunch.com/2024/06/28/amazon-hires-founders-away-from-ai-startup-adept/)
- [GeekWire: Amazon hires Adept founders to boost AGI team](https://www.geekwire.com/2024/amazon-hires-founders-from-well-funded-enterprise-ai-startup-adept-to-boost-tech-giants-agi-team/)

### Benchmarks & frontier (Section 6)

- [Anthropic Economic Index — March 2026 Learning Curves report](https://www.anthropic.com/research/economic-index-march-2026-report)
- [Anthropic Claude Opus 4.6 announcement](https://www.anthropic.com/news/claude-opus-4-6)
- [Anthropic 2026 Agentic Coding Trends Report (PDF)](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
- [Awesome Agents leaderboard — GAIA / WebArena / BFCL / Tau2](https://awesomeagents.ai/leaderboards/agentic-ai-benchmarks-leaderboard/)
- [Berkeley RDI: How we broke top AI agent benchmarks](https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/)
- [SS&C Blue Prism: Agentic AI survey 2025](https://www.blueprism.com/resources/blog/ai-agentic-agents-survey-statistics/)
- [Agentic Business Process Management — arXiv 2504.03693](https://arxiv.org/pdf/2504.03693)
- [Agentic Business Process Management Systems — arXiv 2601.18833](https://arxiv.org/abs/2601.18833)

### Property management + emerging markets (Sections 5/6)

- [How AI Took Over Property Management in 2025](https://www.thepropertymanager.ai/p/how-ai-took-over-property-management-in-2025)
- [EliseAI homepage](https://eliseai.com/)
- [Brickwise — Y Combinator](https://www.ycombinator.com/companies/brickwise)
- [Kolena: AI for property management](https://www.kolena.com/blog/ai-for-property-management/)
- [Ntansa: Influence of fintech and need for intelligent automation in African banks](https://www.ntansa.com/the-influence-of-fintech-and-the-need-for-intelligent-automation-rpa-in-african-banks/)
- [McKinsey: Fintech in Africa — the end of the beginning](https://www.mckinsey.com/industries/financial-services/our-insights/fintech-in-africa-the-end-of-the-beginning)
