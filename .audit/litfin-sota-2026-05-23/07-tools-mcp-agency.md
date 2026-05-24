# LITFIN — Tools / Function Calling / MCP / Connectors / Agentic-Action / Sensors

**Audit date:** 2026-05-23
**Surface:** Tools, function calling, MCP servers/clients, connectors, sensors, action runners, hooks, AOP, agent platform, skills
**Reference:** SOTA 2026 frontier (MCP spec 2025-06-18, Anthropic Claude Agent SDK + skills/hooks, OpenAI Realtime, Google ADK + A2A, Composio, Letta v2, LangGraph 1.0, Modal / E2B sandboxes, Browserbase, Inngest / Temporal / Trigger.dev)

LITFIN root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/`
Prior partial audit (2026-05-18): `BOSSNYUMBA101/.planning/parity-litfin/09-tools-connectors-kg.md` and `04-sensors-routing.md` and `07-agency.md`. This deeper sweep finds material things those audits missed.

---

## 0. TL;DR scorecard vs SOTA 2026

| Sub-system | LITFIN today | SOTA 2026 frontier | Gap |
|---|---|---|---|
| **MCP server (inbound)** | `McpServer` v1.26.0 SDK; tools + resources + resource templates + prompts + logging caps; static + template resources (`src/core/mcp/litfin-mcp-server.ts:52-77`); Streamable-HTTP transport (`src/app/api/mcp/route.ts:20`) | MCP spec 2025-06-18 + draft 2026 (elicitation, structured output, prompt arguments, RFC 8707 resource indicators) | Spec compliance ~85% — missing **elicitation**, **structured tool output**, and **OAuth 2.1 + DCR** (uses API-key/Bearer only) |
| **MCP client (outbound)** | `StreamableHTTPClientTransport` to external servers; ping health; bridge converts external tools to native (`src/core/mcp/mcp-client-bridge.ts:17-91`) | Sampling (server → client LLM), roots negotiation, completion API | Missing **sampling**, **roots**, **completion** |
| **External MCP servers registered** | 2 (Blender + Meshy — both with **plaintext API keys in `.mcp.json`** — `:1-19`) | 200+ via Composio; per-tenant MCP gateways | **Two stale 3D modeling MCP servers, totally off-domain for fintech**; no credit-bureau / KYC / BoT / TRA MCP servers wired |
| **Tool registry (action-side)** | 76 platform tools (`src/core/litfin-ai/actions/tool-registry.ts`, 104K); +7 operator-agent tools; +8 brain self-coding tools | Anthropic Claude Agent SDK auto-tool-discovery from skills, OpenAI assistant tools, Composio 200+ pre-built | Strong tool catalog, but **registry is a 104KB file** (god-file smell) |
| **Tool definition format** | Anthropic-native `{name, description, input_schema}` (`src/core/litfin-ai/llm/tool-use-adapter.ts:20-31`); converters to OpenAI/Generic JSON Schema (`universal-tool-adapter.ts:349-397`) | OpenAI `strict: true`, Anthropic `strict mode` (Feb 2026), Gemini function calling | Has Anthropic strict-tool path (`strict-tool-extractor.ts`) but **most tools route through non-strict mode** |
| **Parallel tool calls** | Defaults enabled (`disable_parallel_tool_use: false` per `tool-loop.ts:390`, `stream-tool-loop.ts:346`); executes via `Promise.all` (`tool-use-adapter.ts:127`) | All frontier models support parallel | PARITY — proper parallel execution |
| **Prompt caching of tool defs** | `cache_control: ephemeral 1h` on LAST tool + system prompt (`tool-loop.ts:233-254`) | Anthropic 1h caching (Feb 2026) | PARITY — workspace-scoped 1h cache |
| **Tool result handling** | Text-only `tool_result` blocks (`tool-use-adapter.ts:86-100`); JSON-stringified | Multi-modal: text + image + structured (Claude 4.5 + GPT-5.2) | **No image/multi-modal in tool results** |
| **Connectors framework** | Strong: `BaseConnector` (425 lines) with rate-limit + circuit-breaker + retry + audit + SSRF guard (`src/core/connectors/base-connector.ts`); 7 adapters (Temenos, Mambu, CNO, Avoka, Kony, Salesforce, Gmail) | Composio 200+; Pipedream; Workato; n8n | **All 7 connectors are LITFIN-coded one-offs** — no integration framework |
| **Authentication (outbound)** | OAuth 2.0 client-credentials + API key + bearer (`mcp-auth.ts:23-110`) with SSRF guard | OAuth 2.1 + DCR (RFC 7591), capability tokens, OBO (On-Behalf-Of) | Missing **PKCE**, **dynamic client registration**, **capability tokens**, **OBO flow** |
| **Idempotency / retries / breakers** | All present: `CONNECTOR_MAX_RETRIES` + exponential delay (`base-connector.ts:349-374`); 3-state breaker (`utils/circuit-breaker.ts`); token-bucket rate-limit; per-agent `X-Idempotency-Key` (`agent-platform/idempotency.ts`) | Add **jitter** to retry; explicit 4xx-no-retry | LITFIN retries **every** error (no 4xx exclusion); **no jitter** (retry-storm risk) |
| **Sensors / input ingestion** | Webhooks (Stripe, Twilio, M-Pesa, Mobile-Money via HMAC verify in `src/lib/webhook-verification.ts`); USSD (`src/core/ussd/`); WhatsApp; voice (realtime + ElevenLabs); SSE streaming (`src/core/brain/stream-tool-loop.ts`) | Polling + webhooks + streaming + file-watching + change-data-capture | PARITY — broad coverage incl. **Africa-specific USSD/M-Pesa**, **realtime voice**, **CDC** |
| **Action runners** | **V8 isolates via `isolated-vm`** (`src/core/litfin-ai/sandbox/js-sandbox.ts`, "May 2026 SOTA"); DOM executor (browser) (`src/core/agentic-action/dom-executor.ts`); cron-scheduler (`src/app/api/cron/`); 33 cron jobs | Modal sandboxes, E2B, Cloudflare Workers + Durable Objects, Inngest/Temporal/Trigger.dev for durable workflows | **Excellent V8 isolate sandbox** (genuinely SOTA); but **no Inngest/Temporal** — durable workflows via Supabase cron polling |
| **Agent platform / BYO agents** | Full A2A-compatible registration: `/.well-known/agent.json` (`src/app/.well-known/agent.json/route.ts`); agent registry with API-key + scopes + rate-limit + webhook URL (`src/app/api/agent/register/route.ts`); hardened tool registry with **SHA-256 signed entries** (`src/core/agent-platform/registry/hardened-registry.ts`) | Google A2A (April 2025), IBM ACP, ANP, Letta v2 agent runtime | **A2A agent-card endpoint is real**; lacks A2A task lifecycle (createTask/poll/cancel); no agent-to-agent message protocol |
| **Skills** | Anthropic-spec compliant `SKILL.md` loader (`src/core/skills/skill-md-loader.ts`); **5 published skills** (`skills/litfin-bp-template`, `litfin-fin-template`, `litfin-appraisal-template`, `litfin-officer-training`, `credit-officer`) with 51-heuristic credit-officer skill | Anthropic Claude Agent SDK auto-loaded skills folder, skill marketplace | **Genuinely SOTA** — explicit Anthropic spec compliance, jurisdiction filter, capability tokens, 256 KB cap, Zod-validated frontmatter |
| **Skill marketplace** | Yes — `src/core/litfin-ai/agency/` + `src/core/skills/marketplace/` (separate from raw `skills/`) with curriculum, runner, proposal store, starter skills | Anthropic skill marketplace (planned 2026) | **Partially ahead of frontier** |
| **Hooks (PreToolUse/PostToolUse/Stop/UserPromptSubmit)** | All 4 Claude-Code hook events. `src/core/brain/hooks/builtin-hooks.ts` registers killswitch + feature-flag + autopoiesis-pause gates; `src/core/governance/hooks/` has DSL + rules-store + post-tool-use evaluator with **per-tenant `tenant_governance_hooks` table** + `tenant_hook_audit_log` | Anthropic Claude Agent SDK hooks (CLI parity) | **STRONG — multi-tenant hook DSL with per-tool rule store, deny-by-default precedence, decision audit chain** — ahead of CLI hooks |
| **AOP / interception** | The hook bus (`hook-bus.ts`) + `executeActions` (`action-executor.ts:90-317`) sequences: RBAC → safety → intent verification → agent sandbox → budget → execute → tenant-isolation scrub → OCSF audit | OpenTelemetry instrumentation + AOP frameworks | **No formal AOP compiler**, but the 7-stage NemoClaw pipeline is equivalent in effect |
| **Operator-tool MCP exposure** | 5/7 operator tools surfaced via MCP_SAFE allowlist (`src/core/brain/operator-agent-tools.ts:50-55`) | — | **Audit found this — and intentionally excludes 2 (`simulate_decision`, `read_brain_pulse`) due to tenant-leak risk**. Good security posture. |

---

## 1. MCP server / client — full inventory

### 1.1 LITFIN-hosted MCP server (`src/core/mcp/litfin-mcp-server.ts`)

| Aspect | Implementation | File:Line |
|---|---|---|
| SDK | `@modelcontextprotocol/sdk` ^1.26.0 (latest stable as of audit) | `package.json` |
| Server constructor | `new McpServer({name:'litfin-mcp-server',version:'1.0.0'}, {capabilities:{tools,resources,prompts,logging}})` | `litfin-mcp-server.ts:52-66` |
| Transport (inbound) | `WebStandardStreamableHTTPServerTransport` over Next.js route | `src/app/api/mcp/route.ts:20,82-86` |
| Auth | `X-MCP-API-Key` header or `Bearer` token, env-stored allowlist | `route.ts:34-67` |
| Rate-limit | 30 req/min per API key | `route.ts:28-32` |
| Tools registered | **76 platform tools** + **5 of 7 operator tools** (MCP_SAFE allowlist) | `:87-145` and `:161-224` |
| Resources | `LITFIN_STATIC_RESOURCES` + `LITFIN_RESOURCE_TEMPLATES` with mimeType | `:230-272` |
| Prompts | 3 named prompts: `credit-assessment`, `borrower-readiness`, `portfolio-analysis` with Zod-typed args | `:279-336` |
| Schema conversion | LITFIN `ToolDefinition` → Zod via `buildZodSchema` (supports string-enum, number, boolean, array, object) | `:346-392` |
| Singleton | `serverInstance` module-level cache | `:41-77` |
| Default ActionContext | userId='mcp-client', userRole='external', portalId='public' — **no tenant context plumbed from MCP transport** | `:404-412` |

### 1.2 MCP spec 2025-06-18 compliance audit

| Spec feature | Status | Evidence |
|---|---|---|
| Tools (`tools/list`, `tools/call`) | ✅ Full | `:87-224` |
| Resources (`resources/list`, `resources/read`) | ✅ Full incl. templates | `:230-272` |
| Prompts (`prompts/list`, `prompts/get`) | ✅ Full with Zod args | `:279-336` |
| Logging capability | ✅ Declared | `:62` |
| Roots negotiation | ❌ Missing | n/a |
| Sampling (server→client LLM call) | ❌ Missing | n/a |
| Completion (`completion/complete`) | ❌ Missing | n/a |
| **Elicitation** (2025-11 spec) | ❌ Missing | n/a |
| **Structured tool output** (2025-11) | ❌ Missing — all results are JSON-stringified text blocks | `:121-131` |
| Notifications (`notifications/*`) | ⚠️ Partial — SSE stream via GET works | `route.ts:103-119` |
| Resource subscriptions (`resources/subscribe`) | ❌ Missing | n/a |
| **OAuth 2.1 + DCR (RFC 7591/8707)** | ❌ API-key + Bearer only | `route.ts:34-67` |

**Verdict:** ~85% of MCP 2025-06-18; 0% of 2026 draft features. The two-key API-key model is the biggest auth gap (no PKCE, no DCR, no resource indicators).

### 1.3 MCP client bridge (outbound) (`src/core/mcp/mcp-client-bridge.ts`)

| Aspect | Implementation | File:Line |
|---|---|---|
| Transport | `StreamableHTTPClientTransport` | `:17-18,91-98` |
| Max connections | 10 | `:37` |
| External tool timeout | 30s | `:38` |
| Discovery | `client.listTools()` + `client.listResources()` | `:170,188` |
| Cost model per server | `McpServerCostModel{costPerCall, costPer1kTokens, isFree, tier, monthlyBudgetUSD}` | `types.ts:165-178` |
| Tool result extraction | Text-only — filters `content.type==='text'`, joins, attempts JSON.parse | `:230-246` |
| Server categories | `credit-bureau`, `core-banking`, `regulatory`, `document-verification`, `market-data`, `partner-bank`, `analytics`, `custom` | `types.ts:45-53` |
| Health check | `client.ping()` with latency record | `:402-411` |
| Auth (outbound) | OAuth 2.0 client-credentials (+SSRF guard via DNS validation), API-key, Bearer | `mcp-auth.ts:23-110` |
| Event bus | 5 event types (connected, disconnected, error, tool-discovered, resource-updated) | `types.ts:127-134` |

### 1.4 Registered external MCP servers (`.mcp.json`)

```json
{
  "mcpServers": {
    "blender": { "command":"uvx", "args":["blender-mcp"], "env":{"FAL_KEY":"<plaintext key>"} },
    "meshy":   { "command":"npx", "args":["-y","meshy-ai-mcp-server"], "env":{"MESHY_API_KEY":"<plaintext key>"} }
  }
}
```

**This is the single most surprising finding of the audit.** A fintech platform's only registered MCP servers are 3D-modeling tools (Blender + Meshy/text-to-3D), with **API keys committed in plaintext** to a tracked file. No credit-bureau, KYC, BoT, TRA, BRELA, Mambu, Temenos, or M-Pesa MCP servers — all of those go through the bespoke `src/core/connectors/` framework instead, which is parallel infrastructure to MCP.

---

## 2. Tool registry — what tools exist

### 2.1 Platform tools (76)

`src/core/litfin-ai/actions/tool-registry.ts` (104,463 bytes, 76 tool defs):

| Category | Tools |
|---|---|
| **Data query** | `query-data`, `query-audit`, `query-analytics`, `query-graph`, `query-products` |
| **Web** | `web-search`, `research-topic` |
| **UI / navigation** | `navigate-user`, `switch-tab`, `advance-stepper`, `spotlight-element`, `start-onboarding-tour`, `control-layout`, `control-session`, `set-chat-mode` |
| **Form** | `fill-form`, `explain-platform`, `bulk-ingest-employees-csv` |
| **Workflow** | `trigger-workflow`, `guide-workflow` |
| **Learning** | `teach-concept`, `assess-knowledge`, `assess-starting-level`, `assign-document-quest`, `check-quest-progress` |
| **Financial** | `loan-comparison-flat-vs-reducing`, `loan-rate-difference-impact`, `time-value-calculator`, `total-cost-of-credit` |
| **Business plan** | `generate-business-plan`, `modify-bp-section`, `manage-bp-sections`, `update-financial-assumption`, `regenerate-financials`, `validate-business-plan` |
| **Document AI** | `analyze-document` |
| **Officer ops** | `handoff_agent`, `escalate_to_human`, `acknowledge_escalation`, `schedule_task`, `assign_kpi`, `update_kpi_progress`, `record_meeting_note`, `mark_task_done`, `send_message_to_employee`, `create_employee_from_chat` |
| **Self-coding / autopoiesis** | `self_propose_code_change`, `sandboxed_eval`, `md_sandbox_write/commit/reject/list`, `md_introspect_capabilities`, `md_propose_features`, `md_restore_soft_deleted` |
| **Brain power** | `cross_borrower_pattern`, `compose_tool_chain`, `schedule_action`, `spawn-feature`, `demonstrate-on-blackboard` |
| **Generative UI** | `open_artifact`, `write_to_artifact`, `close_artifact` |
| **Plan-mode (Claude Code parity)** | `md_propose_plan`, `md_respond_plan`, `md_execute_plan_step`, `md_dispatch_subagent`, `md_dispatch_subagent_team`, `md_aggregate_subagent_results`, `md_todo_write`, `md_todo_list`, `md_dry_run_tool_chain` |
| **Governance hooks (4-eye)** | `md_hook_rule_write/list/delete`, `md_hook_audit_list` |

### 2.2 Operator-agent tools (7) — `src/core/brain/operator-agent-tools.ts`

| Tool | MCP_SAFE? | Why |
|---|---|---|
| `emit_ui_block` | ❌ | Chat-renderer-only |
| `propose_sovereign_action` | ✅ | Requires 4-eye approval anyway |
| `read_brain_pulse` | ❌ | Cross-tenant data leak risk (audit fix C2, 2026-05-18) |
| `read_sleep_pass_catalog` | ✅ | Static catalog |
| `describe_sovereign_tool` | ✅ | Schema introspection |
| `simulate_decision` | ❌ | Reads tenant-scoped data without verified MCP tenant context (H1 audit fix) |
| `deep_research` | ✅ | Synthesizes internal + web data |

This audit-aware exclusion logic (filtering by `OPERATOR_TOOLS_MCP_SAFE` allowlist) is **genuinely SOTA** — most frontier projects expose everything blindly via MCP.

### 2.3 Brain-side BrainToolLoopTool registry

`src/core/brain/tool-loop.ts` defines Anthropic-shape `{name, description?, input_schema}` for in-brain tool loops. Separate from the action-side registry. Stream variant in `src/core/brain/stream-tool-loop.ts`.

---

## 3. Connectors framework — full inventory

`src/core/connectors/` ships 7 enterprise connector adapters with a shared `BaseConnector` providing:

| Capability | Implementation | Source |
|---|---|---|
| Auth lifecycle (token + refresh) | `accessToken` + `tokenExpiry` on base class | `base-connector.ts:54-91` |
| Rate limit | Token-bucket, per-connector RPM from `CONNECTOR_RATE_LIMITS` config | `:325-341` |
| Circuit breaker | 3-state (CLOSED→OPEN→HALF_OPEN) with `failureThreshold`/`resetTimeoutMs`/`halfOpenRequests` | `utils/circuit-breaker.ts` |
| Retry | `withRetry` with exponential backoff, `CONNECTOR_MAX_RETRIES` attempts | `:349-374` |
| **SSRF guard** | `validateOutboundUrlWithDns` on **every** outbound URL — DNS resolution included to prevent RFC1918 pivoting through public hostnames | `:299-321` |
| Audit | `getConnectorEventBus().emit(...)` on every push/pull lifecycle event | `:159-167, 220-229, 384-399` |
| Validation | Zod parse of `ConnectorPushRequestSchema` / `ConnectorPullRequestSchema` (request envelope) | `:127-132, 189-194` |
| Health check | Per-connector `doHealthCheck()` with latency record | `:249-274` |

**Registered connectors** (`src/core/connectors/connector-registry.ts:22-429`):

| ID | Vendor | Category | Auth | Capabilities (count) | Required env vars |
|---|---|---|---|---|---|
| `temenos` | Temenos AG | core_banking | oauth2 | 8 (account, transaction, customer, loan-origination, payment, reference, event-streaming, batch) — **256+ T24/Transact APIs across 9 categories** with TIPS/TISS, Kafka event bridge | `TEMENOS_API_URL`, `TEMENOS_CLIENT_ID`, `TEMENOS_CLIENT_SECRET` |
| `mambu` | Mambu GmbH | core_banking | api_key | 4 (loan-accounts, client-management, deposits, webhooks) | `MAMBU_API_URL`, `MAMBU_API_KEY` |
| `cno` | CNO | core_banking | api_key | 3 (customer-records, loan-booking, account-inquiries) | `CNO_API_URL`, `CNO_API_KEY` |
| `avoka` | Temenos AG | core_banking | oauth2 | 3 (application-capture, workflow, documents) | `AVOKA_API_URL`, `AVOKA_CLIENT_ID`, `AVOKA_CLIENT_SECRET` |
| `kony` | HCL Technologies | core_banking | api_key | 3 (push notifications, mobile analytics, mobile data sync) | `KONY_API_URL`, `KONY_API_KEY` |
| `salesforce` | Salesforce | crm | oauth2 | 4 (leads, contacts, opportunities, reporting via SOQL) | `SALESFORCE_INSTANCE_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` |
| `gmail` | Google LLC | email | oauth2 | 4 (sending, thread tracking, label management, contacts) | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` |

**Connector subsystems:**
- `connector-orchestrator.ts` — routes operations across adapters
- `connector-registry.ts` — single source of truth catalog (461 lines, 7 connectors)
- `connector-event-bus.ts` — event emitter (8 event types: CONNECTOR_CONNECTED/DISCONNECTED/ERROR/PUSH_*/PULL_*/RATE_LIMITED/HEALTH_CHECK)
- `connector-bootstrap.ts` — boot-time wiring
- `connector-factory.ts` — instance creation

