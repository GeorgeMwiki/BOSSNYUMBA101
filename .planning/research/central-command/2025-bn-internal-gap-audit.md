# BOSSNYUMBA Internal Brain — Central Command Gap Audit

**Date:** 2026-05-15
**Branch:** main (post wave-K-final-zero / wave-K-tier2+3)
**Vision under test:** Internal admin (`apps/admin-platform-portal`) should let HQ run the whole company by chat — brain fills places, fills fields, creates things, controls everything; users = "touching the brain's skin"; progressive intelligence everywhere.
**Scale:** 0 = doesn't exist · 5 = production-grade Central Command parity.

Note: the audit treats `apps/admin-platform-portal/` as the canonical internal admin (Next.js, port 3020). `apps/admin-portal/` is the deprecated Vite landing (`apps/admin-portal/DEPRECATED.md:1`) and is excluded from scoring.

---

## 1. Brain core (post-wave-K)

| Capability | Evidence | Score |
|---|---|---|
| 14-step kernel pipeline (K1 + K8) | `packages/central-intelligence/src/kernel/kernel.ts:267` (createBrainKernel, 2096 lines); step list in `decision-trace.ts:26-46` (`KernelStepName`) | 5 |
| Tool registry (K9 BrainToolRegistry, 5 PM seed tools) | `packages/central-intelligence/src/kernel/tool-spec.ts:74-217` (registry), `:443-501` (`registerSeedBrainTools`); seeded at `services/api-gateway/src/composition/brain-kernel-wiring.ts:315-320` | 4 |
| Sovereign-tier action ledger + fail-closed | `packages/central-intelligence/src/kernel/agency/executor/executor.ts:64-100` (ledger port + `SOVEREIGN_TIER_ACTION_NAMES`), env switch `SOVEREIGN_LEDGER_FAIL_CLOSED` via `service-registry.ts:readSovereignLedgerFailClosedFromEnv` | 5 |
| Decision-trace recorder | `packages/central-intelligence/src/kernel/decision-trace.ts:1-269`; wired through `BrainKernelDeps.traceRecorder` (`kernel.ts:203`) | 4 |
| Persona-drift detection | `packages/central-intelligence/src/kernel/persona-drift/{alert,vectors}.ts`; 24-dim probe vs `BOSSNYUMBA_REFERENCE_PERSONA`, threshold 0.15 / 0.075 | 4 |
| Memory hierarchy (episodic / semantic / procedural / reflective) | `packages/central-intelligence/src/kernel/memory/` types, services wired in `services/api-gateway/src/composition/sovereign.ts:270-281` (Drizzle migration 0121) | 4 |
| Embedder (OpenAI text-embedding-3-small) | `packages/central-intelligence/src/kernel/embedder.ts:1-284` (OpenAI + null sentinel); kernel slot `kernel.ts:245` | 4 |
| Approval policy + four-eye | `packages/central-intelligence/src/kernel/four-eye-approval.ts:1-480`; role-group quorum + recall + re-auth | 5 |

**Section verdict:** brain core is production-strong. **Gap:** the 5 PM seed tools (lookupTenantArrears, computeKraMri, checkComplianceCertificate, getMarketRateBand, triageMaintenanceTicket — `tool-spec.ts:504-510`) cover read/compute only. There is NO "create-tenant", "add-user", "run-cron", "kill-switch", "warehouse-query", "FX-rate-refresh", "feature-flag-flip" tool in either the BrainToolRegistry OR the 5 action-tool stubs (`agency/action-tools/stubs.ts:1-145`). Internal admin operations are not in the brain's vocabulary.

---

## 2. Conversational admin command — write/execute path

