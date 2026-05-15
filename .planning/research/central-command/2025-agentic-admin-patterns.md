# 2025-2026 Agentic Admin Patterns — Source Notes

Compiled 2026-05-15 for BOSSNYUMBA Central Command research. Primary sources captured below so downstream agents can read raw material directly.

---

## Pattern A — Multi-step Autonomous Agents

### Devin / Cognition AI
- 2025 Annual Performance Review: https://cognition.ai/blog/devin-annual-performance-review-2025
- Devin 2.0 release April 2025 dropped price from $500/mo to $20/mo Core plan; introduced parallel multi-agent fan-out and "interactive planning" (confidence-based clarification before execution).
- Architecture = compound system: a high-reasoning **Planner** model + execution agent + sandboxed compute (shell, code editor, browser) + reviewer.
- Loop: **decompose goal → search & read docs → edit code → run cmds/tests → analyse failures → iterate** until stopping condition.
- Stated HIL points: code review (humans must approve PRs); unit-test playbooks must be human-authored; ambiguous outcomes require human review.
- Documented failure modes (2025):
  - **Context hallucination** — Devin references files that don't exist (Register/Futurism 2025 reviews).
  - **Hallucinated platform features** — spent a full day trying to deploy multi-app to Railway, inventing features that didn't exist.
  - **3/20 tasks completed satisfactorily** in independent 2025 review (Futurism).
  - Best with **clear, frozen requirements** — performance degrades sharply when humans append requirements after execution starts.
- Cautionary tale write-up: https://medium.com/tech-waves/devin-a-cautionary-tale-of-the-autonomous-ai-engineer-e1339ede8f8a
- Hacker News retrospective: https://news.ycombinator.com/item?id=41607251

### Cursor 2.0 / Composer
- Launch post 29 Oct 2025: https://cursor.com/blog/2-0
- InfoQ deep-dive: https://www.infoq.com/news/2025/11/cursor-composer-multiagent/
- Composer is a frontier MoE+RL model trained from scratch for **low-latency multi-step coding** (most turns <30s, ~4x faster than peers).
- **Agent-as-object UI**: agents are first-class sidebar entities with inputs, logs, outputs, status; runnable as parallel "plans".
- **Up-to-8 parallel agents** using **git worktree isolation** (or remote sandboxes) to avoid file conflicts.
- Built-in **native browser tool** so the agent can test its own changes and iterate to a working result.
- HIL: human reviews diffs; agent surfaces "what changed" digest per agent before merge.

### GitHub Copilot Workspace → Copilot Coding Agent
- GitHub Next page: https://githubnext.com/projects/copilot-workspace/
- Sunset 30 May 2025; functionality migrated to **Copilot Coding Agent** (GA Sep 2025) — async issue→PR worker.
- Planning-first 3-phase loop: **Spec → Plan → Implementation**; every step editable by human.
- Key idea: **the plan is the artefact** — humans review the plan (files, functions, steps) before code is generated.
- Async execution model: sub-agent architecture, runs in background sandbox, opens PR when done.

### Replit Agent / Agent 3
- Product: https://replit.com/products/agent
- Docs: https://docs.replit.com/core-concepts/agent
- Agent 3 (2025): **self-tests in a real browser**, up to 200 minutes of autonomous work, can author scheduled-automation agents.
- Loop: describe app → agent proposes plan & stack → user confirms → agent generates files, installs deps, runs preview, iterates on failures.
- Dec 2025: ChatGPT-integrated build flow; "Fast mode" for quick iterations.

### Anthropic Claude Agent SDK
- Engineering blog: https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- Docs: https://code.claude.com/docs/en/agent-sdk/overview
- NPM package: `@anthropic-ai/claude-agent-sdk`
- Renamed from "Claude Code SDK" → "Claude Agent SDK" in late 2025 to reflect general-purpose agent use.
- **Core loop**: `gather context → take action → verify work → repeat`.
- Tool abstraction: tools are "prominent in Claude's context window" — design them as the primary verbs (`fetchInbox`, `searchEmails`, not `runQuery`).
- Context strategies: **agentic search** (bash `grep`/`tail`), **semantic search**, **/compact** auto-summarisation.
- **Subagents** = isolated context windows for parallel work, return only relevant summaries — prevents context bloat.
- **Hooks** = lifecycle interceptors (pre-tool, post-tool, on-stop) — used for validation, audit, formatting.
- **Skills** system (2025 addition) = reusable capability packs.
- Verification: rules-based linters, screenshot diff, LLM-as-judge.

