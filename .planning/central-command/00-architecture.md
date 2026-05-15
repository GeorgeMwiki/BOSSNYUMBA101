# Central Command — Architecture Synthesis

> Synthesis of 5 research/audit reports (May 2026). Source notes:
> - `2025-agentic-admin-patterns.md` (R1)
> - `2025-generative-ui.md` (R2)
> - `2025-progressive-intelligence.md` (R3)
> - `2025-brain-as-os.md` (R4)
> - `2025-bn-internal-gap-audit.md` (Internal)

## Vision

The internal admin portal (`apps/admin-platform-portal/`) is a **Central Command**: the
admin can run the entire BOSSNYUMBA company by chatting with the brain. The brain
**senses** every user interaction (mouse, scroll, focus, current page), **acts**
across every cell of the body (fills forms, creates users, renders charts, triggers
workflows), and **learns** continuously from every signal (explicit thumbs +
implicit copy/re-prompt/edit/override).

> **Brain controls every cell. Mouse moves = touching the brain's skin. The OS IS
> the brain's neural network.**

## The Central Command Pattern — 8 layers

Adopted from R1's synthesis ("Metadata-Driven Typed-Action Bus with Subagent Fan-out
and Generative UI Surface"):

1. **Conversational surface** (Vercel AI SDK 5/6 + `useChat`, with AG-UI Protocol)
2. **Presence packet** (route, selection, focus, last query) — every turn
3. **Orchestrator** (Claude Agent SDK + LangGraph `interrupt()` for HIL)
4. **Typed action registry** (metadata-bounded — agent CANNOT invent tools)
5. **Risk-tiered HIL gate** (Permit.io / four-eye-approval / LangGraph interrupt)
6. **MCP bus** (2025-11-25 spec — Tasks for async, URL Elicitation for OAuth)
7. **Permission-aware retrieval** (identity is the boundary, not the prompt)
8. **OTel + Phoenix audit fabric** (every span, tool, decision logged + replayable)

## Stack decisions (locked)

| Layer | Choice | Rationale |
|---|---|---|
| Brain↔UI wire | **AG-UI Protocol** (SSE, typed events) | CopilotKit-led standard adopted by Google/LangChain/AWS/MS |
| Chat UI | Vercel AI SDK 5+ UIMessage parts | RSC `streamUI` officially paused; tool-result rendering wins |
| Agent runtime | `@anthropic-ai/claude-agent-sdk` | Battle-tested loop, hooks, subagents, skills |
| Workflow orchestration | LangGraph (`interrupt()` + checkpointing) | HIL gates, pause/resume, DAG state |
| Tool protocol | MCP 2025-11-25 (Tasks, Sampling, URL Elicit) | Industry standard, async long-running ops |
| HIL gateway | Permit.io + existing four-eye-approval | Approval-as-tool pattern |
| Chart engine | **Vega-Lite v5** | Pure JSON, ajv-validatable, near-zero invalid-spec rate (VegaChat 2026) |
| Form engine | TanStack Form + Zod + zod-to-json-schema | Single source of truth: schema → form + tool input + DB validator |
| Data table | TanStack Table v8 | Sort/filter/CSV, JSON-driven |
| KPI tiles | Tremor + shadcn Chart | Pre-built financial-dashboard primitives |
| Map | react-leaflet + OSM | No Mapbox token cost in TZ |
| Calendar | FullCalendar v6 | Lease renewals, inspections, KRA deadlines |
| File preview | react-pdf + shadcn Sheet | Owner statements, leases |
| Memory: extraction | Mem0 single-pass ADD | Cheapest ingestion stage |
| Memory: temporal KG | Zep / Graphiti pattern (bi-temporal validity) | "Tenant X lived in 4B Jan-Mar" → queryable at time T |
| Memory: skill registry | Voyager-style | NL description, embedding, success/fail counts, tenant scope |
| Memory: per-session reflection | Reflexion (Shinn et al., NeurIPS 2023) | +22% AlfWorld, no weight updates |
| Memory: per-turn reflection | Self-RAG (IsREL/IsSUP/IsUSE tokens) | 5.8% hallucination rate (lowest of 12 RAG variants) |
| Sleep-time compute | 8-stage nightly worker | Expand existing K2.2 consolidation-worker |
| Prompt optimization | DSPy GEPA/MIPROv2 weekly | External memory only; base model immutable |
| Realtime sync | tRPC v11 SSE + Liveblocks 3.0 rooms | Liveblocks: humans + agents as first-class peers |
| Durable agent | **Inngest AgentKit primary, Temporal for hardest 5%** | TypeScript-first, deterministic Router |
| Observability | Langfuse self-hosted + Arize Phoenix | OTel GenAI semconv; Helicone is maintenance mode |
| Sensors | PostHog autocapture pattern, **14-event filtered taxonomy** | NOT keystroke-level; mouse.move @ 4Hz session-replay only, never LLM context |
| Browser perception | a11y tree, NOT DOM | 93% token savings (Playwright MCP, Chrome DevTools MCP, Stagehand 2.0 all switched) |
| Last-resort actuator | Anthropic Computer Use beta `computer-use-2025-11-24` | Only for legacy vendor portals with no API |