| Capability | Evidence | Score |
|---|---|---|
| Admin chat surface | `apps/admin-platform-portal/src/app/jarvis/JarvisConsole.tsx:1-353` (`/jarvis` route, streaming + voice + image attach) | 4 |
| Mission-eval chat surface (read-only audit) | `apps/admin-platform-portal/src/app/mission-eval/MissionEvalClient.tsx:1-467` | 4 |
| `Ask` / industry chat surface | `apps/admin-platform-portal/src/app/ask/page.tsx` + `AskChat.tsx:1-100` | 3 (proxy route is 503: `api/platform/intelligence/thread/[threadId]/message/route.ts:11-16` — *"intelligence-service not wired for platform scope"*) |
| Brain can add/remove users via chat | **No tool exists.** No `user.create` / `user.disable` / `user.invite` in any registry. | 0 |
| Brain can create/delete tenants via chat | **No tool exists.** No `tenant.create` / `tenant.disable` / `tenant.purge`. | 0 |
| Brain can run cron / consolidation / wake-loop on demand | Wake-loop cron is auto-scheduled (`composition/wake-loop-cron.ts:1-100`) and the consolidation loop runs hourly (`services/consolidation-worker/src/consolidation.ts:282`), but there is **no chat-callable trigger**. | 1 |
| Brain can mutate any DB state with audit-grade safety | Only the 5 stubbed action-tools (`stubs.ts:138-144`: rent.send-reminder, work-order.create, inspection.schedule, arrears.escalate, listing.publish) + 4 real adapters bound at `agency-port-bindings.ts`. Domain ops only — no platform-admin mutations. | 2 |
| Brain can answer "what is currently happening?" with real telemetry | Static pages exist (`/system-health`, `/control-tower`, `/webhook-dlq`, `/ai-costs`) but the brain has no tool to query them. No `system.current_status` BrainTool. | 1 |

**Section verdict:** the brain *talks*; it does not *act* at HQ scope. The 4-eye gate exists (`POST /actions`, `POST /actions/:id/sign` in `routes/jarvis-router-factory.ts:526-583`) but the only `toolName`s that can be proposed are the 5 PM domain tools — so a sovereign-tier proposal like "disable tenant XYZ" or "rotate API key" is **structurally unreachable through chat today**.

---

## 3. Generative UI — does the brain create UI?

| Capability | Evidence | Score |
|---|---|---|
| 12 UI block types defined | `packages/chat-ui/src/generative-ui/types.ts:18-30` (`UIBlockType`) + `block-generator.ts` + `AdaptiveRenderer.tsx` | 4 |
| Renderer wired to customer-app / owner-portal / estate-manager-app | `apps/customer-app/src/app/page.tsx`, `apps/owner-portal/src/pages/{ManagerChat,OwnerAdvisor}.tsx`, `apps/estate-manager-app/src/app/coworker/training/page.tsx` | 4 |
| Renderer wired to **admin-platform-portal** | **No.** `grep` returns zero hits across `apps/admin-platform-portal/**`. `JarvisConsole.tsx` only renders plain text + confidence + citations (`:191-244`). | 0 |
| Chat → chart (arrears trends, occupancy, KRA filings) | Block types exist (`arrears_projection_chart`, `lease_timeline_diagram`, `maintenance_case_flow_diagram`) but none target HQ-scope analytics (occupancy roll-up, KRA file-status, AI spend). | 1 |
| Chat → pre-filled form (add-user / create-tenant / file-MRI) | **No form block.** Closest is `action_buttons` (`types.ts:138-148`) — labels only, no form schema. | 0 |
| Chat → data table with live filters | `property_comparison_table` (`types.ts:62-68`) is static. No sort/filter/pagination contract. | 1 |
| Chat → timeline / event log | `lease_timeline_diagram` exists; no generic "event log" block. | 1 |
| Chat → KPI cluster | **No block type.** `insight_card` is single-metric. | 0 |
| Chat → approval prompt with diff preview | Approval flow has POST `/actions` (`jarvis-router-factory.ts:526-540`) and persona-drift caveats but no UI block renders a diff. | 1 |
| Streaming UI elements over SSE / WS | SSE protocol exists at `/admin/jarvis/stream` (`jarvis-router-factory.ts:349-449`) — text deltas only. **No `ui_delta` / `state_delta` / `tool_call_args_delta` events.** AG-UI parity gap. | 1 |

**Section verdict:** generative UI is present but built for tenant-facing chat (rent calculators, 5 Ps wheels, quizzes). HQ never sees it; HQ has no blocks for the operations it actually runs (tenants list, cron schedule, secrets vault, feature-flag toggles, AI spend chart, webhook DLQ table).

---

## 4. Sensory awareness — does the brain feel the user?

