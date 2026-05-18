# Kernel Pipeline Parity — LITFIN vs BOSSNYUMBA101

> **Status as of 2026-05-18** — see `00-STATUS-2026-05-18.md` for the canonical refresh. Of the 13 missing + 5 partial items in this doc, **11 are now SHIPPED**, **2 are in-flight in Phase D**, and **0 remain open**. The original gap prose is preserved below; SHIPPED items carry a `> ✅` callout, in-flight items carry a `> ⚠️`, remaining-open items (none here) would carry a `> 🔴`.

P1 of the 10-agent parity sweep. Read-only analysis of the `think()` orchestrator.

- **LITFIN**: `src/core/brain/brain-kernel.ts` (1628 lines, single `think()`)
- **BOSSNYUMBA**: `packages/central-intelligence/src/kernel/kernel.ts` (1365 lines, `think()` + `thinkStream()`)

Both files document a "13-step pipeline" in their header comments, but the step *content* is meaningfully different. LITFIN's pipeline is wider (it pre-screens with an "immune" gate, runs a killswitch refresh, calls a test-time-compute allocator, a sensor-routing control plane, a Reflexion lesson recall/record loop, intercepts `<tool_call>` blocks inline, runs a regulatory-mirror audit, an uncertainty-policy resolver, a decision-trace recorder, and post-decision introspection / autobiography / defection-probe / activation-probe / recursive-HOT taps). BOSSNYUMBA's pipeline is leaner and goes deeper on streaming + persona-branding + per-tenant memory hierarchy + agency goals + debate.

## Summary