**Notable Temenos detail (deepest integration):** `src/core/connectors/temenos/` has 13 files including dedicated `loan-origination.ts` (16K), `account-opening.ts` (22K), `batch-operations.ts` (12K), `tips-integration.ts` (Tanzania Instant Payment Settlement, 11K), `kafka-bridge.ts` (9K), `reconciliation.ts` (11K). This is a **production-grade integration with the largest core-banking vendor**, not a thin wrapper.

**SOTA gap:** None of these connectors are exposed as MCP servers. Composio-style federated connector marketplace concept is **absent**. Connector definitions are TS files, not declarative JSON/YAML the way Pipedream/Workato/Composio model them.

---

## 4. Sensors / input ingestion

### 4.1 Sensor router for cognition

`src/core/brain/sensor-routing/router.ts` is **not** about input sensors — it's a **task→model routing layer** (greeting → Haiku; voice_turn → realtime; credit_memo → Opus 4.7 first then Sonnet 4.6 fallback). 9 built-in routes with `cognition_mode_hint` (`fast`/`default`/`deep`) + per-tenant overrides via `task_sensor_routing` table. Cost-aware via `tenant_budget_envelopes` table.

Models referenced (current as of audit):
- `claude.haiku-4-5`, `claude.sonnet-4-6`, `claude.opus-4-7`
- `openai.gpt-5-mini`, `openai.realtime`

