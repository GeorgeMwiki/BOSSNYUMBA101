# Agentic LLM Frameworks — Frontier Survey (2026-05-18)

> Read-only research compiled for BOSSNYUMBA101 Phase E. Anchored to ~35 primary/secondary sources accessed on 2026-05-18.
> Context: BOSSNYUMBA is a multi-tenant property-management SaaS architected around a "Managing Director" + specialized sub-MD agents (Arrears, Compliance, Retention, Maintenance, Cashflow, Dispute), each following a 4-stage OBSERVE → MAP → REDESIGN → AUTOMATE pipeline. We're Claude-primary, with significant existing kernel work (`packages/central-intelligence/src/kernel/*`).

---

## TL;DR

**Five actionable findings:**

1. **Stop building agent abstractions; start composing Anthropic primitives.** The Anthropic stack of 2026 (Agent SDK + Skills + Hooks + Memory tool + Managed Agents + MCP + Prompt caching) collectively *is* a battle-tested agent runtime. The Agent SDK's `query()` loop, 12+ hook types, Skills via `SKILL.md` frontmatter, and the `/memories` file-based memory primitive map 1:1 onto the patterns we'd otherwise need LangGraph for. Our `packages/central-intelligence/src/kernel/*` should re-bind to these primitives rather than reinvent. (Cite: Agent SDK docs, Hooks reference, Memory tool spec.)
2. **Adopt the Anthropic "five workflow patterns" verbatim as our sub-MD architecture catalog.** Prompt chaining, routing, parallelization (sectioning + voting), orchestrator-workers, and evaluator-optimizer give us a complete vocabulary for the 4-stage MD pipeline. OBSERVE = parallelization (sectioning), MAP = orchestrator-workers, REDESIGN = evaluator-optimizer, AUTOMATE = prompt-chained workflow with HITL gates. Don't invent a sixth pattern.
3. **Prompt caching + Batch API are the cost story; everything else is noise.** Cache write 1.25×, cache read 0.1×, up to 4 breakpoints per request, 5-min/1-hr TTLs. Batch API gives 50% off with ≤24h latency. For sub-MD weekly rollups, this is a 90%+ cost reduction with one config change. Workspace isolation (Feb 5, 2026) means we must structure tenant boundaries to maximize cache reuse without leakage.
4. **Skip LangGraph, CrewAI, AutoGen as runtimes; steal their patterns.** LangGraph's state-machine model is genuinely good for durable workflows but conflicts with the Agent SDK's session/resume model. CrewAI is too opinionated for our multi-tenant constraints. AutoGen is in maintenance mode. Adopt DSPy only at the prompt-evolution layer (we already do — `kernel/prompt-evolution/`).
5. **Memory: file-based for working memory, Postgres+pgvector for long-term, graph only when entity-relationship reasoning is the bottleneck.** Anthropic's `/memories` directory primitive is correct for *agent working notes* (interruption-resilient progress logs). For tenant-scoped institutional knowledge (arrears history, dispute precedents), pgvector on existing Postgres beats adding Pinecone/Weaviate. Graph DBs (Neo4j) only earn their keep when sub-MDs need multi-hop reasoning across entities (e.g., "which contractors did dispute X reference that also appear in arrears Y for tenant Z").

**Three contrarian takes:**

- **Sub-agent fan-out costs more than it improves quality below 3 agents.** The 2026 Microsoft research on multi-agent debate confirms that adversarial verification works, but evidence below 3 agents is statistically indistinguishable from a single agent with self-reflection. Our existing `kernel/debate/` and `kernel/critics/` modules should bound parallel critics at 2-3, not 5-7.
- **The Memory tool is more powerful than RAG for our use case.** Anthropic's pattern — agent writes XML/Markdown notes to a structured directory, reads on next session — outperforms vector RAG for tenant-scoped workflows where the agent itself decides what to record. Skip vector retrieval inside individual MD sessions; use it across the platform for federated search.
- **GPT-5.4 / o3 / Gemini 3 are dispensable for us.** SWE-bench Verified now leads with Claude variants (Mythos Preview 93.9%, Opus 4.7 87.6%); tau2-bench retail at 91.9% (Opus 4.6) — the customer-service benchmark closest to our domain — is Anthropic-dominated. The only realistic OpenAI use case is GPT-5.4 Realtime for voice, and even there Claude Voice Mode is closing fast. Stop maintaining multi-provider routing layers as a hedge; commit to Claude with thin GPT-Realtime adapter for voice only.

---

## (1) Anthropic ecosystem deep dive

### 1.1 Claude Agent SDK (renamed from Claude Code SDK in late 2025)

**Packages:** `claude-agent-sdk` (Python) and `@anthropic-ai/claude-agent-sdk` (TypeScript). The TypeScript SDK bundles a native Claude Code binary as an optional dependency.

