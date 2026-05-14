# P4 — Sensor failover + multi-LLM routing + provider health + degradation mode

**Agent**: P4 of 10
**Slice**: Sensor failover, multi-LLM router, provider health, brain cache, output normaliser, continuous grading framework
**Mode**: READ-ONLY analysis, cite `file:line`
**Verdict**: framework parity is high; LITFIN's control plane + circuit breaker + 5C scoring depth are the dominant gaps

---

## 0 · Files compared

LITFIN (`Claude Projects/LITFIN PROJECT/src`):

- `src/core/brain/failover.ts` (151 lines) — health + cooldown + ordering
- `src/core/brain/sensors.ts` (128 lines) — concrete sensor adapters
- `src/core/brain/sensor-routing/router.ts` (466 lines) — DB-backed task→sensor routing + budget envelope + call log
- `src/core/brain/sensor-routing/types.ts` (108 lines) — control-plane public types
- `src/core/brain/sensor-routing/index.ts` (40 lines) — barrel
- `src/core/brain/normalizer.ts` (251 lines) — preamble strip, JSON repair, ui_block + tool_call extract
- `src/core/brain/five-c-continuous.ts` (404 lines) — Character / Capacity / Capital / Collateral / Conditions
- `src/core/litfin-ai/llm/response-cache.ts` (319 lines) — semantic response cache (pattern families + LRU + TTL)

BOSSNYUMBA101 (`packages/`):

- `packages/central-intelligence/src/kernel/sensor-failover.ts` (90 lines)
- `packages/central-intelligence/src/kernel/brain-cache.ts` (119 lines)
- `packages/central-intelligence/src/kernel/normalizer.ts` (98 lines)
- `packages/central-intelligence/src/kernel/continuous-grading.ts` (101 lines)
- `packages/central-intelligence/src/kernel/kernel-types.ts` (Sensor / SensorCallArgs at lines 211–253)
- `packages/ai-copilot/src/providers/multi-llm-router.ts` (290 lines) — task-type → provider chain + cost ledger
- `packages/ai-copilot/src/providers/router.ts` (149 lines) — `buildMultiLLMRouter` env wire-up
- `packages/ai-copilot/src/providers/budget-guard.ts` (138 lines) — pre-flight budget assert + ledger record
- `packages/ai-copilot/src/providers/advisor.ts` (209 lines) — executor + advisor (Sonnet → Opus) pattern

LITFIN total ≈ 1,867 lines · BOSSNYUMBA total ≈ 1,294 lines for the comparable surface.

---

## 1 · Sensor failover policy

| Dimension | LITFIN | BOSSNYUMBA101 | Verdict |
|---|---|---|---|
| Health window | rolling 60 s sliding window (`HEALTH_WINDOW_MS`) `failover.ts:22` | no rolling window — only `lastFailureAt` per sensor `sensor-failover.ts:42` | **Gap**: BN has no success-rate metric, only "is in cooldown right now" |
| Circuit breaker | 3 consecutive failures → 30 s cooldown `failover.ts:23-24,71-73` | no breaker — every failure marks `unhealthy`, cleared after `coolDownMs` (default 30 s) `sensor-failover.ts:40,69` | **Gap**: BN trips on first failure (more aggressive); LITFIN needs 3 strikes |
| Cool-down | 30 s, applied only when breaker trips `failover.ts:24,72` | 30 s default, applied on every failure `sensor-failover.ts:40` | Same constant, different semantics |
| Retry budget | walks `pickReadySensorOrder()` until non-cooldown sensor responds; if all cooled, returns `DEFAULT_ORDER` anyway `failover.ts:140-144` | walks all eligible by priority; throws `SensorFailoverError` if none `sensor-failover.ts:58-77` | **Gap**: LITFIN degrades-then-tries (never silent refusal); BN throws |
| User preference | first-tier override (`preferred` arg) `failover.ts:129,135` | not supported | **Gap** |
| Health snapshot | `snapshotHealth()` returns successCount/failureCount/successRate/cooldownRemainingMs `failover.ts:97-125` | `health()` returns `{ id, healthy, lastFailureAt }` — no rates `sensor-failover.ts:78-85` | **Gap**: BN telemetry is thin |
| Non-retryable error | not distinguished | `err.retryable` short-circuits the chain `multi-llm-router.ts:179-184` | BN advantage |