This is genuinely SOTA cognitive routing — closest analog is **task-tier-aware routing in Letta v2 / LangGraph**.

### 4.2 Actual input sensors (webhooks, polling, streaming)

| Channel | Implementation | Verification |
|---|---|---|
| **HMAC-verified webhooks** | `src/lib/webhook-verification.ts` — `timingSafeEqual` HMAC-SHA256/SHA1 helper with hex/base64 + prefix support | Centralized, fail-closed, raw-body-first ordering |
| **Stripe webhooks** | `src/app/api/webhooks/stripe/route.ts` | Stripe SDK verifier |
| **Twilio webhooks** | `src/app/api/webhooks/twilio/route.ts` | Twilio signature verifier (hardened — see `__tests__/twilio-signature-hardening.test.ts`) |
| **M-Pesa webhooks** | `src/app/api/webhooks/mpesa/` (`_shared.ts`, `result/route.ts`, `timeout/route.ts`) | M-Pesa challenge/response |
| **Generic mobile money** | `src/app/api/webhooks/mobile-money/route.ts` | HMAC |
| **USSD** | `src/core/ussd/` (8 files including `ussd-handler.ts`, `ussd-menu-tree.ts`, `ussd-session-service.ts`, `decision-flow.ts`) | Africa's Talking USSD pattern |
| **WhatsApp** | `src/core/whatsapp/whatsapp-api-client.ts` + `src/app/api/whatsapp/webhook/` + `src/core/staged-call/whatsapp-stepper-handler.ts` + Twilio adapter `src/core/omnichannel/adapters/twilio-whatsapp-adapter.ts` | Meta WhatsApp Business API + Twilio fallback |
| **Voice (realtime)** | `src/core/voice/realtime-session.ts` supports `openai-realtime` + `elevenlabs-agent`; `wss://api.openai.com/v1/realtime` direct | ephemeral session tokens via `/api/voice/realtime-token` |
| **Voice (LiveKit)** | `src/core/voice/agents/livekit-adapter.ts` | LiveKit SDK |
| **SSE streaming** | `src/core/brain/stream-tool-loop.ts` + `src/core/brain/stream.ts` + `src/core/cdc/projection-stream.ts` + `src/core/voice/streaming/*` | Anthropic SDK `messages.stream()` |
| **CDC** | `src/core/cdc/` — Postgres → Neo4j change-data-capture | LITFIN-internal |
| **Cron polling** | `src/app/api/cron/*` — 33 cron endpoints (heartbeat, sleep-pass, scheduled-brain-actions, learning-consolidation, persona-drift, hash-chain-verify, mission-eval, etc.) | Vercel Cron / GitHub Actions |
| **CSV bulk ingest** | `src/features/central-command/md/juniors/agents/csv-ingest-factory.ts`, `hr-csv-ingest.ts` + `src/core/litfin-ai/actions/tools/bulk-ingest-employees-csv.ts` | LITFIN tool |
| **Brain sensors abstraction** | `src/composition/sensors-wiring.ts` (scaffold port for SensorPort/RetryPolicy/CallLog), `src/core/brain/sensors/qwen-open-weight-sensor.ts` (residual-stream capture for activation probing) | Wiring scaffold + Qwen open-weight sensor for sleeper-agent probe |