**Core primitive — `query()`:** An async iterator returning a streaming message sequence. The async loop runs as Claude thinks, calls tools, observes results, and decides what to do next. Each iteration yields a message: reasoning, tool call, tool result, or final outcome. ([source](https://code.claude.com/docs/en/agent-sdk/overview))

```python
async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
):
    print(message)
```

**Differs from Anthropic Client SDK how?** Client SDK = direct API access; you implement the tool loop yourself. Agent SDK = Claude handles tools autonomously, with built-in tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, Monitor) and session/permission/hook management out of the box.

**Built-in tools (relevant to sub-MD pipelines):**
- `Read`, `Write`, `Edit` — filesystem access
- `Bash` — terminal + git operations
- `Glob` / `Grep` — file pattern + content search
- `WebSearch`, `WebFetch` — web access
- `AskUserQuestion` — clarifying multiple-choice questions to operator
- `Monitor` — watch a background script and react to each output line as an event (critical for long-running sub-MD jobs)

**Subagent spawning** (relevant to MD → sub-MD architecture):
```python
options=ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep", "Agent"],
    agents={
        "arrears-md": AgentDefinition(
            description="Sub-MD for tenant arrears recovery.",
            prompt="...specialized arrears prompt...",
            tools=["Read", "Glob", "Grep"],
        )
    },
)
```
Sub-agents are invoked via the `Agent` tool; their messages include a `parent_tool_use_id` for tracking. Tool inheritance: by default sub-agents inherit all tools from parent; restrict with `tools` allowlist or `disallowedTools` denylist. ([source](https://code.claude.com/docs/en/sub-agents))

**Agent SDK Credit (June 15, 2026):** Subscription plans get a separate monthly Agent SDK credit, distinct from interactive usage limits. Plan budgeting accordingly.

**Authentication providers:** Anthropic API (default), Amazon Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), Claude Platform on AWS (`CLAUDE_CODE_USE_ANTHROPIC_AWS=1`), Vertex AI (`CLAUDE_CODE_USE_VERTEX=1`), Microsoft Azure Foundry (`CLAUDE_CODE_USE_FOUNDRY=1`). Important: Anthropic forbids third-party developers from offering claude.ai login or shared rate limits for their products. Use API key auth.

### 1.2 Claude Code internals — hooks, skills, subagents, MCP, slash commands

**Hook lifecycle (26 events as of v2.1.116, April 2026):**

| Phase | Events |
|---|---|
| Setup | `Setup` (one-time init), `SessionStart`, `SessionEnd` |
| Prompt | `UserPromptSubmit`, `UserPromptExpansion` |
| Tool execution | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` |
| Permissions | `PermissionRequest`, `PermissionDenied` |
| Sub-flows | `SubagentStart`, `SubagentStop`, `WorktreeCreate`, `WorktreeRemove` |
| Context | `PreCompact`, `PostCompact` |
| Lifecycle | `Stop`, `StopFailure`, `Notification`, `InstructionsLoaded`, `ConfigChange`, `FileChanged`, `CwdChanged`, `TaskCompleted`, `TeammateIdle` |

**Hook handler types (critical taxonomy for our sub-MDs):**
1. **Command hooks** — shell scripts, fastest, exit-code based, free
2. **HTTP hooks** — POST to endpoint, same JSON schema, 2xx success, `decision: "block"` in body to block
3. **MCP tool hooks** — call tools on connected MCP servers
4. **Prompt hooks** — single-turn LLM evaluation for yes/no decisions (Haiku-cheap)
5. **Agent hooks** — spawn subagents with tool access for complex validation (most expensive)

**Blocking semantics:** Only `PreToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `PreCompact`, `WorktreeCreate` can block. `PostToolUse` fires after the action — cannot undo. This is load-bearing for our four-eye approval and policy-gate architecture (`kernel/four-eye-approval.ts`, `kernel/policy-gate.ts`): policy enforcement must hook `PreToolUse`, not `PostToolUse`.

**Decision schema for `PreToolUse`:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny|allow|ask|defer",
    "permissionDecisionReason": "Database writes not allowed in tenant scope",
    "updatedInput": { "command": "safe_command" },
    "additionalContext": "Why this happened"
  }
}
```
`updatedInput` lets hooks rewrite a tool call (e.g., add tenant scoping). `defer` postpones execution. ([source](https://code.claude.com/docs/en/hooks))

**Configuration locations:** `~/.claude/settings.json` (user), `.claude/settings.json` (project, shareable), `.claude/settings.local.json` (project-local, gitignored), managed-policy (org-wide), plugin `hooks/hooks.json`, skill/agent frontmatter.

**Skills (`SKILL.md` directories):** YAML frontmatter (`name`, `description`, optional `license`, `compatibility`, `allowed-tools`, `metadata`). Description must be ≤1,024 chars and is the primary auto-invocation signal — pre-loaded into system prompt at startup. Set `disable-model-invocation: true` to make the skill manual-only. Skills are progressive disclosure: metadata in system prompt, body loaded only when triggered. ([source](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills))

**Slash commands:** Files in `.claude/commands/*.md`. As of 2026, slash commands and skills are unified — every skill gets a `/slash-command` interface automatically.

**Plan mode:** Shift+Tab toggles. Read-only — no edits or commands execute until user confirms. Anthropic's guidance: "Plan mode is free; re-doing work is expensive."

### 1.3 Computer Use API

**Latest tool version:** `computer_20251124` for Claude Opus 4.7, Opus 4.6, Sonnet 4.6, Opus 4.5. Older `computer_20250124` for Sonnet 4.5, Haiku 4.5, Opus 4.1.

**Beta header:** `computer-use-2025-11-24`.

**Capabilities (expanded `20251124`):** screenshot, left/right/middle/double/triple click, type, key combos, mouse_move, scroll (with direction + amount), left_click_drag, left_mouse_down/up, hold_key, wait, **zoom** (new — `region: [x1,y1,x2,y2]`, requires `enable_zoom: true`).

**Modifier keys:** `text` parameter on click/scroll accepts `shift`, `ctrl`, `alt`, `super`.

**Recommended display:** 1024×768 (XGA) for general; 1280×800/1366×768 for web apps. Avoid >1920×1080 — performance issues. Claude Opus 4.7 supports up to 2576px on long edge with 1:1 coordinate mapping (no scaling math needed). Older models cap at 1568px long edge / ~1.15 MP — you must scale coordinates back to native screen space.

**Reliability caveats from Anthropic (2026):**
- Latency too slow for real-time human interaction — best for background tasks
- Coordinate hallucination on niche UIs
- Scroll unreliable in some apps — fall back to keyboard PageDown
- Spreadsheet selection is brittle — use fine-grained mouse_down/up
- Prompt injection mitigation: classifier auto-runs on screenshots, can force user-confirm; opt out via support

**Pricing overhead:** System prompt adds 466–499 tokens; tool definition adds 735 tokens for Claude 4.x models. Plus screenshot vision costs.

**Tested benchmarks:** Anthropic claims SOTA on WebArena among single-agent systems (Sonnet 4.6); independent leaderboards show Claude Mythos Preview 68.7% on WebArena vs. GPT-5.4 Pro 65.8% and human baseline ~78%. ([source](https://benchlm.ai/benchmarks/webArena))

**Our use:** Computer Use is genuinely useful for *lease portal scraping*, *land registry lookups*, and *bank portal cashflow reconciliation* where APIs don't exist. Not for in-product UX — too slow.

### 1.4 Memory tool

**Primitive:** Client-side, file-based. Claude makes `view`/`create`/`str_replace`/`insert`/`delete`/`rename` tool calls against a `/memories` directory; **your application** executes the operations locally. Storage backend is yours (filesystem, S3, Postgres BYTEA, encrypted disk).

**Tool type id:** `memory_20250818`. Eligible for Zero Data Retention.

**Auto-injected system prompt** (when memory enabled):
```
IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE.
MEMORY PROTOCOL:
1. Use the `view` command of your `memory` tool to check for earlier progress.
2. ... (work on the task) ...
   - As you make progress, record status / progress / thoughts etc in your memory.
ASSUME INTERRUPTION: Your context window might be reset at any moment, so you risk losing any progress that is not recorded in your memory directory.
```

**Pairs with Compaction:** Compaction is server-side summarization when conversation approaches context limit. Memory persists across compaction boundaries. Recommended pattern: use both.

**Multi-session pattern (Anthropic-blessed):** Initializer session creates progress log + feature checklist + startup script in `/memories`. Subsequent sessions read these on start, write end-of-session updates. "Work on one feature at a time. Only mark a feature complete after end-to-end verification."

**Security MUSTS:** Validate all paths start with `/memories`, resolve to canonical form, reject `../`/`..\\`/URL-encoded traversal (`%2e%2e%2f`). Anthropic explicitly calls this out as a directory-traversal attack surface. Size limits + pagination for view. Periodic expiration of stale files. ([source](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool))

**Managed Agents Memory (April 23, 2026 public beta):** Each memory store is a workspace-scoped directory mounted at `/mnt/memory/` inside the agent's container; uses standard bash + file tools. Differs from the client-side Memory tool by being Anthropic-managed.

**Verdict for BOSSNYUMBA:** Use Memory tool *inside* each sub-MD session for working notes / progress logs / cross-session pickup. Use Postgres+pgvector *across* tenants for institutional knowledge. Don't conflate the two.

### 1.5 Extended Thinking

**Budget range:** 1,024 (minimum) → 100,000+ tokens. Output-priced. Opus output ≈ 5× input price, so budget directly scales cost.

**Cost example (Opus 4.7):** 10,000 requests/day × 10k thinking budget = ~$7,500/day in thinking alone if every request maxes the budget. Opus typically uses 40–90% of budget; budget is a cap, not a target.

**Suggested ranges by task complexity:**
- Well-defined / look-up tasks: skip extended thinking
- Moderate (debugging a function): 5–10k
- Complex (system design, competition math): 20–50k
- Research-grade: 100k+ (must use Batch API; >32k synchronous risks network timeouts)

**When to use:** Multi-step algebra/probability, code debugging across functions, multi-step planning where early decisions constrain later, careful analysis (legal, paper eval, trade-off comparison).

**When NOT to use:** Customer-facing real-time interaction (latency), well-defined classification, retrieval-only tasks. ([source](https://platform.claude.com/docs/en/build-with-claude/extended-thinking))

**Our use:** Sub-MD REDESIGN stage (proposing process changes) and AUTOMATE compilation (writing actual workflow code) should use extended thinking with 10–20k budget. OBSERVE/MAP should not.

### 1.6 Prompt caching (THE cost lever)

**Mechanics:**
- Up to **4 explicit `cache_control` breakpoints** per request
- TTL: **5 min** (default, 1.25× write cost) or **1 hour** (2× write cost)
- Cache read: **0.1× base input cost** (10% — i.e., 90% discount)
- Lookback: 20 blocks backward from each breakpoint
- Min cacheable prompt: 4,096 tokens (Opus 4.x / Haiku 4.5), 1,024 tokens (Sonnet 4.x)

**Cost formula:**
```
total = cache_read × 0.1 + cache_write × 1.25 (5m) + new_tokens × 1.0
```

**Cacheable:** Tools, system, messages (text/images/documents/tool_use/tool_results). Not cacheable: thinking blocks (cached implicitly with surrounding content), sub-content citation blocks, empty text.

**Cache invalidation:**

| Change | Invalidates |
|---|---|
| Tool definitions | Tools + System + Messages |
| Web search toggle | System + Messages |
| Citations toggle | System + Messages |
| Fast mode toggle | System + Messages |
| Tool choice | Messages only |
| Image add/remove | Messages only |
| Extended thinking settings | Messages only |

**Pre-warming pattern:**
```python
prewarm = client.messages.create(
    max_tokens=0,  # prefill only, no generation
    system=[{"type": "text", "text": "long prompt...",
             "cache_control": {"type": "ephemeral"}}],
    messages=[{"role": "user", "content": "warmup"}]
)
# Cache written; later real requests hit it
```
`max_tokens=0` rejected with: stream=True, extended thinking, structured outputs, specific `tool_choice`, Batch API.

**Workspace isolation (Feb 5, 2026 change):** On Claude API, AWS Claude Platform, Microsoft Foundry — cache is workspace-scoped, not org-scoped. Bedrock + Vertex still org-scoped. ([source](https://platform.claude.com/docs/en/build-with-claude/prompt-caching))

**TTL change pain:** TTL dropped from 60min to 5min in early 2026 — many production workloads saw 30–60% cost increase. Mitigation: use 1h TTL where appropriate, or chatty-conversation pattern where each read resets the 5m clock.

**Our gap:** I do not see consistent `cache_control` usage in our copilot/orchestrator paths. This is the #1 cost win available. Estimate: 60–90% input-cost reduction on repeated sub-MD invocations if we cache system + skill bodies + tenant context properly.

### 1.7 Batch API

**Cost:** 50% off both input and output token prices.
**Latency:** Up to 24h; typically faster.
**Limits:** No fast-mode in batch. `max_tokens=0` (cache prewarm) not allowed.

**Decision rule:** Real-time? Standard API. ≤24h tolerable + ≥100 requests? Batch. ([source](https://jangwook.net/en/blog/en/anthropic-message-batches-api-production-guide/))

**Our wins:** Nightly arrears recompute, weekly retention scoring, monthly compliance audits, training-data generation, eval suites. Combined with prompt caching: up to 95% cost reduction on cached-prefix batch jobs.

### 1.8 MCP — Model Context Protocol

**Architecture (per [modelcontextprotocol.io/docs/learn/architecture](https://modelcontextprotocol.io/docs/learn/architecture)):**
- **Host** (AI app — Claude Code, Claude Desktop, our copilot)
- **Client** (one per server — maintains connection)
- **Server** (provides tools, resources, prompts)
- JSON-RPC 2.0 over the wire
- Lifecycle: `initialize` → capability negotiation → `notifications/initialized` → tool/resource calls → notifications

**Primitives servers expose:**
- **Tools** — executable functions (`tools/list`, `tools/call`)
- **Resources** — data sources (`resources/list`, `resources/read`)
- **Prompts** — reusable templates (`prompts/list`, `prompts/get`)

**Primitives clients can offer back:**
- **Sampling** — server requests LLM completion from client (model-independent server design)
- **Elicitation** — server requests info from user
- **Logging** — server sends log msgs to client

**Experimental:** **Tasks** — durable execution wrappers for deferred result retrieval (batch processing, multi-step ops).

**Transports:**
- **stdio** — direct process IPC, optimal local perf, no network overhead
- **Streamable HTTP** — HTTP POST + optional SSE; supports OAuth, bearer, API key auth; SSE-only transport is now deprecated in favor of Streamable HTTP

**Security (2026 standard per Red Hat zero-trust profile):** OAuth 2.0 + OIDC, RBAC, AES-256 at rest + in transit, TLS 1.3 for server-to-server, explicit user consent before host exposes data to server.

**Ecosystem scale:** 500+ public MCP servers by early 2026; 97M+ monthly SDK downloads. Top servers: GitHub, Slack, Google Drive, PostgreSQL, Notion, Jira, Salesforce, Stripe, Figma, Docker, Kubernetes, Playwright, Sentry, Linear, Confluence, BigQuery, Snowflake, AWS, GCP, Azure.

**Our use:** Sub-MDs should expose themselves as MCP servers so Claude Desktop / Claude Code (operator's IDE) can call them directly. Internal MCP servers for tenant-DB, ledger, lease store, K&D registry. Use OAuth-bearer model for inter-service auth.

### 1.9 Building Effective Agents — the five patterns (Anthropic's canon)

[source](https://www.anthropic.com/research/building-effective-agents)

| Pattern | What | When |
|---|---|---|
| **Prompt chaining** | Sequential LLM calls, programmatic gates between | Fixed subtasks, accuracy > speed (marketing copy → translate; outline → draft) |
| **Routing** | Classify input, dispatch to specialized handler | Distinct categories (customer-service intent; small-model triage routing) |
| **Parallelization — sectioning** | Independent subtasks in parallel | Speed (content moderation across rules) |
| **Parallelization — voting** | Identical task N times, aggregate | Higher-confidence verification (vulnerability scan; multi-perspective review) |
| **Orchestrator-workers** | LLM dynamically decomposes + delegates + synthesizes | Unpredictable complexity (multi-file SWE-bench, multi-source research) |
| **Evaluator-optimizer** | Generator + critic loop until criteria met | Clear eval criteria, iterative refinement helps (literary translation, multi-round research) |

**Agents proper** (vs. workflows): LLM uses tools in a loop based on environment feedback; semi-autonomous; HITL checkpoints. Use when step count unpredictable (SWE-bench, computer use).

**Anthropic's design philosophy** (quote): *"The most successful implementations…use simple, composable patterns rather than complex frameworks."* Start simple, measure everything, add complexity only when it pays for itself.

**Mapping to our 4-stage sub-MD pipeline:**

| Stage | Pattern | Why |
|---|---|---|
| OBSERVE | Parallelization (sectioning) | Multiple data sources scanned concurrently |
| MAP | Orchestrator-workers | Process discovery requires dynamic decomposition |
| REDESIGN | Evaluator-optimizer | Generate proposal → critic checks for regressions / compliance → revise |
| AUTOMATE | Prompt-chained workflow + HITL gates | Deterministic deploy steps with four-eye approval |

---

## (2) OpenAI ecosystem state

### 2.1 Agents SDK (formerly Swarm)

**Status:** Swarm officially deprecated; Agents SDK is production successor. v0.17.1 shipped May 11, 2026. ([source](https://www.respan.ai/articles/openai-agents-sdk-vs-swarm))

**Four primitives:**
1. **Agents** — model + instructions + tools
2. **Handoffs** — agent-to-agent transfers (Swarm pattern, preserved)
3. **Guardrails** — input/output validators with structured exception flow
4. **Tracing** — built-in distributed tracing for debugging

April 2026 evolution added sandboxing and a "new model harness." Supports the Responses API natively.

### 2.2 Assistants API — deprecation

**Sunset date:** **August 26, 2026.** ([source](https://learn.microsoft.com/en-us/answers/questions/5571874/openai-assistants-api-will-be-deprecated-in-august))

**Replacement:** **Responses API** — combines Chat Completions simplicity with Assistants tool-use, plus stateful conversation handling. Migration guide forthcoming.

**Implication:** Anyone (us included) shouldn't build new code against Assistants API. If we have any legacy integration assumptions, retire before August 2026.

### 2.3 GPT-5 family (2026 pricing & benchmarks)

| Model | Input $/MTok | Output $/MTok | SWE-bench (varies) | Notes |
|---|---|---|---|---|
| GPT-5.4 Standard | 2.50 | 15 | ~75% Verified, 57.7% Pro | Default workhorse |
| GPT-5.4 Pro | 30 | 180 | Higher | Premium reasoning |
| GPT-5.4 Mini | ~0.40 | ~1.60 | 54.4% Pro | 70% cheaper than Standard, near-match on coding |
| GPT-5.4 Nano | even lower | — | 52.4% Pro | Edge/embedded |
| GPT-5.3 Codex | — | — | 85% SWE-Verified | Code-specialized |

GPT-5.4 OSWorld 75% (surpasses 72.4% human-expert baseline). HealthBench Hard 46.2%. AIME 2025 (no tools): 94.6%. ([source](https://www.vellum.ai/blog/gpt-5-benchmarks))

### 2.4 o3 / o4-mini

Pushed frontier on Codeforces, SWE-bench, MMMU at launch. Evaluated at "high reasoning effort"; cf. o4-mini-high. Largely superseded by GPT-5.4 family for new builds.

### 2.5 GPTs vs. our Skills

GPTs are consumer-facing assistant configurations in ChatGPT — closest analog to our Skills concept but published on OpenAI's marketplace. Not directly usable in our enterprise context. Skills via Claude Code/Agent SDK are the right primitive for us — local, versioned, vendor-portable.

### 2.6 Realtime API

Three real-time voice models (2026): GPT Realtime 2, Translate, Whisper. API-only at launch. Killer feature: **parallel tool calling** — fires multiple tools simultaneously rather than stalling per call. Relevant for our Voice Hippodrome / `kernel/voice/` and `kernel/voice-persona-dna/`. ([source](https://www.mindstudio.ai/blog/openai-3-new-realtime-voice-models-api-access))

### 2.7 Embeddings (text-embedding-3 family)

text-embedding-3-large is *strong but no longer SOTA*. 2026 leaderboards have Cohere embed-v4, Voyage voyage-3-large, Gemini Embedding 2 (preview, March 10 2026 — five modalities: text, image, video, audio, PDF) topping MTEB. text-embedding-3-large remains a defensible default. ([source](https://pecollective.com/tools/text-embedding-models-compared/))

**For BOSSNYUMBA:** stay with text-embedding-3-small for default cost-perf, allow tenant-level override to Voyage for high-precision legal/dispute corpus.

---

## (3) LangGraph / CrewAI / AutoGen / DSPy — verdicts

| Framework | Best for | Weakness | Adoption cost | Verdict |
|---|---|---|---|---|
| **LangGraph** v0.4 | Stateful production workflows, regulated industries, durable execution, graph-based state machines. Klarna/Uber/LinkedIn/BlackRock/Cisco/JPMorgan in prod. 76% medium-task accuracy in indep benchmarks. | Conflicts with Agent SDK's session model; adds runtime dep; LangChain coupling | High — rebind kernel state | **SKIP** — steal the checkpointer pattern, build it on Agent SDK sessions |
| **CrewAI** | Role-based crew assembly; fastest-growing framework (31k stars by Apr 2026, +1014% in 15mo); good for prototyping multi-agent setups | Too opinionated; less control over tool execution; 71% medium-task accuracy | Medium | **SKIP** — steal the "role + goal + backstory" YAML pattern for our sub-MD definitions |
| **AutoGen** | Conversational multi-agent; 1.0 GA reached; 68% medium-task | Microsoft pivoted focus to Agent Framework; effectively maintenance mode | Low (but dying) | **SKIP** — DOA for new builds |
| **DSPy 3** (stanfordnlp) | Prompt-as-program compilation; signatures + modules; MIPROv2 (Bayesian opt), GEPA (reflective evolution), SIMBA (stochastic mini-batch); native tool calls; async-first | Research-leaning ergonomics; debugging compiled prompts opaque | Low (we already use it) | **ADOPT (continue)** at the prompt-evolution layer; do NOT use as runtime |

[sources: [pooya.blog](https://pooya.blog/blog/crewai-vs-langgraph-autogen-comparison-2026/), [pecollective.com](https://pecollective.com/blog/ai-agent-frameworks-compared/), [stanfordnlp/dspy](https://github.com/stanfordnlp/dspy/releases)]

**Patterns to steal:**
- LangGraph's *checkpointer + resume from arbitrary node* — implement as our own JSONL session log
- CrewAI's *role × goal × backstory* metadata block — applied to our sub-MD definitions
- DSPy GEPA — for evolving sub-MD prompts using execution traces; we have `kernel/prompt-evolution/` — wire it up to GEPA properly

### 3.1 Other contenders

- **LlamaIndex Agents** — best when agent's main job is RAG over indexed private data. Not our shape.
- **Pydantic AI** v1.85.1 (Apr 22, 2026) — type-safe agent framework with dependency injection; built by the team behind Pydantic (which already powers OpenAI SDK, Anthropic SDK, LangChain, LlamaIndex, CrewAI). 16.5k+ stars and growing fast. **Worth a serious look as a thin wrapper around Anthropic SDK if we want stricter typing than Agent SDK's TypeScript types provide.** ([source](https://ai.pydantic.dev/))
- **Haystack** — Berlin-based, EU-friendly NLP pipelines. Not our shape unless we add European data residency tier.
- **Atomic Agents** — explicit IPO contracts per agent; high-discipline, low-magic. Interesting design philosophy; small ecosystem.

---

## (4) Coding-agent frontier (Devin, Cursor, Replit Agent, Copilot)

### 4.1 Cognition Devin

**Devin 2.0 score:** 45.8% SWE-bench Verified (pass@1, no human assistance). Conservative methodology. ([source](https://ucstrategies.com/news/devin-1-specs-benchmarks-why-its-obsolete-2026/))

**Capabilities:** Full autonomous dev env — browser, terminal, code editor — managed cloud service. $500/mo for enterprise. Targets teams wanting a managed agent UI, not raw API.

**Where it failed:** Foundation models with good scaffolding (Claude Code, Codex CLI) now exceed Devin's original benchmarks. Cognition's proprietary smaller model can't keep up with Opus 4.x.

### 4.2 Cursor Agent Mode

**Cloud Agents (2026):** Background agents in isolated VMs, each with terminal + browser + full desktop. Clone repo, set up env, write+test code, push for review, keep working offline. **56% SWE-bench Verified independent measurement.** ([source](https://www.augmentcode.com/tools/8-top-ai-coding-assistants-and-their-best-use-cases))

### 4.3 Replit Agent

Serious for spinning up full apps with zero local setup. Best for non-engineer founders / quick MVP. Less relevant for our codebase.

### 4.4 GitHub Copilot Workspace / Agents

Copilot Chat → Copilot Workspace (multi-file planning) → Agent Mode (executes changes across project). February 2026 multi-agent workflows. **51.7% SWE-bench Verified** per the same March 2026 benchmark. Falls behind Cursor.

### 4.5 Lovable / Bolt.new / v0.dev — generative UI

- **Lovable 2.0** — most polished UI out-of-box; Framer Motion + state mgmt; Chat Mode Agent + Visual Edits + custom domain purchasing; full-stack
- **Bolt.new (StackBlitz)** — multi-agent workflows (DB agent + UI agent) for stable full-stack
- **v0.dev (Vercel)** — production-grade Next.js output; full-stack via Vercel infra

**Market:** AI-app-builder revenue hit $4.7B in 2026, projected $12.3B by 2027. "Vibe coding" mainstream — 41% of production code is AI-generated globally. ([source](https://nextfuture.io.vn/blog/v0-dev-vs-bolt-new-vs-lovable-comparison-2026))

**Relevance to BOSSNYUMBA:** Our `apps/admin-platform-portal/src/lib/genui/` already does generative UI via Vega and render-blocks. Worth studying Lovable's prompt-to-UI synthesis discipline for our prompt-block library.

### 4.6 Claude Code (the one we're in)

Highest-performing coding agent on Verified at 87.6% (Opus 4.7 Adaptive) / 93.9% (Mythos Preview). Has all the primitives we need (Skills, Hooks, MCP, Subagents, Plan Mode, Memory). The only honest competition is itself.

---

## (5) Vertical agent platforms

| Platform | Domain | Architecture insight | Lesson for BOSSNYUMBA |
|---|---|---|---|
| **Sierra** (Bret Taylor) | Consumer brand customer service — Sonos, SiriusXM, WeightWatchers, Casper | Voice-first multi-channel; created τ-bench to measure their domain | Domain-specific benchmarks (τ-bench) → build our own (e.g., PMS-bench) to measure sub-MDs honestly |
| **Decagon** | SaaS B2B ticket resolution | Ingests KB + docs + ticket history; agents handle escalations/refunds/account changes | Use historical ticket corpora to bootstrap retention/arrears MD training data |
| **Cresta** | Contact center, human+AI hybrid | "Agent Operations Center" — unified command hub managing human + AI together | Our operator dashboard should treat human + AI sub-MDs as same management surface |
| **Harvey AI** | Legal — top law firms, corporate legal | Contract analysis, due diligence, compliance, litigation. Multi-model backend | Bet on Claude as primary but maintain provider-portable prompts |
| **Casetext / CoCounsel** | Legal (Thomson Reuters) | Multi-model arch (Anthropic + OpenAI + Google); proprietary "Thomson" LLM launching summer 2026; reached 1M users Feb 24, 2026 | Even verticals are multi-model; we should remain Claude-primary but instrument for fallback |
| **Hippocratic AI** | Healthcare voice agents | Telephonic, non-diagnostic; app-store model for clinician-authored scripts; NVIDIA H200s | App-store / marketplace pattern for landlord-authored sub-MD recipes is plausible |
| **Glean** | Enterprise search + agents | Connected to all enterprise data; agents act on context | Glean-style enterprise search isn't our scope but the "agent acts on retrieved context" pattern is core |
| **Salesforce Agentforce 360** | Enterprise CRM — Agentforce 3 + Operations | Command Center; supports A2A + MCP protocols; "digital workers" for back-office | A2A is the second protocol to watch alongside MCP; back-office sub-MDs = exactly our positioning |
| **ServiceNow AI Agents** | ITSM / enterprise platform | "AI Agent Fabric" + RaptorDB + "Agentic Playbooks" | Playbook pattern (our `kernel/skill-library/` already moves this way) |
| **Adept** | Workflow agents across business tools | Reduces manual cross-app workflows | Operating across SaaS surfaces (Xero, Salesforce, M-Pesa) is our seam |
| **Imbue** | Foundation models for agents (70B reasoning) | $1B valuation, $200M Series B; multi-agent coding coordination | Building base models is not our path; consumers of frontier models is |

[sources: [parloa.com](https://www.parloa.com/knowledge-hub/sierra-ai-alternatives/), [corepiper.com](https://corepiper.com/blog/decagon-vs-sierra/), [harvey.ai](https://www.harvey.ai/), [hippocraticai.com](https://hippocraticai.com/), [salesforce.com/news](https://www.salesforce.com/news/stories/agentforce-operations-announcement/), [thomsonreuters.com](https://www.thomsonreuters.com/en/cocounsel)]

---

## (6) Benchmark grounding

| Benchmark | What it measures | Current SOTA (model + score) | Relevance to junior-replacement |
|---|---|---|---|
| **SWE-bench Verified** | Solve real GitHub issues end-to-end | Claude Mythos Preview 93.9%; Opus 4.7 Adaptive 87.6%; GPT-5.3 Codex 85%; Devin 2.0 45.8% | **High** — sub-MD AUTOMATE stage writes real code |
| **SWE-bench Pro** | Harder, contamination-resistant successor; OpenAI's recommended replacement | GPT-5.4 Standard 57.7%; GPT-5.4 Mini 54.4%; GPT-5.4 Nano 52.4% | **High** — more honest signal than Verified |
| **GAIA** | General assistant tasks (Princeton HAL scaffold) | Sonnet 4.5 74.6%; Anthropic sweeps top 6 | Medium — multi-step reasoning under uncertainty |
| **BFCL V4** | Function-calling accuracy | GLM-4.5 70.9%; Opus 4.1 70.4%; Sonnet 4 close | **High** — tool-call correctness is foundational |
| **τ-bench / τ2-bench** | Multi-turn customer-service with tools (Sierra) | Opus 4.6 — telecom 99.3%, retail 91.9% | **Very High** — closest analog to our domain |
| **WebArena** | Autonomous web navigation across real sites | Mythos Preview 68.7%; GPT-5.4 Pro 65.8%; human ~78% | **High** — sub-MDs scrape lease portals, registries, bank UIs |
| **VisualWebArena** | Multimodal web tasks | All models << human; gap remains large | Medium — Computer Use ceiling |
| **OSWorld** | OS-level desktop automation | GPT-5.4 75% (beats 72.4% human-expert) | **High** — Computer Use task ceiling |
| **AgentBench** | Multi-environment agent capability | Mixed; favors function-call-strong models | Medium |
| **Terminal-Bench 2.0** | Agentic terminal work | Cursor-Claude-Sonnet leading | High — sub-MD operator surface |
| **HELM Agents** | Holistic agent eval | Anthropic leads | Medium |

**Property-management vertical:** No public benchmark exists. **Recommendation:** Phase E should include constructing **PMS-bench-1** internally — 50–100 tasks across the six sub-MD domains, evaluated pass^k for reliability scoring (the τ-bench methodology). This becomes our internal gating signal and (eventually) competitive moat.

[sources: [swebench.com](http://www.swebench.com/), [labs.scale.com](https://labs.scale.com/leaderboard/swe_bench_pro_public), [hal.cs.princeton.edu/gaia](https://hal.cs.princeton.edu/gaia), [awesomeagents.ai/leaderboards/agentic-ai-benchmarks-leaderboard](https://awesomeagents.ai/leaderboards/agentic-ai-benchmarks-leaderboard/)]

---

## (7) Critical architecture questions — frontier answers

### 7.1 State management across long-running sub-MD sessions

**Best-in-class:** LangGraph's checkpointer (Postgres/SQLite/Redis backends); Agent SDK's JSONL session log + `resume=session_id`; Managed Agents' Anthropic-hosted event log.

**For us:** Already partially built (`kernel/sources/`, `kernel/cot-reservoir/`). Recommendation: standardize on a JSONL session log per sub-MD invocation, stored in Postgres with tenant_id partitioning, indexable for replay/eval. Mirror Agent SDK's `SystemMessage.subtype="init"` envelope.

### 7.2 Backtracking / undo when an agent makes a mistake

**Frontier patterns:**
- **Pre-action approval gates** (PreToolUse hook with `permissionDecision: "deny|allow|ask|defer"`)
- **Post-action compensating actions** — agent has a registered rollback for each mutating tool
- **Confidence-based routing** — low-confidence actions enqueued for human review
- **Sovereign Action Ledger** (we already have it: `packages/database/src/schemas/sovereign-action-ledger.schema.ts`) — append-only log of all mutating actions with reversal metadata

**Best ergonomics:** Cloudflare Agents' pause/resume + state snapshot (workflow framework can resume from any saved checkpoint). ([source](https://developers.cloudflare.com/agents/guides/human-in-the-loop/))

**For us:** Bind PreToolUse hook to `kernel/four-eye-approval.ts`. Every mutating tool emits a sovereign-action-ledger entry with a `compensating_action` JSON blob. Undo = reverse-execute the ledger.

### 7.3 Cost control / token budgeting per agent

**Five layers** ([source](https://aisecuritygateway.ai/blog/llm-token-budget-strategies-for-agents)):
1. **Per-request ceiling** (max_tokens, reasoning budget cap)
2. **Per-session rolling budget** (cumulative tokens over a session)
3. **Per-key / per-tenant monthly cap**
4. **Model-tier routing** (Haiku → Sonnet → Opus by task hardness)
5. **Circuit breaker** (kill switch when retry-loops detected)

**Highest-leverage techniques:**
- Prompt caching (90% off cached input)
- Batch API (50% off, ≤24h)
- Cascading: Haiku tries first, escalate only on failure
- MCP tool metadata constrained — can consume 40-50% of context if uncontrolled

**For us:** `kernel/cognitive-load.ts` + `packages/ai-copilot/src/cost-ledger.ts` are the right spots. Add per-tenant monthly caps as MCP server resource limits.

### 7.4 Eval-in-the-loop

**Pattern (FutureAGI / AgentCore Optimization / Microsoft Foundry):**
- Pre-prod simulation against frozen test set
- Span-attached eval (every trace gets scored online)
- Gateway enforcement (failing traces blocked from prod outputs)
- Continuous prompt optimization on the same runtime
- A/B test winner → new baseline (flywheel)

**Agent eval is trajectory-scored, not output-scored:** Did the agent pick the right tool? Did the planner decompose correctly? Did retries converge? Did the loop terminate? Did the final answer satisfy the original goal? ([source](https://futureagi.com/blog/agent-evaluation-frameworks-2026))

**For us:** `packages/ai-copilot/src/eval/` is the seam. Wire it to our continuous-grading and decision-trace modules. Shadow-mode (already present) is the gateway-enforcement equivalent.

### 7.5 Multi-agent debate / counter-model patterns

**2026 research consensus:**
- Multi-agent debate improves accuracy on math + factual reasoning
- Benefits depend on honest actors; larger optimized models can be more susceptible to persuasion-based adversarial attacks ([Nature Scientific Reports](https://www.nature.com/articles/s41598-026-42705-7))
- **Failure modes:** premature convergence, adversarial weakening on long debates, judge bias toward verbose arguments
- **Mitigations:** bound debate rounds, require structured arguments (rubric-scored), rotate judge identity

**Practical rule:** 2–3 critics with a separate judge agent — more diminishing returns. ([source](https://www.flowhunt.io/blog/multi-agent-ai-system/))

**For us:** `kernel/debate/` + `kernel/critics/` + `kernel/counter-model/` already model this. Cap parallel critics at 2-3. Rotate judge identity each cycle. Use structured-rubric scoring (no free-form judging).

### 7.6 Human-in-the-loop ergonomics

**Best practice (Cloudflare Agents + Cresta + Anthropic guidance):**
- **Calibrated autonomy** — full autonomy for high-confidence reversible low-stakes actions; HITL for uncertain, irreversible, or high-risk
- **Four risk dimensions:** irreversibility, blast radius, compliance exposure, confidence
- **Three approval patterns:**
  - Pre-action (block before execute) — for irreversible high-blast
  - Post-action (review after, with rollback window) — for reversible
  - Confidence-based (auto-route by score) — for medium-risk
- **Infrastructure:** durable state, fast retrieval, reliable messaging, timeout escalation

**Tier example:** Low → auto-execute; medium → log for async review; high → sync approval queue.

**For us:** This is the cleanest spec for `kernel/four-eye-approval.ts`. Each tool registers (`irreversibility`, `blast_radius`, `compliance_exposure`) at definition time; runtime computes risk score and routes accordingly. We already have `risk-tier.ts` — extend it.

### 7.7 Memory persistence — which store when

**2026 consensus:** Hybrid, not one-fits-all. ([source](https://mem0.ai/blog/state-of-ai-agent-memory-2026))

| Memory type | Best store | Notes |
|---|---|---|
| **Working memory** (this-session progress, notes) | File-based (Anthropic Memory tool, `/memories`) | Interruption-resilient; agent-owned schema |
| **Episodic memory** (conversations, events) | Relational/document (Postgres, MongoDB) | Predictable queries, compliance audit trail |
| **Semantic memory** (knowledge base, similarity retrieval) | Vector (pgvector if already on Postgres; Weaviate/Qdrant at scale) | Fuzzy / meaning-based |
| **Associative memory** (entity-relationship reasoning) | Graph (Neo4j, AuraDB) | Multi-hop questions — only when needed |

**Important shift in 2026:** Production stopped picking one. Hybrid platforms (Oracle AI Agent Memory, mem0) bundle all four representations.

**For us:** We're already on Postgres. Use:
- pgvector for tenant institutional knowledge (already partly built)
- Postgres rows for episodic / audit trail (sovereign-action-ledger)
- Anthropic Memory tool primitive for in-session working memory
- Defer graph DB until we hit an explicit multi-hop query we can't answer

---

## (8) BOSSNYUMBA gap map

For each finding, what we have / what's missing / Phase E priority.

### Finding A — Adopt Anthropic primitives natively
**Have:** Extensive kernel (`packages/central-intelligence/src/kernel/*`) covering identity, awareness scopes, policy gate, four-eye approval, counter-model, debate, critics, prompt evolution, reflexion, self-rag, world-model, persona, voice. `kernel/tool-spec/` modelled on Anthropic-style tools.
**Missing:**
- No clear binding to Agent SDK `query()` loop primitives
- Hook system not aligned to Claude Code's 26 lifecycle events (we have policy-gate but not the full PreToolUse / PostToolUse / Stop / SubagentStart / PreCompact taxonomy)
- Skills (`SKILL.md` + frontmatter) not used — we have `kernel/skill-library/` but as code, not SKILL.md directories
- Memory tool primitive not adopted — we conflate working + institutional memory
**Priority:** **P0** — rebind `kernel/kernel.ts`, `kernel/policy-gate.ts`, `kernel/four-eye-approval.ts` to Claude Agent SDK hooks; convert `kernel/skill-library/` entries to `SKILL.md` format; add Memory tool to sub-MD loops.

### Finding B — Adopt the five workflow patterns as sub-MD architecture
**Have:** `packages/ai-copilot/src/orchestrator/`, `orchestrators/`, `intelligence-orchestrator/`. Workflow-related code.
**Missing:** No explicit pattern-tagging in code (OBSERVE = sectioning, MAP = orchestrator-workers, REDESIGN = evaluator-optimizer, AUTOMATE = chaining + HITL). Each sub-MD should declare which pattern it uses per stage so we can measure consistently.
**Priority:** **P1** — add `Pattern` enum + sub-MD pipeline stage tag; refactor existing orchestrators to advertise their pattern.

### Finding C — Prompt caching + Batch API
**Have:** `packages/ai-copilot/src/cost-ledger.ts`, `kernel/semantic-cache/`.
**Missing:** No systematic `cache_control` breakpoints on sub-MD system prompts, skill bodies, or tenant context. No Batch API usage for nightly recomputes (arrears, retention, compliance).
**Priority:** **P0** — single biggest cost win available. Add 4-breakpoint caching pattern (tools / system / skill / tenant) to every sub-MD invocation. Migrate nightly rollups to Batch API.

### Finding D — Skip LangGraph et al., steal patterns
**Have:** No LangGraph/CrewAI/AutoGen deps (good).
**Missing:** Reusable checkpointer pattern; explicit role-goal-backstory schema on sub-MD definitions.
**Priority:** **P2** — define `SubMDDefinition` type with `{role, goal, backstory, pattern, tools, hooks, skills}` fields. Implement checkpointer on top of our existing JSONL sources.

### Finding E — Memory: file for working, pgvector for institutional
**Have:** `kernel/memory/`, `kernel/memory-recall-bench/`, `kernel/dp-memory/` (differential-privacy memory), `kernel/world-model/`.
**Missing:** Anthropic Memory tool not exposed as a tool to sub-MDs; no clean separation between session working memory and cross-session institutional memory.
**Priority:** **P1** — implement client-side Memory tool handler (with path-traversal guards per Anthropic spec); keep pgvector for tenant institutional knowledge.

### Finding F — Sub-agent fan-out cap at 2-3
**Have:** `kernel/debate/`, `kernel/critics/`, `kernel/counter-model/`.
**Missing:** Explicit cap; rotating judge identity; structured-rubric judging.
**Priority:** **P2** — add `MAX_PARALLEL_CRITICS = 3` and judge-rotation primitive.

### Finding G — Computer Use for portal scraping only
**Have:** Document-intelligence service; no Computer Use integration.
**Missing:** Operator portal for sub-MDs to fetch from KCB/CRB/registry portals that lack APIs.
**Priority:** **P2** — opt-in Computer Use tool registered as a special-permission MCP server (sandboxed, tenant-scoped, audit-logged).

### Finding H — Commit to Claude; thin GPT-Realtime adapter for voice
**Have:** `kernel/voice/`, `kernel/voice-bridge.ts`, `kernel/voice-persona-dna/`.
**Missing:** Clear primary/fallback model declaration; voice provider explicitly OpenAI Realtime API behind same interface.
**Priority:** **P2** — `ModelProvider` interface; Claude primary; OpenAI Realtime adapter for voice only; remove any provider-agnostic spaghetti.

### Finding I — Construct PMS-bench-1
**Have:** `kernel/__tests__/`, `packages/ai-copilot/src/eval/`.
**Missing:** Standardized vertical benchmark with pass^k methodology (à la τ-bench).
**Priority:** **P1** — 50–100 PMS tasks (10–20 per sub-MD), automated pass@1/pass^8 grading, run weekly as CI gate.

### Finding J — Agent SDK hook lifecycle = our policy-gate replacement
**Have:** `kernel/policy-gate.ts`, `kernel/four-eye-approval.ts`, `kernel/inviolable.ts`, `kernel/public-inviolable.ts`, `kernel/risk-tier.ts`, `kernel/killswitch.ts`.
**Missing:** Mapping these to PreToolUse / Stop / PreCompact / WorktreeCreate hook events; HTTP-hook deployment so a separate policy service can be the gatekeeper for any agent runtime (not just our kernel).
**Priority:** **P0** (alongside Finding A) — externalize policy enforcement as a hook-compatible HTTP service so Claude Code, Agent SDK, and Managed Agents can all call it.

---

## (9) References

Primary Anthropic docs:
- [Anthropic — Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic Resources — Building Effective AI Agents (architecture patterns PDF)](https://resources.anthropic.com/building-effective-ai-agents)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK — Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Anthropic Engineering — Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Memory tool spec](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Anthropic skills GitHub repo](https://github.com/anthropics/skills)
- [Claude Agent SDK Python (GitHub)](https://github.com/anthropics/claude-agent-sdk-python)

MCP:
- [Model Context Protocol — Architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [MCP cheat sheet 2026 (Webfuse)](https://www.webfuse.com/mcp-cheat-sheet)

OpenAI:
- [OpenAI — New tools for building agents](https://openai.com/index/new-tools-for-building-agents/)
- [OpenAI o3 and o4-mini](https://openai.com/index/introducing-o3-and-o4-mini/)
- [OpenAI Agents SDK vs Swarm migration guide](https://www.respan.ai/articles/openai-agents-sdk-vs-swarm)
- [Assistants API deprecation — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5571874/openai-assistants-api-will-be-deprecated-in-august)
- [GPT-5 benchmarks (Vellum)](https://www.vellum.ai/blog/gpt-5-benchmarks)
- [GPT-5.4 mini/nano (DataCamp)](https://www.datacamp.com/blog/gpt-5-4-mini-nano)
- [OpenAI text-embedding-3-large API docs](https://developers.openai.com/api/docs/models/text-embedding-3-large)

Frameworks:
- [LangGraph vs CrewAI vs AutoGen 2026 benchmarks](https://pooya.blog/blog/crewai-vs-langgraph-autogen-comparison-2026/)
- [Agentic AI frameworks 2026 (pe collective)](https://pecollective.com/blog/ai-agent-frameworks-compared/)
- [DSPy releases (GitHub)](https://github.com/stanfordnlp/dspy/releases)
- [DSPy 3 build & optimize pipelines](https://amirteymoori.com/dspy-3-build-evaluate-optimize-llm-pipelines/)
- [GEPA optimizer repo](https://github.com/gepa-ai/gepa)
- [Pydantic AI docs](https://ai.pydantic.dev/)

Coding agents:
- [Cognition Devin SWE-bench report](https://cognition.ai/blog/swe-bench-technical-report)
- [SWE-bench leaderboards](http://www.swebench.com/)
- [SWE-Bench Pro leaderboard (Scale)](https://labs.scale.com/leaderboard/swe_bench_pro_public)
- [Coding agents comparison (Artificial Analysis)](https://artificialanalysis.ai/agents/coding)
- [v0 vs Bolt vs Lovable comparison 2026](https://nextfuture.io.vn/blog/v0-dev-vs-bolt-new-vs-lovable-comparison-2026)

Vertical platforms:
- [Sierra AI alternatives 2026](https://www.parloa.com/knowledge-hub/sierra-ai-alternatives/)
- [Decagon vs Sierra (CorePiper)](https://corepiper.com/blog/decagon-vs-sierra/)
- [Harvey AI](https://www.harvey.ai/)
- [Hippocratic AI](https://hippocraticai.com/)
- [Cresta AI Agent](https://cresta.com/ai-agent)
- [Salesforce Agentforce Operations](https://www.salesforce.com/news/stories/agentforce-operations-announcement/)
- [Salesforce vs ServiceNow 2026](https://www.eesel.ai/blog/salesforce-agentforce-vs-servicenow-ai)
- [Thomson Reuters CoCounsel](https://www.thomsonreuters.com/en/cocounsel)
- [Glean Work AI](https://www.glean.com/)

Benchmarks:
- [HAL GAIA leaderboard (Princeton)](https://hal.cs.princeton.edu/gaia)
- [Agentic AI benchmarks (Awesome Agents)](https://awesomeagents.ai/leaderboards/agentic-ai-benchmarks-leaderboard/)
- [tau-bench leaderboard (llm-stats)](https://llm-stats.com/benchmarks/tau-bench)
- [WebArena benchmark (BenchLM)](https://benchlm.ai/benchmarks/webArena)

Architecture / patterns:
- [State of AI agent memory 2026 (mem0)](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [Cloudflare Agents — Human-in-the-loop](https://developers.cloudflare.com/agents/guides/human-in-the-loop/)
- [LLM token budget strategies (AI Security Gateway)](https://aisecuritygateway.ai/blog/llm-token-budget-strategies-for-agents)
- [Multi-agent AI systems (FlowHunt 2026)](https://www.flowhunt.io/blog/multi-agent-ai-system/)
- [Persuasion-driven adversarial influence in multi-agent debate (Nature Scientific Reports)](https://www.nature.com/articles/s41598-026-42705-7)
- [Agent evaluation frameworks 2026 (FutureAGI)](https://futureagi.com/blog/agent-evaluation-frameworks-2026)
- [Anthropic Message Batches production guide](https://jangwook.net/en/blog/en/anthropic-message-batches-api-production-guide/)

---

*Compiled 2026-05-18 by deep-research agent (Claude Opus 4.7, 1M-context).
No production code modified. Report-only.*
