# Eval Harness Parity — LITFIN vs BOSSNYUMBA101

P8 of the 10-agent parity sweep. Read-only analysis of judge rubric, scenario library, CoT reservoir sampling, eval workflow, drift alerting, and the manual-review surface.

- **LITFIN judge**: `src/core/brain/brain-kernel.ts:160-190` (`judgeAnswer`) + `src/core/brain/envelope.ts:85-90` (review hook)
- **LITFIN scenarios**: `src/core/parity-tests/capability-evals/*.ts` (5 runners, ~3000 LOC) + CLI `scripts/run-capability-evals/run-all.ts`
- **LITFIN CoT reservoir**: `src/core/audit/cot-reservoir/cot-recorder.ts` (~140 LOC) + sleep-pass distiller `src/core/heartbeat/sleep-passes/distill-cot-reservoir.ts` (~400 LOC)
- **LITFIN drift / readiness**: `src/core/parity-tests/orchestrator/scoring.ts` (`detectReadinessDrift`, 7-day rolling mean, 5pp threshold)
- **LITFIN memory bench**: `src/core/litfin-ai/memory/eval/harness.ts` (exact-match / token-F1, no LLM judge)
- **BOSSNYUMBA judge**: `packages/central-intelligence/src/kernel/sensors/anthropic-judge.ts:1-83` (`createAnthropicJudge`)
- **BOSSNYUMBA scenarios**: `packages/ai-copilot/src/eval/{golden-scenarios,scenarios-extended,index,runner,run-eval,scenario}.ts` (~1.2k LOC, ~87 scenarios) AND `packages/central-intelligence/src/__tests__/eval/{scenarios,runner,eval.test}.ts` (~4.3k LOC, 222 scenarios)
- **BOSSNYUMBA CoT reservoir**: `packages/central-intelligence/src/kernel/cot-reservoir.ts:1-115`
- **BOSSNYUMBA workflow**: `.github/workflows/kernel-eval.yml` (1 job, deterministic stub) + `pr-check.yml`/`strict-ci.yml`
- **BOSSNYUMBA grading**: `packages/central-intelligence/src/kernel/continuous-grading.ts:1-102`
- **BOSSNYUMBA review UI**: `apps/estate-manager-app/src/app/brain/reviews/page.tsx` + `src/app/api/brain/review-queue/route.ts`
- **BOSSNYUMBA substrate schema**: `packages/database/src/schemas/kernel-substrate.schema.ts:64-140` (`kernel_cot_reservoir`, `kernel_persona_drift_events`, `kernel_provenance`)

## Summary