**SOTA gap:** No first-class file-watching (no chokidar / fs.watch). No streaming SQL CDC tools (Debezium, Kafka Connect). No event-driven streaming framework (Inngest functions, Trigger.dev workflows).

---

## 5. Action runners (sandboxes / executors)

### 5.1 V8 isolate sandbox (`src/core/litfin-ai/sandbox/js-sandbox.ts`)

**This is genuinely SOTA, May 2026.** Quoting the file header:

> Used by the `sandboxed_eval` brain tool and the `transform` step in `compose_tool_chain`. Runs an arbitrary JS snippet inside a real V8 isolate — same isolation primitive Chrome tabs and Cloudflare Workers use. The isolate has its own V8 heap (16 MB cap), its own event loop, NO Node intrinsics, a true wall-clock timeout.

Hard limits:
- snippet size: 5 KB (capped on **both** UTF-8 bytes AND UTF-16 code-units — explicit audit fix for astral-plane characters)
- heap memory: 16 MB per isolate (V8-enforced)
- wall clock: 1000 ms default, 5000 ms ceiling
- result depth walked to enforce structured-clonable output (max 200 keys per object, depth 8)
- error messages stripped of absolute filesystem paths (information-disclosure audit fix)

**Replaces previous `node:vm` implementation** because Node docs explicitly say `vm` is not a security boundary, citing **OWASP GenAI Q1 2026 round-up flagging `vm`-based sandboxes as a top-three risk for agent platforms**.

