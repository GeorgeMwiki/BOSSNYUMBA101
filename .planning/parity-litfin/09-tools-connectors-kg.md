# Tools / Connectors / KG / Agent-Platform / MCP Parity — LITFIN vs BOSSNYUMBA101

> **Status as of 2026-05-18** — see `00-STATUS-2026-05-18.md`. Of the 4 missing + 5 partial items below, **6 are now SHIPPED** and **1 is in-flight in Phase D9 (Ed25519 signed tool registry + denylist)**. After Phase A/B/C the BOSSNYUMBA-AHEAD count grew from 7 → 10 on this surface. The 2026-05-15 "BOSSNYUMBA has only 2 adapters" line below is OUTDATED.
>
> Headline shipments (all in `00-STATUS-2026-05-18.md` §3):
> - ✅ **BrainToolSpec registry — 510 LOC + 18 platform tools** — `kernel/tool-spec.ts:510`. **BOSSNYUMBA AHEAD** vs LITFIN's 4 brain-side tools (closes Gap A). See §3 item 3.
> - ✅ **MCP prompts (5 canonical)** — `packages/mcp-server/src/prompts.ts:347` registers `tenant-onboarding`, `arrears-resolution`, `maintenance-triage`, `lease-renewal-assessment`, `eviction-pre-check` (closes Gap B).
> - ✅ **Connector orchestration + registry + health-scheduler** — `packages/connectors/src/{registry,orchestrator,health-scheduler}.ts` (closes Gap C).
> - ✅ **Tenant-scoped Cypher helper** — `packages/graph-sync/src/client/neo4j-client.ts:71-82` `executeReadScoped(tenantId, cypher, params)` asserts `$tenantId` presence at the helper boundary (closes Gap D).
> - ✅ **Temporal entity graph + Louvain community detection** — `packages/database/src/services/temporal-entity-graph.{service,louvain}.ts` (922 LOC) + migration `0140_temporal_entity_graph.sql`. **BOSSNYUMBA AHEAD** vs LITFIN's KG which has bi-temporal indexes but no Louvain. See §3 item 13.
> - ⚠️ **Tool-call denylist + Ed25519 signed tool registry** — Phase D9 in flight. Registry will be signed at boot; denylist persists in `kernel-tool-policy` table.
> - ✅ **Agent platform HMAC + idempotency + correlation-id parity** — already at parity per original doc. No change.

P9 of the 10-agent parity sweep. Read-only analysis of the **tool registry, MCP server, connectors framework, Neo4j knowledge graph, and agent-platform DNA**.

Surfaces compared:

| Surface | LITFIN root | BOSSNYUMBA root |
|---|---|---|
| Tool registry (brain side) | `src/core/brain/tools.ts` (230) | (no kernel-internal brain registry; tool exec deferred to agent-loop) |
| Tool registry (action side) | `src/core/litfin-ai/actions/tool-registry.ts` | `packages/mcp-server/src/tool-registry.ts` (289) |
| MCP server | `src/core/mcp/litfin-mcp-server.ts` (320) | `packages/mcp-server/src/bossnyumba-mcp-server.ts` (375) |
| MCP auth | `src/core/mcp/mcp-auth.ts` (183) | `packages/mcp-server/src/mcp-auth.ts` (246) |
| MCP tier-router / cost | `src/core/mcp/tier-router.ts` (255) + `cost-persistence.ts` (262) | `tier-router.ts` (184) + `cost-persistence.ts` (156) |
| Universal tool adapter | `src/core/mcp/universal-tool-adapter.ts` (431) | `packages/mcp-server/src/universal-tool-adapter.ts` (319) |
| Connectors framework | `src/core/connectors/base-connector.ts` (414) + 8 siblings | `packages/connectors/src/base-connector.ts` (583) + sinks |
| Connector orchestrator | `src/core/connectors/connector-orchestrator.ts` (167) + `connector-registry.ts` (461) | — |
| Neo4j client | `src/core/graph/neo4j-client.ts` (~200) | `packages/graph-sync/src/client/neo4j-client.ts` (~300) |
| Neo4j schema | `src/core/graph/schema/constraints.cypher` (132) + `init-schema.ts` (181) | `schema/constraints.ts` (224) + `node-labels.ts` (137) + `relationship-types.ts` (173) |
| Graph agent toolkit | `src/core/graph/queries/index.ts` (8 query fns: connected-parties, fraud, risk-prop, similar-cases, portfolio-conc, audit, search, lineage) | `queries/graph-agent-toolkit.ts` (392) + `graph-query-service.ts` (866) |
| Agent platform | `src/core/agent-platform/` (8 files, 1429 lines) | `packages/agent-platform/src/` (8 files, 1334 lines) |