| Capability | Evidence | Score |
|---|---|---|
| `BehaviorObserver` primitive exists | `packages/ai-copilot/src/ambient-brain/behavior-observer.ts:1-319` (idle, error, navigation_back, form_submit_attempt, rapid_deletion) | 4 |
| `page-context-registry` exists | `packages/ai-copilot/src/ambient-brain/page-context-registry.ts:1-189` (5 manager/owner routes registered) | 3 |
| Ambient-brain middleware on api-gateway | `services/api-gateway/src/middleware/ambient-brain.middleware.ts:1-65` records *server-side* `field_focus` for `(METHOD path)` only. | 2 |
| Browser-side capture (mouse / scroll / focus / dwell) | **None.** No `onMouseMove`, `IntersectionObserver`, autocapture lib, or PostHog/OTel browser-instrumentation in `apps/admin-platform-portal/**`. | 0 |
| Current page / route in kernel context | `ThoughtRequest.surface` carries portal id (`tenant-app` / `admin-portal` / `platform-hq`) — coarse only. No `currentRoute` / `currentSelection`. | 1 |
| Current selection / hover | **Not captured anywhere.** | 0 |
| Form-in-progress is part of brain context | Behavior-observer tracks `fieldId` + `field_error` but no UI emits these events. | 0 |
| Copy-paste / keyboard shortcuts | **No capture.** | 0 |
| Admin-portal subscribes to ambient interventions | `ambient-brain.middleware.ts:22-39` only logs; **no SSE / WS push to the frontend**. | 0 |

**Section verdict:** the "brain's skin" exists in code but is anaesthetised. Zero browser-side perception events leave the admin portal. The `BehaviorObserver` is a server-side event recorder for HTTP requests, not a sensory surface.

---

## 5. Progressive intelligence — does the brain learn?

| Capability | Evidence | Score |
|---|---|---|
| FeedbackThumbs collects signals | `POST /jarvis/feedback` (`jarvis-router-factory.ts:104-111`), persisted via `createFeedbackService(db)` | 4 |
| Kernel **reads** feedback at step 4 | `kernel.ts:164` (`feedback` dep), `loadFeedbackRecent` / `renderFeedbackFragment` mix corrections + negative-rate into the system prompt | 4 |
| CoT reservoir processed by consolidation | `services/consolidation-worker/src/consolidation.ts:1-300` (hourly tick, pull 24h unconsolidated, group by (tenant, user), upsert facts). But consolidator is `createStubConsolidator` (1 fact per N turns, fixed `recent-topic` key — `:133-157`) — **no real Haiku consolidator wired** outside the gateway's runner (`composition/consolidation-runner.ts:1-361` exists but uses heuristic summarisation). | 2 |
| Consolidation improves prompts / tool selection over time | Facts persist into `semantic_facts`; kernel reads them at step 4 via `loadSemanticFacts` (`kernel.ts:1620`) → mixes into system prompt. **No tool-selection bandit, no prompt-variant A/B.** | 2 |
| Implicit signals (copy, edit, re-prompt) captured | **None.** | 0 |
| Tool / skill library grows from successful turns (Voyager-style) | **No mechanism.** BrainToolRegistry is boot-time-only; no runtime registration from agent loops. | 0 |
| A/B testing of prompt variants in production | **Not wired.** No prompt-variant table, no eval harness routing. | 0 |
| Eval-driven prompt iteration | `parity-capability-dashboard.factory.ts` exists; `/mission-eval` page lets ops re-judge runs (`MissionEvalClient.tsx:140-159`). **Re-judging updates a row; it does not feed prompt changes back.** | 2 |
| Sleep-time / offline consolidation | Consolidation worker is a sleep cycle in spirit. Reflective digests (`loadReflectiveDigest` `kernel.ts:1690`) exist as a read path; the writer is the consolidation tick. | 3 |
| Learning-loop primitives (reflection, policy proposer) | `packages/ai-copilot/src/learning-loop/*` (1485 LOC: outcome-capture, pattern-extractor, policy-proposer, reflection, dry-run-gate, confidence-scorer). **`grep` shows zero callers** outside the package's own tests. | 0 |

**Section verdict:** the brain "remembers" but does not "improve". The learning-loop pipeline is dead code; the consolidator is a stub key-value extractor; no closed loop from eval → prompt → kernel.

---

## 6. Always-on durable execution