---

## 2 · Multi-LLM router

| Dimension | LITFIN | BOSSNYUMBA101 | Verdict |
|---|---|---|---|
| Provider tiers | DB-backed `task_sensor_routing` rows per (task, tenantId) with built-in fallback `sensor-routing/router.ts:351-404`; 9 built-in tasks: greeting, voice_turn, explanation, 5c_score, officer_review, regulatory_audit, credit_memo, sovereign_write, form_field_help `router.ts:110-296` | in-code `DEFAULT_FALLBACK_CHAINS` per task-type (7 task types) `multi-llm-router.ts:97-105`; no DB, no per-tenant override | **Gap**: BN has no control plane; admin cannot change routing without deploy |
| Dispatch policy | per-task `OrderedSensorChoice` array (sensorId + maxTokens + maxBudgetUsdPerCall) + `cognitionModeHint` `sensor-routing/types.ts:49-66`; iterates in order on failure | task-type → ordered providerId chain, cost/latency overrides re-order chain `multi-llm-router.ts:226-248` | Same pattern, LITFIN richer |
| Cost budget knob | per-task `maxBudgetUsdPerCall` + per-tenant `BudgetEnvelope` (`budget_usd`, `consumed_usd`, `alert_threshold_pct`, `hard_cap_enforced`) `sensor-routing/types.ts:68-78`; envelope tied to UTC month period `router.ts:341-344` | per-call `costBudget: 'cheap'|'balanced'|'premium'` re-orders chain `multi-llm-router.ts:46,226-239` + `CostLedger.assertWithinBudget(tenantId)` pre-flight `multi-llm-router.ts:157` | **Gap**: LITFIN has period-bound dollar envelope w/ hard cap and alerts; BN ledger semantics not visible here but cap is binary |
| Latency budget | implicit via `cognitionModeHint` ("fast" maps to Haiku/gpt-5-mini in builtins) `router.ts:117,127,287-291` | explicit `latencyBudget: 'fast'|'normal'|'slow_ok'` `multi-llm-router.ts:47,240-246` | Different idioms — same intent |
| Tenant tier | per-tenant routing rows `router.ts:57-65` | per-call `tenantTier: 'free'|'growth'|'enterprise'` hint passed into pick but not used to gate `multi-llm-router.ts:48,143` | **Gap**: BN tenantTier is plumbed but ignored |
| Anthropic model defaults | builtin uses `claude.opus-4-7` (5c_score, officer_review, regulatory_audit, credit_memo, sovereign_write), `claude.sonnet-4-6` (voice_turn, explanation), `claude.haiku-4-5` (greeting, form_field_help) `router.ts:117-291`; sensors.ts always uses Opus 4.7 as the live model `sensors.ts:25-35` + `CLAUDE_MODELS.premium` | router.ts:55-60 maps reasoning→Opus 4.6, analysis/tool_use→Sonnet 4.6, conversation/summarisation/batch/bulk_extraction→Haiku 4.5 | **Gap**: BN is one minor version behind on Anthropic models (Opus 4.6 vs LITFIN's 4.7) |
| Vision routing | `sensorimotor-loop`/`vision.ts` (not in this slice but referenced via brain ports) | router.ts has no vision branch; capability gating only at `Sensor.capabilities` declaring `'vision'` `kernel-types.ts:244` — must be requested at `router.call(args, ['vision'])` `sensor-failover.ts:34,56` | LITFIN spec mentions Anthropic primary, OpenAI fallback for vision — BN supports the requirement at type level; concrete vision sensor not wired here |
| Batch routing | LITFIN: no explicit DeepSeek batch sensor in failover.ts (stub fallback to Claude `sensors.ts:108-113`) | BN has `'batch'` and `'bulk_extraction'` task types primary-routed to DeepSeek `multi-llm-router.ts:103-104` | BN advantage in declaration; LITFIN has it at admin/control plane |
| Call telemetry | `recordSensorCall()` writes to `sensor_call_log` (tenantId, task, sensorId, model, tokens, cost, latency, thinking, outcome, errorClass) `router.ts:411-444`; auto-debits `tenant_budget_envelopes.consumed_usd` `router.ts:428-441` | `CostLedger.recordUsage()` records (tenantId, provider, model, tokens, costUsdMicro, operation, correlationId) `multi-llm-router.ts:189-200`; budget-guard.ts also records `budget-guard.ts:110-127` | LITFIN logs outcome/error_class explicitly; BN does not log failures distinctly — failures fall to retry without ledger entry |

---

## 3 · Provider health telemetry

| Dimension | LITFIN | BOSSNYUMBA101 | Verdict |
|---|---|---|---|
| Public health surface | `snapshotHealth()` per-sensor: successCount, failureCount, consecutiveFailures, inCooldown, cooldownRemainingMs, successRate `failover.ts:87-95,97-125` | `health()` per-sensor: id, healthy bool, lastFailureAt `sensor-failover.ts:34-35,78-85` | **Gap**: BN health is a boolean; LITFIN exports five quantitative signals |
| Reset | `clearHealthState()` (test helper) `failover.ts:149` | `resetAll()` (public) `sensor-failover.ts:36,86-88` | Equivalent |
| Circuit breaker threshold | 3 consecutive failures `failover.ts:23` | n/a — every failure marks unhealthy until cooldown lapses `sensor-failover.ts:69` | **Gap** |
| Cool-down constant | 30 000 ms `failover.ts:24` | 30 000 ms default `sensor-failover.ts:40` | Same |
| OTel / metrics export | not in failover.ts (lives in sensor-routing/`recordSensorCall`) | not exported; BN tests only check internal state | **Gap**: neither exports to OTel inside failover; LITFIN persists to `sensor_call_log` table for admin dashboards |
| Health window | 60 s rolling `failover.ts:22` | none | **Gap** |

---

## 4 · Brain cache

| Dimension | LITFIN | BOSSNYUMBA101 | Verdict |
|---|---|---|---|
| TTL | response-cache: 1 min personalised, 5 min default, 10 min greeting/farewell `response-cache.ts:42-51,272-283` | 60 s default `brain-cache.ts:44` | **Gap on TTL semantics**: LITFIN tunes TTL by intent; BN is a single 60 s value |
| Capacity | 200 entries `response-cache.ts:44` | 64 entries `brain-cache.ts:43` | **Gap**: BN cache is 3× smaller |
| Eviction | LRU by hit-count when over capacity, expired-first sweep `response-cache.ts:293-318` | LRU via `Map` insertion-order touch on get/set, GC on set `brain-cache.ts:48-50,56-77` | Same idiom |
| Key composition | `${portalId}:${normalizedMessage}` + family key for pattern matches `response-cache.ts:83-85,174,217` | sha256 of `kind ∣ tenantId ∣ actorUserId ∣ personaId ∣ tier ∣ surface ∣ stakes ∣ sha(userMessage)` `brain-cache.ts:99-112` | **Gap on dimensions**: LITFIN keys on portal + normalised text; BN keys on full scope tuple including per-user. BN is *correct for multi-tenant*; LITFIN is portal-only |
| Per-user isolation | none — same portal, same normalised message ⇒ shared entry | yes — `req.scope.actorUserId` part of payload to prevent tenant-mate bleed `brain-cache.ts:97,103` | **BN advantage** (necessary for multi-tenant SaaS) |
| Pattern families | yes — greeting / acknowledgment / farewell / platform_intro / how_to_start regexes `response-cache.ts:101-131` | none | **Gap**: LITFIN gets a cache hit on "Hi"/"hello"/"habari" — BN treats each as distinct |
| Personalised-bypass | `isPersonalizedResponse()` skips caching responses mentioning "your X" or "TSh X" `response-cache.ts:286-291` | none — caches every `BrainDecision` | **Gap**: BN may cache a personalised answer keyed on identical request (mitigated by user-id in key, but no content-side check) |
| Clock injection | `Date.now()` directly | injectable `clock: () => number` `brain-cache.ts:35,45` | BN advantage — testability |
| Spec target | LITFIN spec says "brain-side LRU 60 s on (scope, message-hash, persona)" — matches BN, not LITFIN's response-cache | matches the spec | LITFIN spec is closer to BN's brain-cache than to LITFIN's response-cache; they appear to be different layers |

The spec mentions a brain-side LRU cache (60s) on (scope, message-hash, persona). LITFIN's `response-cache.ts` is the user-facing speed cache (5 ms hit budget) — the actual brain-side LITFIN equivalent at 60 s TTL is not in this slice (likely in `core/litfin-ai/` infrastructure not visible here). BOSSNYUMBA's `brain-cache.ts` is the direct one-to-one of the spec.

---

## 5 · Output normaliser — repair set

| Repair | LITFIN | BOSSNYUMBA101 | Verdict |
|---|---|---|---|
| Preamble strip ("Sure", "Here's") | 2 patterns: `^(sure\|certainly\|...)[!,.]?\s*` and `^(i'll\|let me\|i can)…[.!]\s*` `normalizer.ts:27-30` | 6 patterns: `sure/certainly/absolutely/of course`, `here's the ___:`, `i'd be happy to ___:`, `i can help ___:`, `let me ___:`, `great question` `normalizer.ts:19-26` | **BN advantage**: BN strips wider set, multi-pass (loops until no match) `normalizer.ts:40-53` |
| Trailing pleasantry strip ("hope this helps") | yes `normalizer.ts:32-34,93-98` | no | **Gap**: BN does not strip trailing |
| JSON repair (smart quotes) | yes `normalizer.ts:104` | no | **Gap** |
| JSON repair (strip fences) | yes `normalizer.ts:106-107` | implicit — extracts ` ```json` blocks and re-emits as `repairFences` `normalizer.ts:79-98` | Equivalent for JSON-in-fences |
| JSON repair (strip leading prose) | yes — looks for `{…}` or `[…]` substring `normalizer.ts:109-115` | no — relies on JSON.parse on fence body only | **Gap**: BN cannot rescue JSON with prose prefix |
| Trailing-comma repair | yes `normalizer.ts:117` | yes — second-chance after first JSON.parse `normalizer.ts:87-90` | Same |
| ui_block extract | three-pass: canonical `<ui_block>` tag → bare JSON object via `tryParseJson` → must have `type` field `normalizer.ts:152-185` | single regex `\`\`\`ui_block\n…\n\`\`\`` fenced form only `normalizer.ts:66-77` | **Gap**: LITFIN tolerates angle-bracket tags AND bare JSON; BN only fenced |
| tool_call extract | yes — `<tool_call>` tag OR bare JSON with `tool`/`name` field `normalizer.ts:191-209` | no | **Gap**: BN cannot extract tool calls from text output |
| Output kinds | typed: `text`, `json`, `ui_block`, `tool_call`, with `{ok, kind, value, text}` discriminated union `normalizer.ts:36-78,215-251` | single return shape `{ text, uiBlock, mutations }` `normalizer.ts:28-32` | **Gap**: BN has weaker types and no `ok:false` reason channel |
| Empty-input handling | `{ ok: false, raw:"", reason:"empty response" }` `normalizer.ts:219-221` | passes through (returns empty text) | **Gap** |
| Mutation telemetry | binary `trimmedPreamble` flag on text only `normalizer.ts:40` | `mutations: string[]` list per call — `preamble-stripped`, `ui_block-extracted`, `json-fence-validated`, `json-fence-repaired`, `json-fence-unrepairable` `normalizer.ts:31,46,57,84,90,93` | **BN advantage** — observability |

---

## 6 · Continuous grading framework

Both modules implement the same architecture: 5 axes × per-axis score × weighted overall × tier/band string × per-axis evidence/missing telemetry. The framework is identical at the structural level:

| Aspect | LITFIN (`five-c-continuous.ts`) | BOSSNYUMBA101 (`continuous-grading.ts`) | Verdict |
|---|---|---|---|
| Axis count | 5 (Character / Capacity / Capital / Collateral / Conditions) `five-c-continuous.ts:26-31` | 5 (condition / cashflow / covenant / context / compliance) `continuous-grading.ts:19-27` | Same — and BN preserves the 5C mnemonic |
| Score domain | 0–100 integer per axis `five-c-continuous.ts:98-145` | 0–1 float per axis `continuous-grading.ts:19-26,79-82` | **Different units, same framework** |
| Weights | character 0.20, capacity 0.30, capital 0.15, collateral 0.20, conditions 0.15 `five-c-continuous.ts:49-55` | condition 0.20, cashflow 0.30, covenant 0.20, context 0.15, compliance 0.15 `continuous-grading.ts:43-49` | **Identical weight vector** — perfect parity |
| Tier / band thresholds | 5 tiers: weak (<25), emerging (<45), developing (<65), prepared (<85), strong `five-c-continuous.ts:57-63` | 5 bands: F (<0.40), D (<0.55), C (<0.70), B (<0.85), A `continuous-grading.ts:84-90` | Same 5-step ladder, near-identical thresholds (25/45/65/85 vs 40/55/70/85 on a 0–1 scale ≈ 40/55/70/85) — close but **boundaries not symmetric** |
| Per-axis telemetry | evidence[], missing[], watchpoints[] arrays `five-c-continuous.ts:33-40` | none — only raw numbers `continuous-grading.ts:19-27` | **Major gap**: BN's grade is opaque |
| Scorer depth | each axis has a dedicated function reading 5–10 input fields with conditional branches (CRB scoring, DSCR proxy, LTV bands, sole-supplier text detection) `five-c-continuous.ts:98-347` | each axis is a 2-input mean (`condition = mean(passRate, 1−backlog)`) `continuous-grading.ts:51-58` | **Major gap**: BN scorers are trivial; LITFIN encodes 200+ lines of domain logic |
| Weakest-axis surfacing | `weakestC` field on snapshot `five-c-continuous.ts:46,365,370` | none — must compute externally | **Gap** |
| System-policy rendering | `renderFiveCsAsContext()` produces a multi-line directive ("Tie this turn to lifting the weakest C…") `five-c-continuous.ts:376-393` | `renderGradeBriefing()` produces a single sentence summary `continuous-grading.ts:92-101` | **Gap**: LITFIN gives the LLM an explicit instruction; BN gives only data |
| Memory record | `fiveCsAsMemory()` returns a `MemoryRecall` for grandfathering into recall pipeline `five-c-continuous.ts:397-404` | none | **Gap** |

Answer to the framework-vs-domain question: **the framework is identical** (5 axes, weighted sum, banded tier, system-prompt rendering) — but BN is currently a **skeleton**: weights and structure match, but the scorers are 1-line means, there are no evidence/missing/watch arrays, and the system-prompt directive is non-prescriptive. LITFIN's `five-c-continuous` is the depth target.

---

## 7 · Top gaps to close (priority order)

1. **LITFIN sensor-routing control plane** (`router.ts` 466 lines + 4 Supabase tables: `sensor_catalog`, `task_sensor_routing`, `tenant_budget_envelopes`, `sensor_call_log`) — BN has no DB-backed routing, no per-tenant overrides, no period-bound dollar envelope, no `outcome`/`error_class` call log. This is the single biggest absence and would let admins shift Opus→Sonnet for non-paying tenants without a deploy. *Wire it as a thin Postgres adapter over `multi-llm-router.ts`'s existing `pick()` decision.*

2. **`continuous-grading` is a skeleton, not a domain model** — weights are right, but `condition = mean(inspectionsPassRate, 1 - workOrderBacklog)` is two inputs where LITFIN reads ten. Without evidence[]/missing[]/watchpoints[] arrays, the system-policy rendering can't say "lift the weakest C by attaching X". Port LITFIN's `evalCharacter/Capacity/Capital/Collateral/Conditions` pattern adapted to property/occupancy data (inspections detail, arrears aging, lease renewal probability, dispute history, KYC completeness). Add `renderGradeBriefing` directive: "Tie this turn to lifting the weakest axis (___) without losing the others."

3. **Sensor health is too thin and the breaker is wrong** — BN's `unhealthy` map trips on the first failure and exports only a boolean. LITFIN's rolling 60 s window + 3-strike breaker + `successRate` + `cooldownRemainingMs` snapshot enables proper degradation-mode dashboards and avoids one-flap-trips-the-circuit. Port `HEALTH_WINDOW_MS`, `BREAKER_THRESHOLD`, `consecutiveFailures` counter, `snapshotHealth()` shape. Also expose `pickReadySensorOrder(preferred?)` so users can pin a sensor on per-call basis.

### Secondary gaps (medium leverage)

4. **Normaliser**: BN cannot strip trailing pleasantries, repair smart quotes, strip leading prose around JSON, or recover bare-JSON `ui_block` / `tool_call`. Port LITFIN's `repairJsonString` + `extractUIBlock` 3-pass + `extractToolCall` and add the `{ok:false, reason}` failure channel so kernel can decide regen-vs-fall-back. Also widen preamble patterns to the LITFIN+BN union.

5. **Brain cache**: BN's 64-entry / 60 s defaults are *correct for the spec* but its pattern-family bypass (LITFIN's "hi"/"hello"/"habari" all hash to one entry) is missing. Add `matchPatternFamily()` and a `isPersonalised()` skip so cache stores the right things. Also add intent-tiered TTLs (greeting 10 m, generic 5 m, personalised 1 m).