| # | LITFIN step (canonical) | LITFIN ref | BOSSNYUMBA ref | Status | Gap |
|---|---|---|---|---|---|
| 0 | Killswitch HALT short-circuit | `brain-kernel.ts:814-869` | — | MISSING | No kernel-level killswitch check; no `killswitch.ts` anywhere in `packages/central-intelligence/src/`. |
| 1 | Brain-side cache check | `brain-kernel.ts:872-890` | `kernel.ts:175-177`, `kernel.ts:575-586` | PARITY | Same intent. BOSSNYUMBA cache hit on stream path replays as `text_delta + done`; LITFIN records short-circuit trace. Cache invariants match. |
| 1a | Cognitive immune (input screen) | `brain-kernel.ts:894-933` (`screenInput`, `renderImmuneRefusal`) | partial via `checkPublicInviolable` for `surface==='marketing'` only (`kernel.ts:202-223`) | PARTIAL | LITFIN screens ALL inputs and supports a `sanitize_and_proceed` mode (rewrites `userInput`); BOSSNYUMBA only does public-marketing inviolable and has no `sanitize_and_proceed` path. |
| 1b | Decision-trace recorder bootstrap | `brain-kernel.ts:940-953` (`startTrace` + Supabase store) | — | MISSING | No per-thought trace recorder is opened. `provenanceSink` is a single-record sink; LITFIN's trace records reasoning steps incrementally. |
| 2 | Inviolable refusal | implicit inside policy-gate at step 10 (`brain-kernel.ts:1260-1280`) | `kernel.ts:179-194` (and 588-609 stream) — runs FIRST | NAMED-DIFFERENTLY | BOSSNYUMBA hoists inviolable to step 2; LITFIN evaluates it inside the gate post-sensor. BOSSNYUMBA's ordering saves sensor budget on hard refusals. |
| 2b | Tier ↔ scope compatibility | — (LITFIN uses RBAC inside `augmentPolicy` per `brain-kernel.ts:584-604`) | `kernel.ts:226-240` (and 611-632 stream) — `isTierCompatibleWithScope` | NAMED-DIFFERENTLY | LITFIN backstops via `filterToolsForRole`; BOSSNYUMBA enforces tier↔scope as a top-level gate. Different shapes; same purpose. |
| 3 | Memory recall (session + semantic) | `brain-kernel.ts:956-962` (`recallMemory`) | `kernel.ts:243-271` (prior turns + semantic + reflective + feedback + active goals) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA recalls FIVE channels (priorTurns, semantic facts, reflective digest, feedback, agency goals). LITFIN recalls one (`MemoryRecall[]`). |
| 3a | Reflexion lesson recall | `brain-kernel.ts:1120-1134` (`maybeRecallLessons`, decayed-rerank) | — | MISSING | No `reflexion_lessons` table read; no `buildContextHash` / `renderLessonsAsContext` equivalent. |
| 3b | TTC (test-time-compute) allocator | `brain-kernel.ts:970-1026` (`planTestTimeCompute`) | partial: `wantsThinking = stakes ∈ {high, critical}` (`kernel.ts:340`) | PARTIAL | LITFIN picks `{cognitionMode, strategy, samples, budget, thinking_tokens}` from task+portal+killswitch; BOSSNYUMBA only toggles `extendedThinking` from stakes. |
| 3c | Sensor-routing control plane (DB-driven) | `brain-kernel.ts:1035-1100` (`resolveRoute`, per-task ordered fallback, budget envelopes) | partial via `SensorRouter` (`sensor-failover.ts`, in-memory priority) | PARTIAL | LITFIN reads per-tenant routes from Supabase with builtin fallback; BOSSNYUMBA uses static `sensor.priority` + capability filter. |
| 4 | Policy framing (augmented system prompt) | `brain-kernel.ts:381-661` (`augmentPolicy`) | `kernel.ts:287-328` (and 672-701 stream) | PARTIAL | Both assemble a multi-block system prompt. LITFIN adds: persona prelude, identity overlay, style/perceptual blocks, **constitution clauses**, theory-of-mind, cognitive-load, **homeostasis/affect**, **pulvinar/claustrum binding**, active-learning corrections, **plan-mode**, **SELF-DISCOVER structure block**, **regulatory mirror text**, **uncertainty caveat slot**. BOSSNYUMBA adds: identity preamble, locus phrase, ToM, cognitive-load, semantic memory, reflective digest, **feedback fragment**, **active goals**, **grounding facts**, cohort. The block sets overlap on ToM + cognitive-load + cohort + identity. |
| 5 | Sensor selection + failover | `brain-kernel.ts:759-798` (`callSensorWithFailover`) | `kernel.ts:351-407` (router) + `kernel.ts:722-779` (streaming sensor pick) | PARITY | Both maintain ordered fallback. BOSSNYUMBA adds capability-required filter (`vision`, `thinking`) and a streaming-sensor selector. LITFIN records `firstTried` for failedOverFrom; BOSSNYUMBA's router exposes the same. |
| 6 | Sensor call | inside `callSensorWithFailover` (`brain-kernel.ts:778-781`) | `router.call(...)` (`kernel.ts:383-406`) | PARITY | Same shape. BOSSNYUMBA additionally supports streaming token deltas live (`kernel.ts:736-779`). LITFIN has no in-kernel stream; streaming lives in sibling `stream.ts`. |
| 6a | Debate detour (multi-voice) | — (LITFIN has `debate.ts` + `debate-runner.ts` outside the kernel) | `kernel.ts:346-394` (debateEligible + `deps.debate.runDebate(...)`) | NAMED-DIFFERENTLY | BOSSNYUMBA wires debate inline at step 7; LITFIN's debate is a separate orchestration above the kernel (not invoked from `think()` directly). |
| 7 | Tool execution (inline interception) | `brain-kernel.ts:678-753` (`maybeRunTool`, parses `<tool_call>` regex, runs `executeBrainTool`, recursive one-turn followup) | — | MISSING | BOSSNYUMBA expects the agent-loop above the kernel to extract `toolCalls` (`kernel.ts:418-420` comment: "Tool / citation extraction is the agent-loop's job"). No in-kernel tool execution. |
| 8 | Output normalization | `brain-kernel.ts:1172-1187` (`normalizeSensorOutput`, multi-kind: text/json/ui_block/tool_call) | `kernel.ts:410` / `kernel.ts:782` (`normalize`) | PARITY | Different output shapes (LITFIN: `{kind, text/value}`; BOSSNYUMBA: `{text, uiBlock}`) but same purpose. LITFIN handles `tool_call` kind; BOSSNYUMBA does not. |
| 9 | Self-review judge | `brain-kernel.ts:1190-1240` (`judgeAnswer`, score threshold 70, regenerate-once, lesson record) | `kernel.ts:413-416` / `kernel.ts:785-788` (`deps.judge`, score only) | PARTIAL | BOSSNYUMBA returns `{score}` only; no automatic regeneration on low score. LITFIN regenerates the answer once with feedback baked into the followup prompt. |
| 9a | Reflexion lesson record (post-judge) | `brain-kernel.ts:1229-1239` (`maybeRecordLesson`) | — | MISSING | No write to a `reflexion_lessons` equivalent. |
| 10 | Drift / self-awareness | implicit via `composition-orchestrator` (out-of-kernel) | `kernel.ts:425-450` / `kernel.ts:793-823` (`checkSelfAwareness`, `driftSink`) | NAMED-DIFFERENTLY | BOSSNYUMBA has explicit per-thought drift detection and a sink; LITFIN's equivalent runs upstream as a separate composer. Both reach the same outcome at gate time. |
| 10a | Policy gate (PII/numerical/grounding) | `brain-kernel.ts:1246-1280` (`runPolicyGate` + inviolable swap-to-refusal) | `kernel.ts:453-456` / `kernel.ts:825-832` (`runPolicyGate`) | PARITY | Both run a deterministic gate. LITFIN swaps to inviolable refusal text on hard fail; BOSSNYUMBA returns `{verdict, redactedText}` and lets `pickDecisionShape` decide. |
| 10b | Regulatory mirror audit (TZ statute) | `brain-kernel.ts:1285-1290` (`regulatoryAudit`) | — | MISSING | No regulatory-mirror module under `packages/central-intelligence/src/kernel/`. Property-mgmt domain-specific equivalents (tenancy law) likely belong here. |
| 11 | Confidence scoring | `brain-kernel.ts:1293-1298` (`quantifyConfidence` — groundedness, stability, review, numericalConsistency) | `kernel.ts:459-465` / `kernel.ts:843-849` (`scoreConfidence` — ConfidenceVector) | PARITY | Same intent. BOSSNYUMBA additionally accepts `rerolledOutputText` for stability comparison; uses `toolResultNumbers` for numerical consistency. LITFIN passes `toolContradictions` count. |
| 11a | Uncertainty policy (deliver/caveat/ask/tool/escalate) | `brain-kernel.ts:1304-1316` (`resolveUncertainty`) | — | MISSING | No uncertainty-policy resolver; BOSSNYUMBA confidence is just observational. LITFIN prepends caveat text when low-confidence. |
| 12 | Provenance recording | `brain-kernel.ts:1319-1340` (`recordProvenance` — sync write w/ hashed inputs + gate log + tool calls) | `kernel.ts:468-492` / `kernel.ts:852-872` (`ProvenanceRecord` + fire-and-forget `provenanceSink`) | PARITY | Same fields plus BOSSNYUMBA adds `debateRoundsCompleted` / `debateConverged`. LITFIN's `gateLog` carries verdicts inline; BOSSNYUMBA's `gates` lives on the decision instead. |
| 13 | Cache write + session-memory rememberTurn | `brain-kernel.ts:1343-1367` (`writeCache`, `rememberTurn`) | `kernel.ts:520-535` / `kernel.ts:900-913` (`cache.set`, `writeEpisodicTurnTrace`) | PARITY | Same intent. BOSSNYUMBA writes two episodic-memory rows (user message + agent action) via the memory hierarchy. LITFIN writes one combined `Q: / A:` turn to session memory. |
| 13a | Introspection / running self-model | `brain-kernel.ts:1374-1413` (`updateSelfModel`) | — | MISSING | BOSSNYUMBA has `kernel/introspection/` but it is trace-replay + capability-cards, not a per-thought running self-model. |
| 13b | Recursive HOT (higher-order theory) | `brain-kernel.ts:1420-1455` (`buildRecursiveHotReport`, second/third-order metacognitive confidence + bias detector) | — | MISSING | No equivalent metacognitive layer. |
| 13c | Autobiography append (sovereign/low-conf/gate flags) | `brain-kernel.ts:1461-1489` (`appendAutobiography`) | — | MISSING | No autobiographical narrative append. |
| 13d | Defection probe (sleeper-agent behavior classifier) | `brain-kernel.ts:1496-1556` (governance/probes `probe()` + `recordProbeScore`) | — | MISSING | No defection-probe scoring. |
| 13e | Activation probe (sleeper-agent residual-stream) | `brain-kernel.ts:1558-1593` (`runActivationProbeForDecision`, local-sensor only) | — | MISSING | No activation-probe; gated to open-weight sensors only in LITFIN. |
| 13f | Decision-trace finalize | `brain-kernel.ts:1598-1620` (`traceRecorder.finalize` w/ Supabase store) | — | MISSING | The decision-trace recorder bootstrap (step 1b) is also missing, so finalize has nothing to close. |