## Summary

| Topic | LITFIN | BOSSNYUMBA | Status | Gap |
|---|---|---|---|---|
| 1. Brain-side tool registry shape | `BrainToolSpec` with `{name, description, inputSchema, category, run}` + `registerBrainTool`/`getBrainTool`/`listBrainTools`/`renderToolsAsContext`/`executeBrainTool` (`brain/tools.ts:27-229`) | — (no kernel-internal registry — kernel records `toolCalls` but agent-loop executes) | MISSING | BOSSNYUMBA has no `<tool_call>`-style deterministic tool layer the kernel can invoke; cross-checked by P1 step-7 finding. |
| 2. Action-side tool registry shape | `ToolDefinition[]` with handlers in a `Map<string, ToolHandler>` (`litfin-ai/actions/tool-registry.ts:80…`, ~40 tools) | `McpToolDefinition[]` Object.frozen array w/ `{name, description, inputSchema, requiredInputs, requiredScopes, minimumTier, estimatedCostUsdMicro}` (`mcp-server/src/tool-registry.ts:16-283`, 12 tools) | NAMED-DIFFERENTLY | BOSSNYUMBA registry is **declarative-only** — handlers wired by composition root. LITFIN registry **owns handlers** as imports. BOSSNYUMBA adds `minimumTier` + `estimatedCostUsdMicro` per tool; LITFIN puts cost in `litfin-cost-config` outside the registry. Same end shape, opposite ownership polarity. |
| 3. Tool dispatch policy | `executeBrainTool(name, input)` → result; wrapped via tool-use-adapter for Claude tool_use (`actions/tool-registry.ts`) | `wrapToolHandler(toolDef, handler, {tierRouter, recordCost, getMonthlySpend})` validates input → scopes → tier → executes → records cost (`universal-tool-adapter.ts:36…`) | PARTIAL | BOSSNYUMBA's wrapper is **stricter** (scope gate, tier gate, cost cap, size cap `MAX_INPUT_BYTES=1_000_000`); LITFIN's brain-side registry has no scope/tier guard and no per-call cost (those live in `tool-result-gate.ts` / `policy-gate.ts`). Different layering. |
| 4. Tool audit per call | LITFIN audits via `provenance.ts` + `tool-result-gate.ts` (cross-tool contradiction check) + `mcp/cost-persistence.ts` | BOSSNYUMBA's wrapper writes a `McpCostEntry` per call via `recordCost` batcher (`universal-tool-adapter.ts` + `cost-persistence.ts`) | PARITY | Both write per-tool-call cost+latency rows. LITFIN additionally surfaces tool numerical contradictions into the kernel's confidence scorer; BOSSNYUMBA does not. |
| 5. MCP server handler set | `tools{}` + `resources{}` + `prompts{}` + `logging{}` capabilities; registers tools from `PLATFORM_TOOLS`, static resources, resource templates, prompts (`litfin-mcp-server.ts:42-200`) | `tools` (via `invokeTool`) + `staticResources` + `templateResources` + `costSnapshot` + `flushCosts` + `shutdown` (`bossnyumba-mcp-server.ts:76-99`) | NAMED-DIFFERENTLY | LITFIN binds directly to `@modelcontextprotocol/sdk`'s `McpServer`; BOSSNYUMBA returns a transport-agnostic value object + an `attachToMcpServer` helper. **BOSSNYUMBA exposes no `prompts` capability** — gap. |
| 6. MCP auth model | OAuth 2.0 client-credentials + token cache + refresh (`mcp/mcp-auth.ts:23-110`) — primarily for OUTBOUND calls to external MCP servers | API-key (`X-Api-Key: bnk_...`) + JWT Bearer (HS256) → tenant + tier + scopes (`mcp-auth.ts:1-246`) | NAMED-DIFFERENTLY | Both AUTH layers solve different sides: LITFIN's `mcp-auth.ts` authenticates LitFin → external MCP servers; BOSSNYUMBA's authenticates external callers → BOSSNYUMBA MCP. The inbound-auth analog in LITFIN lives in `agent-platform/agent-auth.ts`. **Each project has one half of what the other has on this surface.** |
| 7. Connector base contract — auth | `auth refresh` via `accessToken` + `tokenExpiry` on base class (`base-connector.ts:54-91`) | `ConnectorAuth` union: `bearer` / `api-key` / `basic` / `oauth2` with single-attempt refresh-on-401 (`base-connector.ts:20-28, 168-191, 437-472`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA supports four auth kinds with declarative `ConnectorAuth`; LITFIN's base only has token-cache primitives + concrete connectors implement their own OAuth. BOSSNYUMBA's oauth2 401-then-refresh-retry-within-same-attempt is a closer match to RFC 6749 than LITFIN's pre-emptive `tokenExpiry` check. |
| 7. Connector base contract — retry | `withRetry` with `CONNECTOR_MAX_RETRIES` + exponential delay `CONNECTOR_RETRY_BASE_MS * 2^attempt` (`base-connector.ts:349-374`) | retry with `jitter(initialDelayMs * 2^(attempt-1))` ±20%; only retries 5xx + transport (not 4xx) (`base-connector.ts:200-204, 494-498`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA adds jitter (avoids retry storms) and is explicit about 4xx-no-retry; LITFIN retries every error indiscriminately. |
| 7. Connector base contract — circuit breaker | `CircuitBreaker` class (in `utils/circuit-breaker.ts`) with closed/half-open/open + `failureThreshold`/`resetTimeoutMs`/`halfOpenRequests` (`base-connector.ts:322-326`) | Inline `CircuitState` with closed/half-open/open + `errorThreshold` + `halfOpenAfterMs` + `maybeHalfOpen()` (`base-connector.ts:125-130, 252-287, 393-405`) | PARITY | Both implement the same three-state breaker. LITFIN supports `halfOpenRequests` quota; BOSSNYUMBA promotes one probe at a time. Both emit `circuit-opened` / `circuit-closed` events. |
| 7. Connector base contract — audit | `emitEvent` to event bus per push/pull (`base-connector.ts:159-167, 220-229`) + audit through Supabase elsewhere | **First-class `AuditSink` port** writes `{connectorId, path, method, outcome, latencyMs, inputHash, outputHash, idempotencyKey}` on every call (`base-connector.ts:85-96, 289-315`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA's audit is a structured row with **SHA-256 hash of input + output** (canonicalised via `stableStringify`) — required for regulator-grade reproducibility. LITFIN's equivalent lives in adjacent `provenance.ts` and is keyed to brain decisions, not connector calls. |
| 7. Connector base contract — events | `getConnectorEventBus().emit(...)` with 8 event types (`CONNECTOR_CONNECTED/DISCONNECTED/ERROR/PUSH_STARTED/PUSH_COMPLETED/PUSH_FAILED/PULL_STARTED/PULL_COMPLETED/PULL_FAILED/RATE_LIMITED/HEALTH_CHECK`) (`base-connector.ts:384-399` + `connector-event-bus.ts`) | `ConnectorEventSink` port with 8 event kinds (`request/response/error/rate-limited/circuit-opened/circuit-half-open/circuit-closed/auth-refreshed`) (`base-connector.ts:64-84, 243-250`) | NAMED-DIFFERENTLY | Same event-bus pattern. LITFIN's events are **lifecycle-oriented** (push/pull start/complete), BOSSNYUMBA's are **transport-oriented** (request/response/circuit transitions). LITFIN lacks `circuit-half-open` / `auth-refreshed` events. |
| 7. Connector base contract — rate limit | `TokenBucketRateLimiter` from `utils/rate-limiter.ts`, bucket size from `CONNECTOR_RATE_LIMITS[connectorId]` (`base-connector.ts:314-321, 329-341`) | Inline token bucket (`refillBucket` at `base-connector.ts:193-198, 407-421`) with `rpm` + optional `burst` | PARITY | Same algorithm, different placement. BOSSNYUMBA returns `rate-limited` outcome + retry-after; LITFIN throws a `Rate limited — retry after Xms` error. Outcome-vs-exception is the only diff. |
| 7. Validation | Zod parse via `ConnectorPushRequestSchema` / `ConnectorPullRequestSchema` (`base-connector.ts:127-132, 189-194`) | Per-request `inputSchema` / `outputSchema` (Zod) hooks on `ConnectorRequest<I>` (`base-connector.ts:50-51, 386-391, 527-540`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA validates **output too**; LITFIN only validates the request envelope shape. Output validation is critical for upstream-API contract drift. |
| 7. Connector orchestration | `connector-orchestrator.ts` (167) routes across `mambu`/`temenos`/`kony`/`avoka`/`cno`/`salesforce`/`gmail` adapters + `connector-registry.ts` (461) with status, healthcheck scheduler | `adapters/credit-bureau-adapter.ts` + `mpesa-adapter.ts` only; no orchestrator, no registry, no health scheduler | MISSING | BOSSNYUMBA has only 2 adapters and zero registry/orchestrator/scheduler around them. LITFIN ships 7 adapters + multi-adapter orchestration + scheduled healthchecks. |
| 8. KG — Neo4j schema | 25 node-label constraints + ~30 indexes (`org_id_*`) + `entity_search` fulltext + relationship `valid_from/valid_to` indexes (`schema/constraints.cypher:1-133`) | 35 node labels grouped by 9 bounded contexts (Org/Property/People/Contract/Ops/Finance/Legal/Market/Timeline) + relationship-type catalogue + `_id`+`_tenantId`+`_syncedAt`+`_sourceTable`+`_version` base props enforced (`schema/node-labels.ts`, `schema/relationship-types.ts`, `schema/constraints.ts`) | NAMED-DIFFERENTLY | Both multi-tenant-scoped. **BOSSNYUMBA enforces optimistic concurrency `_version` per node and a `_sourceTable` provenance column**; LITFIN does not. LITFIN enforces **bi-temporal `valid_from/valid_to`** indexes on every relationship; BOSSNYUMBA only carries `since`/`until` as optional. Distinct strengths. |
| 8. KG — agent toolkit shape | `query-graph` tool routes to 8 query fns in `graph/queries/*` (`connected-parties, fraud-detection, risk-propagation, similar-cases, portfolio-concentration, audit-trail, entity-search, data-lineage`). Each returns `{ ok, data, evidencePaths? }`. | `GraphToolDefinition[]` (~25 tools) wrapping `GraphQueryService`, with Zod params + `evidenceSummary` + `executionTimeMs` returned per call. (`queries/graph-agent-toolkit.ts:24-91, 94+`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA has **25 graph tools** (case-timeline, tenant-risk, vendor-scorecard, unit-health, parcel-compliance, property-rollup, evidence-pack, portfolio-overview, graph-stats, unit-occupancy-timeline, …) vs LITFIN's 8. Both attach evidence to results. LITFIN's evidence is a path of node-IDs; BOSSNYUMBA's is a free-text `evidenceSummary` (less machine-readable). |
| 8. KG — upsert / remove primitives | `executeRead<T>(cypher, params)` + `executeWrite<T>(cypher, params)` with mandatory `orgId` in params (`neo4j-client.ts:93-130`); per-domain upserts in `graph/sync/node-mappers.ts` + `edge-mappers.ts` | `Neo4jClient.readQuery / writeQuery / readTransaction / writeTransaction` (no mandatory tenantId at client level — caller must inject `$tenantId`) (`client/neo4j-client.ts:170-229`) + `sync/graph-sync-engine.ts` + `sync/batch-sync.ts` | PARTIAL | LITFIN's client **forces `orgId` into every params object** at the helper boundary; BOSSNYUMBA's client is tenant-blind — tenant scoping is the caller's responsibility. **Risk: forgetting `$tenantId` in a Cypher leaks cross-tenant data.** Closure: add an `executeReadScoped(tenantId, cypher, params)` helper that asserts presence. |
| 8. KG — sync pipeline | `graph/sync/graph-sync-pipeline.ts` + `realtime-cdc.ts` (CDC) + `sync-scheduler.ts` + `node-mappers.ts` + `edge-mappers.ts` | `sync/graph-sync-engine.ts` + `sync/batch-sync.ts` only — no CDC, no scheduler | PARTIAL | BOSSNYUMBA syncs in batch only; LITFIN supports realtime CDC from Postgres → Neo4j. P4 finding likely overlaps. |
| 9. Agent platform — agent-card schema | `AgentCard` with `{name, description, url, version, provider:{org,url,contact}, capabilities, authentication:{schemes,registrationUrl,tokenUrl}, tools, resources, prompts, rateLimit:{defaultRpm,maxRpm,burstLimit}}` (`agent-platform/agent-card.ts:68-172`) | Same shape minus `prompts`; auth `schemes: ['api-key','bearer','hmac-sha256']` (LITFIN: `['api-key','bearer']`) (`agent-platform/agent-card.ts:22-105`) | PARITY | Shape is identical except: **(a)** BOSSNYUMBA includes `hmac-sha256` scheme advertisement; **(b)** BOSSNYUMBA omits `prompts[]` (LITFIN lists 3 named prompts). |
| 9. Agent platform — auth scheme | `requireAgentAuth(request, requiredScopes?)` — API key in `X-Agent-API-Key` header, hashed via SHA-256, looked up against Supabase `agent_registry`, per-agent rate limit, status check (`agent-auth.ts:63-240`) | `verifyAgentRequest({registry, …}, request, requiredScopes?)` — **HMAC-SHA256 over canonical `${method}\n${path}\n${ts}\n${bodyHash}`** with 5-min clock-skew window + constant-time compare + storage-agnostic `AgentRegistry` port (`agent-auth.ts:34-271`) | NAMED-DIFFERENTLY | **Material upgrade in BOSSNYUMBA**: HMAC body-binding + replay protection (timestamp window) + constant-time compare. LITFIN's API-key-only scheme is vulnerable to header replay across endpoints (same key signs every call). |
| 9. Agent platform — idempotency | `X-Idempotency-Key` + SHA-256 body hash, **24h TTL**, only POST/PUT/PATCH, only 2xx cached, conflict on same-key-different-body, fail-open on DB error (`idempotency.ts:50-168`) | Same: `X-Idempotency-Key` + SHA-256 body hash, **24h TTL**, only POST/PUT/PATCH, only 2xx cached, conflict on same-key-different-body, **storage-agnostic `IdempotencyStore` port** + in-memory ref impl (`idempotency.ts:69-145`) | PARITY | Identical semantics. **Key derivation** = `key + agentId` in both. **TTL** = `24*60*60*1000` in both. BOSSNYUMBA decouples storage; LITFIN is Supabase-coupled. |
| 9. Agent platform — correlation-id | `X-Request-Id` / `X-Correlation-Id` header → fallback `crypto.randomUUID()`; `correlationHeaders()` + `injectCorrelationId(Headers, id)` (`correlation-id.ts:14-38`) | Same primitive, plus `forwardHeaders(id, extra)` helper to seed next-hop calls (`correlation-id.ts:13-43`) | PARITY | BOSSNYUMBA adds a small ergonomic `forwardHeaders` helper. Otherwise identical. |
| 9. Agent platform — webhook delivery | `agent-platform/webhook-delivery.ts` (293 lines) | `agent-platform/webhook-delivery.ts` (211 lines) | PARTIAL | BOSSNYUMBA implementation is ~30% smaller — likely missing some retry/replay/sig-rotation. Not deep-read for this slice. |
| 9. Agent platform — error-codes | 278 lines, ~30 codes | 234 lines, similar code set | PARITY | Same shape, slightly leaner BOSSNYUMBA list. |

**Counts**
- Full parity: 6 (agent-card shape, idempotency, correlation-id, error-codes, circuit-breaker, rate-limit-bucket, tool-audit).
- Partial: 5 (dispatch policy, KG upsert scoping, KG sync pipeline, webhook-delivery, action-side tool registry).
- Named-differently: 7 (action registry ownership polarity, MCP handler-set, MCP auth direction, connector events, agent-auth scheme, KG schema discipline, MCP server return shape).
- Missing in BOSSNYUMBA: 4 (brain-side `BrainToolSpec` registry, MCP `prompts` capability, connector orchestrator/registry/healthcheck-scheduler, tenant-scoped Cypher helper).
- Extended in BOSSNYUMBA: 7 (connector ConnectorAuth union, retry jitter, audit-sink with hashed input/output, output-schema validation, agent-auth HMAC, idempotency storage-agnosticism, graph agent toolkit cardinality).

## Detailed gaps

### Gap A — Brain-side deterministic tool registry (`BrainToolSpec`)
- **LITFIN**: `src/core/brain/tools.ts:21-179` registers `dscrTool`, `amortizationTool`, `cccTool`, `botLookupTool` as `BrainToolSpec` (`{name, description, inputSchema, category, run}`). Renders as `<tool_call>{...}</tool_call>` block in the system prompt (`renderToolsAsContext`, line 185). The kernel intercepts the block, runs `executeBrainTool(name, input)`, feeds result back.
- **BOSSNYUMBA**: No equivalent. Kernel records `toolCalls` but never executes (per P1, step 7 missing). Tools live one layer up in `packages/mcp-server/src/tool-registry.ts` and are exposed to MCP — they cannot be reached from the kernel's own turn loop.
- **Risk**: Numeric/regulatory questions the kernel asks itself (e.g. arrears coverage ratio, statutory notice period) are answered by the LLM's intuition rather than a provable function. For a regulated property-management product (PPA, rent caps) this is the same compliance-defence weakness P1 flagged.
- **Closure effort**: moderate. Mirror `BrainToolSpec` + `executeBrainTool` into `packages/central-intelligence/src/kernel/`, register a starter set (e.g. `calc.rent_arrears`, `calc.late_fee`, `lookup.tz_pa_statute`), wire `<tool_call>` interception in `thinkOnce`. Roughly 250 lines.

### Gap B — MCP `prompts` capability
- **LITFIN**: `litfin-mcp-server.ts:42-55` declares `prompts: {}` capability and registers `credit-assessment`, `borrower-readiness`, `portfolio-analysis` prompts at `registerPrompts` (line 185-200).
- **BOSSNYUMBA**: `bossnyumba-mcp-server.ts` exposes only `tools` + `resources`. No `prompts[]` array on the server object, no prompt registration. The agent-card also omits `prompts` (compare `agent-platform/agent-card.ts` LITFIN line 149-165 vs BOSSNYUMBA line 22-105).
- **Risk**: External MCP clients (Claude Desktop, Cursor) cannot discover BOSSNYUMBA's canonical workflows. Each integration partner must rewrite "how do I do X" prompts themselves.
- **Closure effort**: small. Add a `prompts: ReadonlyArray<McpPromptDefinition>` to the server type, register 3-5 canonical prompts (`tenant-onboarding`, `arrears-resolution`, `maintenance-triage`, `lease-renewal-assessment`), expose on agent-card.

### Gap C — Connector orchestration layer (registry + healthcheck scheduler)
- **LITFIN**: `connectors/connector-registry.ts` (461 lines) holds the live status of every adapter; `connector-orchestrator.ts` (167) routes across them; `connector-bootstrap.ts` registers defaults; sibling `mcp/health-scheduler.ts` runs background healthchecks.
- **BOSSNYUMBA**: only `adapters/credit-bureau-adapter.ts` + `adapters/mpesa-adapter.ts` exist. There is no registry / orchestrator / bootstrap / scheduler under `packages/connectors/src/`.
- **Risk**: When M-Pesa or the credit bureau goes down, BOSSNYUMBA can't multiplex to a backup, can't observe the failure ahead of time, and can't expose `/api/health/connectors` without ad-hoc wiring at the gateway.
- **Closure effort**: moderate. Port `connector-registry.ts` (~300 lines slimmed) + `connector-orchestrator.ts` (~150) + a `healthcheck-scheduler.ts` (~80). Keep storage injectable.

### Gap D — Tenant-scoped Cypher helper
- **LITFIN**: `graph/neo4j-client.ts:84-130` defines `GraphQueryParams extends { orgId: string }` and the `executeRead<T>(cypher, params)` signature requires it at the type level. Forgetting `orgId` is a TypeScript compile error.
- **BOSSNYUMBA**: `client/neo4j-client.ts:170-199` exposes `readQuery<T>(cypher, params: Record<string, unknown> = {})`. Nothing in the type system requires `tenantId`. The 25 graph-toolkit tools all hand-thread `$tenantId` into Cypher, but a future tool can silently omit it.
- **Risk**: Cross-tenant read on a single forgotten `WHERE n._tenantId = $tenantId`. Hard to catch in code review; impossible to catch in CI without a Cypher linter.
- **Closure effort**: small. Add `interface TenantScopedParams { tenantId: string }` and `readQueryScoped<T>(cypher, params: TenantScopedParams & Record<...>): Promise<T[]>` that asserts the cypher contains `$tenantId`.

### Gap E — Connector audit-sink hash discipline (extension to port back)
- **BOSSNYUMBA wins**: `base-connector.ts:85-96` defines `AuditSink.audit({connectorId, path, method, outcome, latencyMs, inputHash, outputHash, idempotencyKey})` and computes `inputHash` / `outputHash` via `sha256Hex(stableStringify(value))` (lines 141-151). Every connector call leaves a regulator-grade reproducibility row.
- **LITFIN**: no equivalent — connector observability is event-only, no hashed input/output.
- **Recommendation**: this gap is REVERSE — BOSSNYUMBA's audit pattern should be backported to LITFIN, not the other way. Flag in cross-project sync.

### Gap F — Agent-auth HMAC (extension to port back)
- **BOSSNYUMBA wins**: `agent-auth.ts:109-129` builds canonical string `${method}\n${path}\n${timestamp}\n${bodyHash}` + HMAC-SHA256 + 5-min replay window + constant-time compare (`timingSafeEqual` at line 96).
- **LITFIN**: API-key only. Same key signs every request; no replay window; vulnerable to header replay.
- **Recommendation**: REVERSE gap. LITFIN should adopt BOSSNYUMBA's HMAC scheme. Flag for cross-project sync.

### Gap G — Connector output-schema validation
- **BOSSNYUMBA**: `base-connector.ts:527-552` validates the upstream response against `req.outputSchema` (Zod) before returning `ok`. Contract drift on M-Pesa/CRB returns `validation-failed` immediately and the circuit breaker counts it as a failure.
- **LITFIN**: only validates the *request* envelope (`ConnectorPushRequestSchema` at line 127-132). Upstream contract changes silently corrupt downstream state.
- **Recommendation**: REVERSE gap. Backport to LITFIN.

### Gap H — Tool-registry handler ownership polarity
- **LITFIN**: `litfin-ai/actions/tool-registry.ts` **imports 40+ tool handlers directly** and exports a `Map<name, handler>`. Tight coupling — adding a tool means editing the registry file.
- **BOSSNYUMBA**: `mcp-server/src/tool-registry.ts:16-283` is **purely declarative** (frozen array of `McpToolDefinition`); handlers are injected at composition time via `BossnyumbaMcpDeps.handlers: HandlerMap`. New tools = new file + register at gateway.
- **Recommendation**: keep BOSSNYUMBA's polarity. This is the better pattern — LITFIN's import-coupled style is a known refactor target in that codebase.

### Gap I — Action-side tool registry size
- **LITFIN**: ~40 tools (`query-data, query-audit, query-analytics, query-products, query-graph, teach-concept, assess-knowledge, research-topic, assign-document-quest, check-quest-progress, loan-comparison-flat-vs-reducing, loan-rate-difference-impact, time-value-calculator, total-cost-of-credit, guide-workflow, trigger-workflow, fill-form, navigate-user, explain-platform, web-search, switch-tab, advance-stepper, control-session, set-chat-mode, assess-starting-level, spotlight-element, start-onboarding-tour, generate-business-plan, modify-bp-section, manage-bp-sections, update-financial-assumption, regenerate-financials, validate-business-plan, control-layout, spawn-feature, analyze-document, demonstrate-on-blackboard, open/write/close-artifact, handoff-agent, sandboxed-eval, schedule-action, cross-borrower-pattern, compose-tool-chain, self-propose-code-change`).
- **BOSSNYUMBA**: 12 tools (`query_property_graph, get_tenant_risk_profile, list_maintenance_cases, create_maintenance_case, generate_letter, query_arrears_projection, list_occupancy_timeline, query_ai_cost_summary, list_compliance_plugins, get_maintenance_taxonomy, get_warehouse_inventory, run_skill`).
- **Risk**: domain-appropriate gap. BOSSNYUMBA's `run_skill` universal-dispatch tool is the safety valve (line 263-281). The smaller surface is justified by the smaller maturity — but tutoring/learning/spotlight/workflow-control category tools are entirely absent. P5 (UX) likely flags more.
- **Closure effort**: not a single fix — this gap closes as domain features ship.

### Gap J — Connector events not lifecycle-aware
- **LITFIN**: emits lifecycle events `CONNECTOR_PUSH_STARTED` / `CONNECTOR_PUSH_COMPLETED` / `CONNECTOR_PUSH_FAILED` / mirror set for `PULL` (`base-connector.ts:138-167, 200-244`).
- **BOSSNYUMBA**: emits transport events `request` / `response` / `error` / `rate-limited` / `circuit-*` / `auth-refreshed` (`base-connector.ts:64-84, 243-250`).
- **Risk**: observability dashboards that read "pushes per minute, failed pushes per minute" must be rebuilt at the BFF/audit layer because the transport-level stream doesn't say "this was the M-Pesa push for invoice X".
- **Closure**: add a higher-level `operation` field on the `ConnectorEvent` envelope, or have callers emit their own application-level event around the `connector.call()`.

## Three highest-leverage gaps

1. **Connector orchestration layer** (Gap C) — BOSSNYUMBA has 2 adapters and zero registry/orchestrator/healthcheck-scheduler. Real M-Pesa/CRB outages will not multiplex to fallbacks and won't be observable. ~600 lines to port; high blast-radius win.

2. **Tenant-scoped Cypher helper + missing brain-side `BrainToolSpec` registry** (Gaps A + D) — these compound: the KG client doesn't enforce tenant-scoping at the type system, and the kernel can't deterministically reach KG queries from inside its own turn. Together they cap how much of the agent's reasoning can be both safe and provable. Closure unlocks regulator-grade auditability.

3. **MCP server prompts capability** (Gap B) — small fix but high external-integration leverage. Without `prompts[]` on the agent card, no partner platform (Claude Desktop, Cursor, future BFFs) can discover BOSSNYUMBA's canonical workflows ("how do I run an arrears resolution?"). The cost is ~80 lines of code; the benefit is every integration partner stops reinventing.

## Reverse-direction gaps (BOSSNYUMBA → LITFIN)

These are surfaces where **BOSSNYUMBA is ahead**. Flag for cross-project sync; not closure targets for this sweep:

- Connector `AuditSink` with `inputHash` + `outputHash` (Gap E)
- Agent-auth HMAC with replay protection + constant-time compare (Gap F)
- Connector `outputSchema` validation (Gap G)
- Tool-registry handler-ownership polarity (Gap H)
- Connector retry jitter (avoids retry storms)
- ConnectorAuth union type (`bearer | api-key | basic | oauth2`)
- Idempotency storage-port abstraction (LITFIN is Supabase-coupled)
- Optimistic-concurrency `_version` + `_sourceTable` on KG nodes