6. **Multi-LLM router model defaults**: BN points reasoning at Opus 4.6; LITFIN ships Opus 4.7 across 5 high-stakes tasks. Bump `ANTHROPIC_MODELS.OPUS_4_6` → `OPUS_4_7` once the SDK supports.

7. **CostLedger ↔ outcome telemetry**: BN's ledger logs successes; LITFIN's `sensor_call_log` logs `outcome ∈ {ok, timeout, error, budget_exceeded, refused}` + `error_class`. Failure-mode analytics need the latter.

8. **`tenantTier` is plumbed but ignored** in `multi-llm-router.pick()` — either use it (e.g. free→deepseek, growth→sonnet, enterprise→opus) or drop the hint.

---

## 8 · Things BN does that LITFIN does not (small wins to preserve)

- **Per-user cache key** (`actorUserId` in `brain-cache.ts:103`) — LITFIN response-cache bleeds across users on the same portal. Keep BN's design.
- **Multi-pass preamble strip** with explicit `mutations[]` telemetry — better observability than LITFIN's binary `trimmedPreamble`.
- **Injectable `clock`** in `brain-cache.ts:45` and `sensor-failover.ts:41` — LITFIN's `Date.now()` is a testability tax.
- **`err.retryable` short-circuit** in `multi-llm-router.ts:179-184` — LITFIN retries blindly across all sensors regardless of error class.
- **Advisor pattern** (`advisor.ts` — Sonnet executor + Opus advisor on hard categories or low confidence) — LITFIN has no equivalent in this slice. Anthropic-published technique; keep it.
- **`budget-guard.ts` wrapping the Anthropic SDK directly** — LITFIN's budget enforcement lives in the routing layer only; BN's at the SDK boundary is stronger (no path can skip it).

