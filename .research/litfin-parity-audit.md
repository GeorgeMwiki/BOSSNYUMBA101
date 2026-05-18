# LITFIN ↔ BOSSNYUMBA Parity Audit (2026-05-18)

> Read-only structural audit. No code modified.
> BOSSNYUMBA tip: `3fb3be63` (Phase F shipped) on `claude/phase-d-comprehensive-gap-closure`.
> LITFIN tip: `13d7c81d` (security hardening) on `main`.

## TL;DR

1. **BOSSNYUMBA is structurally ahead on agency platform / orchestration**: it has a real Claude-Code-grade orchestrator main-loop with 9-stage hook chain + Decision ADT + Budget + Plan + Checkpoint + ContextBudget + ToolSearch + MemoryTool + PermissionMode + SubMdSpawn that LITFIN does not have. LITFIN runs a `composition-orchestrator` (Best-of-N + PRM + SELF-DISCOVER) which is a different (smaller, reasoning-quality-focused) primitive. The hook surfaces are conceptually equivalent (LITFIN has its own 9-event `hook-bus`) but the chain-based ADT outcomes (`updated-input`, `additional-context`, `transform`, `defer`, `ask-owner`, `sandbox`, `stop`) are a strict superset.
2. **LITFIN is meaningfully ahead on universal security-coverage scanners (5 of them) + sovereign-ledger hash-chain integrity regression**: these are concrete vitest scanners that walk the whole API surface and fail PRs on auth/SSRF/RLS/Zod/rate-limit gaps. BOSSNYUMBA has no structural equivalent — its `security-route-coverage.yml` is a single thinner check. Backporting these into BOSSNYUMBA is the single highest-leverage reverse-port.
3. **LITFIN has a deeper "cognitive-architecture" tree (active-inference, attention-schema, default-mode-network, dual-process, basal-ganglia, cerebellum, self-discover, LATS, PRM, JEPA-cashflow, world-rollouts, alignment-faking probe, defection probe)** that BOSSNYUMBA does not have. Most of those are credit-risk-tuned and not directly portable to property management, BUT the framework scaffolding (active-inference / dual-process / metacognitive-monitor) is generic and worth porting.
4. **BOSSNYUMBA is ahead on every "operationalisation" axis**: 5 sub-MDs (maintenance.dispatch / complaint.triage / lease / arrears / kra / report / vendor / leasing-ah), 5 real connector adapters (M-Pesa Daraja, KRA eRITS, NIDA, GePG, OPay), AOP compiler (NL → Skill+cron+monitor+hook), MCP process-intel server with pm4py sidecar, 5 VP personas, autonomy-governance package (caps + SLO + handoff), forecasting-engine package (4 forecaster families + 6 scenarios + scoring + feedback), compliance-plugins package (16 country plugins), 42-kind dynamic genui catalogue, 6 Grafana dashboards, full OTel 0.218 stack, full k8s + helm + cert-manager + KEDA + knative + linkerd, compliance docs for TZ/KE/NG/EU + SOC2 + Art.30 RoPA. LITFIN has 12 genui components, no AOP compiler, no MCP server, no VP personas, no autonomy-governance/forecasting-engine packages.
5. **LITFIN is ahead on jurisdictional-rules pluggability (TZ priors + KE skeleton + audit hardcode-detector), proactive-nudge pipeline, decision-simulator (5 simulators), process-mining feature surface (mine→diagnose→research→redesign with bottleneck-detector + conformance-checker), and Anthropic Memory Tool wire-format adapter (April 2026 protocol)**. These are real production capabilities BOSSNYUMBA should consider lifting.

---

## Method

**BOSSNYUMBA capabilities surveyed:**
- `packages/central-intelligence/src/kernel/orchestrator/{main-loop, hook-chain, budget, plan, checkpoint, context-budget, memory-tool, permission-mode, self-extension, decision, skill}.ts` (3345 LOC total)
- `packages/central-intelligence/src/kernel/sub-mds/` (8 sub-MDs)
- `packages/central-intelligence/src/kernel/vp-personas/` (5 VPs)
- `packages/central-intelligence/src/kernel/world-model/` + `forecasting-engine/`
- `packages/aop-compiler/src/` (parser / compiler / validator / renderer)
- `packages/autonomy-governance/src/` (caps / slo / handoff)
- `packages/connectors/src/adapters/` (4 -real + 4 sandbox)
- `packages/compliance-plugins/src/countries/` (ae au br ca de fr gb in jp kr mx sg tz)
- `packages/genui/src/` (42 component catalogue, AdaptiveRenderer)
- `packages/observability/src/` (OTel SDK 0.218)
- `services/mcp-server-process-intel/` (9 PA tools + pm4py)
- `apps/owner-portal/src/app/` (/onboarding /plan /skills + 20+ pages)
- `Docs/COMPLIANCE/` (10 country/policy docs + Art.30 + SOC2)
- `eslint-rules/no-jurisdictional-literal.js`
- `.github/workflows/` (21 yml files including security-route-coverage, audit-not-yet-wired)
- `monitoring/grafana-dashboards/` (4 base + D6 per-agent panels)
- `.planning/parity-litfin/00-STATUS-2026-05-18.md` (canonical reverse audit)

**LITFIN capabilities surveyed:**
- `src/core/brain/{composition-orchestrator, hooks, active-inference, attention-schema, default-mode-network, dual-process, basal-ganglia, cerebellum, self-discover, lats, autonomy, simulation, nudges}/`
- `src/core/credit-mind/{world-model/{jepa, bootstrap-cohort, regime-detector, trajectory-predictor, world-rollouts, world-model-explainer}, prm}/`
- `src/core/sovereign-brain/{actions, tools}/` (17 actions + 6 tools + audit-ledger + decision-trace)
- `src/core/jurisdictions/{tz, ke, eu, uk, ug, rw, global, instances, audit/hardcode-detector}/`
- `src/core/mcp/` (litfin-mcp-server.ts, tier-router, universal-tool-adapter)
- `src/core/skills/marketplace/` (curriculum, skill-registry, skill-md-loader, skill-runner)
- `src/core/heartbeat/sleep-passes/` (8 sleep passes: distill-cot, lesson-rot, md-morning-brief, precompute-counterfactuals, proactive-nudges, reanalyze-failed-decisions)
- `src/features/{central-command, generative-ui, litfin-ai, litfin-ai-ops}/`
- `src/features/central-command/md/process-mining/` (mine + bottleneck + conformance + redesign-proposer)
- `src/test/regression/{zod, rls, rate-limit}-coverage-regression.test.ts`
- `src/lib/__tests__/ssrf-coverage-regression.test.ts`
- `src/app/api/__tests__/auth-coverage-regression.test.ts`
- `src/core/sovereign-brain/actions/__tests__/audit-ledger-integrity-regression.test.ts`
- `src/core/connectors/{avoka, cno, gmail, kony, mambu, salesforce, temenos}/`
- `.github/workflows/` (security.yml, red-team.yml, ci.yml)