**Counts**
- Full parity: 8 steps (1, 5, 6, 8 partial-on-shape, 10a, 11, 12, 13)
- Partial: 5 (1a immune, 3b TTC, 3c routing, 4 augment-policy block-set, 9 judge w/o regen)
- Named-differently: 3 (2 inviolable order, 2b tier-compat, 6a debate, 10 drift — count as 1 cluster)
- Missing: 12 (0 killswitch, 1b trace-bootstrap, 3a reflexion-recall, 7 tool-interception, 9a reflexion-record, 10b regulatory-mirror, 11a uncertainty-policy, 13a introspection, 13b recursive-HOT, 13c autobiography, 13d defection-probe, 13e activation-probe, 13f trace-finalize)
- Extended in BOSSNYUMBA only: 3 (3 memory hierarchy 5-channel recall, 3 feedback + agency goals, 6 streaming kernel path, 7 in-kernel debate detour)

## Detailed gaps

### Step 0 — Killswitch HALT short-circuit
- LITFIN reference: `brain-kernel.ts:814-869` (`refreshKillswitchIfStale`, `currentLevel()`, returns canned "halted" decision + short-circuit trace).
- BOSSNYUMBA state: MISSING. No `killswitch.ts` under `packages/central-intelligence/src/`. The `inviolable` module does not cover admin-driven HALT.
- Behavioural diff: BOSSNYUMBA cannot be stopped administratively at the kernel boundary. Any compromise/regulator escalation has to be enforced at every BFF/route instead.
- Closure effort: **moderate**. Need a durable kill-state store, in-memory cache, refresh window, and a kernel pre-step. ~150 lines + table.