### OpenAI Operator / ChatGPT Agent / CUA
- Intro: https://openai.com/index/introducing-operator/
- CUA paper: https://openai.com/index/computer-using-agent/
- Operator launched Jan 2025; merged into **ChatGPT Agent** July 2025; standalone site sunset.
- **CUA model**: GPT-4o vision + RL-trained reasoning, controls **screen + mouse + keyboard** (no APIs).
- Loop: **Perception (screenshot) → Reasoning (CoT) → Action (click/type/scroll)** repeated.
- Known failure modes: wrong-click cascades, overconfident interactions with unfamiliar UI, infinite click loops; OpenAI added "take over" buttons + confirmation on payments/auth as mitigations.

### Anthropic Computer Use
- Tool docs: https://docs.claude.com/en/docs/agents-and-tools/tool-use/computer-use-tool
- Beta header: `computer-use-2025-11-24` for Opus 4.7/4.6, Sonnet 4.6, Opus 4.5; older `computer-use-2025-01-24` for Sonnet 4.5, Haiku 4.5.
- Pixel-level GUI control via screenshots + coordinate-based click/type.
- Same vision-driven failure modes as Operator; recommended only for tasks where APIs aren't available.

### Bolt.new / v0.dev / Lovable
- StackBlitz **Bolt.new**: full Node.js in-browser via WebContainer; generates backend, schema, API routes from a prompt.
- **v0** (Vercel): UI-only — React + Tailwind + shadcn/ui components from NL or Figma; no backend.
- **Lovable**: full-stack with built-in Supabase, GitHub export, one-click deploy; hit $20M ARR in 2 months.
- Comparison: https://www.digitalapplied.com/blog/v0-lovable-bolt-ai-app-builder-comparison

### Lindy
- https://www.lindy.ai/blog/no-code-ai-agent-builder
- No-code visual workflow builder for non-engineers; 7,000+ integrations via Pipedream partnership; SOC 2 + HIPAA.
- Multi-agent collaboration (research agent → writing agent → CRM agent).
- Lesson: power users want **plain-English constraints** ("never email after 8pm", "always CC accounting on invoices >$5k").

---

## Pattern B — Conversational CRUD Over Enterprise Schemas

### Salesforce Agentforce (was Einstein Copilot)
- https://www.salesforce.com/agentforce/einstein-copilot/
- Einstein Copilot retired Jan 2025; rebranded as **Agentforce** with assistants as just one agent type.
- Built on **Einstein 1 metadata-driven platform** — every action is metadata, so the LLM only sees configured, typed actions.
- Critical safety design: **"Copilot's architecture is designed to prevent hallucinations by default, only operating within the boundaries of configured actions, so it can't invent data sources or unsupported capabilities."**
- Action library = pre-programmed typed verbs (update account, schedule meeting, fetch shipping update). Users chat in NL, action is dispatched against schema.

### Microsoft Copilot for Dynamics 365 / Copilot Studio
- 2025 release wave 2: https://learn.microsoft.com/en-us/dynamics365/release-plan/2025wave2/
- Native **MCP support across Copilot Studio + Dataverse MCP + Dynamics 365 ERP MCP server** (2025).
- Plugin manifest schema 2.4: MCP server support, file references, confirmation handling primitives.
- Pattern: schema-aware NL prompts → typed plugin/action invocation → governance gates → execution.

### HubSpot ChatSpot / Glean
- Glean architecture blog: https://www.glean.com/blog/emerging-agent-stack-2026
- Glean's stack: **permissions-aware retrieval layer** (the agent only ever sees data the asker is authorised to see) → MCP-bridged tools → 30+ pre-built agents.
- Key principle: **identity-scoped retrieval is the safety boundary**, not the agent prompt.