## Anti-stack (do NOT pick)

- Replicache (maintenance mode — Rocicorp pivoted to Zero)
- Triplit (acquired by Supabase)
- Helicone (March 2026 maintenance mode — founders moved to Mintlify)
- Pusher/Ably with tRPC (paid-priority-only, forks transport)
- Stateful WebSocket in serverless (use SSE or Durable Object)
- Vercel AI SDK v4 RSC `streamUI` (officially paused — use v5 UIMessage parts)
- LLM emitting raw JSX (brittle + injection vector — emit values against typed primitives)
- LLM modifying form schemas (privilege escalation — schemas are server-owned)
- LLM-emitted Tailwind classes (purged in prod build — primitives own classnames)
- DOM in prompts (use a11y tree)
- Mouse-move events to LLM (session-replay only)
- Computer Use as default (prosthetic, not hand — vision-only on structured UIs → wrong-clicks)

## Sensory event taxonomy (14 events)

Per R4's PostHog convergence. Each event has `(tenantId, userId, sessionId, surface, route, timestamp, payload)`:

| Event | When | Payload |
|---|---|---|
| `page.view` | Route enter | `{ route, referrer, sessionMs }` |
| `page.leave` | Route exit | `{ route, dwellMs }` |
| `element.click` | Any click | `{ targetTagName, targetText (truncated), targetId, route }` |
| `input.change` | After 300ms debounce + PII-redact | `{ fieldName, valueLength, hasPii, route }` |
| `form.submit` | Form submit | `{ formName, fieldCount, route }` |
| `scroll.depth` | At 25/50/75/100% only | `{ route, percent }` |
| `dwell.time` | On exit, ≥2s only | `{ route, dwellMs }` |
| `focus.change` | Window focus/blur | `{ focused: boolean }` |
| `keyboard.shortcut` | Cmd/Ctrl combos only | `{ combo, route }` |
| `copy.paste` | Selection-derived | `{ direction: 'copy'\|'paste', selectionLength }` |
| `viewport.resize` | After 300ms debounce | `{ width, height }` |
| `network.request` | Failures + >1s slow only | `{ url, status, durationMs }` |
| `error.boundary` | React error caught | `{ componentStack (truncated), errorName }` |
| `a11y.tree.diff` | A11y subtree change | `{ route, addedRoles, removedRoles, focusedRole }` |

**Mouse.move @ 4Hz**: session-replay only, never LLM context. (PostHog separates "activity" replay from "events" analytics.)

## Action authority ladder (motor output)

Per R4's analysis, low → high authority:

1. `render-widget` (generative UI subtree)
2. `mutate-state` (setState on shared room)
3. `fill-form` (typed action — `useCopilotAction`)
4. `scroll-to` / `highlight` / `focus` (attention primitives)
5. `navigate` (router push — reversible)
6. `run-server-action` (server-enforced RBAC)
7. `run-durable-workflow` (Inngest / Temporal — SOX-grade)
8. `computer-use` (last resort — never as primary actuator)

Every action emits **`tool_call` + `tool_response` audit pair** (IETF draft Agent Audit Trail format — `draft-sharif-agent-audit-trail`).

## HIL safety primitives

Per R1's synthesis — production-validated:

1. **Pre-execution approvals only** — never retroactive
2. **Risk tiers**: `read` / `mutate` / `destroy` / `billing` / `external-comm`
3. **Challenge-and-response approvals** — 5-item checklist (intent / data lineage / permissions chain / blast radius / rollback plan)
4. **Counter-model sanity check** — second LLM reviews destructive actions
5. **Metadata-bounded action surface** — agent cannot invent tools
6. **Identity-scoped retrieval** — agent only sees what asking admin can see
7. **Tamper-resistant audit** — every call recorded; reversible
8. **EU AI Act Article 14 + NIST AI RMF compliance**

## Progressive intelligence cadence

Per R3 — tiered cost from cheap to expensive:

| When | What | Touches |
|---|---|---|
| Per-turn sync | Self-RAG reflection tokens; emit trace + thumbs widget | In-context only |
| Per-turn async | Mem0 ADD extracts facts before next turn | External memory |
| Hourly | Langfuse automation rules; aggregate low-thumbs; LLM-judge 1% sample | External memory |
| Nightly (sleep) | Reflexion summary; Voyager skill curation; Zep entity consolidation; decay; community-merge | External memory |
| Weekly | DSPy GEPA/MIPROv2 recompile prompts against new traces + golden set | Prompts |
| Monthly (rare) | QLoRA adapter retrain on curated high-signal data; A/B before promote | Weights |