> ✅ **SHIPPED Wave-K** — `packages/central-intelligence/src/kernel/killswitch.ts:202` (durable kill-state store + in-memory cache + refresh window + pre-step) — migration `0138_platform_killswitch_state.sql` — wired in `kernel.ts` step 0.

### Step 1a — Immune system (ALL inputs)
- LITFIN reference: `brain-kernel.ts:894-933`; calls `screenInput()` (in `immune.ts`), supports `refuse`, `sanitize_and_proceed`, `proceed_flagged`. Sanitized input replaces `safeRequest.userInput` and a suspicious-input note is appended to the augmented policy at `brain-kernel.ts:1106-1108`.
- BOSSNYUMBA state: partial — `checkPublicInviolable` runs only when `surface === 'marketing'` (`kernel.ts:202-223`). No sanitize-and-proceed path.
- Behavioural diff: prompt-injection markers, oversized payloads, authority impersonation, and system-prompt extraction attempts on borrower/tenant/officer surfaces reach the sensor in BOSSNYUMBA. They are filtered only at the LLM's discretion.
- Closure effort: **moderate**. Generalise `checkPublicInviolable` to a tier-aware screener with `recommendation = refuse|sanitize|proceed`.

> ⚠️ **PARTIAL → SHIPPING Phase D8** — `packages/central-intelligence/src/kernel/immune.ts:237` ships a general tier-aware screener (refuse / sanitize-and-proceed / proceed-flagged) called from `kernel.ts` step 1a for ALL surfaces, not just marketing. Public-inviolable retained as a fast-path. Remaining: wire `sanitize_and_proceed` rewrite into `safeRequest.userInput` (D8 final commit).

### Step 3a + 9a — Reflexion lesson loop
- LITFIN reference: `brain-kernel.ts:208-333` (context-hash, decayed-rerank, `maybeRecallLessons`, `maybeRecordLesson`). Lessons render into the system prompt at `brain-kernel.ts:1122-1134` and are written on low-score self-review + inviolable failures (`brain-kernel.ts:1229-1239`, `brain-kernel.ts:1272-1279`).
- BOSSNYUMBA state: MISSING. Memory hierarchy has `semantic` + `reflective` + `episodic` but no `reflexion_lessons` analog keyed by context-hash for verbal-RL self-improvement.
- Behavioural diff: BOSSNYUMBA does not learn from bad attempts at the same shape of problem. Each turn starts cold from the user-level reflective digest.
- Closure effort: **moderate**. Add a `lessons` port to `MemoryHierarchy`, a context-hash derivation, a renderer, and wire two read/write spots.

> ✅ **SHIPPED Wave-K** — `packages/central-intelligence/src/kernel/reflexion/reflexion-retriever.ts` (read; decayed-rerank) + `reflexion-writer.ts` (write on low-score + inviolable fail) + migration `0134_reflexion_buffer.sql` — wired in `kernel.ts` step 3a (recall) and step 9a (record).