---

## 9 · Cross-references for sibling agents

- P1 (kernel / brain / persona) — ties to `kernel.ts:166`, `kernel-types.ts:240-253` (Sensor contract).
- P2 (memory / consolidation) — `brain-cache.ts` is the short-term cache; long-term memory not in this slice.
- P3 (confidence / gates / policy) — `advisor.ts` consumes `executorConfidence`; ties to confidence-vector parity.
- P5 (tools / agency) — `tool_call` extraction in `normalizer.ts:191-209` (LITFIN) is the contract for tool dispatch.
- P6 (provenance / telemetry) — `sensor_call_log` and `CostLedger.recordUsage` are the two telemetry sinks.
- P7 (UI / streaming) — `Sensor.callStream` + `SensorStreamEvent` `kernel-types.ts:252,261-275` consumed by `BrainKernel.thinkStream`.

---

## 10 · Single-line summary

BN matches LITFIN's *framework* on sensor failover, multi-LLM router, normaliser, brain cache, and continuous grading; LITFIN beats BN on *depth of policy + control plane*: it has DB-backed task routing with per-tenant budget envelopes, a rolling-window 3-strike circuit breaker with rich health snapshots, a 200-line per-axis 5C scorer with evidence/missing/watch arrays, and a normaliser that tolerates 3× more output shapes.