**External memory only — base model immutable until a new adapter ships through separate release.**

## 8-stage nightly sleep-time consolidation

Expand existing `services/consolidation-worker`:

1. **Ingest** — day's traces, thumbs, overrides, edit-diffs (with `trace_id + agent_action_id` join key)
2. **Cluster** — embedding clustering by intent / failure mode
3. **Reflect** — LLM critic writes "what went well / what failed / next time" per cluster
4. **Promote** — recurring success → skill library entry; recurring failure → prompt patch + regression eval seed
5. **Decay** — existing `memory-decay.ts` hook
6. **Consolidate** — Zep-style community detection merges duplicate entities
7. **Re-embed** with current embedding model version
8. **Publish** "brain delta" event so caches refresh; emit OTel + Langfuse summary

## Implicit feedback signals (>99% of value)

Per R3 — explicit thumbs are <1% of interactions. Must capture:

| Signal | Strength | Capture point |
|---|---|---|
| Thumbs + free-text on thumbs-down | Highest (rare) | Existing FeedbackThumbs.tsx |
| **Copy-to-clipboard on AI answer** | High implicit | `apps/*/components/AIResponse` |
| **Re-prompt within 30s** | High negative | Conversation gap analysis |
| **Edit-and-resubmit of agent draft** | Very high — granular correction | Diff agent output vs final saved row |
| **Admin override of agent-suggested action** | Critical — "RLHF on rails" | Already audited; needs labelling |
| Time-to-resolution after AI suggestion | Medium outcome proxy | Tickets/chats outcome attribution |
| Abandonment mid-turn | Medium frustration | Stream cancellation |

All signals must join via `(trace_id, agent_action_id, tenant_id, user_id, surface, role)`.

## Brutal gaps (from internal audit)

1. HQ has no write vocabulary — only 5 PM tools, **no `platform.create_tenant`, `platform.create_user`, `platform.killswitch_set`, `platform.run_consolidation_tick`**.
2. `admin-platform-portal` has **zero generative UI** — JarvisConsole renders plain text only.
3. "Brain skin" is anaesthetised — `BehaviorObserver` + 1485-LOC learning-loop have no production callers.
4. `/ask` on admin-platform-portal is a 503 stub — literally returns "intelligence-service not wired for platform scope".
5. Consolidation is a stub key-value extractor — no real Haiku consolidator wired.
6. Wake-loop has no HQ-tier triggers — all 3 detectors are agency-scope.
7. No durable execution layer — process crash leaves goals in `running`.
8. No cross-portal fan-out — SSE per-caller only.

## Phase A — implementation plan (this wave)

6 parallel agents, file-isolated:

| Agent | Scope | Closes |
|---|---|---|
| **C1 AG-UI Wire** | AG-UI emitter + `/admin/jarvis/stream` upgrade + client hook | Gap #1, #4 |
| **C2 HQ Tool Vocabulary** | 12+ HQ-tier BrainTools (platform.*) + risk-tier registry | Gap #1 (write vocab) |
| **C3 Generative UI Primitives** | 10 typed UI primitives (Vega chart, table, timeline, KPI, prefill-form, approval, workflow, map, calendar, file-preview) | Gap #2, #4 (display layer) |
| **C4 Sensorium / Brain Skin** | 14-event sensory bus client + a11y-tree perception + presence packet + BehaviorObserver wire-up | Gap #3 |
| **C5 Progressive Intelligence** | 8-stage sleep-time consolidation + Voyager skill registry + Self-RAG + Reflexion + implicit feedback joins | Gap #5 + learning loop closure |
| **C6 Durable Execution + Cross-Portal** | Inngest AgentKit integration + cross-portal Redis pubsub + HQ-tier wake triggers | Gap #6, #7, #8 |

## Phase B (next wave, separate PR)

- DSPy GEPA weekly prompt recompilation
- QLoRA adapter training pipeline (only after prompts hit ceiling)
- Constitutional critic for nightly RLAIF labelling
- Counter-model sanity check on destroy-tier actions
- Liveblocks 3.0 rooms (when collab editing surfaces emerge)
- Browser-Use AXTree perception for legacy vendor portals

## Phase C (later, when scale demands)

- LoRA adapters per top-3 tenants by volume
- Temporal workflows for SOX/regulator-grade actions (eviction, large payouts)
- Tenant-scoped QLoRA fine-tuning pipeline
- Active learning loop with operator labelling queue