**This is materially better than 2026-standard Modal/E2B SaaS sandboxes for cost-sensitive workloads** because it's in-process — no network round-trip, no container cold-start.

### 5.2 DOM-side action executor (`src/core/agentic-action/dom-executor.ts`)

Browser-side mechanical executor that dispatches `CustomEvent`s on `document`. Canonical event names (10):
- `litfin-action-fill-field`, `litfin-action-navigate-tab`, `litfin-action-open-document`, `litfin-action-submit-stepper`, `litfin-action-schedule-call`, `litfin-action-payment`, `litfin-action-send-message`, `litfin-action-delete`, `litfin-action-share`, `litfin-action-autofill-suggest`, `litfin-action-undo`, `litfin-action-close-tab`

**Hard high-stakes gate** — `HIGH_STAKES_INTENTS = ['SUBMIT','PAYMENT','SEND_MESSAGE','DELETE','SHARE']` cannot run without `options.confirmed === true`. The executor returns `awaiting_confirmation` instead.

Theory anchors cited in the file:
- Anthropic Computer Use API (Oct 2024 / refined 2025)
- OpenAI Operator (Jan 2025)
- Karpathy "Software 3.0" (2025)

### 5.3 Cron / scheduler

`scheduled_brain_actions` Postgres table + `/api/cron/scheduled-brain-actions` (cron tick) lets brain queue future tool calls via `schedule_action` tool. **Tier-policy guard** prevents privilege-laundering (a borrower can't queue a `send_message` and have the cron dispatch under admin context — caller's `portal_id` and `user_role` are persisted and rehydrated at fire-time). Audit fix iter-44 CRITICAL #1.

33 cron jobs cover: heartbeat, sleep-pass, learning consolidation, persona drift, hash-chain-verify, mission eval, retention sweep, erasure worker, partition creation, alpha-evolve, canary SPRT, GEPA training, knowledge fetch, mission eval, awake pass, awareness merge audit, etc.

**SOTA gap:** No Inngest/Temporal/Trigger.dev — durable workflows are home-rolled via Supabase cron polling. No saga primitives (`src/core/sagas/` exists but unclear scope).

### 5.4 Browser-research agent

`src/core/desktop-review/browser-research-agent.ts` declares a `computer_use` research mode that "Claude Sonnet 4.6 navigates web portals autonomously (officer-supervised)". Security model: officer-initiated only, never auto-triggers, audit trail, domain whitelist, read-only. **But computer-use beta API headers (`anthropic-beta: computer-use-2024-10-22`) are not wired** — the field is declarative not active.

---

## 6. Agent platform (BYO agents, A2A)

### 6.1 Agent registration / discovery

| Endpoint | Purpose | File |
|---|---|---|
| `POST /api/agent/register` | Bank/admin registers external agent; receives API key + webhook secret (shown once) | `src/app/api/agent/register/route.ts` |
| `GET /.well-known/agent.json` | A2A protocol Agent Card | `src/app/.well-known/agent.json/route.ts` |
| `GET /api/agent/discover` | Tool catalog grouped by category with schemas | `src/app/api/agent/discover/route.ts` |
| `GET /api/agent/tools/search` | Tool search | (route exists) |
| `GET /api/agent/eligibility` | Eligibility check | (route exists) |
| `POST /api/agent/webhooks` | Webhook events | (route exists) |
| `GET /api/agent/health` | Agent health check | (route exists) |
| `GET /api/agent/activities` | Activity log | (route exists) |
| `GET /api/agent/commissions` | Commissions | (route exists) |

### 6.2 A2A Agent Card (`src/core/agent-platform/agent-card.ts`)