| # | LITFIN feature (canonical) | LITFIN ref | BOSSNYUMBA ref | Status | Gap |
|---|---|---|---|---|---|
| 1 | Self-review judge (LLM-as-judge) | `brain-kernel.ts:167-190` | `anthropic-judge.ts:32-66` + wired at `kernel.ts:413-416,785-788` | PARTIAL | Rubric shape and scale differ; BOSSNYUMBA does NOT regenerate on low score. |
| 1a | Judge rubric dimensions | "relevance, accuracy, polish" (`brain-kernel.ts:171`) | "grounded, tone, fabrication" (`anthropic-judge.ts:22-29`) | NAMED-DIFFERENTLY | Three dimensions on both sides but axes do not overlap. Neither maps to the marketed "five-C-continuous". |
| 1b | Score scale | 0-100 integer, threshold 70 (`brain-kernel.ts:171,1192`) | 0.0-1.0 float with 4 anchor bands (`anthropic-judge.ts:24-28`) | NAMED-DIFFERENTLY | Different range; BOSSNYUMBA has no automatic action threshold (score folded into `confidence.review`). |
| 1c | Regenerate-on-low-score | yes — `judgeAnswer` triggers single regenerate w/ feedback baked in (`brain-kernel.ts:1190-1240`) | — | MISSING | BOSSNYUMBA returns the original answer untouched even when judge scores 0.0. |
| 1d | Five-C-continuous rubric (the marketed framework) | declared in CoT credit reasoning shape `cot-reservoir/types.ts:33-49` (character/capacity/capital/collateral/conditions) | analog declared in `continuous-grading.ts:19-72` (condition/cashflow/covenant/context/compliance) | NAMED-DIFFERENTLY | Both ship a "5-C" model BUT it is a **property/borrower grade fed into the system prompt**, not the judge rubric. Neither side wires its 5-C model into the judge. |
| 2 | Scenario library — count | 100 per runner × 5 runners = ~500 scenario-instances; capability-suite (`agencybench-100`, `tom-100`, `counterfactual-200`, `debate-quality`, `multimodal-100`) | 222 kernel scenarios + 87 orchestrator scenarios = 309 total | PARITY | BOSSNYUMBA total scenario count is lower (309 vs ~500) but the kernel-eval corpus (222) is broader on categories. |
| 2a | Scenario categories | bucketed inside each runner (happy/edge/adversarial in agencybench; ToM partner-adaptation; counterfactual stress; debate marginal; multimodal) | 12 categories — tenant/owner/estate/hq/refusal/drift/policy/confidence/multilang/happy/multi-turn/capability — counts: 70 happy, 35 refusal, 23 drift, 18 policy, 18 confidence, 15 multi-turn, 15 capability, 12 multilang, 4 tenant/owner/estate/hq each | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA has explicit `refusal` (35), `drift` (23), `policy` (18), `confidence` (18), `multilang` (12) buckets — none of which LITFIN's runners separate as first-class categories. |
| 2b | ALL_SCENARIOS export (single entry point) | — (no `ALL_SCENARIOS` symbol; runners exposed via `runAllCapabilityEvals` in `capability-evals/index.ts:64-84`) | `packages/ai-copilot/src/eval/index.ts:22-25` (`ALL_SCENARIOS = GOLDEN + EXTENDED`) AND `__tests__/eval/scenarios.ts` `EVAL_SCENARIOS` | PARITY | Both ship a "run-everything" handle. BOSSNYUMBA has TWO disjoint scenario libraries (orchestrator-level + kernel-level); LITFIN has one capability batch. |
| 2c | Per-scenario assertion grammar | per-runner bespoke (completion rate, coherence rate, entropy, etc.) | uniform: `expectInitialPersona`, `expectHandoffs`, `expectToolCalls`, `expectProposedAction`, `expectAdvisorConsulted`, `maxTokens` (orchestrator); `kind`, `expectedGate`, `mustContain`, `mustNotContain`, `minConfidence`, `expectedDriftCount`, `maxLatencyMs` (kernel) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA's grammar is more uniform; LITFIN's is more bespoke per measurement. |
| 3 | CoT reservoir — sampling logic | UNCONDITIONAL persist of every CoT (no probabilistic sample); see `cot-recorder.ts:43-87` | **probabilistic, stakes-keyed**: low=1%, medium=5%, high=50%, critical=100% (`cot-reservoir.ts:20-25`) | NAMED-DIFFERENTLY | BOSSNYUMBA implements the marketed "1% / 100% on high-stakes" sampling literally; LITFIN persists all decisions then strips PII. Different storage profiles; different cost. |
| 3a | PII handling at capture | SHA-256 hash of prompt + response; intermediate steps PII-stripped via `sanitizeForSentry` (`cot-recorder.ts:35-78`) | none — `thoughtText` stored plaintext (`kernel-substrate.schema.ts:71`) | MISSING in BOSSNYUMBA | BOSSNYUMBA persists raw thought text with no PII scrub. Combined with the 1% rate this is a smaller absolute exposure but still a regulatory gap. |
| 3b | RLS / tenant scoping | `tenant_id` column with RLS (`cot-recorder.ts:9-10`) | `tenantId` FK to `tenants` with cascade (`kernel-substrate.schema.ts:68`) — no explicit RLS policy in this schema file | PARTIAL | Schema field present in BOSSNYUMBA; RLS policy must be added separately to match LITFIN. |
| 3c | Query API | `queryCot()` w/ subject/tenant/domain/model/from/to filters (`cot-recorder.ts:119-141`) | sink interface only; no query API | MISSING | BOSSNYUMBA has no `queryCot` equivalent. Regulators cannot pull "all CoT for borrower X". |
| 3d | Sleep-pass distillation | `distill-cot-reservoir.ts:1-403` — TF-IDF cluster + Haiku summarises → `reflexion-lesson` emissions | — | MISSING | No periodic distillation; BOSSNYUMBA does not turn captured CoT into learnable lessons. |
| 4 | CI per-PR run (regression suite) | `.github/workflows/ci.yml:75-117` (unit-tests job runs full vitest; capability-evals NOT in CI) + standalone CLI `scripts/run-capability-evals/run-all.ts` | `.github/workflows/kernel-eval.yml:32-57` — dedicated job runs 222-scenario corpus through `composeSovereign()` on every PR | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA actually wires the regression suite into per-PR CI. LITFIN's capability-evals are CLI-only (run-all.ts) and produce markdown reports under `Docs/parity-tests/capability/results/{date}/` — there is no CI workflow that gates a PR on capability-eval verdict. |
| 4a | Mock vs live mode | live-only (uses real sensors) | dual-mode: mock (default, no API key) + live (when `ANTHROPIC_API_KEY` set) per `run-eval.ts:29-50` | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA can run the suite for free in CI; LITFIN cannot. |
| 4b | Deterministic seeding | yes (`run-all.ts:32`, default `20260507`) | yes (fixed clock + `rng = () => 0.999`, `runner.ts:104-147`) | PARITY | Both deterministic. |
| 5 | Drift / baseline alerting | `detectReadinessDrift` in `parity-tests/orchestrator/scoring.ts:80-100` — 7-day rolling mean, 5pp drop flags | per-suite baseline diff in `eval.test.ts:36-141` — `meanConfidenceDropMax=0.05`, `refusalRateChangeMax=0.10`, `driftRateChangeMax=0.10`, p95 latency dual-floor | NAMED-DIFFERENTLY | BOSSNYUMBA's thresholds are wider (LITFIN: 5pp absolute on a composite score; BOSSNYUMBA: 5pp on mean confidence + 10pp on refusal/drift rates). BOSSNYUMBA's diff is a per-test-run check, LITFIN's is a cron-driven rolling-window comparison. |
| 5a | Aggregate metric set | readiness in [0,1] from severity-weighted per-test scores | meanConfidence, meanLatencyMs, p95LatencyMs, refusalRate, driftRate, gateBlockRate{inviolable,policy,drift} (`runner.ts:55-69`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA tracks more aggregate dimensions. |
| 5b | Baseline refresh workflow | n/a (no checked-in baseline file for capability-evals) | `EVAL_WRITE_BASELINE=1` regenerates `baseline.next.json`; reviewers diff before promotion (`eval.test.ts:69-72`, `baseline.json` checked in at `__tests__/eval/baseline.json`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA has an explicit reviewed-diff baseline refresh ritual; LITFIN has none. |
| 5c | Alert delivery | the cron writes a drift alert (referenced from `scoring.ts:78`); separate `persona-drift/alert.ts` + `monitoring/drift-monitor.ts` | suite test fails the CI job; no Sentry/Slack/PagerDuty hook in `__tests__/eval/eval.test.ts` (verified via grep) | PARTIAL | BOSSNYUMBA fails CI on regression (loud) but has no operator notification beyond the CI bot. LITFIN routes through `persona-drift/alert.ts`. |
| 6 | Manual-review surface (UI) | mission-eval dashboard `app/(admin)/org-admin/intelligence/mission-eval/page.tsx` + cron route `app/api/cron/mission-eval/route.ts` (admin-only) | `apps/estate-manager-app/src/app/brain/reviews/page.tsx` (admin/manager dashboard) + `app/api/brain/review-queue/route.ts` | NAMED-DIFFERENTLY | Both surfaces exist. LITFIN's reviews the **eval/mission** results (regulator-facing); BOSSNYUMBA's reviews **PROPOSED_ACTION queue** (operator-facing). They are NOT the same product — see gap 6a. |
| 6a | Borderline-eval-turn inspection UI | yes — mission-eval shows pass/fail/headline metrics per runner | — | MISSING | BOSSNYUMBA has no UI to drill into a borderline kernel-eval scenario, see the captured CoT, and re-judge. The review-queue page is for approving live PROPOSED_ACTIONs, not auditing eval samples. |
| 6b | Capability dashboard endpoint | `GET /api/parity/capability/dashboard` returns `CapabilityDashboardPayload` (`capability-evals/types.ts:59-67`, wired in `capability-evals/index.ts:64-84`) | — | MISSING | No `/api/eval/dashboard` route in BOSSNYUMBA. |
| 7 | CoT reservoir → eval feedback loop | sleep-pass distills last-24h CoT into one-sentence lessons that are PREPENDED to the next system prompt (`distill-cot-reservoir.ts:153-183`) | — | MISSING | BOSSNYUMBA captures CoT but never feeds it back into the eval suite or system prompt. |
| 8 | Memory recall bench (separate from scenario suite) | `litfin-ai/memory/eval/harness.ts:1-228` — exact-match + token-F1 + difficulty buckets, no LLM judge | — | MISSING | BOSSNYUMBA has no separate memory-recall benchmark. The 222 kernel scenarios test cross-cutting behaviour but do not isolate recall accuracy. |

**Counts**
- Full parity: 2 (deterministic seeding, ALL_SCENARIOS entry point)
- Partial: 4 (judge wired but rubric differs; RLS partial; alert delivery partial; PII handling partial)
- Named-differently: 5 (rubric dimensions, scale, 5-C model location, CoT sampling philosophy, drift threshold shape)
- Extended in BOSSNYUMBA: 5 (12-category scenario taxonomy, uniform assertion grammar, dual mock/live mode, per-PR CI integration, broader aggregate metric set, baseline-refresh ritual)
- Missing in BOSSNYUMBA: 8 (regenerate-on-low-score, CoT PII scrub, CoT query API, sleep-pass distillation, capability dashboard endpoint, borderline eval-turn UI, CoT→system-prompt feedback loop, memory recall bench, operator alert hook)

## Detailed gaps

### Gap 1 — Judge rubric does NOT match the marketed five-C-continuous

LITFIN ships a 5-C model in TWO places:
- `cot-reservoir/types.ts:33-49` — `CreditReasoning.five_c` carries per-component score + reasoning, but only as a *payload* in audit traces, never consumed by the judge.
- `learning-engine/services/credit-assessment-rubrics.ts` — learning-engine rubrics (not in the judge path).

The judge itself (`brain-kernel.ts:171`) uses only "(relevance, accuracy, polish)" as dimensions and returns one composite 0-100 score. The marketed "five-C-continuous-style scoring" of the eval judge is **aspirational, not implemented** on LITFIN.

BOSSNYUMBA's analog (`continuous-grading.ts:19-72`) ships a `PropertyGrade` 5-vector (condition/cashflow/covenant/context/compliance) but identically uses it only as a **system-prompt fragment** (`renderGradeBriefing`, line 92). The judge in `anthropic-judge.ts` returns one composite score on "grounded, tone, fabrication".

Closure effort: **moderate**. The cheap win is to swap the judge prompt to ask for the 5-dimension property grade as JSON, fold each component into `confidence.review`, and use the component score most-correlated with risk to drive a regenerate threshold.

### Gap 2 — Regenerate-on-low-score is the highest-leverage missing behaviour

LITFIN's `judgeAnswer` returns `{score, feedback}`. `brain-kernel.ts:1190-1240` does:
1. If `score < 70`, bake the judge feedback into a follow-up turn and re-call the sensor once.
2. If the regenerate still scores low, write a Reflexion lesson via `maybeRecordLesson`.

BOSSNYUMBA's `createAnthropicJudge` returns `{score}` only. Even if score is 0.0 the kernel folds it into `confidence.review` and serves the original answer. There is no `feedback` field, no regenerate path, no Reflexion sink.

Closure effort: **moderate**. Extend `anthropic-judge.ts` to return `{score, feedback}`. In `kernel.ts:413-416` (and the mirror at `:785-788` for stream) check threshold; on low score call the sensor again with feedback in the messages. ~60 lines.

### Gap 3 — CoT reservoir sampling lives, capture pipeline is incomplete

BOSSNYUMBA's `cot-reservoir.ts:20-25` correctly implements the literal "1% low, 5% medium, 50% high, 100% critical" sampling — LITFIN does not (LITFIN captures everything and PII-strips). However, BOSSNYUMBA's reservoir is missing:

- **PII scrub.** `kernel-substrate.schema.ts:71` stores `thoughtText` as raw text. No sanitisation pass equivalent to LITFIN's `sanitizeForSentry`. Even at 1%, raw thought-text is a regulatory exposure.
- **Query API.** `cot-reservoir.ts:41-43` exposes only `maybeCapture`. There is no `queryCot()` equivalent for regulators / ops to pull "all CoT for thread X" or "all CoT for tenant Y in last 30 days".
- **Sleep-pass distillation.** LITFIN's `distill-cot-reservoir.ts` runs a 24h TF-IDF cluster → Haiku one-sentence-lesson pipeline that PREPENDS lessons to the next system prompt (the verbal-RL loop). BOSSNYUMBA captures CoT but it is write-only; the captured data never re-enters the eval suite or the live system prompt.

Closure effort: **moderate** (PII scrub + query API) + **moderate-large** (distillation pipeline). The PII scrub is the regulatory blocker; the others are productivity wins.

### Gap 4 — Capability-eval is two disjoint corpuses, not one

BOSSNYUMBA has TWO scenario libraries:
- `packages/ai-copilot/src/eval/` — 30 golden + 57 extended = 87 orchestrator scenarios. Mock-mode-default; tests routing/handoff/visibility/PROPOSED_ACTION/advisor.
- `packages/central-intelligence/src/__tests__/eval/scenarios.ts` — 222 kernel scenarios. Stub-sensor; tests `composeSovereign()` decisions, gates, drift events, confidence.

These two corpuses do not share IDs, categories, or assertion grammars. The kernel-eval suite uses 12 categories (tenant/owner/estate/hq/refusal/drift/policy/confidence/multilang/happy/multi-turn/capability); the orchestrator suite uses 8 (leasing/maintenance/finance/compliance/communications/migration/coworker/governance). A regression in one corpus does not surface in the other's CI badge.

LITFIN's 5 capability-eval runners share `CapabilityRunReport` shape and a single `runAllCapabilityEvals` aggregator (`capability-evals/index.ts:64-84`). Closure effort: **moderate**. Either bridge the two corpuses with a shared aggregator, or document the partition + make sure both run on per-PR CI (currently only kernel-eval is wired into `kernel-eval.yml`; the orchestrator suite has no equivalent workflow).

### Gap 5 — No operator alert hook on eval regression

`eval.test.ts:91-141` throws a descriptive `Error` on baseline regression. This fails the CI job, which posts a red X on the PR. There is no further hook — no Sentry capture, no Slack/PagerDuty alert, no entry in a regression-tracking table.

LITFIN has `governance/persona-drift/alert.ts` and `governance/monitoring/drift-monitor.ts` that explicitly route alerts. Closure effort: **trivial**. Add a `process.env.CI && captureException(...)` in the threshold-violation branch.

### Gap 6 — No UI to inspect borderline eval turns

LITFIN ships `app/(admin)/org-admin/intelligence/mission-eval/page.tsx` plus a `GET /api/parity/capability/dashboard` endpoint. Ops can click into a runner's report and see the per-scenario verdict + headline metrics + the markdown narrative.

BOSSNYUMBA's `apps/estate-manager-app/src/app/brain/reviews/page.tsx` is mis-aliased to "Brain Review Queue" but it is for approving live PROPOSED_ACTIONs, not auditing eval scenarios. There is no:
- per-scenario eval dashboard,
- CoT-sample inspector ("show me the 1% sample of low-stakes thoughts that captured"),
- borderline-confidence drill-down ("show me the scenarios where `confidence.review < 0.5`").

The substrate is in the schema (`kernel_cot_reservoir`, `kernel_provenance.judgeScore` per `kernel-substrate.schema.ts:129`) but no UI consumes it. Closure effort: **moderate-large**. One new admin route + one Drizzle query + a results table component.

### Gap 7 — `requireJudge` flag exists but is not driven by stakes or surface

`kernel-types.ts:95-96` declares `requireJudge?: boolean` on `ThoughtRequest`. The kernel runs the judge only when callers set it true. There is no automatic policy that says "run the judge whenever `stakes >= high`" or "run the judge for `surface === 'estate-manager-app'`". The default is OFF — most turns go un-judged.

LITFIN's `selfReview` flag has the same on-by-caller shape, but the `taskName`-based test-time-compute allocator (`brain-kernel.ts:970-1026`) at least bumps it on for high-stakes tasks. BOSSNYUMBA's TTC is binary (`wantsThinking = stakes ∈ {high, critical}`, kernel.ts:340) and does not include a judge default.

Closure effort: **trivial**. Set `requireJudge ||= (stakes === 'high' || stakes === 'critical')` in `compose.ts` before `think()` runs.

## Recommended closure order

1. **Gap 3 (CoT PII scrub) + Gap 5 (alert hook).** Combined regulatory + ops-readiness blocker. ~80 lines.
2. **Gap 2 (regenerate-on-low-score) + Gap 7 (auto-judge on stakes>=high).** Closes the actual "self-review judge" claim. ~100 lines.
3. **Gap 6 (borderline-turn UI).** Operator surface that makes the captured CoT + judgeScore + drift events actionable. One admin route + one Drizzle query.

Honourable mentions: Gap 1 (port the 5-C component scoring into the judge so the rubric matches the marketing) and Gap 3-d (sleep-pass distillation — turns the reservoir from write-only into a learning loop).

## Out of scope / different by design

- **LITFIN's capability-evals architecture (5 specialised runners, each with bespoke metrics).** BOSSNYUMBA's flat 222-scenario corpus with a uniform assertion grammar is a simpler — arguably better — design for the property-management domain. Do not port the bespoke-per-runner shape.
- **Memory recall bench (`litfin-ai/memory/eval/harness.ts`).** LITFIN's memory subsystem needs a dedicated benchmark because it has two coexisting v1/v2 adapters. BOSSNYUMBA's memory hierarchy has a single design path; a separate recall bench can wait.
- **`five-C-continuous` rubric label.** Both projects ship a 5-vector continuous grade but in domain-specific dimensions. The judge does not have to use them as its rubric; what matters is the rubric is multi-dimensional and the judge regenerates on a low component score.

---

**Caveat.** Every claim cites `file:line`. Where I report "MISSING", I verified via `grep -rn` across `packages/central-intelligence/src`, `packages/ai-copilot/src`, and `apps/` — those modules genuinely do not exist in BOSSNYUMBA. The marketing claim that LITFIN ships "five-C-continuous-style scoring" inside the judge is contradicted by `brain-kernel.ts:171` (the judge prompt asks for relevance/accuracy/polish, not the 5-Cs). Treat the gap analysis as the closeable engineering surface, not the marketing surface.