| Capability | Evidence | Score |
|---|---|---|
| Wake-loop cron is scheduled | `services/api-gateway/src/composition/wake-loop-cron.ts:1-100` — pg_advisory_lock-guarded, 15-min default cadence | 4 |
| Wake-loop has real detectors | `packages/central-intelligence/src/kernel/agency/initiative/real-detectors.ts` (arrears-30d, lease-expiring-30d, vacancy-30d); stub variants at `wake-loop.ts:150-181` | 3 |
| Stall-detector | `packages/central-intelligence/src/kernel/agency/stall-detector.ts:1-355` with thresholds, audit reader, event sink | 4 |
| Stall-detector acts (creates self-heal proposals) | Emits proposals; gateway wires `eventSink.emit` to event bus + `four-eye approval` (per `agency/index.ts:48-72`). | 3 |
| Background workers proactively suggest admin actions | `packages/central-intelligence/src/kernel/proactive-nudge.ts:1-122` + `packages/ai-copilot/src/proactive-loop/proactive-orchestrator.ts`. **No HQ-tier nudge source wired** (`grep` shows orchestrator referenced only by `forecast.router.ts:7,116,205-207` and `vacancy-pipeline.router.ts`, both org-scope). | 2 |
| Durable workflows (Inngest / Trigger.dev / Temporal) | **None.** Only `setInterval`-based loops + pg_advisory_lock. No durable saga retry; a process crash mid-tool-execution leaves the goal `running` until next wake. | 1 |
| Action-tool retries on transient failure | Executor bails on first tool failure (`agency/executor/executor.ts` docstring `:13-15`). | 1 |
| HQ-scope wake triggers | All 3 wake triggers are tenant-scoped (arrears / leases / vacancy). **No HQ-scope triggers** (subscription churn, AI cost overrun, webhook DLQ depth, persona-drift breach, killswitch HALT). | 1 |

**Section verdict:** durable execution exists for the AGENCY tier; HQ has no autonomous loop. Crash-safety is at-most-once.

---

## 7. Cross-portal command surface

| Capability | Evidence | Score |
|---|---|---|
| Personal Jarvis on all 4 portals | `routes/jarvis-router-factory.ts:184-217` (surface → persona + grounding-role); SSE streaming on every portal (`apps/{customer,owner-portal,estate-manager-app,admin-platform-portal}/...`) | 4 |
| Admin chat reads HQ-tier state (KPI roll-up, billing, subscriptions) | Brain has `world-model-tool` + `graph-tools` but no `platform.overview` / `platform.subscriptions` / `platform.billing` / `platform.ai-cost` tools. The HQ pages fetch directly from `/api/platform/*` REST routes; brain doesn't see them. | 1 |
| Admin chat reads customer-portal state (live ticket, lease in progress) | `kernel` has tenant-scoped grounding (`roleForSurface` `:207-217`) but **cross-tenant introspection is denied by design**: HQ scope falls into `kind: 'platform'` and only DP-aggregate cohort signals are available (`sovereign.ts` config). HQ literally cannot "look into" a tenant chat from the brain. | 2 |
| Admin can DRIVE actions across all 4 portals | **No cross-portal action tool.** HQ cannot say "send a notification to tenant X" or "pin a notice on owner-portal" through the brain. | 0 |
| Real-time push from brain → all UI surfaces | SSE flows brain → ONE caller; no fan-out room (Liveblocks / Yjs / Redis pubsub). Other portals do not receive nudges from HQ in real time. | 1 |
| Per-tenant killswitch is operator-reachable | `KillswitchPort` exists (`kernel.ts:195`) and HALT/DEGRADED is enforced server-side. **No chat tool to flip it.** Operator must hit DB / config directly. | 2 |

**Section verdict:** the 4 portals all *have* Jarvis; they are not federated under HQ control. HQ has neither read access (correctly — DP isolation) nor write authority into other portals' chat surfaces.

---

## Top 20 priority gaps (ranked by user-impact × implementation-effort)

Scored 1-5 on **impact** (how much it unlocks Central Command) and **effort** (1 = days, 5 = weeks). Priority = impact / effort, ties broken by impact.