Generates Google A2A-protocol-compliant Agent Card at `/.well-known/agent.json`:
- `name`, `description`, `url`, `version`, `provider`
- `capabilities[8]` (credit-assessment, borrower-readiness, learning-engine, product-matching, knowledge-graph, regulatory-compliance, document-verification, portfolio-analytics)
- `authentication.schemes: ['api-key','bearer']` (NOT hmac-sha256 — BOSSNYUMBA's card adds that)
- `tools[76]`, `resources[*]`, `prompts[3]`
- `rateLimit{defaultRpm:60, maxRpm:120, burstLimit:10}`
- Tool category map: data-query, learning, financial, workflow, navigation, general
- Per-tool scope map (`mapToolToScopes`): granular `read:applications`, `write:learning`, `execute:tools`, etc.

**Cited reference:** https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/

### 6.3 Hardened tool registry (`src/core/agent-platform/registry/hardened-registry.ts`)

Signs every tool at registration with `sha256(canonical(metadata) + impl source)`. Registry is `ReadonlyMap` — every mutation produces a **new frozen map** (immutability rule per user's global coding-style.md). Tampering with metadata or impl source is detected at execution time.

Tier filter via `LitFinAITier` (free/cheap/standard/premium) — `listToolsForTier(tier)` returns only tools whose `supportedTiers` includes the requested tier.

### 6.4 Webhook delivery (`src/core/agent-platform/webhook-delivery.ts`, 293 lines)

3-state circuit breaker with `errorThreshold` + `halfOpenAfterMs`; HMAC-signed payload (`whsec_*` secret per agent); replay-safe.

### 6.5 Agent platform — full file set

`src/core/agent-platform/` (8 files, 1429 lines total):
- `agent-auth.ts` — API-key auth + SHA-256 hash + scope check + per-agent rate-limit
- `agent-card.ts` — A2A Agent Card generator
- `correlation-id.ts` — X-Request-Id / X-Correlation-Id propagation
- `error-codes.ts` — ~30 standardized agent error codes
- `idempotency.ts` — `X-Idempotency-Key` + SHA-256 body hash, 24h TTL, 2xx-only cache, conflict on same-key-different-body
- `index.ts`
- `registry/hardened-registry.ts` — signed tool registry
- `types.ts` — `ALL_AGENT_SCOPES`
- `webhook-delivery.ts` — outbound webhook delivery with breaker

---

## 7. Skills (Anthropic-spec compliant)

### 7.1 Skill loader (`src/core/skills/skill-md-loader.ts`)

- Parses `SKILL.md` files with YAML frontmatter + Markdown body
- 256 KB cap, no eval, Zod-validated frontmatter
- Snake-kebab name format, semver version, jurisdiction code (or "GLOBAL")
- Capabilities list — discrete tokens the brain can ask for (`hasCapability("bp_swot_analysis")`)
- Tolerates both camelCase (`mappedTo`, `sectionCount`) and snake_case (`mapped_to`, `section_count`) frontmatter keys

### 7.2 Skill registry (`src/core/skills/skill-registry.ts`)

Pure (no filesystem reads): `makeSkillRegistry(skills: LoadedSkill[])` returns:
- `getByName(name)`
- `list()`
- `listByJurisdiction(code)` — case-insensitive; GLOBAL skills always included
- `listByCapability(capability)`
- `hasCapability(capability)`
- `manifestSummary()` for the system-prompt builder

### 7.3 Published skills (`skills/`)

| Skill | Version | Jurisdiction | Section/Heuristic count | Capabilities |
|---|---|---|---|---|
| `litfin-bp-template` | 1.0.0 | TZ | 12 sections | bp_cover_page, bp_executive_summary, bp_sector_performance, bp_project_location, bp_target_market, bp_swot_analysis, bp_risk_mitigation, bp_management_team, bp_capital_investment, bp_financial_projections, bp_viability_analysis, bp_appendices |
| `litfin-fin-template` | 1.0.0 | TZ | (financial template) | (parallel structure) |
| `litfin-appraisal-template` | 1.0.0 | TZ | (appraisal template) | (parallel structure) |
| `litfin-officer-training` | 1.0.0 | TZ, EN+SW, 12 months | 12 modules | oct_month_01_foundations → oct_month_12_capstone; pairs_with: credit-officer |
| `credit-officer` | 1.0.0 | GLOBAL | **51 heuristics** | 51 capability tokens covering red_flag/amber_warning/green_flag/regulatory_redline categories: ACC_BOUNCED_CHEQUES, ACC_CASH_DOMINANT, BHV_ADDRESS_CHANGES, CAP_DSCR_BELOW_125, COL_TITLE_DEFECT, CPL_DEBT_EQUITY_HIGH, TX_INVENTORY_TURN_DROP, TZ_BOT_APR_CAP, TZ_BRELA_NOT_CURRENT, TZ_CRB_THIN_FILE, TZ_MOBILE_MONEY_VOLUME_MISMATCH, TZ_PEP_SCREENING_HIT, etc. |

Each heuristic in `credit-officer/SKILL.md` includes: id, category, weight, title, signal, predicate (pseudo-code), action, citation URL, Tanzania context. Example:

```
### acc_bounced_cheques
- id: ACC_BOUNCED_CHEQUES
- category: red_flag
- weight: high
- title: Bounced cheques in last 12 months

Signal: Any returned cheque is a red flag; >2 is fatal absent a regulatory remediation letter.
Predicate: bounced_cheque_count_12m >= 1
Action: Flag in credit memo; require senior-officer override before approval. Cite this heuristic.
Citation: https://precisa.in/blog/early-warning-signals-in-credit-appraisal/
Tanzania context: BoT requires reporting via TISS; CRB will reflect.
```

### 7.4 Skill loader (alternate) — `src/core/litfin-ai/agency/`

Parallel skill system at `src/core/litfin-ai/agency/skill-md-loader.ts` (separate from `src/core/skills/`), plus `skill-runner.ts`, `skill-proposal-store.ts`, `curriculum.ts`, `starter-skills/`. **Two parallel skill systems** — this is probably an organic split that needs reconciliation.

### 7.5 Skill passport / award

`src/core/skills-passport/`:
- `passport-service.ts` (16K)
- `skill-mapper.ts` (21K)
- `skill-award-service.ts` (7K)
- `types.ts` (7K)

Borrower-facing skill mastery tracking (BKT — Bayesian Knowledge Tracing). Awards skills as borrowers demonstrate mastery in chat.

---

## 8. Hooks system (PreToolUse / PostToolUse / Stop / UserPromptSubmit)

### 8.1 Hook bus (`src/core/brain/hooks/hook-bus.ts` + `builtin-hooks.ts`)

Built-in hook priorities (lower = fires first, deny-first precedence):
- 10 — killswitch HALT short-circuit (PreToolUse + UserPromptSubmit)
- 20 — tier policy (`assertTierPolicy`)
- 30 — path policy (autopoiesis tools only)
- 40 — feature-flag check (`brain_feature_flags` table: `tool_quarantine:<name>`, `autopoiesis_paused`, `persona_frozen`)
- 50 — rate-limit + DP budget
- 100 — domain-specific gates (default)

### 8.2 Tenant governance hooks DSL (`src/core/governance/hooks/dsl.ts`)

Pure-JS boolean tree, NO `eval`, NO `Function`, NO template strings. Operators are named discriminated-union cases:
- `always`, `never`, `eq`, `neq`, `in`, `contains`, `exists`, `missing`, `gt`, `lt`, `between_hours` (with midnight-wrap semantics), `all`, `any`, `not`

Dotted field paths: `tool`, `input.<key>`, `input.metadata.foo`, `now.hour` (0..23 UTC), `now.minute`, `now.dayOfWeek`.

Persisted in `tenant_governance_hooks` table per tenant per event (`pre_tool_use`, `post_tool_use`, `user_prompt_submit`, `stop`). Decision audit chain in `tenant_hook_audit_log`.

### 8.3 PostToolUse evaluator (`src/core/governance/hooks/post-tool-use.ts`)

Three outcomes:
- `noop` — no matching rules
- `annotate` — rules matched; merge `additionalContext` into next system message
- `followup` — rules matched AND requested a downstream tool call

Decision interpretation:
- `allow` → noop / short-circuit
- `deny`, `ask`, `defer` → annotate with payload reason/prompt
- `mutate` → schedule follow-up tool call if `patch.followupTool` + `followupInput` present

Use-cases (Claude Code parity per file header):
- Append corrective context after tool side-effect
- Reactive automation (escalation → message on-call officer)
- Audit enrichment (log row id + previous state for SOC2)

### 8.4 Per-call evaluation pipeline (NemoClaw)

`src/core/litfin-ai/actions/action-executor.ts:90-317` defines the canonical pre-tool sequence — equivalent to a 7-stage AOP interceptor chain:

1. **RBAC check** (`checkToolPermission`)
2. **Safety validation** (injection in tool parameters via `validateToolCallSafety`)
3. **NemoClaw intent verification** (`verifyIntent` — does this tool call align with user message?)
4. **Agent sandbox** evaluation (deny-by-default policy — `BORROWER_AGENT_POLICY` or `OFFICER_AGENT_POLICY`; admin/litfin-admin portals rely on RBAC)
5. **Budget check** (`checkBudget` — legacy tool-sandbox budget)
6. **Execute** permitted tools via `executeToolCalls`
7. **Tenant-isolation scrub** (`scrubCrossTenantData`) on results — defends against cross-tenant leak
8. **OCSF audit log** (fire-and-forget per tool, includes `tool_category: 'db_query' | 'computation'`)

Plus `applyPostToolHooks` from `_md-action-shared.ts` runs after the handler returns.

This is **functionally an AOP framework** even though there's no AspectJ/decorator syntax. The interception is hand-wired but comprehensive.

---

## 9. Operator-agent SSE chat endpoint (`/api/brain/operator-agent/route.ts`)

The operator chat surface for the LITFIN admin uses `BrainStreamToolLoopRequest` to drive Anthropic native tool-use over SSE. Streams `{kind:"text"|"tool"|"done"}` chunks. Brain orchestration guarantees applied:
- Opus → Sonnet hard-failure fallback on first turn
- Anthropic prompt cache on system prompt (1h ephemeral)
- Anthropic prompt cache on tools array (LAST tool gets `cache_control`)
- Telemetry breadcrumb joined by task name
- Cross-tenant leak detector via `tenantContext`
- `AbortSignal` plumbed end-to-end (client disconnect kills Anthropic stream)

---

## 10. Strict-tool extraction (Anthropic Feb 2026)

`src/core/litfin-ai/extraction/strict-tool-extractor.ts` uses Anthropic's **Strict Tool Use** (Feb 2026, https://docs.anthropic.com/claude/docs/tool-use#strict-mode) to force the model to emit a single `tool_use` block whose `input` matches the given JSON schema **exactly**. Eliminates:
1. Markdown fence parsing (`json ... `)
2. Regex `match(/\{[\s\S]*\}/)` brittleness
3. Silent JSON.parse failures swallowing real model output

Uses `tool_choice: { type:'tool', name:<tool>, disable_parallel_tool_use: true }`. Falls back to `getLLMService().chat()` (OpenAI structured outputs `strict: true`) on strict failure.

**SOTA gap:** This pattern is only used in ONE extraction path (replaces legacy `parseLLMResponse` regex-JSON path in `src/core/conversational-agent/extractors/field-extractor.ts:806`). The other 75 platform tools use non-strict mode.

---

## 11. Multi-modal tool results — gap

Tool results today are TEXT ONLY. `tool-use-adapter.ts:86-100`:

```typescript
content: result.success
  ? JSON.stringify(result.data)
  : `Error: ${result.error ?? 'Unknown error'}`,
```

Claude 4.5+ and GPT-5.2 support multi-modal `tool_result` blocks (image, structured JSON). LITFIN's `analyze-document` tool returns extracted fields as JSON text — fine. But OCR-extracted bank statement images, chart visualizations, or document thumbnails could be returned as `image` blocks for richer downstream reasoning. **Not done today.**

---

## 12. Findings — what the prior 2026-05-18 audit MISSED

The prior audits (`04-sensors-routing.md`, `07-agency.md`, `09-tools-connectors-kg.md`) compared structures and counted lines. This audit finds **5 material things they did not catch:**

### 12.1 `.mcp.json` registers OFF-DOMAIN 3D-modeling servers with PLAINTEXT API KEYS

`Claude Projects/LITFIN PROJECT/.mcp.json` has two MCP servers — `blender-mcp` and `meshy-ai-mcp-server` — with `FAL_KEY` and `MESHY_API_KEY` committed in plaintext. **A fintech platform has zero fintech MCP servers registered in its repo-level MCP config**, but does have 3D modeling. This is either a dev-tools/experimentation file or a security violation, but it's tracked in git either way. BOSSNYUMBA's prior audit (item 5 of `09-tools-connectors-kg.md`) discussed MCP server capability surface but never checked the *actual* registered MCP servers.

### 12.2 V8 isolate sandbox (`isolated-vm` 6.1.x) replaces `node:vm` with audit-cited OWASP justification

`src/core/litfin-ai/sandbox/js-sandbox.ts` is **genuinely SOTA May 2026**. The file header cites OWASP GenAI Q1 2026 flagging `vm`-based sandboxes as top-three risk. UTF-8 + UTF-16 dual-cap on snippet size to defeat astral-plane inflation. Result depth walked. Path stripping on errors. No prior audit mentions this — they classified sandboxing as "PARITY" without noting LITFIN's specific implementation quality is **ahead of typical** (typical fintech uses `node:vm` or shells out to a container per call).

### 12.3 Operator-agent MCP_SAFE allowlist with documented exclusion reasons

`src/core/brain/operator-agent-tools.ts:50-55` explicitly excludes `simulate_decision` (H1 audit, MCP transport doesn't thread authenticated tenant) and `read_brain_pulse` (C2 audit 2026-05-18, executor reads cross-tenant counts without tenant filter). Each exclusion has a citation in the source. This is a **defensive security pattern** that more frontier projects should adopt; no prior audit highlighted it.

### 12.4 Per-tool tier-policy guard in `schedule_action` to prevent privilege laundering

`src/core/litfin-ai/actions/tools/schedule-action.ts:64-73` refuses to queue any tool the caller can't currently invoke. Persists `original_portal_id` + `original_user_role` so the cron rehydrates the caller's context at fire-time instead of escalating to admin. **iter-44 CRITICAL #1 audit fix.** This is the kind of guard that's trivial to forget and catastrophic to omit — most agent frameworks don't have it. Prior audits compared cron infrastructure as "PARITY" without noticing this subtle but vital security property.

### 12.5 Hooks DSL parser explicitly bans `eval` / `Function` / template strings

`src/core/governance/hooks/dsl.ts` is a **pure-JS boolean tree** with named discriminated-union operators — not a string-eval'd expression language. Every operator (`eq`, `in`, `between_hours`, `all`, `any`, `not`, etc.) is a typed case. This means tenant-supplied hook rules can never execute arbitrary code. Most "rules engines" in fintech are Drools/JEXL/MVEL which CAN eval — this is a deliberate, audited choice that's more secure but less expressive. Prior audits noted "rule store" exists, never compared the DSL safety model.

---

## 13. Top-3 SOTA port opportunities (for BOSSNYUMBA)

### Port 1 — V8-isolate sandbox (`isolated-vm` 6.1.x)
**From:** `src/core/litfin-ai/sandbox/js-sandbox.ts`
**Why:** OWASP-grade isolation, sub-ms cold-start, 16 MB heap cap, true wall-clock timeout, structured-clone result scrubbing. Replaces any `node:vm` or shell-out you have today.
**Lift:** Single file, ~500 lines, plus `isolated-vm: ^6.1.2` dep.
**SOTA-2026:** Yes — currently the best in-process sandbox for agent platforms running tenant code.

### Port 2 — Operator-tool MCP_SAFE allowlist + audit-cited exclusions
**From:** `src/core/brain/operator-agent-tools.ts:50-55`
**Why:** Pattern for safely exposing high-power admin tools via MCP. Each exclusion has a reason field citing the audit that prompted it. Defends against the cross-tenant leak class of bugs that prior LITFIN audits caught (H1, C2). BOSSNYUMBA's MCP server (`packages/mcp-server/`) doesn't have this — assume every tool is currently MCP-exposed unless intentionally filtered.
**Lift:** ~30 lines + audit doc.
**SOTA-2026:** Yes — most MCP servers expose blindly.

### Port 3 — Per-tool tier-policy guard in schedule/queue tools
**From:** `src/core/litfin-ai/actions/tools/schedule-action.ts:64-73` + persistence of `original_portal_id` / `original_user_role` in `scheduled_brain_actions` and rehydration at fire-time
**Why:** Prevents privilege laundering through any deferred-execution layer (cron, queue, webhook delivery). The bug class: borrower → tool A → queues tool B → cron runs B under admin context. Trivial to introduce; impossible to detect post-hoc.
**Lift:** ~50 lines per scheduled-tool entry point + DB column additions.
**SOTA-2026:** Yes — agentic platforms with deferred execution should all have this.

---

## 14. Other notable LITFIN patterns (not necessarily SOTA, but worth knowing)

| Pattern | File | Note |
|---|---|---|
| **Strict-tool extraction with Anthropic Feb 2026 API** | `src/core/litfin-ai/extraction/strict-tool-extractor.ts` | Underused — only one call site |
| **3-state circuit breaker with shared `CircuitState` type** | `src/core/connectors/utils/circuit-breaker.ts` + `src/core/risk-mitigation/types.ts` | Two breaker variants coexist for connector-vs-canonical semantics |
| **DOM-side `CustomEvent` action executor** | `src/core/agentic-action/dom-executor.ts` | Clean syscall-layer-of-LLM-OS pattern (Karpathy "Software 3.0" anchor) |
| **5-min undo window with hash-chain audit** | `src/core/agentic-action/reversibility-manager.ts` (`Docs/agentic-action/undo-protocol.md`) | High-stakes intents = `reversible_overall=false`, no token |
| **Open-weight residual-stream sensor for activation probing** | `src/core/brain/sensors/qwen-open-weight-sensor.ts` | Citation: Anthropic sleeper-agent paper arXiv 2401.05566 |
| **A2A `/.well-known/agent.json` endpoint** | `src/app/.well-known/agent.json/route.ts` | Honest Google A2A protocol compliance, not just lip service |
| **Cost-aware multi-tier routing free→cheap→standard→premium** | `src/core/mcp/tier-router.ts` | Tier mapping ready (DeepSeek/Sonnet 4.7/Opus 4.7); auto-downgrade at 85% budget |
| **Universal Tool Adapter format converters (Claude/OpenAI/Generic)** | `src/core/mcp/universal-tool-adapter.ts:349-397` | Same `ToolDefinition[]` → 3 provider formats |
| **Tool-use cache breakpoints (≤2 of Anthropic's 4)** | `src/core/brain/tool-loop.ts:228-254` | Tools-array breakpoint + system-prompt breakpoint |

---

## 15. Inventory totals

| Inventory | Count | Source |
|---|---|---|
| Platform tools (action-side) | 76 | `src/core/litfin-ai/actions/tools/` (71 files + 5 grouped) |
| Operator-agent tools (brain-side) | 7 | `src/core/brain/operator-agent-tools.ts` |
| MCP-safe operator tools | 4 | `OPERATOR_TOOLS_MCP_SAFE` |
| Registered external MCP servers | 2 | `.mcp.json` (Blender, Meshy) |
| Enterprise connectors | 7 | `src/core/connectors/connector-registry.ts` (Temenos, Mambu, CNO, Avoka, Kony, Salesforce, Gmail) |
| Published skills | 5 | `skills/` |
| Heuristics in `credit-officer` skill | 51 | `skills/credit-officer/SKILL.md` |
| Cron jobs | 33 | `src/app/api/cron/` |
| Webhook routes | 4 categories (M-Pesa, Mobile-Money, Stripe, Twilio) | `src/app/api/webhooks/` |
| `core/` subsystems | 161 | `src/core/*/` |
| Anthropic SDK version | 0.72.1 | `package.json` |
| MCP SDK version | 1.26.0 | `package.json` |
| `isolated-vm` version | 6.1.2 | `package.json` |
| Built-in sensor routes | 9 tasks | `src/core/brain/sensor-routing/router.ts:110-296` (`greeting`, `voice_turn`, `explanation`, `5c_score`, `officer_review`, `regulatory_audit`, `credit_memo`, `sovereign_write`, `form_field_help`) |

---

*Audit conducted 2026-05-23 against LITFIN main branch at the snapshot date. Compared against SOTA 2026 frontier: MCP spec 2025-06-18 (and 2025-11 draft features), Anthropic Claude Agent SDK with skills/hooks/subagents, Anthropic computer use beta + tool_use parallel + prompt caching + strict tool use, OpenAI strict function calling + Realtime API, Google ADK + A2A protocol, IBM ACP, ANP, LangGraph 1.0, AutoGen 0.5+, Letta v2, Composio, isolated-vm 6.x, Modal, E2B, Browserbase, Inngest, Temporal, Trigger.dev.*