**Greps performed**: orchestrator, hook-chain, hook-bus, sub-md, vp-personas, sovereign, ledger-integrity, ssrf, zod, rls, auth-coverage, rate-limit, world-model, forecasting, mcp-server, aop, jurisdictions, decision-trace, four-eye, killswitch, policy-gate, memory-tool, kind:, registerHook.

---

## Parity matrix (38 capabilities)

| # | BOSSNYUMBA capability | LITFIN status | Path in BOSSNYUMBA | Path in LITFIN (if exists) | Notes |
|---|---|---|---|---|---|
| 1 | Orchestrator main-loop (while-loop, budget+plan-driven) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/main-loop.ts` (658 LOC) | absent (composition-orchestrator is Best-of-N, not a main loop) | LITFIN runs `composition-orchestrator/orchestrator.ts` which is a one-shot Best-of-N + PRM scorer over reasoning chains — not a sustained while-loop with budget/plan/checkpoint state. |
| 2 | 9-stage HookChain ADT (`session-start`/`user-prompt-submit`/`pre-tool-use`/`post-tool-use`/`pre-compact`/`post-compact`/`subagent-start`/`subagent-stop`/`stop`) | **EQUIVALENT (different shape)** | `packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts` (525 LOC) | `src/core/brain/hooks/hook-bus.ts` (registration-bus with 9 events) | LITFIN's hook-bus has 9 events but registers handlers globally; BOSSNYUMBA's chain is per-decision pipeline with 9 outcome ADT. LITFIN missing: `transform`, `additional-context`, `defer`, `updated-input` outcomes. |
| 3 | HookResult ADT (9 outcomes incl `transform`/`updated-input`/`additional-context`/`defer`) | **PARTIAL** | `packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts` | `src/core/brain/hooks/hook-bus.ts` (5 decisions: allow/deny/ask/defer/modify) | LITFIN has 5 decisions; BOSSNYUMBA has 9. Missing 4. |
| 4 | Orchestrator Budget (token/cost/time tracker) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/budget.ts` (198 LOC) | absent | LITFIN has cost-circuit-breaker but no orchestrator-scoped budget. |
| 5 | Orchestrator Plan (PlanStore advanceable goals) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/plan.ts` (216 LOC) | partial — `src/core/brain/autonomy/outer-planner.ts` exists but is autonomy-tier, not main-loop plan | LITFIN's outer-planner is for autonomy levels, not orchestrator goal-driven loop. |
| 6 | Orchestrator Checkpoint (Session persistence) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/checkpoint.ts` (124 LOC) | absent | LITFIN has no checkpointed session store. |
| 7 | ContextBudget + compactIfOver | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/context-budget.ts` (201 LOC) | absent | LITFIN compacts ad-hoc in `consolidation.ts` but no token-budgeted compact-on-threshold. |
| 8 | ToolSearch (lazy descriptor retrieval) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/context-budget.ts` (ToolDescriptor) | absent | LITFIN passes full BrainToolSpec on every call. |
| 9 | MemoryTool (Anthropic protocol /memories) | **AHEAD** | `packages/central-intelligence/src/kernel/orchestrator/memory-tool.ts` (452 LOC) | `src/core/brain/memory-tool-adapter.ts` (bidirectional wire-format adapter to Anthropic Managed Agents 2026-04-01 beta) | LITFIN has the WIRE-FORMAT bridge; BOSSNYUMBA implements only one direction. **Backport candidate to BOSSNYUMBA.** |
| 10 | PermissionMode (6-mode: plan/bypass/ask/dont-ask/...) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/permission-mode.ts` (163 LOC) | partial — `four-eye/approval` is 2-mode only | LITFIN has four-eye/approval-gate but no per-tool permission ADT. |
| 11 | SubMdSpawn (Agent contract for sub-agents) | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/decision.ts` (Decision: `spawn_sub_md`) | absent | LITFIN has process-mining juniors but no spawn-as-decision protocol. |
| 12 | 8 sub-MDs (maintenance.dispatch, complaint.triage, leasing-after-hours, arrears-chaser, lease-coordinator, kra-filing, weekly-report-compiler, vendor-onboarding) | **MISSING** | `packages/central-intelligence/src/kernel/sub-mds/` | absent (LITFIN has process-mining juniors for observe/map/diagnose/research/redesign but no domain-specific sub-MDs) | Each BOSSNYUMBA sub-MD is observe→map→redesign→automate→persona scaffold. |
| 13 | 5 VP personas (vp-finance, vp-growth, vp-operations, vp-people, vp-risk-compliance) | **MISSING** | `packages/central-intelligence/src/kernel/vp-personas/` | absent | LITFIN has persona-drift detector but no role-VP personas. |
| 14 | Self-extension keystone | **MISSING** | `packages/central-intelligence/src/kernel/orchestrator/self-extension.ts` (389 LOC) | partial — `src/core/skills/marketplace/skill-proposal-store.ts` | LITFIN can propose skills (approve-skill-proposal sovereign action) but no self-edit-skill kernel hook. |
| 15 | AOP compiler (NL → Skill+cron+monitor+hook) | **MISSING** | `packages/aop-compiler/` (parser / compiler / validator / renderer) | absent | LITFIN has Skill manifests + skill-md-loader but no NL→artifact compiler. |
| 16 | MCP process-intel server (pm4py sidecar + 9 PA tools) | **PARTIAL** | `services/mcp-server-process-intel/` | partial — `src/core/mcp/litfin-mcp-server.ts` + `src/features/central-command/md/process-mining/` (TS-only bottleneck-detector + conformance-checker + miner + redesign-proposer) | LITFIN has process-mining in-process, no pm4py sidecar, no MCP server exposing PA tools as MCP. |
| 17 | Autonomy governance (caps + SLO + canary auto-rollback + PMS-bench) | **PARTIAL** | `packages/autonomy-governance/src/` (caps / slo / handoff) | partial — `src/core/brain/autonomy/{evaluator,executor,levels,outer-planner}.ts` + `src/core/autopoiesis/canary/canary-runner.ts` | LITFIN has autonomy levels + canary runner (SPRT) but no SLO module + no per-operation caps surface. |
| 18 | Forecasting engine (world model + sandbox + 10 forecasters + 6 scenarios + scoring + predicted-vs-actual feedback) | **DIVERGED** | `packages/forecasting-engine/src/` (causal / discrete-event / stochastic / time-series + sandbox + scenarios + feedback) | divergent — `src/core/brain/forecasting.ts` (5-family forecaster: pipeline/portfolio/cash/capacity/...) + `src/core/credit-mind/world-model/{jepa, world-rollouts, bootstrap-cohort, regime-detector}/` | LITFIN's forecasting is credit-portfolio-tuned with deep JEPA + cohort priors. BOSSNYUMBA's is property-mgmt-tuned with 4 forecaster families + scenario library. Neither dominates; different domain shapes. |
| 19 | 9 hooks bound to real production ports (cost-circuit / four-eye / permission / pii-scrub / rate-limit / sandbox-divert / tool-denylist / audit-emission / ledger-seal) | **PARTIAL** | `packages/central-intelligence/src/kernel/orchestrator/hooks/{pre,post,stop}/` | partial — `src/core/brain/hooks/builtin-hooks.ts` (killswitch + tier + path + feature-flag + rate-limit + DP-budget) | LITFIN has 6 built-in hooks; BOSSNYUMBA has 9 with real port bindings. Missing in LITFIN: sandbox-divert, audit-emission, ledger-seal. |
| 20 | 5 real connector adapters (M-Pesa Daraja, KRA eRITS, NIDA, GePG, OPay) sandbox/prod | **DIVERGED** | `packages/connectors/src/adapters/{mpesa,kra-erits,nida,gepg,opay}-real.ts` (1418 LOC) | divergent — `src/core/connectors/{avoka, cno, gmail, kony, mambu, salesforce, temenos}/` (banking-stack connectors) | LITFIN connectors target banking-system-of-record; BOSSNYUMBA's target TZ payment/regulatory rails. Different surfaces. |
| 21 | JurisdictionalRules pluggable module (TZ + KE + NG) + eslint `no-jurisdictional-literal` | **AHEAD** | `packages/compliance-plugins/src/countries/` (16 country plugins) + `eslint-rules/no-jurisdictional-literal.js` | `src/core/jurisdictions/{tz, ke, eu, uk, ug, rw, global, instances/{tanzania, kenya-skeleton}, audit/hardcode-detector}/` (10+ jurisdictions + audit + TZ priors) | LITFIN has deeper jurisdiction registry with `audit/hardcode-detector` + `tz-priors` + `instance-framework`. BOSSNYUMBA has eslint guard. **Both directions have something to learn.** |
| 22 | 42-kind dynamic UI catalogue + AdaptiveRenderer | **PARTIAL** | `packages/genui/src/components/` (42 components) + `AdaptiveRenderer.tsx` | partial — `src/features/generative-ui/` (12 components: ChartVegaLite, FormSchemaDriven, MapMapbox, MetricGrid, TableTanStack, MermaidDiagram, MarkdownRender, SourceTrail, ChartRechartsTimeSeries, ConfirmDialog, GenerativeUiMessage) | 30 components missing in LITFIN: ApprovalDialog, CalendarView, ChatEmbed, CodeBlock, ComparisonTable, DashboardGrid, DataTable, DataflowDiagram, DecisionTrace, DiffView, EvidenceCard, FilePreview, Gauge, GeoFence, Heatmap, ImageAnnotation, Kanban, KpiGrid, LiveCounter, MediaGrid, MarkdownCard, MetricSparkline, MultistepWizard, NotificationToast, OrgChart, PdfViewer, PrefillForm, PromptSuggestions, SignaturePad, SliderInput, Timeline, Tree, UnknownKindCard, WorkflowStepper. |
| 23 | Owner UI (/onboarding + /plan + /skills + 20+ pages + slash commands) | **PARTIAL** | `apps/owner-portal/src/app/` (20+ pages) | partial — `src/app/(admin)/org-admin/`, `src/app/(litfin-admin)/litfin-admin/` cover analogous surfaces but not packaged as "owner portal" | LITFIN has the admin surfaces; framing differs. |
| 24 | 10 Playwright E2E journeys | **PARTIAL** | `e2e/tests/journeys/` (10 + critical-flows/) | partial — `e2e/{borrower, officer, compliance, journeys}/` (15+ specs) | Equivalent count. Different scenarios (borrower vs tenant). |
| 25 | Production deployment (docker-compose + k8s Kustomize + CD) | **AHEAD on k8s** | `docker-compose.production.yml` + `k8s/{Chart.yaml, helm/, templates/, values.yaml, *-cron.yaml}` | `k8s/{base, cert-manager, external-secrets, helm, keda, knative, linkerd, policies}/` | LITFIN has cert-manager + external-secrets + KEDA + Knative + Linkerd; BOSSNYUMBA has helm chart + 3 cron jobs (consolidation, sovereign-ledger-verify, wake-loop) but lacks full service-mesh layer. **LITFIN ahead on prod k8s surface.** |
| 26 | Compliance docs (TZ/KE/NG/EU DPA runbooks + Art.30 RoPA + SOC2 + DPIA template + breach-notification) | **AHEAD on TZ depth** | `Docs/COMPLIANCE/` (10 docs: PDPA-tz, DPA-ke, NDPA-ng, GDPR-eu, SOC2, breach-notification, consent-revocation, cross-border, dpia-template, right-to-erasure-playbook, lawful-basis-register.json, GDPR_ARTICLE_30) | `Docs/compliance/tanzania/{PDPA-2022-COMPLIANCE-MAP, DPIA-LITFIN-AI-2026-05, BOT-CYBERSECURITY-2026-MAP, DATA-RESIDENCY-ATTESTATION-2026-Q2}` + `Docs/parity-tests/regulator-pack/EU-AI-ACT-COMPLIANCE-PACK` | LITFIN has TZ regulator-pack depth (BOT-Cybersecurity, residency-attestation, DPIA-instance); BOSSNYUMBA has broader country coverage but less per-country depth. |
| 27 | Observability — OTel SDK 0.218 exporter + 6 Grafana dashboards + 10 Prometheus alerts | **PARTIAL** | `packages/observability/src/` (tracer, exporter-binding, langfuse-adapter, judge-confidence-histograms) + `monitoring/grafana-dashboards/{bossnyumba-ai,overview,payments,agent-spans}.json` | partial — `src/lib/observability/{sentry, error-reporter, error-store}.ts` (Sentry-only) | LITFIN has Sentry only; no OTel, no Grafana, no Prometheus alerts. **Major gap.** |
| 28 | CI gates (no-jurisdictional-literal eslint, audit-not-yet-wired, audit-no-no-op-hooks, gitleaks allowlist, security-route-coverage workflow) | **PARTIAL** | `eslint-rules/no-jurisdictional-literal.js` + `.github/workflows/{audit-not-yet-wired,security-route-coverage,red-team,codeql,kernel-eval,openapi-drift,sbom}.yml` (21 workflows) | partial — `.github/workflows/{ci,security,red-team}.yml` (3 workflows) + `src/core/jurisdictions/audit/hardcode-detector.ts` (runtime detector, no eslint) | LITFIN has jurisdiction hardcode detector but not as eslint rule; LITFIN has 3 workflows vs BOSSNYUMBA's 21. |
| 29 | **Universal auth-coverage regression scanner (906 routes locked)** | **MISSING (LITFIN ahead)** | absent | `src/app/api/__tests__/auth-coverage-regression.test.ts` | Walks every `src/app/api/**/route.ts` and asserts each imports a known auth helper or is in `ALLOWED_PUBLIC_ROUTES` with stated reason. **Reverse-port priority 1.** |
| 30 | **Universal SSRF-coverage regression scanner** | **MISSING (LITFIN ahead)** | partial — `packages/agent-platform/src/__tests__/webhook-delivery-ssrf.test.ts` (single test) | `src/lib/__tests__/ssrf-coverage-regression.test.ts` | Walks every server-side `.ts` and asserts every `fetch()` is preceded by `validateOutboundUrl` / same-origin / allow-listed-with-reason. **Reverse-port priority 2.** |
| 31 | **Universal RLS-coverage regression scanner** | **MISSING (LITFIN ahead)** | absent | `src/test/regression/rls-coverage-regression.test.ts` | Walks every table for RLS policy. 55-table remediation done. **Reverse-port priority 3.** |
| 32 | **Universal Zod-validation coverage regression scanner** | **MISSING (LITFIN ahead)** | partial — `packages/genui/src/__tests__/` does schema validation tests | `src/test/regression/zod-coverage-regression.test.ts` | Walks every mutating route handler and asserts Zod-`.safeParse`/`.parse` or allow-listed. **Reverse-port priority 4.** |
| 33 | **Universal rate-limit coverage regression scanner** | **MISSING (LITFIN ahead)** | absent | `src/test/regression/rate-limit-coverage-regression.test.ts` | 5th scanner. **Reverse-port priority 5.** |
| 34 | **Sovereign-ledger hash-chain integrity regression** (field-by-field tamper detection + canonical-order pin + collision resistance + perf cap + genesis pin) | **PARTIAL (LITFIN ahead)** | `packages/database/src/services/sovereign-action-ledger.service.ts` (Drizzle service with `pg_advisory_lock`) + `packages/database/src/schemas/sovereign-action-ledger.schema.ts` (schema in transit) — no regression test | `src/core/sovereign-brain/actions/{audit-ledger.ts, __tests__/audit-ledger-integrity-regression.test.ts}` (BASELINE) | LITFIN's `computeLedgerHash` is the canonical pattern BOSSNYUMBA's schema mirrors. **The integrity regression test should be ported into BOSSNYUMBA `packages/database/src/services/__tests__/`.** |
| 35 | Sovereign actions (17 in LITFIN vs 18 platform.* in BOSSNYUMBA) | **EQUIVALENT** | `packages/central-intelligence/src/kernel/tool-spec/hq-tools/` (18 platform.* tools) | `src/core/sovereign-brain/actions/` (17 actions + `tools/` registry) | Different surface area (BOSSNYUMBA: tenant/property mgmt; LITFIN: lending policy). |
| 36 | Four-eye approval gate | **EQUIVALENT** | `packages/central-intelligence/src/kernel/four-eye-approval.ts` | `src/core/governance/four-eye/` (multiple files incl `sovereign-policy-coverage.test.ts`) | Both shipped. |
| 37 | Killswitch HALT short-circuit | **EQUIVALENT** | `packages/central-intelligence/src/kernel/killswitch.ts` + hook | `src/core/brain/killswitch.ts` + `set-killswitch-level.ts` | Both shipped. |
| 38 | Persona drift (24-dim vector vs 1-dim Jaccard) | **AHEAD on BOSSNYUMBA** | `packages/central-intelligence/src/kernel/persona-drift/vectors.ts` (24-dim) | `src/core/brain/drift-detector.ts` (Jaccard scalar) | Already in BOSSNYUMBA Top-15 list. |
| 39 | Cognitive architecture stack (active-inference + attention-schema + DMN + dual-process + basal-ganglia + cerebellum + LATS + PRM + SELF-DISCOVER + JEPA-cashflow + world-rollouts) | **MISSING (LITFIN ahead)** | partial — kernel has `world-model/` (regime-detector, trajectory, state-vectors) | `src/core/brain/{active-inference, attention-schema, default-mode-network, dual-process, basal-ganglia, cerebellum, self-discover, lats}/` + `src/core/credit-mind/{prm, world-model/jepa, world-model/world-rollouts}/` | LITFIN's neuro-inspired tree is much deeper. Most is credit-tuned but the framework scaffolding (active-inference / dual-process / metacognitive-monitor) is generic. **Reverse-port candidate.** |
| 40 | Proactive nudge pipeline (observe → detect → notify, HITL-gated) | **PARTIAL (LITFIN ahead)** | `packages/central-intelligence/src/kernel/proactive-nudge.ts` (single file) | `src/core/brain/nudges/nudge-service.ts` (hash-chained + dedup + lifecycle + cooldown) + `src/core/heartbeat/sleep-passes/proactive-operator-nudges.ts` + `proactive-borrower-nudges.ts` | LITFIN's is full pipeline w/ HMAC chain + dedup + cooldown + lifecycle (read/dismiss/snooze). **Reverse-port candidate.** |
| 41 | Decision simulator (5 simulators: automation-activation, field-proposal, process-redesign, reject-redesign, sovereign-action) | **MISSING (LITFIN ahead)** | absent | `src/core/brain/simulation/{decision-simulator.ts, simulators/{automation-activation-simulator, field-proposal-simulator, process-redesign-simulator, reject-redesign-simulator, sovereign-action-simulator}.ts}/` | Pre-commit "what if I commit this decision?" preview. **Strong reverse-port candidate.** |
| 42 | Heartbeat sleep-passes (8 background passes: distill-cot, lesson-rot, md-morning-brief, precompute-counterfactuals, proactive-nudges, reanalyze-failed-decisions) | **PARTIAL** | scattered — `kernel/consolidation`, `kernel/reflexion`, `kernel/feedback` exist but not as unified heartbeat-tick + sleep-pass framework | `src/core/heartbeat/{heartbeat-tick.ts, sleep-tick.ts, sleep-passes/}` | LITFIN has the canonical sleep-cycle framework. |
| 43 | Skills marketplace + curriculum + skill-runner + skill-md-loader | **PARTIAL** | `packages/central-intelligence/src/kernel/skill-library/` + `packages/aop-compiler/` | `src/core/skills/{marketplace/{curriculum, skill-md-loader, skill-runner, starter-skills, skill-proposal-store}, boot-loader, skill-registry}.ts` | Different shapes; LITFIN has a marketplace concept BOSSNYUMBA doesn't. |
| 44 | Process-mining feature surface (mine + bottleneck-detector + conformance-checker + redesign-proposer + pipeline-coordinator + event-log-service) | **AHEAD on tooling** | `services/mcp-server-process-intel/` (pm4py sidecar) | `src/features/central-command/md/process-mining/{process-miner, bottleneck-detector, conformance-checker, redesign-proposer, pipeline-coordinator, event-log-service}.ts` | LITFIN ships the TS pipeline in-process. BOSSNYUMBA ships pm4py-MCP. Different envelopes, both valid. |
| 45 | Defection-probe / alignment-faking probe / activation probe | **MISSING (LITFIN ahead)** | absent | `src/core/brain/{alignment-faking-probe.ts, defection-probe, activation-probe}` (also in `__tests__`) | These are research-grade safety probes the kernel runs against itself. **Reverse-port candidate.** |
| 46 | Composition-orchestrator (Best-of-N + PRM + SELF-DISCOVER + LATS bridge) | **MISSING (LITFIN ahead)** | absent | `src/core/brain/composition-orchestrator/{orchestrator, lats-bridge, index}.ts` + `src/core/credit-mind/prm/` + `src/core/brain/self-discover/` | This is the reasoning-quality kernel: take a task, pick a SELF-DISCOVER structure, ask sensor for N candidate chains, score with PRM, pick winner. **Strong reverse-port candidate (orthogonal to BOSSNYUMBA's orchestrator main-loop — composes WITHIN a single router.call).** |

---

## Forward port plan (LITFIN ← BOSSNYUMBA)

Ranked by closing-cost-to-value (cost in hours, value in shipping leverage). 18 items.

### Wave 1 — orchestrator substrate (~80h)

1. **Orchestrator main-loop + Decision ADT + dispatch** (~24h)
   - Source: `packages/central-intelligence/src/kernel/orchestrator/{main-loop, decision}.ts`
   - Target: `src/core/brain/orchestrator/{main-loop, decision}.ts` (new)
   - Integration: thin wrapper that the composition-orchestrator runs INSIDE; LITFIN's existing kernel pipeline becomes the inner-loop dispatcher. Existing `kernel.ts` stays as legacy/coexist (BOSSNYUMBA pattern).
2. **HookChain ADT (9 outcomes) over LITFIN's existing hook-bus** (~12h)
   - Source: `packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts`
   - Target: `src/core/brain/hooks/hook-chain.ts` (new; reuses `hook-bus.ts` registrations under the hood)
   - Integration: LITFIN's `HookDecision` enum gains 4 outcomes (`transform`, `updated-input`, `additional-context`, `defer`). Chain runner short-circuits on deny/ask/sandbox/stop; `updated-input` + `additional-context` continue.
3. **Budget + Plan + Checkpoint + ContextBudget + ToolSearch + PermissionMode** (~28h)
   - Source: `packages/central-intelligence/src/kernel/orchestrator/{budget, plan, checkpoint, context-budget, permission-mode}.ts`
   - Target: `src/core/brain/orchestrator/`
   - Integration: Plan replaces ad-hoc task-graph; ContextBudget replaces ad-hoc compaction in consolidation.ts; PermissionMode supersedes four-eye-only gate.
4. **Self-extension keystone + SubMdSpawn decision** (~16h)
   - Source: `packages/central-intelligence/src/kernel/orchestrator/self-extension.ts` + `decision.ts:spawn_sub_md`
   - Target: `src/core/brain/orchestrator/self-extension.ts`
   - Integration: bind to existing `skill-proposal-store.ts`; sub-MD spawn integrates with `process-mining` juniors.

### Wave 2 — sub-MDs + AOP + MCP (~120h)

5. **Sub-MD scaffold (observe→map→redesign→automate→persona)** + 2 priority sub-MDs (arrears-chaser → "delinquency-officer-junior"; complaint-triage → already exists as concept) (~40h)
   - Source: `packages/central-intelligence/src/kernel/sub-mds/{shared, arrears-chaser, complaint-triage}/`
   - Target: `src/core/brain/sub-mds/`
   - Integration: each sub-MD becomes a "department officer" persona. Arrears-chaser maps to LITFIN's existing arrears workflow.
6. **AOP compiler (NL → Skill+cron+monitor+hook)** (~30h)
   - Source: `packages/aop-compiler/src/{parser, compiler, validator, renderer}/`
   - Target: `packages/aop-compiler/` (new package) OR `src/core/aop/`
   - Integration: feeds the existing `skill-md-loader.ts` registration path; NL DSL caller is the chat-based skill-creation UI.
7. **MCP process-intel server + pm4py sidecar** (~30h)
   - Source: `services/mcp-server-process-intel/`
   - Target: new top-level `services/mcp-server-process-intel/` (LITFIN currently has no `services/` directory — first one)
   - Integration: exposes existing in-process miner/bottleneck/conformance as MCP tools to other Claude Code instances + pm4py for heavier algorithms.
8. **5 VP personas (vp-finance, vp-growth, vp-operations, vp-people, vp-risk-compliance)** (~20h)
   - Source: `packages/central-intelligence/src/kernel/vp-personas/`
   - Target: `src/core/brain/vp-personas/`
   - Integration: persona registry expansion; each VP has its own scope, tool denylist, and role-specific system-prompt fragment.

### Wave 3 — Observability + production hardening (~60h)

9. **OpenTelemetry stack (SDK 0.218, exporter-binding, langfuse-adapter, tracer)** (~14h)
   - Source: `packages/observability/src/{tracer, exporter-binding, langfuse-adapter, judge-confidence-histograms}.ts`
   - Target: `src/lib/observability/otel/` (extends existing observability)
   - Integration: instruments every kernel-step span + sub-MD lifecycle. LITFIN has Sentry; OTel is additive.
10. **6 Grafana dashboards + 10 Prometheus alerts** (~10h)
    - Source: `monitoring/grafana-dashboards/{bossnyumba-ai, overview, payments, agent-spans, *-D6}.json`
    - Target: `monitoring/grafana-dashboards/litfin-{ai,portfolio,credit-decisions,agent-spans}.json`
    - Integration: trivial renames + LITFIN-specific metric names.
11. **30 missing genui components** (~30h, ~1h each)
    - Source: `packages/genui/src/components/{ApprovalDialog, CalendarView, DataTable, DataflowDiagram, DecisionTrace, DiffView, EvidenceCard, Gauge, Heatmap, ImageAnnotation, Kanban, KpiGrid, LiveCounter, MarkdownCard, MediaGrid, MetricSparkline, MultistepWizard, NotificationToast, OrgChart, PdfViewer, PrefillForm, PromptSuggestions, SignaturePad, SliderInput, Timeline, Tree, WorkflowStepper, FilePreview, GeoFence, ChatEmbed, CodeBlock, ComparisonTable, DashboardGrid}.tsx`
    - Target: `src/features/generative-ui/`
    - Integration: each component + Zod schema; register in AdaptiveRenderer kind-switch.
12. **AdaptiveRenderer + registry pattern + schema-driven validation** (~6h)
    - Source: `packages/genui/src/{AdaptiveRenderer, registry, schemas, validate}.ts`
    - Target: `src/features/generative-ui/AdaptiveRenderer.tsx` (replaces current per-component switch in `GenerativeUiMessage.tsx`)

### Wave 4 — Connectors + autonomy + forecasting (~50h)

13. **Autonomy-governance SLO module + canary auto-rollback wiring** (~12h)
    - Source: `packages/autonomy-governance/src/{slo, handoff}/`
    - Target: `src/core/brain/autonomy/{slo, handoff}/`
    - Integration: existing `outer-planner.ts` + `evaluator.ts` gain SLO-gate.
14. **Forecasting-engine scenario library + scoring + predicted-vs-actual feedback** (~16h)
    - Source: `packages/forecasting-engine/src/{scenarios, scoring, feedback}/`
    - Target: `src/core/brain/forecasting-engine/` (extends existing `forecasting.ts`)
    - Integration: feedback loop captures predicted vs actual; existing JEPA + world-rollouts become forecaster implementations within the new framework.
15. **Compliance-plugins multi-country registry (lift Singapore, India, Australia, Brazil, Mexico, S Korea, Japan, UAE plugins for LITFIN's KE/RW/UG/UK expansion)** (~12h)
    - Source: `packages/compliance-plugins/src/countries/{sg, in, au, br, mx, kr, jp, ae}.ts`
    - Target: `src/core/jurisdictions/instances/`
    - Integration: existing `jurisdiction-registry.ts` ingests new country plugins.
16. **`no-jurisdictional-literal` eslint rule** (~4h)
    - Source: `eslint-rules/no-jurisdictional-literal.js`
    - Target: `eslint-rules/no-jurisdictional-literal.js`
    - Integration: catches hard-coded `'TZ'`/`'KE'`/currency strings outside the jurisdiction registry.

### Wave 5 — Misc closing items (~40h)

17. **Audit-not-yet-wired CI gate + audit-no-no-op-hooks** (~6h)
    - Source: `.github/workflows/audit-not-yet-wired.yml`
    - Target: `.github/workflows/audit-not-yet-wired.yml`
18. **Owner-portal `/onboarding`, `/plan`, `/skills` route pattern** (~12h)
    - Source: `apps/owner-portal/src/app/{onboarding,plan,skills}/page.tsx`
    - Target: `src/app/(admin)/org-admin/{onboarding,plan,skills}/page.tsx`
    - Integration: surfaces existing skill-registry + plan-store to admin UI.

---

## Reverse port plan (BOSSNYUMBA ← LITFIN)

What BOSSNYUMBA is missing from LITFIN. Ranked.

### 1. Universal coverage scanners (5 of them) — ~16h total

These are the highest-leverage backport. Each is a pure vitest scanner that walks the API surface and fails the PR on any uncovered route. No infra dependencies.

| Scanner | Source path in LITFIN | Target path in BOSSNYUMBA | Effort |
|---|---|---|---|
| auth-coverage | `src/app/api/__tests__/auth-coverage-regression.test.ts` | `services/api-gateway/src/__tests__/auth-coverage-regression.test.ts` (plus per-service variants) | 4h |
| ssrf-coverage | `src/lib/__tests__/ssrf-coverage-regression.test.ts` | `packages/agent-platform/src/__tests__/ssrf-coverage-regression.test.ts` (extend existing single-test file) | 3h |
| rls-coverage | `src/test/regression/rls-coverage-regression.test.ts` | `packages/database/src/__tests__/rls-coverage-regression.test.ts` | 3h |
| zod-coverage | `src/test/regression/zod-coverage-regression.test.ts` | per-service variant + `packages/genui/` already covered | 3h |
| rate-limit-coverage | `src/test/regression/rate-limit-coverage-regression.test.ts` | `services/api-gateway/src/__tests__/rate-limit-coverage-regression.test.ts` | 3h |

**Integration notes**: The LITFIN scanners hardcode an absolute path to `LITFIN PROJECT/src/...`. The backport must read repo root from `process.cwd()` and walk the BOSSNYUMBA monorepo's many `services/*/src/routes/`, `packages/*/src/routes/`, etc. The structural pattern (signal detection + allowlist with stated reason) is the load-bearing part — the file-walk implementation needs to be re-written for BOSSNYUMBA's polyrepo layout.

### 2. Sovereign-ledger hash-chain integrity regression — ~4h

- Source: `src/core/sovereign-brain/actions/__tests__/audit-ledger-integrity-regression.test.ts` + `audit-ledger.ts` (already mirrored in `packages/database/src/schemas/sovereign-action-ledger.schema.ts`)
- Target: `packages/database/src/services/__tests__/sovereign-action-ledger.integrity-regression.test.ts`
- 5 properties covered: field-by-field tamper detection, canonical-order pin, hash collision resistance, large-chain perf (<50ms for 200 rows), genesis pin.
- **Drop-in port** — same `computeLedgerHash` shape.

### 3. Decision simulator (pre-commit "what if" preview) — ~12h

- Source: `src/core/brain/simulation/{decision-simulator, simulators/{automation-activation, field-proposal, process-redesign, reject-redesign, sovereign-action}-simulator}.ts`
- Target: `packages/central-intelligence/src/kernel/decision-simulation/`
- 5 simulator kinds. The sovereign-action-simulator is the highest-value: simulates a `platform.evict_tenant` / `platform.payout_owner` / `platform.set_killswitch` BEFORE four-eye approval shows the simulated trace + cost + risk-band.

### 4. Proactive-nudge pipeline (HMAC-chained + dedup + cooldown + lifecycle) — ~10h

- Source: `src/core/brain/nudges/nudge-service.ts` + `src/core/heartbeat/sleep-passes/{proactive-operator-nudges, proactive-borrower-nudges}.ts` + `nudge-rules.ts`
- Target: `packages/central-intelligence/src/kernel/proactive-nudge/` (replaces single `proactive-nudge.ts`)
- LITFIN's is: hash-chained inserts (audit), dedup window on `dedup_key`, cooldownMs per rule, lifecycle (active/read/dismissed/snoozed).

### 5. Memory tool wire-format adapter (Anthropic Managed Agents 2026-04-01) — ~6h

- Source: `src/core/brain/memory-tool-adapter.ts`
- Target: extend `packages/central-intelligence/src/kernel/orchestrator/memory-tool.ts` with the same bidirectional wire-format methods.
- Enables LITFIN-style external-orchestrator integration of BOSSNYUMBA's MemoryTool.

### 6. Cognitive-architecture framework scaffolding (active-inference, dual-process, metacognitive-monitor) — ~14h

- Source: `src/core/brain/{active-inference, dual-process, attention-schema, default-mode-network}/` (the GENERIC parts, not the credit-tuned ones)
- Target: `packages/central-intelligence/src/kernel/cognitive-arch/`
- Picks up: hierarchical predictor, generative model, policy selector (active-inference); Type-1/Type-2 runners + gate + metacognitive-monitor (dual-process); attention-schema-builder + introspector; DMN scheduler.
- These are research-quality primitives that compose with BOSSNYUMBA's orchestrator.

### 7. Composition-orchestrator (Best-of-N + PRM + SELF-DISCOVER + LATS) — ~16h

- Source: `src/core/brain/composition-orchestrator/{orchestrator, lats-bridge}.ts` + `src/core/credit-mind/prm/` + `src/core/brain/self-discover/`
- Target: `packages/central-intelligence/src/kernel/composition/`
- Slots WITHIN a single `router.call` in BOSSNYUMBA's main-loop: high-stakes tasks pick a SELF-DISCOVER structure, ask sensor for N candidate chains, score with PRM, pick winner. Orthogonal to the orchestrator.

### 8. Alignment-faking + defection + activation probes — ~10h

- Source: `src/core/brain/{alignment-faking-probe.ts, defection-probe, activation-probe}`
- Target: `packages/central-intelligence/src/kernel/probes/`
- Research-grade self-tests the kernel runs against itself periodically.

### 9. Jurisdiction `hardcode-detector` runtime audit — ~3h

- Source: `src/core/jurisdictions/audit/hardcode-detector.ts`
- Target: pair with existing `eslint-rules/no-jurisdictional-literal.js` as a runtime complement (catches dynamic strings the eslint rule misses).

### 10. Process-mining TS pipeline (already in BOSSNYUMBA as pm4py-MCP; the TS in-process version is faster for small jobs) — ~8h

- Source: `src/features/central-command/md/process-mining/{process-miner, bottleneck-detector, conformance-checker, redesign-proposer}.ts`
- Target: `packages/process-intel/` (new lightweight in-process package; complements pm4py for jobs <10k events)

---

## Recommended next 3 backport waves (rank-ordered)

### Wave A — "Lock down BOSSNYUMBA's API surface" (Reverse) — ~20h, LOW risk

**Scope**: Universal coverage scanners (5) + sovereign-ledger hash-chain integrity regression.

**Prerequisites**: None. Scanners are pure file-walk vitest tests. Sovereign-ledger integrity regression uses already-implemented `computeLedgerHash` shape from the existing schema.

**Effort**: 20 hours.

**Risk**: LOW. New scanners may surface real auth/SSRF/RLS/Zod/rate-limit gaps in BOSSNYUMBA's 21 services + 30 packages. Plan for 8-16 hours of remediation on top, scoped wave-by-wave (start with each scanner in audit-only mode, ratchet to fail-PR after triage).

**Why first**: BOSSNYUMBA has shipped massive new surface area (Phase B/C/D/E/F). The cost of an auth-gap regression in production is catastrophic. LITFIN's pattern is proven — these scanners caught 3 cross-tenant breaches that manual review missed. Highest possible defensive-leverage per hour.

### Wave B — "Give LITFIN the orchestrator substrate" (Forward) — ~80h, MEDIUM risk

**Scope**: Wave 1 of the forward-port plan — orchestrator main-loop + 9-outcome HookChain + Budget + Plan + Checkpoint + ContextBudget + ToolSearch + PermissionMode + Self-extension keystone + SubMdSpawn.

**Prerequisites**:
- LITFIN's existing `composition-orchestrator` needs to be preserved AS-IS as the inner-loop reasoning step inside the main-loop's `router.call`. This is the design pattern BOSSNYUMBA already uses (`kernel.ts` legacy + `orchestrator/` new coexist).
- LITFIN's existing `hook-bus.ts` becomes the underlying registration mechanism; `hook-chain.ts` is a per-decision layer ON TOP that yields the 9-outcome ADT.

**Effort**: 80 hours over 3-4 weeks (2 engineers).

**Risk**: MEDIUM. The main-loop replaces LITFIN's linear kernel pipeline for the orchestrator path. Mitigation: feature-flag the new path per-tenant; default off; flip after PRM-scored quality matches old pipeline on the 222-eval suite + 50-legal-replay set.

**Why second**: This is the single biggest architectural lift. Once landed, LITFIN inherits BOSSNYUMBA's entire sub-MD / AOP-compiler / autonomy-governance / process-intel toolchain at marginal cost.

### Wave C — "Production observability + 30 genui components" (Forward) — ~50h, LOW risk

**Scope**: OpenTelemetry stack + 6 Grafana dashboards + 10 Prometheus alerts + 30 missing genui components + AdaptiveRenderer + registry pattern.

**Prerequisites**: None. OTel is additive to existing Sentry. Grafana dashboards are JSON imports. genui components are leaf React components.

**Effort**: 50 hours.

**Risk**: LOW. All additive; no replacement of existing primitives.

**Why third**: Genuinely visible value to operators ("we can see the brain doing things now"), and unblocks Wave-B SLO-driven canary auto-rollback (Wave 4 of the forward port) which needs span data.

---

## References

### BOSSNYUMBA paths inspected

- `packages/central-intelligence/src/kernel/orchestrator/{main-loop, hook-chain, budget, plan, checkpoint, context-budget, memory-tool, permission-mode, self-extension, decision, skill, batch-api, hooks/{pre-tool-use, post-tool-use, stop}}/`
- `packages/central-intelligence/src/kernel/sub-mds/{shared, maintenance-dispatch, complaint-triage, leasing-after-hours-contact, arrears-chaser, lease-coordinator, kra-filing-assistant, weekly-report-compiler, vendor-onboarding}/`
- `packages/central-intelligence/src/kernel/vp-personas/{vp-finance, vp-growth, vp-operations, vp-people, vp-risk-compliance}/`
- `packages/central-intelligence/src/kernel/{four-eye-approval, identity, killswitch, policy-gate, proactive-nudge, world-model, persona-drift}.ts`
- `packages/central-intelligence/src/kernel/tool-spec/hq-tools/` (18 `platform.*` tools)
- `packages/aop-compiler/src/{parser, compiler, validator, renderer}/`
- `packages/autonomy-governance/src/{caps, slo, handoff}/`
- `packages/forecasting-engine/src/{forecasters, scenarios, scoring, feedback, world-model, sandbox}/`
- `packages/forecasting/src/`
- `packages/connectors/src/adapters/{mpesa-real, kra-erits-real, gepg-real, nida-real, opay-adapter, mpesa-adapter, eardhi-adapter, credit-bureau-adapter, nida-adapter}.ts`
- `packages/compliance-plugins/src/countries/` (16 country plugins)
- `packages/genui/src/{components/, AdaptiveRenderer.tsx, registry.ts, schemas/, validate.ts, format.ts}` (42 components)
- `packages/observability/src/{tracer, exporter-binding, langfuse-adapter, judge-confidence-histograms, audit-logger, event-bus}.ts`
- `packages/ai-copilot/src/security/{tenant-isolation, pii-scrubber, prompt-shield, audit-hash-chain, canary-tokens, cost-circuit-breaker, output-guard, owasp-agentic-compliance}.ts`
- `packages/database/src/services/sovereign-action-ledger.service.ts` + `packages/database/src/schemas/sovereign-action-ledger.schema.ts`
- `services/mcp-server-process-intel/{src, python}/`
- `apps/owner-portal/src/app/{onboarding, plan, skills, jarvis, vendors, tenants, compliance, budgets, portfolio, analytics}/`
- `e2e/tests/journeys/`
- `monitoring/grafana-dashboards/{bossnyumba-ai, overview, payments, agent-spans}.json`
- `k8s/{Chart.yaml, helm/, templates/, values.yaml, consolidation-worker-cron.yaml, sovereign-ledger-verify-cron.yaml, wake-loop-cron.yaml}`
- `Docs/COMPLIANCE/` (10 docs)
- `eslint-rules/no-jurisdictional-literal.js`
- `.github/workflows/` (21 workflows)
- `.planning/parity-litfin/00-STATUS-2026-05-18.md`

### LITFIN paths inspected

- `src/core/brain/{composition-orchestrator, hooks, active-inference, attention-schema, default-mode-network, dual-process, basal-ganglia, cerebellum, self-discover, lats, autonomy, simulation, nudges, drift-detector, killswitch, policy-gate, adaptive-policy-gate, memory-tool-adapter, forecasting, alignment-faking-probe, ...}/`
- `src/core/credit-mind/{prm, world-model/{jepa, bootstrap-cohort, regime-detector, trajectory-predictor, world-rollouts, world-model-explainer, latent-dynamics, multimodal, online-learning, production-training}}/`
- `src/core/sovereign-brain/{sovereign-service.ts, actions/, actions/tools/, __tests__/}` (17 actions + 6 tools)
- `src/core/jurisdictions/{tz, ke, eu, uk, ug, rw, global, audit/hardcode-detector, instance-framework, instances/{tanzania, kenya-skeleton}, tz-priors, payment-channels, currencies, regulators, languages}/`
- `src/core/mcp/{litfin-mcp-server, tier-router, universal-tool-adapter, cost-persistence, health-scheduler}.ts`
- `src/core/skills/{marketplace/{curriculum, skill-md-loader, skill-runner, skill-proposal-store, starter-skills, skill-manifest}, boot-loader, skill-registry, skill-md-loader}.ts`
- `src/core/heartbeat/{heartbeat-tick, sleep-tick, nudge-rules, sleep-passes/{distill-cot-reservoir, lesson-rot-audit, md-morning-brief, precompute-counterfactuals, proactive-borrower-nudges, proactive-operator-nudges, reanalyze-failed-decisions}}.ts`
- `src/core/governance/{four-eye/, audit/, tier-policy/, constitution/}`
- `src/core/connectors/{avoka, cno, gmail, kony, mambu, salesforce, temenos, base-connector, connector-orchestrator, connector-factory, connector-registry, connector-bootstrap, connector-event-bus}/`
- `src/core/portfolio-mis/{concentration-engine, data-quality-service, portfolio-ai-service, portfolio-snapshot-service, stress-testing-engine, supervisory-pack-service}.ts`
- `src/features/{central-command/md/process-mining/, generative-ui/, litfin-ai/, litfin-ai-ops/, admin-portal/, borrower-portal/, officer-portal/}/`
- `src/features/central-command/md/process-mining/{process-miner, bottleneck-detector, conformance-checker, redesign-proposer, pipeline-coordinator, event-log-service}.ts`
- `src/test/regression/{rls, zod, rate-limit}-coverage-regression.test.ts`
- `src/lib/__tests__/ssrf-coverage-regression.test.ts`
- `src/app/api/__tests__/auth-coverage-regression.test.ts`
- `src/core/sovereign-brain/actions/__tests__/audit-ledger-integrity-regression.test.ts`
- `src/lib/{auth, security, observability, validation, rate-limiter, url-allowlist, tenant-resolver, webhook-verification}/`
- `src/core/{evals, parity-tests, intelligence, intelligence-orchestrator, sagas, neural-spine, autopoiesis}/`
- `k8s/{base, cert-manager, external-secrets, helm, keda, knative, linkerd, policies}/`
- `Docs/compliance/tanzania/{PDPA-2022-COMPLIANCE-MAP, DPIA-LITFIN-AI-2026-05, BOT-CYBERSECURITY-2026-MAP, DATA-RESIDENCY-ATTESTATION-2026-Q2}.md`
- `Docs/parity-tests/regulator-pack/EU-AI-ACT-COMPLIANCE-PACK.md`
- `.github/workflows/{ci, security, red-team}.yml`
- `.planning/`

### Parity matrix counts

- **EQUIVALENT**: 3 (hook events count, four-eye approval, killswitch)
- **PARTIAL**: 13 (hook outcomes, real connectors-diverged-but-equivalent-concept, owner UI, E2E, k8s, compliance docs, observability, CI gates, autonomy, MCP, 9 hooks bound, skills marketplace, heartbeat)
- **MISSING (LITFIN)**: 14 (main-loop, Budget, Plan, Checkpoint, ContextBudget, ToolSearch, PermissionMode, SubMdSpawn, 8 sub-MDs, 5 VPs, self-extension, AOP compiler, decision-simulator-AHEAD-LITFIN, cognitive-arch-AHEAD-LITFIN)
- **DIVERGED**: 2 (forecasting domain, connectors domain)
- **AHEAD (LITFIN)**: 11 (auth-coverage, ssrf-coverage, rls-coverage, zod-coverage, rate-limit-coverage, sovereign-ledger integrity regression, memory-tool wire-format adapter, decision-simulator, proactive-nudge full pipeline, cognitive-architecture tree, composition-orchestrator/Best-of-N/PRM/SELF-DISCOVER/LATS, alignment-faking/defection/activation probes, jurisdictions deeper [TZ priors + audit hardcode-detector + instance-framework])
- **AHEAD (BOSSNYUMBA, per parity-litfin/00-STATUS)**: 15 (already enumerated in BOSSNYUMBA's status doc — persona-drift 24-dim, streaming kernel, 18-tool registry, persistent privacy-budget, tier-scaled k-anonymity, AsyncLocalStorage tenant isolation, two-track inviolable, hash-chain HMAC audit, continuous-grading 696 LOC, advisory-lock ledger, OTel full stack, per-agent Grafana, temporal-entity-graph + Louvain, DB-backed sensor-routing, tenant credit rating)
