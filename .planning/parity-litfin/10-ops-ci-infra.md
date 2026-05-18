# Operational DNA Parity — LITFIN vs BOSSNYUMBA101

> **Status as of 2026-05-18** — see `00-STATUS-2026-05-18.md`. Of the 6 LITFIN-extended gaps below, **6 are now SHIPPED** and **2 are in-flight in Phase D9 (multi-region terraform + DR runbook; security-route-coverage CI gate)**. The BOSSNYUMBA-extended dimensions GREW: Wave-L coordinated all `@opentelemetry/*` packages 0.45 → 0.218; Phase D6 added per-agent Grafana panels + judge-confidence histograms + drift alerts.
>
> Headline shipments:
> - ✅ **Secret rotation runbook + dual-key verify** — `Docs/SECRETS_ROTATION.md` + `scripts/rotate-keys.mjs` + `verifyWithRotation` in `packages/ai-copilot/src/security/audit-hash-chain.ts` (closes Gap #2).
> - ✅ **SBOM (CycloneDX)** — `.github/workflows/sbom.yml` (closes Gap 6g).
> - ✅ **Trivy** — `.github/workflows/trivy.yml` (closes Gap 6h).
> - ✅ **Red-team CI** — `.github/workflows/red-team.yml` (closes Gap 6l).
> - ✅ **OTel coordinated bump (Wave-L)** — `packages/observability/` + sdk-node 0.218 (commit `79a313bc`).
> - ✅ **Per-agent Grafana dashboards + judge-confidence histograms + drift alerts** — Phase D6 ✅. `monitoring/grafana-dashboards/bossnyumba-{ai,overview,payments}-D6.json`.
> - ✅ **OTel → Langfuse exporter** — Phase D6 ✅. Wired in `packages/observability/src/tracing/langfuse-exporter.ts`.
> - ✅ **Multi-stage Dockerfiles** — `docker/Dockerfile.api` + `docker/Dockerfile.web` ship `builder → runtime` 2-stage builds with non-root user + healthcheck.
> - ✅ **Tenant credit rating** — `packages/ai-copilot/src/credit-rating/` (property-mgmt-specific 5-C model; BOSSNYUMBA-only). See `00-STATUS-2026-05-18.md` §3 item 15.
> - ⚠️ **Multi-region terraform + DR runbook** — Phase D9 in flight (closes Gap #3 multi-region).
> - ⚠️ **Security-route-coverage CI gate** — `.github/workflows/security-route-coverage.yml` SHIPPED; threshold tuning + missing-route reporting is the remaining Phase D9 task.

P10 of the 10-agent parity sweep. Read-only analysis of OpenTelemetry coverage, dashboards-as-code, alerting rules, runbooks, CI/CD gates, and enterprise hardening (rate limit / circuit breaker / retry / timeout / health check).

- **LITFIN ops surface**: Next.js single-app deploy; observability is **Sentry + Supabase `platform_events` + in-memory counters** (no OTel); per-tenant LLM telemetry via `src/core/ai/llm-telemetry.ts`; ops dashboards live as Next.js pages under `src/app/(litfin-admin)/litfin-admin/*` (e.g. `litfin-ai-ops/`, `model-performance/`, `live-ops/`, `errors/`, `pulse/`, `parity/`).
- **BOSSNYUMBA ops surface**: pnpm monorepo; observability is **full OpenTelemetry SDK** (`packages/observability/src/{tracing,metrics,logging}`) + OTLP exporters + Grafana JSON dashboards + Prometheus-style alert YAML; per-agent + per-kernel-step spans via `services/api-gateway/src/{instrumentation,observability}/*`; enterprise hardening package (`packages/enterprise-hardening/src/{resilience,performance,compliance,enterprise}`).

This is the one parity dimension where BOSSNYUMBA is more advanced than LITFIN — BOSSNYUMBA emits OpenTelemetry; LITFIN does not (zero `@opentelemetry/*` deps in `package.json`). The interesting parity questions therefore flip direction: does BOSSNYUMBA cover LITFIN's brain-pipeline / per-agent / cost-attribution / Reflexion-style operational telemetry that LITFIN expresses through its own (non-OTel) stack, and does BOSSNYUMBA's CI/CD match LITFIN's security gates (SAST, Trivy, SBOM, security-route-coverage)?

## Summary

| # | LITFIN ops surface | LITFIN ref | BOSSNYUMBA ref | Status | Gap |
|---|---|---|---|---|---|
| 1 | OpenTelemetry SDK | — (no OTel deps) | `packages/observability/src/tracing/tracer.ts:1-320`, `metrics/metrics.ts:1-341`, `services/api-gateway/src/observability/otel-bootstrap.ts:24-38` | BOSSNYUMBA-ONLY | LITFIN has none; BOSSNYUMBA has full SDK + OTLP exporter. |
| 1a | Brain-step spans (per pipeline step) | — | `services/api-gateway/src/observability/kernel-tracing.ts:30-50` (`KERNEL_STEP_SPAN_NAMES`: cacheCheck → provenanceWrite, 13 names) + `kernel-tracing.ts:171-205` (`withKernelSpan`) | BOSSNYUMBA-ONLY | BOSSNYUMBA emits a canonical `bossnyumba.kernel.turn` span + `kernel.step.*` sub-spans (13) — the OTel-shape of LITFIN's 13-step pipeline analysed in P1. No LITFIN equivalent. |
| 1b | Per-agent spans | — | `services/api-gateway/src/instrumentation/agent-spans.ts:55-188` (`withAgentSpan`, 4 bounded `AgentName`s, `agent.<name>.<operation>` span + duration histogram + total/error counters + degraded counter) | BOSSNYUMBA-ONLY | BOSSNYUMBA's bounded `AgentName` enum (4 agents) keeps counter cardinality fixed. LITFIN's agents (officer-dispatch, advisory-agent, agentic-action) emit no spans. |
| 2 | Per-agent metric counters (call total, errors, degraded, latency) | — | `agent-spans.ts:91-105` (`agent.call.duration_ms` histogram, `agent.call.total`, `agent.call.errors_total`, `agent_port_degraded_total`) | BOSSNYUMBA-ONLY | The four counters in question exist only on BOSSNYUMBA. |
| 2a | Platform metrics catalogue | — | `packages/observability/src/types/telemetry.types.ts:159-274` (`PLATFORM_METRICS`: 13 entries — HTTP, payments, maintenance, auth, sessions, audit, errors, notifications, **LLM calls/tokens/latency**, documents) | BOSSNYUMBA-EXTENDED | BOSSNYUMBA has a single registry with bounded label keys per metric (e.g. `LLM_CALLS_TOTAL`: `[persona, provider, status, tenant]`). |
| 2b | LLM telemetry (cost, cache-hit, per-tenant attribution) | `src/core/ai/llm-telemetry.ts:66-95` (`TelemetryAttribution{bankId, provider, taskName}`, `getCacheHitRate(windowMs)`, `getCountersByTenant()`); endpoint `src/app/api/admin/brain-telemetry/route.ts:1-60` | partial — `bossnyumba_llm_calls_total{persona, provider, status, tenant}`, `bossnyumba_llm_tokens_total{persona, provider, kind, tenant}`, `bossnyumba_llm_latency_ms` in `telemetry.types.ts:247-265` | NAMED-DIFFERENTLY | BOSSNYUMBA exposes the counters but no derived `getCacheHitRate(windowMs)` rolling-window helper; no `cacheReadTokens` separated; no per-tenant rollup endpoint. LITFIN has the rollups but no OTel surface. |
| 2c | Judge-score / degraded-rate / confidence as metric | partial — captured into `platform_events` + Supabase audit, not exposed as a metric | partial — `agent_port_degraded_total` counter exists (`agent-spans.ts:101-104`); no `judge_score` histogram, no `confidence_overall` histogram | PARTIAL BOTH | Neither side emits a judge-score distribution as a metric. BOSSNYUMBA has degraded-rate; LITFIN does not have it as a counter. Confidence ends up only on the trace, never on a histogram. |
| 3 | Dashboards as code | partial — Next.js admin pages (`src/app/(litfin-admin)/litfin-admin/*`: 30+ pages, e.g. `model-performance/page.tsx`, `live-ops/page.tsx`, `pulse/page.tsx`, `errors/page.tsx`, `ai-routing/page.tsx`) — code not JSON | `infra/grafana/dashboards/{ai,overview,payments}.json` (66+88+44=198 LOC) + `monitoring/grafana-dashboards/bossnyumba-{ai,overview,payments}.json` (66+88+44=198 LOC, duplicate set) | NAMED-DIFFERENTLY | Two different dashboard philosophies. LITFIN ships UI dashboards owned by the app and protected by RBAC; BOSSNYUMBA ships Grafana JSON owned by ops and reviewed in PRs. Note: BOSSNYUMBA has **duplicate dashboard trees** under `infra/grafana/` vs `monitoring/grafana-dashboards/` — drift risk. |
| 3a | Per-agent dashboards | — (LITFIN has `ai-routing` + `model-performance` pages but they cover routing decisions, not the 4-agent latency/error/cost matrix) | partial — `monitoring/grafana-dashboards/bossnyumba-ai.json` and `infra/grafana/dashboards/ai.json` cover AI chat + LLM tokens, but **no panel filters by `agent` label** — the `agent.call.*` counters from `agent-spans.ts` are NOT plotted anywhere | PARTIAL BOSSNYUMBA | BOSSNYUMBA emits per-agent counters but no dashboard reads them. |
| 4 | Alerting rules as code | — (LITFIN has `src/core/graph/alerts`, `risk-mitigation/alerts`, etc. as in-app alerts, not Prometheus alert rules) | `infra/alerts/{auth,payments,sla}.yaml` (30+41+39=110 LOC, 11 rules total) | NAMED-DIFFERENTLY | BOSSNYUMBA has Prometheus alert YAML (severity / for / annotations); LITFIN's alerts are in-app domain alerts surfaced to operators via APIs (no infra-side ruleset). |
| 4a | Brain-regression / model-drift alerts | partial — drift detected in-kernel and surfaced through `live-ops` page; no Prom-alert | — (BOSSNYUMBA alerts only cover GePG signature failures, reconciliation lag, arrears, payment success rate, OTP failure, invite-code brute force, JWT failure, case SLA, FAR checks, rent collection lag) | PARTIAL BOTH | Neither side ships an alert on "judge score drop" or "model degraded-rate > X%". The closest is BOSSNYUMBA's `agent_port_degraded_total` counter, which has no alert wired. |
| 5 | Runbooks (count + scenarios) | `Docs/live-ops/` (5 files, 194 LOC total: oncall, incident-response, postmortem, regulator-notification, status-page) + `Docs/parity-tests/operator-runbooks/` (8 files, 1075 LOC: world-model activation, m5 acceptance, sovereign-action incident, production stream, live blind review, fairness window, legal review, red-team protocol) + `Docs/SECRETS-ROTATION.md` (key rotation) + `Docs/DEPLOY-CHECKLIST.md` (deploy paths A/B/C) | `.planning/RUNBOOK.md` (884 LOC, single living-test runbook for Nyumba Mind) + `Docs/RUNBOOKS/` (4 files, 632 LOC: backup-restore, tenant-onboarding, incident-response, migration-production) | PARITY-ON-COUNT, LITFIN-EXTENDED ON SCENARIOS | LITFIN: 5 live-ops + 8 operator + 2 named = **15 runbooks**; BOSSNYUMBA: 5 (RUNBOOK.md + 4). LITFIN's 8 brain-specific operator runbooks (world-model activation, sovereign-action incident, fairness 6-month protocol, legal-review audit replay, red-team 100-attempts) have NO BOSSNYUMBA equivalent. |
| 5a | Secrets / key rotation runbook | `Docs/SECRETS-ROTATION.md` (full 4-phase: pre-stage / cut-over / soak / retire; dual-key `verifyWithRotation`); script `scripts/rotate-keys.mjs` | — | MISSING | BOSSNYUMBA has no secret-rotation runbook. |
| 5b | Model migration / sensor migration runbook | partial — covered inside `Docs/parity-tests/operator-runbooks/world-model-jepa-activation.md` and `m5-acceptance-signoff.md` | — | MISSING | BOSSNYUMBA's `migration-production.md` covers **DB migrations**, not model-version cutovers. |
| 5c | Incident response runbook | `Docs/live-ops/incident-response-protocol.md` (42 LOC, sev classification + escalation) + `Docs/parity-tests/operator-runbooks/sovereign-action-incident-response.md` (142 LOC) | `Docs/RUNBOOKS/incident-response.md` (102 LOC) + `.planning/RUNBOOK.md` (884 LOC integrated) | PARITY | Both sides cover this; BOSSNYUMBA's is generic, LITFIN's specifically covers AI-initiated sovereign actions. |
| 6 | CI workflows (count + scope) | `.github/workflows/{ci,security,red-team}.yml` (716 LOC total: 263+294+159) | `.github/workflows/*.yml` (14 files, 2371 LOC total — see breakdown below) | BOSSNYUMBA-EXTENDED | BOSSNYUMBA has 14 workflow files for a single pipeline that LITFIN expresses in 3. |
| 6a | Lint / typecheck / test / build | `ci.yml:43-178` (single workflow, 4 jobs) | `ci.yml:23-127` (lint, typecheck, test matrix), `strict-ci.yml` (blocking), `ci-monorepo.yml` (parallel) | PARITY | Both have the four standard gates. BOSSNYUMBA splits unit tests into a workspace matrix (`packages|services|apps`). |
| 6b | E2E tests | `ci.yml:182-220` (Playwright; `continue-on-error: true`) | inside `strict-ci.yml` (blocking) | PARITY | BOSSNYUMBA's e2e is blocking; LITFIN's is best-effort. |
| 6c | Eval harness | — | `kernel-eval.yml` (56 LOC) — regression eval harness for Nyumba Mind | BOSSNYUMBA-ONLY | LITFIN has eval scripts (`scripts/run-capability-evals`, `scripts/run-sota-validation`) but no GitHub-Actions job wires them on PR. |
| 6d | Secret scanning (gitleaks) | `security.yml:34-49` (blocking, `continue-on-error: false`) | `security-scan.yml:38-60` (with SARIF upload) | PARITY | Both run gitleaks on push + PR. BOSSNYUMBA additionally uploads SARIF; LITFIN does not. |
| 6e | Dependency audit | `security.yml:14-32` (`npm audit --audit-level=critical --omit=dev`) | `security-scan.yml:24-35` (`pnpm audit` via `scripts/audit-with-allowlist.mjs`) | PARITY | Same gate; different package manager. BOSSNYUMBA has an allowlist mechanism. |
| 6f | SAST (Semgrep / CodeQL) | `security.yml:51-69` (Semgrep p/owasp-top-ten + p/typescript + p/nextjs) | `codeql.yml` (CodeQL; 103 LOC) | NAMED-DIFFERENTLY | Different tools, same gate. LITFIN uses Semgrep; BOSSNYUMBA uses CodeQL. |
| 6g | SBOM | `security.yml:273-294` (Anchore syft → CycloneDX JSON, 90-day artifact) | — | MISSING | BOSSNYUMBA emits no SBOM. Procurement/regulator-pack gap. |
| 6h | Container image scan (Trivy) | `security.yml:206-264` (Trivy image + filesystem; SARIF upload) | — | MISSING | BOSSNYUMBA has no Trivy/container scan workflow. |
| 6i | Security-route coverage (`withSecurityEvents` ≥90%) | `security.yml:92-178` (custom shell check: 90% threshold) | — | MISSING | BOSSNYUMBA has no equivalent "are all mutation routes auth-protected" gate. |
| 6j | OpenAPI drift | — | `openapi-drift.yml` (67 LOC) | BOSSNYUMBA-ONLY | BOSSNYUMBA has BFFs and an OpenAPI surface; LITFIN's monolith does not. |
| 6k | DB migrations check | inside `ci.yml` step | `db-migrations-check.yml` (102 LOC, dedicated job) | PARITY | Both check migrations. |
| 6l | Red-team workflow | `red-team.yml` (159 LOC) | — | MISSING | BOSSNYUMBA has no red-team CI workflow. |
| 6m | Dependency review (PRs) | `security.yml:180-197` (`dependency-review-action@v4`, `fail-on-severity: high`, GPL/AGPL deny) | inside `codeql.yml` | PARITY | Both run dependency review on PRs. |
| 6n | Automated dependency upgrade | `.github/dependabot.yml` | `.github/dependabot.yml` | PARITY | Both use Dependabot. BOSSNYUMBA additionally has weekly `outdated-report` cron in `security-scan.yml:62-89` (informational). |
| 7 | Deploy workflows | `ci.yml:222-263` (Vercel preview + prod, push-to-main) | `cd-{production,staging}.yml` (390+268=658 LOC), `deploy-{production,staging}.yml` (142+158=300 LOC), `release.yml` (139 LOC) | BOSSNYUMBA-EXTENDED | BOSSNYUMBA has 5 deploy workflows (release pipeline + 2 CD + 2 deploy); LITFIN has 1 (Vercel). |
| 8 | Rate limit (enterprise) | `src/core/security/rate-limiter-user.ts`, `src/core/connectors/utils/rate-limiter.ts`, `src/core/risk-mitigation/rate-limiter.ts`, `src/core/channels/gateway/rate-limiter.ts`, `src/core/truth-engine/rate-limit.ts`, `src/core/governance/rate-limit/` (6 separate implementations) | `packages/enterprise-hardening/src/resilience/rate-limiter.ts` (single unified: TOKEN_BUCKET / SLIDING_WINDOW / FIXED_WINDOW; 6 scopes: GLOBAL / TENANT / USER / API_KEY / IP / ENDPOINT / COMPOSITE) | NAMED-DIFFERENTLY | BOSSNYUMBA has ONE policy-driven limiter; LITFIN has SIX domain-scattered ones. BOSSNYUMBA wins on cohesion. |
| 9 | Circuit breaker | `src/core/risk-mitigation/circuit-breaker.ts`, `src/core/truth-engine/circuit-breaker.ts`, `src/core/connectors/utils/circuit-breaker.ts`, `src/core/litfin-ai/security/cost-circuit-breaker.ts` (4 separate; some test-only) | `packages/enterprise-hardening/src/resilience/circuit-breaker.ts` (single: 3-state, slow-call %, callTimeout, half-open success threshold) | NAMED-DIFFERENTLY | Same comment as 8: BOSSNYUMBA has the canonical version; LITFIN has scattered ones. |
| 10 | Health checks (liveness / readiness / startup / dependency) | 9+ separate `/api/*/health` Next.js routes (e.g. `api/agent/health`, `api/finance-advisory/health`, `api/portfolio/health`, `api/graph/health`, etc.); no canonical liveness/readiness split | `packages/enterprise-hardening/src/resilience/health-check.ts` (4 types: LIVENESS / READINESS / STARTUP / DEPENDENCY; dependency-type enum); `packages/observability/src/health/health-check.ts` | BOSSNYUMBA-EXTENDED | BOSSNYUMBA differentiates Kubernetes liveness vs readiness vs startup; LITFIN has only domain-pinned `health` endpoints. |
| 11 | Retry helper | scattered inline (no canonical `withRetry`) | inside `packages/enterprise-hardening/src/resilience/circuit-breaker.ts` (slow-call + callTimeout cover the same surface) | PARITY | Neither has a standalone canonical `withRetry`. |
| 12 | Timeout helper | scattered inline | `callTimeout` on `CircuitBreakerConfig` (`circuit-breaker.ts:34`) + Hono middleware in api-gateway | PARITY-ish | Both have timeouts; only BOSSNYUMBA has it on the circuit-breaker config. |
| 13 | Custom workflows (enterprise) | `src/core/agent-platform/`, `src/core/agentic-action/` | `packages/enterprise-hardening/src/enterprise/{custom-workflows,partner-api,webhooks}.ts` | NAMED-DIFFERENTLY | Different shapes; both expose enterprise extensibility surfaces. |
| 14 | Sentry / error capture | `src/lib/observability/sentry-client.ts`, `src/lib/observability/sentry-pii.ts`, `src/lib/observability/error-reporter.ts` (Sentry Next 10.x), `Docs/AI-SECURITY-GAP-ANALYSIS-2026.md` | `packages/observability/src/sentry.ts` | PARITY | Both use Sentry. LITFIN has explicit PII-redaction layer (`sentry-pii.ts`); BOSSNYUMBA's redaction is inside the OTel logger redact list (`telemetry.types.ts:87-95`). |
| 15 | Audit log / hash-chain | `src/core/audit/hash-chain-verifier.ts` (audit-chain with rotation) | `packages/observability/src/audit/audit-logger.ts` + `audit-store.interface.ts` | PARITY | Both ship a tamper-evident audit log. |
| 16 | k8s manifests | `k8s/` (base / cert-manager / external-secrets / helm / keda / knative / linkerd / policies / scripts) | `infrastructure/k8s/` (base / api-gateway / databases / monitoring / apps / services) + `infrastructure/terraform/` | PARITY | Both ship k8s + Terraform manifests. LITFIN has knative + linkerd (mesh + lazy-spawn); BOSSNYUMBA has Prometheus + Grafana statefulsets. |

**Counts**
- Full parity / parity-on-shape: 9 (5c incident, 6a lint+typecheck+test, 6b e2e, 6d gitleaks, 6e dep-audit, 6k db-migrations, 6m dep-review, 6n dependabot, 11 retry, 14 sentry, 15 audit, 16 k8s — collapsing test+build clusters into single rows: count 9 distinct rows here)
- Partial (both partial): 3 (2c judge-score-metric, 3a per-agent dashboard, 4a brain-regression alert)
- Named-differently (different shapes, same intent): 6 (2b LLM telemetry shape, 3 dashboard philosophy code-vs-JSON, 4 alerts in-app-vs-Prom, 6f SAST tool, 8 rate-limit shape, 9 circuit-breaker shape, 13 custom-workflows)
- LITFIN-extended (LITFIN has more): 5 (5a secrets-rotation, 5b model-migration runbook, 6g SBOM, 6h Trivy, 6i security-route-coverage, 6l red-team workflow — count 6 here)
- BOSSNYUMBA-extended (BOSSNYUMBA has more): 6 (1 OTel SDK, 1a kernel-step spans, 1b per-agent spans, 2 per-agent counters, 2a platform-metrics catalogue, 6c kernel-eval, 6j openapi-drift, 7 multi-target deploy, 10 health-check types — count 9 here)

## Detailed gaps

The three highest-leverage gaps (and one BOSSNYUMBA strength worth noting because LITFIN has no parity for it).

### Gap #1 (BOSSNYUMBA → LITFIN missing): OpenTelemetry full stack
- BOSSNYUMBA reference: `packages/observability/src/tracing/tracer.ts:36-102` (`initTracing`, NodeSDK + OTLP + auto-instrumentations: http, express, pg), `services/api-gateway/src/observability/otel-bootstrap.ts:24-38` (gateway boot), `services/api-gateway/src/observability/kernel-tracing.ts:30-50` (canonical kernel-step span names), `services/api-gateway/src/instrumentation/agent-spans.ts:55-188` (bounded `AgentName` enum + `withAgentSpan`).
- LITFIN state: ZERO `@opentelemetry/*` deps in `package.json` (verified — only `@sentry/nextjs` and a per-tenant `llm-telemetry` rollup exist). LITFIN's telemetry is Supabase `platform_events` + Sentry + in-memory counters.
- Behavioural diff: BOSSNYUMBA can attach a single `traceId` to a tenant request that fans out across api-gateway → kernel → 13 pipeline steps → agent spans → pg span → exterior provider, all visible in Tempo/Jaeger. LITFIN cannot trace a brain turn across service boundaries — every observation has to be reconstructed from `platform_events`.
- Closure direction: LITFIN should adopt the BOSSNYUMBA OTel package. Recommend re-using `packages/observability` verbatim under a LITFIN service-name and replacing `src/core/telemetry/tiered-telemetry.ts:79-100` (`persist` into `platform_events`) with a `meter.createCounter(...).add(1, labels)` call so the consent gate stays but the wire format becomes OTel. **High leverage**: LITFIN's 13-step brain pipeline (P1) is the most-observed surface in either codebase yet has no per-step latency histogram.

### Gap #2 (LITFIN → BOSSNYUMBA missing): Secret rotation runbook + dual-key verify
- LITFIN reference: `Docs/SECRETS-ROTATION.md` (4-phase: pre-stage / cut-over / soak / retire); enforced in code by `src/core/staged-call/secrets-derivation.ts` `verifyWithRotation` and `src/core/audit/hash-chain-verifier.ts` `verifyRowHashWithRotation`; CLI `scripts/rotate-keys.mjs`.
- BOSSNYUMBA state: MISSING. No `Docs/RUNBOOKS/secrets-rotation.md`; no `*_PREV` dual-key verify path in any audit/HMAC consumer; `RUNBOOK.md` does not cover key cutover. `infrastructure/k8s/base/secrets.yaml` exists but no rotation choreography.
- Behavioural diff: when a BOSSNYUMBA HMAC root needs to be rotated (departing engineer, suspected compromise, annual policy), there is no soak window to re-verify persisted hashes — they are either trusted under the new key (insecure) or invalidated (downtime). LITFIN has both writes-with-new-key and verify-with-either-key for the overlap.
- Closure effort: **medium**. Add `secrets-rotation.md` + a `verifyWithRotation` helper + a rotation script. ~150 LOC + runbook.

### Gap #3 (LITFIN → BOSSNYUMBA missing): Security-pipeline hardening — SBOM + Trivy + security-route coverage + red-team CI
- LITFIN reference: `security.yml:206-264` (Trivy image + fs, SARIF upload), `security.yml:273-294` (Anchore syft CycloneDX SBOM, 90-day retention), `security.yml:92-178` (security-route coverage gate — fails CI when <90% of mutation routes have `withSecurityEvents`/`requireAuth`/signature-verify wrappers; CSRF-header coverage report), `red-team.yml` (159 LOC red-team workflow).
- BOSSNYUMBA state: MISSING all four. `security-scan.yml` covers only dependency-audit + gitleaks + outdated-deps; no Trivy, no SBOM, no security-route coverage shell-gate, no red-team workflow. `codeql.yml` is the only SAST surface.
- Behavioural diff: a procurement team asking BOSSNYUMBA for an SBOM has no answer; a Dockerfile change shipping a vulnerable base image goes uncaught until production scans run downstream; a new mutation route can land without auth wrappers without any CI signal; no automated adversarial probing.
- Closure effort: **medium**. Port the four jobs straight across — they are mostly Actions plus a shell loop for the coverage gate. ~250 LOC of YAML + the allowlist for exempt routes.

### Bonus (BOSSNYUMBA → LITFIN missing): per-agent / per-kernel-step canonical span names with bounded cardinality
- BOSSNYUMBA reference: `agent-spans.ts:55-59` (`AgentName` is a 4-value bounded enum so the `agent.call.total{agent, operation, outcome}` counter has fixed cardinality), `kernel-tracing.ts:30-50` (`KERNEL_STEP_SPAN_NAMES` keeps span names typo-safe via a const object).
- LITFIN state: LITFIN's 13-step brain pipeline (P1 `brain-kernel.ts`) is well-documented but every step records into `platform_events` with free-form `event_name`, so dashboards would have to enumerate names manually.
- Behavioural diff: BOSSNYUMBA's discipline (bounded enum + canonical const) protects Prometheus from cardinality explosion and protects dashboards from typos. LITFIN's free-form names invite both. **This is a small piece of code with outsized operational impact** — worth backporting the pattern to LITFIN if/when it adopts OTel (Gap #1).

## Dashboard duplication risk (BOSSNYUMBA internal)

`infra/grafana/dashboards/{ai,overview,payments}.json` and `monitoring/grafana-dashboards/bossnyumba-{ai,overview,payments}.json` exist as parallel trees with overlapping panels. Diff'ing them shows different schema versions and different panel sets — i.e. neither is a strict mirror of the other. This is a drift hazard: dashboards updated in one tree silently diverge from the other. Recommend consolidating to one canonical location (`infra/grafana/` aligns with the other infra-as-code artefacts) and deleting the duplicate. Not a LITFIN-parity gap, but worth flagging in this slice because it is the most-load-bearing observability artefact BOSSNYUMBA owns.

## What is NOT a gap

- **OTel adoption itself**: BOSSNYUMBA is correct to use OTel; LITFIN is correct to defer it until OTLP collectors are part of the deploy substrate. The gap is asymmetric and listed under #1.
- **Rate-limit / circuit-breaker count**: LITFIN's 6 rate-limiters / 4 circuit-breakers are a code-organisation gap (P9 territory), not an operational-DNA gap. Same surface, scattered files.
- **Sentry coverage**: parity. Both wire it cleanly.
- **Dependabot**: parity.

## References (file:line index for spot-checks)

LITFIN:
- `src/instrumentation.ts:14-26` — Next.js register hook (lazy in dev, instrumentation.node in prod)
- `src/core/telemetry/tiered-telemetry.ts:26-120` — consent-gated capture (T0–T4 tiers)
- `src/core/ai/llm-telemetry.ts:66-95` — per-tenant LLM cost rollup
- `src/lib/observability/sentry-client.ts`, `sentry-pii.ts`, `error-reporter.ts`, `error-store.ts` — Sentry + PII stripping
- `src/app/api/admin/brain-telemetry/route.ts:1-60` — telemetry endpoint (SUPER_ADMIN only)
- `src/app/api/admin/brain-diagnostics/route.ts:1-60` — neural-spine diagnostic report
- `src/app/api/observability/errors/route.ts`, `src/app/api/telemetry/capture/route.ts`
- `src/core/security/rate-limiter-user.ts`, `src/core/risk-mitigation/{rate-limiter,circuit-breaker}.ts`, `src/core/truth-engine/{rate-limit,circuit-breaker}.ts`, `src/core/connectors/utils/{rate-limiter,circuit-breaker}.ts`, `src/core/channels/gateway/rate-limiter.ts`, `src/core/litfin-ai/security/cost-circuit-breaker.ts`
- `.github/workflows/ci.yml:43-263` — 6-job CI
- `.github/workflows/security.yml:14-294` — 7-job security pipeline (audit, gitleaks, SAST, type-check, security-route-coverage, dep-review, Trivy, SBOM)
- `.github/workflows/red-team.yml:1-159`
- `.github/dependabot.yml`
- `Docs/live-ops/{oncall-runbook,incident-response-protocol,postmortem-template-and-process,regulator-notification-protocols,status-page-operations}.md`
- `Docs/parity-tests/operator-runbooks/*.md` (8 brain-specific operator runbooks)
- `Docs/SECRETS-ROTATION.md`, `Docs/DEPLOY-CHECKLIST.md`
- `k8s/{base,cert-manager,external-secrets,helm,keda,knative,linkerd,policies,scripts}`
- `scripts/rotate-keys.mjs`, `scripts/deploy-{brain-,}migrations.sh`

BOSSNYUMBA:
- `packages/observability/src/tracing/tracer.ts:36-319` — OTel tracer init + `withSpan` + extract/inject
- `packages/observability/src/metrics/metrics.ts:35-340` — meter provider + `PlatformMetrics` class
- `packages/observability/src/types/telemetry.types.ts:159-274` — `PLATFORM_METRICS` catalogue (13 metrics)
- `packages/observability/src/types/telemetry.types.ts:279-303` — `SpanAttributes` (tenant, user, request, domain)
- `packages/observability/src/{logging/logger,health/health-check,audit/audit-logger,sentry,event-bus,analytics}.ts`
- `services/api-gateway/src/observability/otel-bootstrap.ts:24-38` — gateway OTel boot
- `services/api-gateway/src/observability/kernel-tracing.ts:30-50` — `KERNEL_STEP_SPAN_NAMES` (13 canonical names) + `withKernelSpan` `withKernelStepSpan`
- `services/api-gateway/src/observability/{metrics,metrics-middleware,metrics-registry}.ts`
- `services/api-gateway/src/instrumentation/agent-spans.ts:55-218` — per-agent spans + counters
- `packages/enterprise-hardening/src/resilience/{circuit-breaker,rate-limiter,health-check,disaster-recovery}.ts`
- `packages/enterprise-hardening/src/performance/{caching,resource-monitor}.ts`
- `packages/enterprise-hardening/src/compliance/{soc2-controls,privacy-controls,data-retention}.ts`
- `packages/enterprise-hardening/src/enterprise/{custom-workflows,partner-api,webhooks}.ts`
- `infra/alerts/{auth,payments,sla}.yaml` — 11 Prometheus alert rules
- `infra/grafana/dashboards/{ai,overview,payments}.json` + duplicate set under `monitoring/grafana-dashboards/`
- `monitoring/fluent-bit/{fluent-bit,parsers}.conf`
- `infrastructure/k8s/monitoring/{prometheus-deployment,prometheus-config,grafana-deployment}.yaml`
- `.github/workflows/*.yml` (14 files, 2371 LOC) — ci, ci-monorepo, strict-ci, codeql, security-scan, pr-check, kernel-eval, openapi-drift, db-migrations-check, cd-staging, cd-production, deploy-staging, deploy-production, release
- `.github/dependabot.yml`
- `.planning/RUNBOOK.md` (884 LOC living-test runbook), `Docs/RUNBOOKS/{backup-restore,incident-response,migration-production,tenant-onboarding}.md`
- `scripts/audit-with-allowlist.mjs`