### NL→Typed-Action Pattern (consolidated)
- AWS pattern: https://aws.amazon.com/blogs/machine-learning/enterprise-grade-natural-language-to-sql-generation-using-llms-balancing-accuracy-latency-and-scale/
- BridgeScope paper: https://www.vldb.org/cidrdb/papers/2026/p4-weng.pdf
- Production NL→action systems use:
  1. Schema-aware prompt enrichment with **user permissions/role** baked in.
  2. **Allowlist of safe operations** (SELECT/JOIN) vs blocklist of destructive (DROP, DELETE without WHERE).
  3. **Query Validation Service** as gate between model and DB.
  4. **Query Capsule** templates with typed placeholders (improves execution accuracy 4–6% over freeform).
  5. Per-role tool exposure (read-only users only see read tools).

---

## Pattern C — Real-time UI Awareness ("brain's skin")

### Stagewise
- https://stagewise.io/ + https://docs.stagewise.io
- Electron-based developer-browser; AI agent has access to live DOM, console, debugger, current tab state.
- "Select an element, instruct the agent" — the **DOM selection is the prompt context**.
- Cache-hit-rate optimised, dynamic context control for long-running tasks.

### Browser-Use / MultiOn
- DOM-aware (Chromium AXTree) rather than vision-based. **5,000 vision tokens → ~500 AXTree tokens** (10x efficiency).
- Browser-Use scored 89% on WebVoyager (Agent-E only 73%).
- Tradeoff: DOM gives you runtime ground truth (hidden states, dynamic content); vision gives you universal interface but is wasteful.

### Anthropic Computer Use & OpenAI CUA
- Universal but expensive: screenshot → coordinates → click. Use only when no API/DOM exists.

### Vercel AI SDK Generative UI
- https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- AI SDK 6 introduced **Agent abstraction**; AI SDK 5+ uses **typed `tool-${toolName}` message parts**.
- Tool execution maps to React component: `case 'tool-displayWeather': return <Weather {...part.output}/>`.
- Streaming: server `streamText` with tools → `toUIMessageStreamResponse()` → client `useChat` hook.
- **AI SDK RSC paused** — prefer `useChat` + typed tool parts over RSC for new builds (per docs).
- React Server Components version: https://vercel.com/blog/ai-sdk-3-generative-ui

### Awareness inputs (state of the art, mid-2025)
- Cursor movement + element highlights shown as agent works (FillApp model).
- Tab/page/URL awareness via browser extension or in-app event bus.
- Focus share, switching rates, rolling engagement tracked as PM metrics.
- For SaaS: **broadcast current page, selected entities, last query, modal state** into the agent context as a "presence packet" each turn.

---

## HIL + Safety Primitives (2025-2026)

### Frameworks
- LangGraph `interrupt()` — pause graph execution, await human input, resume cleanly. https://www.langchain.com/langgraph
- Microsoft Agent Framework HITL: https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop
- Cloudflare Agents HIL doc: https://developers.cloudflare.com/agents/concepts/human-in-the-loop/
- Permit.io MCP server: turns approval into a tool LLM can call but only execute after human gate.

### Pattern primitives
- **Risk-tiered tool registry** — every tool tagged (read / mutate / destroy / billing / external-comm). Auto-approve reads; require approval for mutates+; require 2FA-judgment for destroys+.
- **Pre-execution approval** — "Approvals must happen before side effects, not after."
- **Challenge-and-response approvals** — checklist (intent, data lineage, permissions chain, blast radius, rollback plan) — approver must positively acknowledge each item, not just click yes.
- **Counter-model sanity check** — second LLM reviews high-risk tool calls before they run.

### Audit, dry-run, undo
- MCP gateway as a centralised logging/policy layer — every tool call recorded, tamper-resistant. https://bytebridge.medium.com/implementing-audit-logging-and-retention-in-mcp-cc4d28ee7c50
- Langfuse audit logs: https://langfuse.com/docs/administration/audit-logs
- Sweep AI Agent Audit Trail: metadata-layer change log; every action **explainable, traceable, reversible**. https://www.sweep.io/blog/the-audit-trail-of-an-ai-agent
- Oracle Runtime Governance: Behavior layer (policy enforcement) + Evidence layer (Structured Decision Records, provenance hashes, tamper-resistant audit). https://blogs.oracle.com/ai-and-datascience/runtime-governance-enterprise-agentic-ai
- Scalekit on B2B SaaS agent auth audit: https://www.scalekit.com/blog/audit-trail-agent-auth