| # | Gap | Impact | Effort | Builds on | Scope of work |
|---|---|---|---|---|---|
| 1 | **AG-UI streaming protocol (text + tool_call + state_delta + ui_delta) on /admin/jarvis/stream** | 5 | 2 | existing SSE in `jarvis-router-factory.ts:349-449`; chat-ui `useJarvisStream` | Add typed event kinds (`tool_call_start`, `state_delta`, `ui_block`); upgrade `ChatPanel` to dispatch into a `useCoAgent`-style reducer; wire the renderer to mount UI blocks streamed mid-turn. |
| 2 | **HQ BrainToolRegistry — add 12 platform-admin tools** (`platform.create_tenant`, `platform.disable_tenant`, `platform.create_user`, `platform.disable_user`, `platform.list_subscriptions`, `platform.set_feature_flag`, `platform.killswitch_set`, `platform.run_consolidation_tick`, `platform.run_wake_cycle`, `platform.ai_cost_today`, `platform.webhook_dlq_depth`, `platform.system_health`) | 5 | 3 | `tool-spec.ts:443-501` (`registerSeedBrainTools`); 4-eye gate already wired | Each tool gets `schemaIn/Out` + executor backed by existing services; sovereign tools get added to `SOVEREIGN_TIER_ACTION_NAMES`; register at `brain-kernel-wiring.ts:315`. |
| 3 | **Wire generative UI renderer into admin-platform-portal/jarvis** | 5 | 2 | `packages/chat-ui/src/generative-ui/AdaptiveRenderer.tsx`; `JarvisConsole.tsx:191-244` (text-only today) | Replace plain-text bubble with `<MessageBubble blockSlot={<AdaptiveRenderer blocks={uiBlocks} />} />`; parse `ui_block` SSE events into state. |
| 4 | **Three HQ-scope UI blocks: `kpi_cluster`, `data_table_interactive`, `form_prefill`** | 5 | 3 | `generative-ui/types.ts:18-30` enum + `block-generator.ts` | Add Zod schemas, renderers, generator emitters. `data_table_interactive` needs sort/filter/pagination + row-click action contract. `form_prefill` needs JSON-schema → React Hook Form mapper. |
| 5 | **Browser-side perception adapter (autocapture-equivalent)** | 4 | 2 | `BehaviorObserver` (`ambient-brain/behavior-observer.ts:1-319`) | Ship a `useAmbientPresence(observer)` hook that wires `onMouseMove` (throttled 1s), `onFocus`, `onBlur`, `IntersectionObserver`, `clipboard` events; POST batched to `/api/platform/ambient-events`. Mount in `admin-platform-portal/src/app/layout.tsx`. |
| 6 | **SSE channel: brain → admin-portal "interventions" stream** | 4 | 2 | `ambient-brain.middleware.ts:22-39` (currently only logs) | Convert observer subscription into per-user SSE feed at `GET /api/v1/admin/jarvis/interventions/stream`; client renders toasts + auto-opens chat with pre-seeded prompt. |
| 7 | **Per-user `currentRoute` + `currentSelection` in `ThoughtRequest`** | 4 | 2 | `kernel-types.ts` `ThoughtRequest`; `surface` field already there | Extend `ThoughtRequest` schema; thread through gateway `/think` + `/stream`; mix into the kernel's identity-render prompt fragment so the brain knows where the operator is sitting. |
| 8 | **HQ-scope wake triggers** (`subscription.churn-spike`, `ai-cost.threshold-breach`, `webhook-dlq.depth-breach`, `persona-drift.breach`, `killswitch.halt-active`) | 4 | 2 | `wake-loop.ts:150-181` (3 existing stubs); `wake-loop-cron.ts:1-100` (scheduler) | One `WakeTrigger` per signal source; detectors read from existing services (`ai-cost-report`, `webhook-dlq-router`, persona-drift store). Goals routed to platform-tier persona. |
| 9 | **Real Haiku consolidator (replace `createStubConsolidator`)** | 4 | 3 | `consolidation.ts:133-157` (stub); `consolidation-runner.ts:1-361` (gateway runner skeleton) | Implement a per-group LLM summariser that emits typed semantic facts (`preferred-channel`, `escalation-style`, `goal-completion-rate`) instead of the fixed `recent-topic` key. |
| 10 | **Closed eval-loop: mission-eval re-judge → prompt-variant proposal** | 4 | 3 | `MissionEvalClient.tsx:140-159` (re-judge); `learning-loop/policy-proposer.ts` (dead) | When re-judge regression > 0.1, write a `prompt_variant_proposal` row; cron promotes proposals with N successful shadow runs. Wire to existing four-eye gate for human sign-off. |
| 11 | **Cross-portal "fan-out room" (Liveblocks / Yjs / Redis pubsub)** | 4 | 4 | existing per-user SSE in `jarvis-router-factory.ts` | New shared-state primitive keyed by tenant; brain publishes `STATE_DELTA`; all subscribed portals reduce. Start with Redis pubsub (Redis is already in stack — `wave-k-final-zero` adds it). |
| 12 | **Durable workflow layer (Inngest minimum, Temporal stretch)** | 4 | 5 | `agency/executor/executor.ts` (linear walk today) | Convert `executeGoal` into a durable saga: per-step idempotency key, transient-failure retry with exponential backoff, compensating-action wiring for sovereign tools. Behind a feature flag. |
| 13 | **Voyager-style runtime tool registration** | 3 | 4 | `BrainToolRegistry.register` (boot-only today) | Persist successful agent-generated tool definitions to `learned_tool_library` (with provenance + safety class); load at boot. Requires sandbox executor + 4-eye sign-off for first invocation. |
| 14 | **Implicit-signal capture (copy, edit-after-paste, re-prompt within 30s)** | 3 | 2 | `BehaviorObserver` taxonomy in `types.ts` | Extend event taxonomy (`clipboard_copy`, `edit_after_assistant`, `re_prompt_close`); feed into feedback-memory port alongside explicit thumbs. |
| 15 | **`form_prefill` block round-trip — brain proposes values, user edits, submit triggers `tenant.create` tool** | 3 | 2 | gap #4 (`form_prefill`) + gap #2 (HQ tools) | Form's `onSubmit` calls a registered action-tool with diff payload; 4-eye sign-off when stakes ≥ high. |
| 16 | **A/B prompt-variant routing** | 3 | 3 | gap #10 + `BrainKernelDeps` | New `promptVariantResolver` port; routes 5% of traffic per tenant to a candidate; logs to `prompt_variant_runs`; bandit picks winner. |
| 17 | **`platform.overview` BrainTool that returns tile-shaped JSON** | 3 | 1 | existing `/api/platform/overview/route.ts` + `KpiTiles.tsx`; new BrainTool spec | Trivial wrapper: brain calls tool, receives tile JSON, emits `kpi_cluster` UI block. End-to-end demo of chat → live KPI. |
| 18 | **Persona-drift "self-introspection" tool** (`brain.explain_my_last_drift_alert`) | 3 | 2 | `persona-drift/alert.ts` + `introspection/trace-replay.ts` | Reads latest drift event + replays the offending trace; renders a `concept_card` UI block with the breached dim + suggested operator action. |
| 19 | **Approval-diff UI block (`approval_prompt_with_diff`)** | 3 | 2 | `/admin/jarvis/actions` (`jarvis-router-factory.ts:526-540`) + gap #1 | New block renders proposed payload vs current state, sign / reject buttons; routed through existing 4-eye gate. |
| 20 | **Stall-detector → HQ visibility wall** (`/control-tower` page subscribes to stall events) | 2 | 1 | existing `stall-detector.ts:1-355` + page `app/control-tower/page.tsx` | Per-tenant stall feed renders in control-tower; brain can offer "abandon / continue / block" via chat in one click. |

---

## What to do next (operationally)

The shortest path to "the admin runs the company by chat" is **gaps 1 → 3 → 2 → 4 → 17**: AG-UI streaming protocol, generative UI mounted in admin-portal, HQ-tier brain tools, the three new HQ UI blocks, and a first end-to-end `platform.overview` demo. That sequence turns the existing wave-K substrate into a real Central Command surface in roughly two waves of work without touching durable-execution or learning-loop wiring — both of which are larger investments worth doing in a separate phase (gaps 9-12).

The most uncomfortable findings: (a) `apps/admin-platform-portal` has **zero** generative-UI rendering despite the package being shipped to three other apps; (b) the `BehaviorObserver` and entire `learning-loop` directory (1485 LOC) have no production callers; (c) HQ cannot create a tenant, add a user, or flip a feature flag through chat — the action-tool registry is property-management-only; (d) the `/ask` route on admin-platform-portal returns HTTP 503 with the comment *"intelligence-service not wired for platform scope"* — the platform's industry-observer chat is still a stub.