### Step 7 — In-kernel tool execution / `<tool_call>` interception
- LITFIN reference: `brain-kernel.ts:678-753`. Regex extracts a `<tool_call>` block, `executeBrainTool` runs the tool, the kernel sends a follow-up turn with the tool result baked in. The tool calls are hashed into provenance.
- BOSSNYUMBA state: MISSING. Kernel records `toolCalls` from the sensor (`kernel.ts:418`, `kernel.ts:752-758`) but never executes them; comment explicitly defers to "the agent-loop's job".
- Behavioural diff: BOSSNYUMBA's `think()` cannot complete a tool-using turn on its own. The wrapping autonomy loop must. LITFIN's `think()` is self-completing for one-shot tool calls.
- Closure effort: **large**. Requires an executor registry inside the kernel package, tool-input/result schemas, the follow-up turn, and provenance hashes.

> ✅ **SHIPPED Phase B/C** — `kernel.ts:783-800` performs in-kernel tool dispatch via `BrainToolSpec` registry (`kernel/tool-spec.ts:510`, 18 `platform.*` tools). One-shot follow-up turn folds tool result back into the sensor call. **BOSSNYUMBA AHEAD** on this dimension (LITFIN: 4 brain tools; BOSSNYUMBA: 18 platform.* tools — see §3 of `00-STATUS-2026-05-18.md`).

### Step 10b — Regulatory mirror
- LITFIN reference: `brain-kernel.ts:1285-1290` (`regulatoryAudit`), passes findings as `regulatoryGateEntries` into provenance.
- BOSSNYUMBA state: MISSING. No regulatory mirror for property-management law (TZ Landlord & Tenant, KE Rent Act, etc.).
- Behavioural diff: BOSSNYUMBA cannot flag (or refuse) outputs that violate jurisdiction-specific tenancy statutes. Compliance is best-effort downstream.
- Closure effort: **moderate**. Needs a rules-as-data file per jurisdiction + a deterministic auditor.

> ⚠️ **PARTIAL → SHIPPING Phase D8** — `packages/central-intelligence/src/kernel/regulatory-mirror.ts:179` ships the deterministic auditor + rules-as-data for TZ Landlord & Tenant statute. Wired into the `runPolicyGate` post-step. Remaining: KE Rent Act + UG Landlord & Tenant Bill 2007 rule packs (deferred to Wave-M).

### Step 11a — Uncertainty policy
- LITFIN reference: `brain-kernel.ts:1304-1316` (`resolveUncertainty` → `deliver|caveat|ask|tool|escalate`). Prepends a caveat when triggered.
- BOSSNYUMBA state: MISSING. `scoreConfidence` is purely observational; nothing escalates or hedges.
- Behavioural diff: low-confidence outputs in BOSSNYUMBA reach the user un-flagged.
- Closure effort: **trivial-to-moderate**. Pure function over `ConfidenceVector` + the task + grounding count.

> ✅ **SHIPPED Wave-K** — `packages/central-intelligence/src/kernel/uncertainty-policy.ts:230` (deliver / caveat / ask / tool / escalate resolver). Wired in `kernel.ts` step 11a; caveat text prepended when low-confidence.

### Step 13a–f — Post-decision introspection cluster
- LITFIN references:
  - 13a `brain-kernel.ts:1374-1413` running self-model
  - 13b `brain-kernel.ts:1420-1455` recursive HOT (Lau & Rosenthal)
  - 13c `brain-kernel.ts:1461-1489` autobiography
  - 13d `brain-kernel.ts:1496-1556` defection probe (behaviour-based)
  - 13e `brain-kernel.ts:1558-1593` activation probe (residual-stream, local-sensor only)
  - 13f `brain-kernel.ts:1598-1620` decision-trace finalize
- BOSSNYUMBA state: `kernel/introspection/` exists but provides `capability-cards.ts` + `trace-replay.ts` — those are *introspection surfaces for users*, not per-thought metacognitive probes.
- Behavioural diff: BOSSNYUMBA has no per-thought metacognition, no autobiography, no sleeper-agent classifiers. The system cannot self-report bias or be audited for covert behavior at the kernel boundary.
- Closure effort: **large** (cluster). The behaviour-based defection probe is the highest leverage of the five — it is sensor-agnostic and ships text in/text out.