### RBAC + Authorization
- Permission-aware retrieval (Glean) — agent only sees data the human asker can see.
- Per-role tool exposure — read-only role only sees read tools (BridgeScope).
- Auth0 access control for AI agents: https://auth0.com/blog/access-control-in-the-era-of-ai-agents/
- Oso RBAC patterns: https://www.osohq.com/learn/best-practices-of-authorizing-ai-agents
- **EU AI Act Article 14** + NIST AI RMF require demonstrable, trained, measurable, provable human oversight.

---

## Observability

- OpenTelemetry GenAI Semantic Conventions SIG: https://opentelemetry.io/blog/2025/ai-agent-observability/
- Major vendors emitting OTel-compliant spans: LangChain, CrewAI, AutoGen, AG2.
- Standard attributes: provider, model name, operation, token counts, error info, tool name, tool latency.
- Pattern: **evals stored next to traces** so dashboards/alerts can use them — evals are part of observability, not a separate offline step.
- Recommended stack (2025): OTel transport + Phoenix/Langfuse/Braintrust trace UI + LLM-as-judge eval pipeline.

---

## Model Context Protocol (MCP) 2025-11-25 spec
- Spec: https://modelcontextprotocol.io/specification/2025-11-25
- WorkOS write-up: https://workos.com/blog/mcp-2025-11-25-spec-update
- **Tasks primitive (experimental)** — any request can return a task handle, status states `working/input_required/completed/failed/cancelled`. Enables async, long-running, governed workflows.
- **Sampling with Tools (SEP-1577)** — servers can initiate sampling that includes tool definitions, enabling server-side agent loops.
- **URL Mode Elicitation (SEP-1036)** — server sends a URL, user completes sensitive flow in a browser (OAuth, payments, API keys).
- OAuth improvements throughout.
- Adoption: OpenAI (Mar 2025), Azure AI Agent Service (May 2025), 97M monthly SDK downloads by Apr 2026.
- Core principles enforced at spec level: explicit user consent for tool calls, sampling, data sharing; tool descriptions untrusted unless from trusted server.

---

## Multi-tenant SaaS / Property Management Context

- AWS prescriptive guidance — agentic AI multi-tenant: https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/agentic-ai-multitenant/agentic-ai-multitenant.pdf
- CallSphere AI agent SaaS architecture: https://callsphere.ai/blog/ai-agent-saas-architecture-multi-tenant-platform-design
- Core tension: **isolation vs efficiency** — tenants want dedicated-feeling agents with private data + custom behaviour, but shared infra controls cost.
- Property management cited as "one of the highest-ROI verticals for agentic AI" (after-hours emergencies, rent reminders, maintenance triage).
- IBM watsonx Orchestrate + MCP for multi-tenant SaaS: https://community.ibm.com/community/user/blogs/himanshu-gupta/2025/11/01/building-multi-tenant-saas-applications-ai-agent-w

---

## Key Anti-Patterns Observed

1. **Devin-style "frozen plan"** — once execution starts, mid-flight requirement changes degrade outcomes.
2. **Hallucinated tool/feature invention** — agent claims a capability that doesn't exist (Devin/Railway).
3. **Vision-only on structured UIs** — wasteful and error-prone vs DOM/AXTree (Operator wrong-clicks).
4. **Approving after side effects** — approvals must gate *before* execution, not retroactively.
5. **Unscoped retrieval** — agent sees data the asker shouldn't access; identity-scoped retrieval is mandatory.
6. **Freeform SQL/action generation** — typed action library + allowlist + validation gate beats freeform every time.
7. **Single context window for long tasks** — leads to context bloat & drift; subagents with isolated windows fix this.
8. **No audit trail** — without per-action traceability you cannot trust, debug, or roll back.
9. **Yes/No approvals without challenge** — automation bias makes humans rubber-stamp; require explicit checklist ack.
10. **Async work without status surfacing** — users lose trust; MCP Tasks primitive exists for this reason.

---

## File created
`.planning/research/central-command/2025-agentic-admin-patterns.md`