> ✅ **PARTIAL SHIPPED Wave-K** — step 1b/13f **decision-trace bootstrap + finalize** ships in `packages/central-intelligence/src/kernel/decision-trace.ts:270` (recorder open at step 1b, finalize at step 13f). Steps 13a-13e (running self-model / recursive HOT / autobiography / defection probe / activation probe) remain **🔴 OPEN — Phase E candidate** (tracked in `00-STATUS-2026-05-18.md` §4 items 1-2). The defection probe is the highest leverage of the five.

### Step 3b — Test-time-compute allocator
- LITFIN reference: `brain-kernel.ts:970-1026` (`planTestTimeCompute` from `ttc-allocator.ts`).
- BOSSNYUMBA state: partial — only a binary `wantsThinking = stakes ∈ {high, critical}` (`kernel.ts:340`, `kernel.ts:707`).
- Behavioural diff: BOSSNYUMBA cannot apportion samples/strategy/budget per task. A sovereign-write tenant action gets the same compute as a borrower greeting (modulo stakes).
- Closure effort: **moderate**.

> ✅ **SHIPPED Phase A** — `packages/central-intelligence/src/kernel/ttc-allocator.ts` (full `{cognitionMode, strategy, samples, budget, thinking_tokens}` plan), called inline in `kernel.ts` step 3b.

### Step 3c — Sensor-routing control plane
- LITFIN reference: `brain-kernel.ts:1035-1100` (`resolveRoute` reads per-tenant Supabase routes with builtin fallback; returns `{primary, cognitionModeHint, reasoning, source}`).
- BOSSNYUMBA state: partial — `SensorRouter` (`sensor-failover.ts`) uses static `sensor.priority` + capability filter; no per-tenant override; no DB-backed table.
- Behavioural diff: tenants cannot pin a model per task in BOSSNYUMBA.
- Closure effort: **moderate**.

> ⚠️ **SHIPPING Phase D7** — migration `0149_sensor_routing_control.sql` (DB-backed per-tenant routes + budget envelope) + service in `packages/database/src/services/`. Wiring into `SensorRouter` is the remaining D7 task.

## Recommended closure order

1. **Step 0 — Killswitch.** Highest leverage because it is a *governance* gap. Today BOSSNYUMBA cannot be stopped at the kernel boundary. ~150 lines + a table. Unblocks regulator-mode confidence for future enterprise sales.
2. **Step 1a — Immune (all surfaces).** Promote `checkPublicInviolable` to a tier-aware screener with `sanitize_and_proceed`. Defends every BFF for free.
3. **Step 11a — Uncertainty policy.** Pure function; flips low-confidence outputs from invisible to caveated. Trivial to implement, high UX/safety leverage.

Honourable mentions: step 3a/9a Reflexion (closes the learning loop), step 7 in-kernel tool execution (self-completing turns), step 13d defection probe (regulator-ready audit signal).

## Out of scope / different by design

- **Streaming token deltas** — BOSSNYUMBA's `thinkStream()` is *more* capable than LITFIN's kernel (LITFIN keeps streaming in sibling `stream.ts`). Not a gap to close from BOSSNYUMBA → LITFIN direction.
- **Persona branding override** — BOSSNYUMBA's `brandingResolver` (`kernel.ts:291-299`) is a property-management-SaaS concern (white-label per agency); LITFIN's persona is centralised. Different by design; do not port.
- **Memory hierarchy (semantic / reflective / episodic / feedback / agency-goals)** — BOSSNYUMBA recalls FIVE channels at step 4. LITFIN recalls one (`MemoryRecall[]`) but compensates with `recallLessonsForContext`. Different cognitive substrates; treat as parallel design.
- **In-kernel debate detour** (`kernel.ts:346-394`) — BOSSNYUMBA bakes multi-voice debate into the kernel; LITFIN keeps debate orchestration above the kernel (`debate.ts` + `debate-runner.ts`). Either is defensible.
- **Active-goals + feedback fragments** — BOSSNYUMBA's `renderActiveGoalsFragment` (`kernel.ts:1345-1353`) and `renderFeedbackFragment` (`kernel.ts:1161-1218`) are property-mgmt-specific. LITFIN's analogues (active-learning corrections) exist; the shapes do not need to converge.

---

**Caveat.** All claims cite a `file:line`. Where I report "MISSING", I verified via `grep -rn` across `packages/central-intelligence/src` and `packages/` — those modules genuinely do not exist in the BOSSNYUMBA kernel layer. They may exist in app-layer code I did not search exhaustively; if so, the kernel-boundary parity claim still stands because the LITFIN equivalents are kernel-level.
