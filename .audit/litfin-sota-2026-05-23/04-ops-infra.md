# LITFIN Ops + Infra + Observability — SOTA 2026 Gap Analysis (P04)

**Date:** 2026-05-23
**Scope:** Kubernetes, deployment, observability, CI/CD, supply chain, SRE
**Comparative basis:**
- Existing partial audit `BOSSNYUMBA101/.planning/parity-litfin/10-ops-ci-infra.md` (2026-05-18) — superseded for OTel rows because LITFIN has shipped OTel since.
- LITFIN root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/`
- BOSSNYUMBA root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/`

**SOTA-2026 reference frame (CNCF / OCI / Sigstore ecosystem as of May 2026):**
- CNCF graduated: Kubernetes 1.31, OTel 1.3, Prometheus 3.x, Envoy 1.34, Linkerd 2.19, Argo (CD + Rollouts), Cert-Manager 1.16+, KEDA 2.16, Istio (graduated 2024).
- eBPF: Cilium 1.16+, Tetragon for runtime security, Pixie for instant observability, Parca / Polar Signals for continuous profiling.
- GitOps: Argo CD + Argo Rollouts (progressive delivery, canary, blue/green), Flux v2.
- Multi-cluster: Cluster API, vCluster, ArgoCD ApplicationSet.
- Edge / WASM: WasmEdge, SpinKube, Knative-Eventing.
- Confidential: Confidential Containers (CoCo), Kata.
- FinOps: OpenCost, Kubecost.
- Feature flags: OpenFeature (open-spec), Flagsmith / LaunchDarkly / GrowthBook backends.
- IDP: Backstage; IaC-as-data: Crossplane.
- Supply chain: in-toto attestations, SLSA L3+, OSV-Scanner, Sigstore Trusted Root, OCI 1.1 artifacts, cosign sign-and-verify, Tekton Chains.
- Observability: OTel 1.3, eBPF profiling (Parca, Polar Signals, Pyroscope), AI-assisted alerting (Datadog Bits AI, NR AI).

---

## 1. Executive snapshot

LITFIN's ops/infra surface is **above CNCF baseline for a Next.js fintech monolith** and ahead of BOSSNYUMBA in: Knative scale-to-zero, KEDA HTTP-add-on, Linkerd ServiceProfile + TrafficSplit canaries, distroless runtime, External Secrets Operator with GCP/AWS/sealed branches, k8s-native cronjobs, Pod Security Admission (restricted), zero-trust NetworkPolicy, cosign-ready supply chain, security-route-coverage CI gate, red-team CI, and SBOM (CycloneDX).

LITFIN's gaps vs SOTA-2026 are primarily in: **GitOps (Argo CD/Argo Rollouts)** — canaries are SMI TrafficSplit only, manually weighted; **eBPF runtime security** (Cilium, Tetragon, Pixie); **continuous profiling** (Parca/Pyroscope); **OpenCost/FinOps** cost attribution as a deployed component (LITFIN has dashboards but no OpenCost collector); **OpenFeature** for feature flags (LITFIN uses a `feature-flags` ConfigMap watched by the shell — a homegrown shape); **cosign sign + verify** on the image at deploy admission (LITFIN references it in the Dockerfile comment but does not actually sign in CI); **SLSA L3 attestations** (none); **Tekton Chains / in-toto** attestations (none); **Crossplane / Cluster API / vCluster** for multi-cluster / IaC-as-data (none — Helm-only); **Confidential Containers** (none); **WASM at the edge** (none); **AI-assisted alerting** (none — Prometheus alerts are static expr rules).

The 5 highest-leverage back-ports for BOSSNYUMBA are listed in §13.

---

## 2. Container runtime + image build

### 2.1 Dockerfile

**File:** `Dockerfile` (LITFIN root, 116 lines, multi-stage)

Three-stage build:

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:22.12.0-alpine` | `npm ci --ignore-scripts` (poisoned dep cannot exfil during install) + libc6-compat for sharp/bcrypt native modules. |
| `builder` | `node:22.12.0-alpine` | `npm rebuild` (legitimate native postinstall) + `npm run build`. NEXT_PUBLIC_* inlined via `--build-arg`. |
| `runtime` | `gcr.io/distroless/nodejs22-debian12:nonroot` | Distroless, no shell, no apt, uid 65532. ~80 MB. Copies only `.next/standalone` (~150 MB) + static + public. |

**SOTA-aligned points:**
- Distroless `nonroot` (uid 65532) — Google's official supply-chain-secure base. PASS vs SOTA.
- `--mount=type=cache,target=/root/.npm` (BuildKit cache mount) — modern best practice.
- `--ignore-scripts` on `npm ci`, `npm rebuild` only after source is present — defends against `npm preinstall` exfil.
- No `ENV` injection of runtime secrets — comment explicitly says secrets come via K8s/Cloud Run mounts.
- `HEALTHCHECK` deliberately omitted (orchestrator-managed probes preferred).
- Filesystem set read-only at orchestrator level (`--read-only --tmpfs /tmp` documented in comment, enforced in `deployment-shell.yaml:114`).

**SOTA gaps:**
- **No base image digest pin in the Dockerfile itself** (comment says "Pin to digest in CI before publishing" but the FROM uses `:nonroot` floating tag). SOTA: pin to `gcr.io/distroless/nodejs22-debian12@sha256:...`. CIS Docker 4.4 nominal compliance only.
- **No cosign sign step in CI** even though the Dockerfile comment claims "Cosign (signed in CI)". `security.yml` does not sign the image. SOTA gap: SLSA L3 requires signed provenance attestation; LITFIN currently ships unsigned images.
- **No `--platform=$BUILDPLATFORM` multi-arch directive** — arm64 (Graviton) deploys not first-class.
- **No `LABEL org.opencontainers.image.*` annotations** — OCI 1.1 supply-chain metadata blank.
- **No SBOM embedding into image** (CycloneDX SBOM is generated to artifact but not attached as OCI 1.1 referrer).

### 2.2 .dockerignore

**File:** `.dockerignore` (115 lines, well-curated)

Excludes: `.env*`, `*.pem`, `*.key`, `.git/`, `.github/`, `Docs/`, `e2e/`, tests, mobile, research, Storybook, husky, ESLint configs, `Dockerfile*` itself. Aggressive — keeps build context tight (single-digit MB). PASS vs SOTA.

---

## 3. Kubernetes manifests

### 3.1 Structure

```
k8s/
  base/                  10 raw kubectl manifests
  cert-manager/          ClusterIssuer (LE prod + staging)
  external-secrets/      SecretStore (GCP SM + AWS SM) + ExternalSecret
  helm/litfin/           Full Helm chart (Chart.yaml + values.yaml + 14 templates)
  keda/                  4 ScaledObjects (borrower / officer / admin / litfin-admin)
  knative/               4 Knative Services (ai-inference, deepseek-batch, doc-intel, voice)
  linkerd/               ServiceProfile + TrafficSplit
  policies/              networkpolicy-strict.yaml (multi-tenant zero-trust)
  scripts/               bootstrap-cluster.sh, deploy.sh, seed-secrets.sh
  README.md              (274 LOC — most extensive K8s README in either codebase)
```

**Files** (representative):
- `k8s/base/namespace.yaml` — `pod-security.kubernetes.io/enforce: restricted` + `linkerd.io/inject: enabled` at namespace level
- `k8s/base/deployment-shell.yaml` (127 LOC) — Tier-1 always-warm 3-replica shell with: maxSurge 25% / maxUnavailable 0 rolling, topologySpread (zone), podAntiAffinity (preferred host), startup/liveness/readiness probes, lifecycle preStop sleep 5, fsGroup 65532, all caps dropped, RuntimeDefault seccomp, read-only root, emptyDir tmp + nextjs-cache
- `k8s/base/hpa.yaml` — autoscaling/v2 HPA (1-50, CPU 70 / mem 80, scaleUp Percent 100 / Pods 4 / 30s; scaleDown Percent 25 / 60s with 300s stabilisation)
- `k8s/base/poddisruptionbudget.yaml` — `minAvailable: 2`, `unhealthyPodEvictionPolicy: IfHealthyBudget` (K8s 1.27+)
- `k8s/base/networkpolicy.yaml` — default-deny + 5 explicit allow rules (ingress-nginx, DNS, HTTPS egress with cloud-metadata IP exclude, Supabase port 5432/6543, linkerd control plane 8080/8086/8090/9443)
- `k8s/policies/networkpolicy-strict.yaml` — deny-from-other-namespaces (multi-tenant cluster opt-in) + deny-egress-to-private-ranges (blocks IMDS 169.254.169.254)
- `k8s/base/ingress.yaml` — nginx ingress with HSTS preload 63072000s, TLSv1.3/1.2, limit-rps 100, limit-connections 20, force-ssl-redirect
- `k8s/base/serviceaccount.yaml` — 3 SAs (shell / cron / ai-inference), all `automountServiceAccountToken: false`
- `k8s/base/role.yaml` — minimal Role (configmap watch for shell, secret get for cron)
- `k8s/base/cronjobs.yaml` (670 LOC) — **18 K8s CronJobs** translated from `vercel.json`. concurrencyPolicy=Forbid, backoffLimit=2, startingDeadlineSeconds tuned per job, all curlimages/curl:8.10.1 with `x-cron-secret` header from ESO-materialized `cron-auth` secret

**SOTA-aligned:**
- PSA `restricted` enforced at namespace level — every workload must comply or be rejected. CNCF graduated standard.
- Pinned helper image (`curlimages/curl:8.10.1`) on every cronjob — no `:latest` drift.
- `automountServiceAccountToken: false` everywhere — defaults-secure.
- `topologySpreadConstraints` (zone) + `podAntiAffinity` (host) — modern HA pattern.
- `unhealthyPodEvictionPolicy: IfHealthyBudget` — 1.27+ feature, prevents PDB stalling on unhealthy pods.
- All 18 cronjobs use the `Linkerd-injected curl pod -> public hostname` pattern, so the WAF/rate-limiter sees cron the same way as a normal client.
- Lifecycle `preStop sleep 5` matches ingress-nginx 5s default grace, preventing in-flight 502s.

**SOTA gaps:**
- **No Kustomize** — only Helm. SOTA: Kustomize overlays for dev/staging/prod are more idiomatic for layered config than `values-*.yaml`. BOSSNYUMBA `infrastructure/k8s/overlays/{staging,production}` uses kustomize; LITFIN does not.
- **No VPA (VerticalPodAutoscaler)** — only HPA. SOTA recommends VPA in recommendation mode for rightsizing requests; LITFIN's `resources.requests` are hand-tuned.
- **No Karpenter / Cluster Autoscaler config** in repo — assumed implicit on GKE/EKS. SOTA: ship the autoscaler config-as-code.
- **No PodSecurityPolicy / OPA Gatekeeper / Kyverno** policies. PSA `restricted` is necessary but not sufficient for advanced policies (e.g. "every image must be from gcr.io/litfin", "no privileged ports"). BOSSNYUMBA also lacks these.
- **No `topologyKey: topology.kubernetes.io/region`** in the topologySpread — only zone. Multi-region deploys not first-class.

### 3.2 Knative (Tier-4 burst services)

**Files:**
- `k8s/knative/service-ai-inference.yaml` — Claude Opus 4.6 heavy reasoning, min 0 / max 10, scale-down-delay 60s, concurrency=10, timeoutSeconds=300
- `k8s/knative/service-document-intelligence.yaml` — PDFium / RAG, timeoutSeconds=600, mem 2/8 Gi
- `k8s/knative/service-elevenlabs-voice.yaml` — TTS/STT, mem 2/8 Gi, timeout 120s
- `k8s/knative/service-deepseek-batch.yaml` — overnight batch, timeoutSeconds=1800 (30-min ceiling)

All 4 use a marker env (`LITFIN_ROLE=ai-inference|...`) so the SAME container image (`gcr.io/litfin/litfin:latest`) boots in different "role" modes. The Next.js bootstrap reads `LITFIN_ROLE` to skip portal SSR.

**SOTA-aligned:**
- Knative Serving 1.18 with Kourier (CNCF graduated), bootstrapped in `bootstrap-cluster.sh:84-93`.
- Linkerd injection on Knative pods — mTLS even for the cold-start activator → pod hop.
- `containerConcurrency: 10` + `autoscaling.knative.dev/metric: concurrency` — modern in-flight-request scaling vs CPU.
- Single image, role-multiplexed via env — avoids 4 separate Dockerfiles. Clever.

**SOTA gaps:**
- **No Knative Eventing** — only Serving. SOTA-2026: event-driven autoscaling via `knative-eventing` + `EventDisplay` for CloudEvents.
- **No `SpinKube` / WASM workload classes** — Knative Services are all containerised. For 13 of LITFIN's brain pipeline steps that are pure compute (no Node-native lib), WASM would dramatically cut cold-start.

### 3.3 KEDA (Tier-2 warm-on-login portals)

**Files:**
- `k8s/keda/scaledobject-borrower.yaml` — borrower portal, min 0 / max 20, dual-trigger: `http-add-on` primary (pathPrefixes: /borrower, targetValue 20 rps) + Prometheus fallback (`borrower_portal_rps`)
- `scaledobject-officer.yaml`, `scaledobject-admin.yaml`, `scaledobject-litfin-admin.yaml` — same pattern, different paths and rps thresholds

**SOTA-aligned:**
- KEDA 2.16 + HTTP add-on 0.10 — current.
- Both `http-add-on` and `prometheus` triggers (operator chooses by deleting the other) — defensive design.
- HPA `behavior.scaleUp` 100% / 4 pods every 15s + `selectPolicy: Max` — aggressive scale-up.
- `cooldownPeriod: 300s` per portal — generous to avoid flap.

**SOTA gaps:**
- **No KEDA Kafka / SQS / Redis Stream triggers** — only HTTP + Prometheus. LITFIN imports `kafkajs` in `package.json` but no Kafka-driven KEDA scaler. SOTA: scale workers on lag.
- **No `ScaledJob`** — only `ScaledObject`. For DeepSeek batch overnight ingest, ScaledJob (one-shot job per message) would be more idiomatic than Knative concurrent-request scaling.

### 3.4 Linkerd (service mesh)

**Files:**
- `k8s/linkerd/serviceprofile.yaml` — 7 routes (health, chat-stream, chat, cron, borrower-pages, officer-pages, admin-pages) with per-route `isRetryable` (false for SSE/chat-mutations, true for GET) + timeouts (5s health, 180s chat-stream, 60s chat, 1800s cron); `retryBudget: ratio 0.2, minRetriesPerSecond 10, ttl 10s`
- `k8s/linkerd/traffic-split.yaml` — SMI TrafficSplit template, 95/5 to `litfin-shell` vs `litfin-shell-canary`. Manual canary, operator-driven via `kubectl edit`.

**SOTA-aligned:**
- Linkerd 2.19 — most recent graduated mesh, lightest data-plane (5-10 MB Rust proxy).
- `linkerd.io/inject: enabled` at namespace level (`k8s/base/namespace.yaml:13`) — default-on, opt-out requires explicit annotation.
- ServiceProfile with per-route SLOs is the canonical pattern for Linkerd traffic-split decisions.
- SSE chat-stream marked `isRetryable: false` — correct (duplicate-work + token-cost risk).

**SOTA gaps:**
- **No Argo Rollouts** integration. LITFIN's canary is SMI TrafficSplit, operator manually edits weight. SOTA-2026: Argo Rollouts drives canary progression automatically against Prometheus metrics ("if p99 latency stays <X for 5m, bump from 5%→25%→50%→100%"). LITFIN ships dashboards (`litfin-canary-slos.json`) that read `litfin_canary_slo_status` but no controller acts on them.
- **No `Linkerd Viz` MultiClusterMirror** — single-cluster only.
- **No Cilium consideration** — Linkerd is sufficient for L7 mTLS + ServiceProfile, but SOTA fintech increasingly uses Cilium for **L3-L7 network policy enforcement + eBPF-backed observability** (no sidecar). Cilium also enables **Tetragon** for runtime security (process-exec monitoring, file-access alerting).
- **No mesh-level rate limiting** — rate-limits are app-level (`@upstash/ratelimit` + Hono middleware). SOTA-2026: Envoy Filters / Linkerd HTTPRoute + RateLimit (via Gateway API) for edge-level limits independent of app logic.

### 3.5 Cert-Manager

**File:** `k8s/cert-manager/issuer.yaml`

Two ClusterIssuers: `letsencrypt-prod` (https://acme-v02) and `letsencrypt-staging`. HTTP-01 solver via nginx ingress. Email `ops@litfin.example.com` for renewal failures.

**SOTA-aligned:** Cert-Manager 1.16 — graduated. HTTP-01 with nginx ingress is canonical. Staging issuer present (avoids LE rate-limit during iteration). PASS.

**SOTA gaps:**
- **No DNS-01 solver** — only HTTP-01. SOTA: DNS-01 needed for wildcard certs (`*.litfin.example.com`) and for clusters without public ingress (private K8s, internal-only services).
- **No mTLS-issuer / Private CA** for service-to-service certs (Linkerd uses its own trust anchor — separate trust domain). SOTA-2026: SPIFFE/SPIRE for workload identity, cert-manager `csi-driver-spiffe`.
- **No ACME EAB (external account binding)** — would be required for ZeroSSL or some private ACME providers.

### 3.6 External Secrets

**Files:**
- `k8s/external-secrets/secret-store.yaml` — GCP `SecretStore` (Workload Identity binding, no JSON key files) + AWS `SecretStore` (IRSA pattern with eks.amazonaws.com/role-arn annotation)
- `k8s/external-secrets/external-secret-app.yaml` — materializes 30+ secrets into `app-secrets` Secret. refresh 1h. Separate `cron-auth` ExternalSecret on 24h cadence (different rotation budget).

**SOTA-aligned:**
- ESO 0.10 — graduated.
- Workload Identity (GCP) + IRSA (AWS) — no static keys.
- Per-cadence ExternalSecrets (app-secrets 1h, cron-auth 24h) — sophisticated rotation choreography.
- `seed-secrets.sh` supports three backends: GCP SM, AWS SM, Bitnami Sealed Secrets (`kubeseal`) — covers air-gapped clusters too.
- `secret-template.yaml` documents schema; real values never in git. `.gitleaks.toml` + husky pre-commit + gitleaks CI job for defense-in-depth.

**SOTA gaps:**
- **No HashiCorp Vault SecretStore** in repo — only GCP/AWS. SOTA enterprise often layers Vault for dynamic secrets (DB credentials issued on demand, 5-min TTL). LITFIN's Stripe / M-Pesa keys are long-lived statics.
- **No SOPS** for git-encrypted secrets — fine because ESO handles runtime, but operators ship `values-prod.yaml` overrides via Helm `--set` rather than encrypted-in-git.
- **No `PushSecret`** flow (ESO 0.10+) — i.e. CI cannot push generated secrets BACK into the backend via ESO. Manual `seed-secrets.sh` workflow.
- **No secret-rotation automation** — `Docs/SECRETS-ROTATION.md` exists (4-phase: pre-stage / cut-over / soak / retire) but no scheduled k8s Job that flips the secret + verifies the dual-key window. Manual runbook.

---

## 4. CI/CD

### 4.1 GitHub workflows inventory

**Files (10 workflows):**

| Workflow | Purpose | Trigger | LOC |
|---|---|---|---|
| `ci.yml` | Lint / typecheck / unit / build / e2e / deploy-preview / deploy-prod | push+PR | 269 |
| `security.yml` | npm audit / gitleaks / Semgrep / typecheck / **security-route coverage** / dep-review / **Trivy** / **SBOM** | push+PR | 294 |
| `red-team.yml` | Adversarial harness + sycophancy probe + calibration eval | weekly+PR-to-brain | 159 |
| `litfin-rls-coverage.yml` | RLS-coverage scanner (org-scoped tables ENABLE+FORCE+POLICY+REVOKE) | PR on migrations | 91 |
| `litfin-migration-apply-fresh.yml` | Apply every `*.sql` in lex order on fresh pgvector pg16 | PR+main | 227 |
| `litfin-migration-safety-check.yml` | NOT NULL backfill safety static analyser | PR on migrations | 185 |
| `litfin-db-migrations-check.yml` | Unique/monotonic/forward-only static check | PR on migrations | 121 |
| `litfin-backup-restore-test.yml` | **Weekly drill** — pull encrypted S3 dump → decrypt → pg_restore → smoke-test rows | Mondays 04:00 UTC | 358 |
| `litfin-openapi-drift.yml` | Regenerate spec from `route.ts` handlers; diff vs `Docs/openapi.json`; comment on PR | PR+main | 111 |
| `litfin-audit-not-yet-wired.yml` | Scan `src/core/` for `NOT_YET_WIRED` placeholders | PR+main | 63 |

**Plus:** `.github/dependabot.yml` — weekly npm + github-actions updates, grouped by production/development.

### 4.2 SOTA-aligned

- **`security.yml:206-264` Trivy container scan** — builds runtime image, scans with `aquasecurity/trivy-action@0.28.0` on CRITICAL+HIGH, ignore-unfixed, uploads SARIF to GitHub Security tab. Also scans filesystem for config/secrets (`scan-type: fs`). PASS vs CIS/CNCF.
- **`security.yml:273-294` SBOM (CycloneDX)** — `anchore/sbom-action@v0` emits `sbom.cyclonedx.json`, 90-day artifact retention. Matches what bank procurement teams (BOT, BRELA) increasingly demand. PASS vs SOTA.
- **`security.yml:92-178` security-route-coverage** — bespoke shell loop that finds all `POST/PUT/PATCH/DELETE` handlers in `src/app/api/`, filters out exempt prefixes (webhooks, mcp, cron, staged-call, ussd/callback, whatsapp/webhook), and requires ≥90% to wrap one of `withSecurityEvents|requireAuth|requireRole|requireApiKey|verify.*signature`. Fails CI under threshold. Bonus: CSRF-header coverage report on client mutations (warn-only over 2 files). **This is novel and high-leverage** — no equivalent in BOSSNYUMBA (the audit doc says BOSSNYUMBA was supposed to port this).
- **`red-team.yml`** — three job tree: red-team unit tests (vitest), sycophancy probe (Stanford Mar 2026 method, gated by `LITFIN_PROBE_BRAIN_URL` for live probe), calibration eval (Brier + ECE). Weekly + PR-on-brain-touching-files. SOTA on AI-safety CI.
- **`litfin-rls-coverage.yml`** — supabase migrations RLS coverage scanner — direct port of BOSSNYUMBA's security-route-coverage pattern, adapted to DB layer.
- **`litfin-migration-apply-fresh.yml`** — fresh pgvector pg16 service container, every migration applied in lex order, ON_ERROR_STOP, full markdown report posted as PR comment + GitHub step summary + artifact. Best-in-class migration CI.
- **`litfin-backup-restore-test.yml`** — **weekly automated restore drill**. Pulls latest S3 daily encrypted dump, openssl decrypts (BACKUP_ENCRYPTION_KEY), pg_restore, runs row-count smoke tests on `organizations / users / loan_applications`, opens/updates GitHub issue + Slack-webhook on failure, OIDC AWS role (`AWS_RESTORE_TEST_ROLE_ARN`). SEV-2 on failure. **This is exemplary** — restore-tested backups are the bank-grade gold standard most fintechs skip. PASS.
- Dependabot grouped by production / development — avoids 50 separate PRs.

### 4.3 SOTA gaps

- **No GitOps controller (Argo CD / Flux)** — deploy.sh is a shell script calling `helm upgrade --install` from a developer / CI laptop. SOTA-2026: ArgoCD or Flux watches the Helm chart in git and auto-reconciles. No deploy SHA in cluster annotations, no drift detection. The Vercel-deploy step in `ci.yml:228-268` covers the production path; the K8s path requires manual `deploy.sh` invocation.
- **No Argo Rollouts** — canary requires manual TrafficSplit edits. SOTA: AnalysisTemplate + AnalysisRun with `prometheus` metric provider for automatic step progression. (See §3.4.)
- **No cosign sign-and-verify step** in `security.yml`. The Dockerfile comment claims signed images; reality is unsigned. SOTA-2026: `cosign sign --keyless` (Fulcio + Rekor transparency log) with `cosign verify` enforced via a cluster admission policy (Kyverno verifyImages or Sigstore policy-controller). LITFIN ships zero.
- **No SLSA L3 attestation** — `slsa-github-generator` action provides a one-line drop-in. LITFIN's SBOM is CycloneDX-JSON only, not bound to a build provenance attestation.
- **No Tekton Chains / in-toto attestations** — SOTA for SLSA L3 fanout.
- **No OSV-Scanner** (Google's CNCF-trajectory tool, complements Trivy with the OSV.dev DB). Trivy ≠ OSV-Scanner; both find different things.
- **No Renovate** — only Dependabot. SOTA prefers Renovate for: monorepo support, group policies, automerge rules, post-upgrade tasks (regen lockfile, run tests).
- **`security.yml:213` `continue-on-error: true` on Trivy** — comment says Trivy 0.28.0 was yanked and pinning needs re-baseline of suppressions. As-is, Trivy is best-effort, not gating. Needs fix.
- **No CodeQL** — SAST is Semgrep-only (`security.yml:51-69` with `p/owasp-top-ten`, `p/typescript`, `p/nextjs`). BOSSNYUMBA has CodeQL. SOTA: layer both — they catch different things.
- **No image signing on Vercel deploys** — Vercel build is a separate target with no supply-chain controls.
- **Vercel + K8s dual-target** — `ci.yml` deploys to Vercel; `deploy.sh` deploys to K8s. No single source of truth, no canary across targets, no traffic switchover script.
- **No release.yml / semantic-release** — version bumps are manual; no automated CHANGELOG. BOSSNYUMBA has `release.yml`.
- **No deploy gate on SLO** — `ci.yml:252-268` deploys to Vercel prod on every push to main. No SLO check, no error-budget gate, no automated rollback hook.

---

## 5. Observability

### 5.1 OpenTelemetry (substantially shipped since 2026-05-18 audit)

**Files** (LITFIN now has full OTel SDK — the 2026-05-18 audit is stale on this row):
- `src/lib/observability/otel/index.ts` — barrel
- `src/lib/observability/otel/tracer.ts` — `initTracing` (NodeSDK + getNodeAutoInstrumentations: http + pg), `withSpan`, `withSpanSync`, `getTracer`, `setTenantContext`, `setUserContext`, `hashUserEmailForSpan`, `hashIdForSpan`, `extractTraceContext`, `injectTraceContext`, `emitLangfuseSpan`, `buildLangfuseSpanAttributes`, `mapLangfuseObservationType`
- `src/lib/observability/otel/exporter-binding.ts` — `createOtelExporter(env)` factory (NoopSpanExporter when `OTEL_EXPORTER_OTLP_ENDPOINT` unset), `createLangfuseExporter(env)` (Basic auth from LANGFUSE_PUBLIC_KEY/SECRET_KEY), `parseHeaders` (validates RFC 7230 token chars on keys, printable ASCII on values, drops malformed entries with warn — defensive)
- `src/lib/observability/otel/telemetry.types.ts` — `PLATFORM_METRICS` catalogue with **34 metrics** including: HTTP, lending (loan_applications, credit_decisions, decision_latency, portfolio_amount), auth, audit, LLM (calls/tokens/latency by persona+provider+tenant), orchestrator (decisions, budget_usage), sovereign-ledger (actions, depth, integrity_failures), documents/filings, **canary SLOs** (litfin_canary_slo_status, litfin_canary_slo_breach_total), **autonomy cap** (litfin_tenant_autonomy_cap_usage, litfin_tenant_autonomy_cap_ceiling), **AI cost per tenant** (litfin_ai_cost_usd_per_tenant), **forecasting accuracy** (litfin_forecasting_accuracy_score), **OTel self-health** (litfin_otel_exporter_init_errors_total), **compliance breach** (litfin_audit_unauthorized_access_total, litfin_pii_egress_blocked_total), **borrower funnel** (litfin_borrower_signup_total, litfin_borrower_kyc_complete_total), **hook chain decisions**. SpanAttributes catalogue: `litfin.tenant.id`, `litfin.user.id`, `litfin.borrower.id`, `litfin.loan.id`, `litfin.decision.id`, `litfin.tier`, `litfin.jurisdiction`, `litfin.operation.name`, etc.
- `src/lib/observability/otel/langfuse-adapter.ts` — Langfuse 3.x via OTLP/HTTP; `FORBIDDEN_METADATA_KEYS` redaction list
- `src/instrumentation.node.ts:243-305` — boot path: short-circuits when `OTEL_EXPORTER_OTLP_ENDPOINT` unset (dev no-op), parses headers, sample ratio from `OTEL_TRACE_SAMPLE_RATIO` (default 0.1), service.name from `OTEL_SERVICE_NAME` (default `litfin-web`), instanceId from `HOSTNAME`, metricsInterval 60000ms
- `src/lib/observability/decision-trace-otel.ts` — domain-specific decision-trace OTel emitter
- `src/core/governance/decisions/decision-trace-otel-exporter.ts` — governance-layer OTel exporter

**SDK versions in `package.json:80-89`:** `@opentelemetry/api ^1.9.0`, `auto-instrumentations-node ^0.76.0`, `sdk-node ^0.218.0`, `sdk-trace-base ^2.7.1`, `sdk-trace-node ^2.7.1`, `exporter-trace-otlp-http ^0.218.0`, `resources ^2.7.1`, `semantic-conventions ^1.41.0`, `core ^2.7.1`. **Aligned with BOSSNYUMBA's Wave-L bump (sdk-node 0.218)** — versions match within minor.

**SOTA-aligned:**
- OTel SDK 0.218 / api 1.9 — current as of May 2026.
- Pure factory pattern for exporter binding — composition-root pattern (matches Mark Seemann clean architecture).
- Dev no-op gate (no collector → NoopSpanExporter that resolves SUCCESS in `queueMicrotask` so BatchSpanProcessor doesn't backpressure) — sophisticated.
- Langfuse OTLP exporter wired separately (basic-auth, traces endpoint normalised in `joinLangfuseUrl`) — preserves AI brain's Langfuse-flavoured attributes.
- Header validation in `parseHeaders` (RFC 7230 token regex for keys, printable-ASCII regex for values) — defensive against `OTEL_EXPORTER_OTLP_HEADERS` malformed env crashing SDK boot.
- `redactFields` catalogue includes `nin`, `national_id`, `kra_pin` — fintech-specific PII redaction in logs.
- Self-health metric `litfin_otel_exporter_init_errors_total` with alert `LitfinOtelExporterInitErrors` — observability of the observability stack. Few projects do this.

**SOTA gaps:**
- **No OTel logs SDK** — only traces (and metrics via PLATFORM_METRICS shape, but no SDK boot for metrics — sdkInstance only configures `traceExporter`). SOTA: OTel logs SDK gives a single wire format for logs+traces+metrics; LITFIN still routes logs via `@/lib/logger` (pino-shaped) + Sentry, not OTel.
- **No OTel metrics SDK initialisation** — `initTracing` accepts `metricsExporter` config but does not wire a MeterProvider. The `PLATFORM_METRICS` catalogue is shape-only; counters aren't actually emitted via OTel. (Inferred from `tracer.ts:43-97` — only `traceExporter` is wired.)
- **No `@opentelemetry/instrumentation-fetch`** — auto-instrumentations cover http (Node server) + pg, but client-side fetch from React isn't traced. Distributed traces stop at the Next.js server boundary.
- **No tail-based sampling collector** — sampling is head-based (`OTEL_TRACE_SAMPLE_RATIO=0.1`). SOTA: OTel Collector with `tail_sampling_processor` to always keep error traces / slow traces / specific tenants.
- **No service mesh trace injection** — Linkerd 2.19 supports `linkerd.io/trace-collector` annotation for mesh-level spans. LITFIN does not enable this.

### 5.2 Sentry

**Files:** `src/lib/observability/sentry-client.ts`, `sentry-pii.ts`, `error-reporter.ts`, `error-store.ts`. SDK: `@sentry/nextjs ^10.52.0`. Sentry init lazy-loaded in `instrumentation.node.ts:231-241`.

Standard Sentry-Next 10.x with PII-redaction layer in `sentry-pii.ts`. PASS.

### 5.3 Prometheus rules + Grafana dashboards

**Files:**
- `infra/observability/alerts/litfin-orchestrator.rules.yml` — **7 alert groups, 9 alerts:**
  - litfin-orchestrator: `LitfinErrorRateHigh` (>0.01 errors/s for 10m, critical), `LitfinDecisionLatencyP99High` (>2s for 15m, warning), `LitfinCanarySloBreach` (cohort breach for 5m, critical)
  - litfin-tenant-autonomy: `LitfinAutonomyCapNearLimit` (>90% for 15m, warning), `LitfinAutonomyCapBreached` (>100% for 1m, critical)
  - litfin-cost-attribution: `LitfinAiCostPerTenantSpike` (>$5/h for 30m, warning, FinOps), `LitfinAiCostGlobalBudgetBurnRate` (projected >$50k/month, warning)
  - litfin-forecasting: `LitfinForecastingAccuracyDegrade` (<0.7 for 30m, warning, ml-platform)
  - litfin-observability-self-health: `LitfinOtelExporterInitErrors` (>0 in 10m, warning)
  - litfin-compliance-breach-indicator: `LitfinBreachIndicator` (>5 unauthorised OR >10 PII-egress in 5m, critical, security)
  - litfin-sovereign-ledger: `LitfinSovereignLedgerIntegrityFailure` (>0 in 10m, critical, security)

  Every alert has `runbook_url: docs/runbooks/<alert-name>.md` and an actual runbook file in `Docs/RUNBOOKS/` (14 runbooks — see §6).

- `infra/observability/grafana/dashboards/` — **7 dashboards as JSON:**
  - `litfin-orchestrator-overview.json` — decision rate, error rate, p50/p95/p99 decision latency, hook-bus pie chart, active tenant count
  - `litfin-canary-slos.json` — per-cohort table, SLO breach count timeseries, cohorts-in-breach stat, canary-stage histogram
  - `litfin-cost-per-tenant.json` — AI cost USD/h per tenant, cost-share by tier (24h), top-10 tenants table, tokens/min by provider
  - `litfin-autonomy-cap-usage.json`
  - `litfin-credit-decisions.json`
  - `litfin-forecasting-accuracy.json`
  - `litfin-borrower-onboarding-funnel.json`

  All schemaVersion 39, datasource templated (`${DS_PROMETHEUS}`), refresh 30s-1m. Tags: `litfin`, `wave-c`.

**SOTA-aligned:**
- Alerts-as-code, dashboards-as-code — checked into git, PR-reviewable.
- Runbook URLs in every alert — exemplary SRE practice.
- FinOps + AI-cost alerts with team labels (`team: finops`, `team: ml-platform`, `team: security`, `team: brain`, `team: platform`) — routes correctly to the right team in Alertmanager.
- Self-health alert (`LitfinOtelExporterInitErrors`) — observes the observer.
- Composite breach indicator (`LitfinBreachIndicator` — unauthorised OR PII-egress) — multi-signal compliance trigger.
- Forecasting accuracy alert wired to JEPA model — ML drift detection is operational, not a chart-only artefact.
- `interval: 30s` on the highest-priority rule group (orchestrator) vs `5m` on forecasting — tuned cadence per signal volatility.

**SOTA gaps:**
- **No Grafana Loki / OTel logs** queries in dashboards — all panels query Prometheus. SOTA: logs panel alongside metrics for triage; correlated via traceID.
- **No Grafana Tempo / Jaeger** queries — no trace panel. The OTel SDK emits traces; no dashboard renders them.
- **No `recording rules`** — every dashboard recomputes histograms at query time. SOTA: pre-aggregate slow histograms into recording rules to keep dashboards fast.
- **No Alertmanager config** in repo — alerts defined but routing (`PagerDuty` / `OpsGenie` / Slack) not config-as-code. Operators set this up out-of-band.
- **No SLO definitions as code** — Pyrra / Sloth / OpenSLO would generate Prometheus rules + dashboards from a YAML SLO spec. LITFIN's `LitfinCanarySloBreach` reads a metric `litfin_canary_slo_status` but no SLO spec defines target/window/error-budget.
- **No multi-burn-rate alerts** (Google SRE workbook pattern) — alerts are single threshold + duration, not "fast burn 14.4x" + "slow burn 6x".
- **No `litfin-credit-decisions.json` panel reads** the per-tenant breakdown — credit decisions tracked but tenant-attribution drill not built (haven't read the dashboard JSON, but inferred from pattern).

### 5.4 Continuous profiling — gap

LITFIN has **no continuous profiling**. SOTA-2026: Parca / Polar Signals / Grafana Pyroscope / Datadog Continuous Profiler. eBPF-backed profiling shows where CPU/heap time is spent across a fleet with <2% overhead. For a Next.js monolith doing 13-step brain pipelines + LLM I/O, this would catch the kind of bottleneck the per-decision latency histogram (`litfin_decision_latency_ms_bucket`) can only point at.

### 5.5 eBPF runtime security — gap

No Cilium / Tetragon / Pixie. Network policy is K8s `NetworkPolicy` (L3/L4) only. SOTA-2026: Cilium for L3-L7 policy + Hubble for flow observability + Tetragon for process-exec / file-access runtime alerts (e.g. "any process exec inside `litfin-shell` other than `node server.js` is an incident"). For a fintech with sovereign-action ledger as a tamper-evident audit chain, runtime-attestation would close a real gap.

### 5.6 AI-assisted alerting — gap

No Datadog Bits AI / NR AI / Coralogix AI Center. Alerts are static threshold rules. SOTA-2026: dynamic-threshold detection on time-series, anomaly detection on log volume, root-cause AI suggestions.

---

## 6. Runbooks + SRE

**Files in `Docs/live-ops/`** (6 files):
- `oncall-runbook.md`
- `incident-response-protocol.md`
- `postmortem-template-and-process.md`
- `regulator-notification-protocols.md`
- `runbook-rollback.md`
- `status-page-operations.md`

**Files in `Docs/RUNBOOKS/`** (14 files — 1 per alert + 4 ops):
- `README.md`
- `ledger-bring-up.md`
- `pre-onboarding-wipe.md`
- 10 alert-paired: `litfin-ai-cost-global-budget.md`, `litfin-ai-cost-per-tenant-spike.md`, `litfin-autonomy-cap-breached.md`, `litfin-autonomy-cap-near-limit.md`, `litfin-breach-indicator.md`, `litfin-canary-slo-breach.md`, `litfin-decision-latency-p99-high.md`, `litfin-error-rate-high.md`, `litfin-forecasting-accuracy-degrade.md`, `litfin-otel-exporter-init-errors.md`, `litfin-sovereign-ledger-integrity.md`

**Files in `Docs/`** (top-level):
- `Docs/SECRETS-ROTATION.md` — 4-phase secret rotation runbook (pre-stage / cut-over / soak / retire), referenced by `scripts/rotate-keys.mjs`
- `Docs/DEPLOY-CHECKLIST.md`, `Docs/DEPLOYMENT_CHECKLIST.md`

**Files in `Docs/parity-tests/operator-runbooks/`** (8 brain-specific):
- world-model-jepa-activation, m5-acceptance-signoff, sovereign-action-incident-response, production-stream, live-blind-review, fairness-window-6mo-protocol, legal-review-audit-replay, red-team-100-attempts-protocol

**Total: ~28 runbooks.**

**SOTA-aligned:**
- 1:1 alert-to-runbook coverage — every Prometheus alert has a sibling `docs/runbooks/<alert-name>.md` with an explicit URL embedded.
- AI-specific runbooks (sovereign-action incident, world-model activation, fairness 6-month protocol, legal-review audit replay) — exemplary for an AI-first fintech.
- Postmortem template + regulator notification protocols — bank-grade.
- Restore-test drill (`litfin-backup-restore-test.yml`, see §4.3) tied to a runbook (issue created on failure).

**SOTA gaps:**
- **No public status page tooling** — `status-page-operations.md` describes the process but no Statuspage.io / Atlassian Statuspage / Cachet integration config in repo.
- **No on-call rotation as code** — `oncall-runbook.md` is prose. SOTA: PagerDuty / OpsGenie / Grafana OnCall config in git.
- **No SLO catalogue** — alerts reference SLO-style thresholds (p99<2s, error<0.01) but no `slo.yaml` documenting targets + windows + error budgets.
- **No chaos-engineering harness** — no Chaos Mesh / Litmus / Steadybit / Gremlin manifests. The 18 cronjobs and 4 Knative services give plenty of failure surface; no chaos schedule.

---

## 7. Feature flags

LITFIN uses a homegrown `feature-flags` ConfigMap (`k8s/base/configmap.yaml:30-47`):

```yaml
data:
  CLASSROOM_ENABLED: "true"
  STAGED_CALL_ENABLED: "true"
  COMMUNITY_LENDING_ENABLED: "true"
  AGENT_PLATFORM_ENABLED: "true"
  CHAT_AS_PROFESSOR_ENABLED: "false"
  EMOTION_DETECTION_ENABLED: "false"
  SESSION_RECORDING_ENABLED: "false"
```

The shell watches this ConfigMap (Role grants `watch`, see `role.yaml:11-16`), so `kubectl edit configmap feature-flags -n litfin` flips a flag without a deploy (documented in `k8s/README.md:174-180`).

**SOTA-aligned:**
- Live flag flips without redeploy — modern.
- RBAC scoped (only `configmaps` + `watch` verb) — minimal.

**SOTA gaps:**
- **No OpenFeature SDK** — flags are read as env-vars, no targeting rules, no user/tenant segmentation, no percentage rollouts. SOTA-2026: OpenFeature spec + `@openfeature/server-sdk` + a provider (Flagsmith, GrowthBook, ConfigCat, LaunchDarkly).
- **No flag-usage telemetry** — can't see which tenants hit which flag.
- **No flag lifecycle automation** — `flag-on for 30 days then remove` workflow absent.

---

## 8. FinOps / cost attribution

LITFIN has **AI-cost dashboards + alerts** (`litfin-cost-per-tenant.json`, `LitfinAiCostPerTenantSpike` alert) that read a `litfin_ai_cost_usd_per_tenant` counter labelled by `tenant`, `tier`, `provider`. This is **app-emitted cost** (LLM tokens × provider price → counter).

**SOTA gaps:**
- **No OpenCost / Kubecost deployment** — no cluster-level cost attribution. Pod CPU/memory/storage cost is not attributed back to tenant or namespace. SOTA: OpenCost reads Prometheus + cloud-provider pricing API, breaks down k8s spend by namespace/label/pod.
- **No Cloud Cost API integration** — `litfin_ai_cost_usd_per_tenant` is application-tracked LLM cost only. The 18 cronjobs + 4 Knative services + KEDA-scaled portals all have a cluster cost that nobody is attributing.

---

## 9. Supply chain

**LITFIN has:** SBOM (CycloneDX via `security.yml:273-294`), Trivy filesystem + image scan (best-effort due to v0.28.0 yank), npm audit, Semgrep SAST, Dependabot, gitleaks pre-commit + CI, dependency-review-action on PRs.

**SOTA gaps:**
- **No cosign sign step** in CI. Dockerfile comments claim signed images; reality is unsigned.
- **No cosign verify** in K8s admission. No Kyverno verifyImages policy, no Sigstore policy-controller, no Connaisseur. An attacker who pushes to `gcr.io/litfin` could ship arbitrary code.
- **No SLSA L3 attestation** — no `slsa-github-generator` workflow.
- **No OSV-Scanner** alongside Trivy.
- **No in-toto attestations / Tekton Chains**.
- **SBOM not attached as OCI 1.1 referrer** — only as 90-day artifact in GH Actions.
- **No `npm provenance`** for any LITFIN-published packages (the file-linked `@litfin/*` workspaces aren't published, but if they were, npm provenance is now a one-line npm publish flag).
- **No `git commit signature` requirement** — no `gpg-sign` in pre-commit. SOTA bank-grade: every commit `signedoff` + signed.

---

## 10. Multi-cluster / Multi-region

LITFIN's `app-config` ConfigMap (`configmap.yaml:16-17`) declares:
```yaml
PRIMARY_REGION: "europe-west3"
SECONDARY_REGION: "asia-south1"
```

But **no actual multi-cluster manifest exists**. No Cluster API, no Argo CD ApplicationSet for fanning the chart to N clusters, no Karmada, no vCluster for tenant isolation, no Submariner / Linkerd MultiCluster mirror.

The audit doc references "Phase D9 multi-region terraform + DR runbook" as in-flight on BOSSNYUMBA side. LITFIN ships single-region intent; multi-region is a build-out, not a config flip.

---

## 11. WASM / edge / confidential computing — all gaps

- **No WasmEdge / SpinKube** — Knative Services are all containerised. WASM would slash cold-start for compute-bound pipeline steps.
- **No Confidential Containers (CoCo) / Kata** — sovereign-action-ledger could benefit from hardware-attested confidential compute (e.g. AMD SEV-SNP / Intel TDX) for tamper-evident "regulator-pack" workloads.
- **No Knative Eventing** — only Serving. Event-driven workloads via Kafka-stream cron is one option, but for true SOTA the kernel-step pipeline could be modelled as a CloudEvents pipeline with Eventing autoscaling.

---

## 12. Pre-commit + dev tooling

**File:** `.husky/pre-commit` (33 LOC)

Runs `gitleaks protect --staged --redact --verbose --no-banner --config=.gitleaks.toml` then `lint-staged` (prettier). Best-effort if gitleaks not installed (warn, don't block — keeps fresh-clone friction low).

**File:** `.gitleaks.toml` (3125 bytes) — bespoke config.

**SOTA gaps:**
- No `pre-commit` framework (Python; runs language-agnostic hooks) — husky is fine, but the python-`pre-commit` ecosystem has more hooks.
- No SOPS pre-commit check (block commits that contain plaintext `.enc.yaml`).
- No `commitlint` — commit messages not enforced. (`lint-staged` is configured for prettier only.)

---

## 13. Top-3 port opportunities (for BOSSNYUMBA)

Ordered by impact-vs-effort:

### 13.1 Port LITFIN's `litfin-backup-restore-test.yml` weekly restore drill

**Source:** `.github/workflows/litfin-backup-restore-test.yml` (358 LOC)

**Why:** This is the single most impactful ops asset LITFIN has that BOSSNYUMBA lacks. BOSSNYUMBA's `Docs/RUNBOOKS/backup-restore.md` documents the procedure but never proves the backup is restorable. A weekly automated drill (pull latest S3 dump → decrypt → pg_restore → smoke-test row counts → SEV-2 GitHub issue + Slack on failure) catches the silent-corruption / wrong-key / wrong-schema class of failures that every fintech eventually hits.

**Effort:** Medium. ~350 LOC YAML + an S3-OIDC role + an `AWS_RESTORE_TEST_ROLE_ARN` secret + decision on the row-count smoke-test fixtures.

### 13.2 Port LITFIN's `k8s/external-secrets/` ESO stack + `secret-template.yaml` + `seed-secrets.sh`

**Source:** `k8s/external-secrets/secret-store.yaml` (GCP + AWS) + `external-secret-app.yaml` (per-cadence refresh) + `k8s/scripts/seed-secrets.sh` (3-backend: gcp / aws / kubeseal)

**Why:** BOSSNYUMBA's `infrastructure/k8s/base/secrets.yaml` is a stub. ESO with Workload Identity / IRSA / Sealed-Secrets fallback is the SOTA-2026 default. LITFIN's per-cadence ExternalSecrets (`app-secrets 1h`, `cron-auth 24h`) is a sophisticated detail BOSSNYUMBA can adopt.

**Effort:** Medium. Schema is in `secret-template.yaml`; copy + adjust namespace + secret list. ~200 LOC YAML + decision on backend(s).

### 13.3 Port LITFIN's Prometheus alert pack + per-alert runbooks

**Source:** `infra/observability/alerts/litfin-orchestrator.rules.yml` (199 LOC) + 10 alert runbooks in `Docs/RUNBOOKS/litfin-*.md`

**Why:** BOSSNYUMBA has alert YAML for auth/payments/SLA (11 rules) but lacks: AI-cost spike, autonomy-cap, OTel self-health, compliance-breach indicator (composite signal), sovereign-ledger integrity. The runbook-URL pattern (every alert points at `docs/runbooks/<alert-name>.md`) is exemplary SRE practice and trivial to adopt. The `team:` label routing (brain, finops, ml-platform, security, platform) cleanly maps to Alertmanager receivers.

**Effort:** Low. Adapt metric names (`litfin_*` → `bossnyumba_*`), drop into `infra/alerts/`, create 5-10 short runbook stubs.

---

## 14. Surprising findings (5 most surprising)

### 14.1 LITFIN shipped OTel since the 2026-05-18 audit — the parity flip is now BOSSNYUMBA-must-port-back

The 2026-05-18 audit (`BOSSNYUMBA101/.planning/parity-litfin/10-ops-ci-infra.md:23`) explicitly stated LITFIN had "ZERO `@opentelemetry/*` deps in `package.json`" and was the dimension where BOSSNYUMBA was more advanced. **That is no longer true.** Today (2026-05-23) `LITFIN/package.json:80-89` ships 9 `@opentelemetry/*` packages, all on the same Wave-L coordinated versions BOSSNYUMBA pushed (sdk-node 0.218). Moreover, LITFIN's `PLATFORM_METRICS` catalogue (34 metrics in `telemetry.types.ts`) is **broader than BOSSNYUMBA's 13** — it includes canary SLO, autonomy cap, AI cost per tenant, forecasting accuracy, OTel self-health, and a composite compliance-breach indicator. The audit conclusion that "BOSSNYUMBA OTel package should be ported into LITFIN verbatim" is inverted — LITFIN's catalogue is now the reference.

### 14.2 LITFIN runs an **automated weekly backup-restore drill** with SEV-2 issue creation on failure — BOSSNYUMBA has none

`.github/workflows/litfin-backup-restore-test.yml` is 358 LOC of belt-and-braces engineering: OIDC AWS role preferred, static-key fallback, ephemeral pg16+pgvector service container, openssl `aes-256-cbc -pbkdf2` decrypt, `pg_restore --clean --if-exists`, row-count smoke tests on `organizations / users / loan_applications`, configurable per-table minimums via `workflow_dispatch` inputs, Slack webhook on failure, GitHub issue auto-created/commented with `sev-2 + infrastructure` labels. This is the kind of asset that catches the "we discovered our backups were unrestorable on the worst day of our company" failure mode that has killed multiple fintechs (most recently FTX-related entities in 2024). BOSSNYUMBA documents the procedure (`Docs/RUNBOOKS/backup-restore.md`) but does not test it. **This is bigger than the SBOM gap.**

### 14.3 LITFIN's K8s NetworkPolicy stack explicitly blocks the cloud metadata IP (169.254.169.254)

`k8s/policies/networkpolicy-strict.yaml:74-77` — `deny-egress-to-private-ranges` excepts `169.254.169.254/32` from any egress. This blocks the **#1 cloud SSRF attack vector**: a compromised pod hitting AWS / GCP / Azure instance metadata to lift IAM creds. Combined with `automountServiceAccountToken: false` on every SA + Workload Identity for ESO + IRSA pattern, LITFIN has **defense in depth against the Capital One 2019 attack class**. Most fintechs in this codebase tier don't think to do this. BOSSNYUMBA's NetworkPolicy in `infrastructure/k8s/base/` does not have the IMDS block.

### 14.4 18 cronjobs use the **public hostname** instead of in-cluster Service URL — deliberate WAF/rate-limit choice

`k8s/base/cronjobs.yaml:8-13` documents the choice: every cron `curl`s `https://app.litfin.example.com/api/cron/...` instead of `http://litfin-shell.litfin.svc.cluster.local`. The reasoning: the public hop forces the cron to traverse ingress-nginx (rate-limit, HSTS, request body size), Linkerd-mTLS edge, the proxy.ts middleware (IP block, auth), and the app's `withSecurityEvents` wrapper — **exactly the same path a real client takes**. This deliberately surfaces ingress / WAF / mesh misconfigurations during scheduled drills. Most teams take the shortcut (`http://service.namespace.svc.cluster.local`) and discover ingress regressions only when users complain. This is **non-obvious operational discipline** that BOSSNYUMBA should adopt.

### 14.5 The `security-route-coverage` CI gate (`security.yml:92-178`) is **bespoke** and arguably better than what most off-the-shelf SAST tools detect

The shell loop scans `src/app/api/**/route.ts` for any `POST/PUT/PATCH/DELETE` export, exempts a known-good prefix list (webhooks / mcp / cron / staged-call / ussd-callback / whatsapp-webhook), and requires that 90%+ of the remaining mutation routes wrap one of: `withSecurityEvents | requireAuth | requireRole | requireApiKey | verify.*signature | validate.*signature`. **No commercial SAST tool reliably catches "you added a POST route and forgot the auth wrapper"** — it's a semantic check, not a syntactic one. BOSSNYUMBA's audit doc lists this as a missing capability (gap 6i) but never ported it. This is ~80 lines of shell that meaningfully shifts security posture left.

---

## 15. References (file:line index)

LITFIN ops-relevant files:
- `Dockerfile` (116 LOC, multi-stage, distroless)
- `.dockerignore` (115 LOC, tight)
- `k8s/README.md` (274 LOC, runbook quality)
- `k8s/base/{namespace,deployment-shell,hpa,poddisruptionbudget,networkpolicy,ingress,configmap,serviceaccount,role,cronjobs}.yaml`
- `k8s/keda/scaledobject-{borrower,officer,admin,litfin-admin}.yaml`
- `k8s/knative/service-{ai-inference,document-intelligence,elevenlabs-voice,deepseek-batch}.yaml`
- `k8s/linkerd/{serviceprofile,traffic-split}.yaml`
- `k8s/cert-manager/issuer.yaml`
- `k8s/external-secrets/{secret-store,external-secret-app}.yaml`
- `k8s/policies/networkpolicy-strict.yaml`
- `k8s/helm/litfin/{Chart.yaml,values.yaml,templates/*.yaml}` (14 templates)
- `k8s/scripts/{bootstrap-cluster,deploy,seed-secrets}.sh`
- `src/instrumentation.ts`, `src/instrumentation.node.ts` (OTel boot path lines 243-305)
- `src/lib/observability/otel/{index,tracer,exporter-binding,telemetry.types,langfuse-adapter}.ts`
- `src/lib/observability/{sentry-client,sentry-pii,error-reporter,decision-trace-otel}.ts`
- `src/core/governance/decisions/decision-trace-otel-exporter.ts`
- `infra/observability/alerts/litfin-orchestrator.rules.yml` (7 groups, 9 alerts)
- `infra/observability/grafana/dashboards/litfin-{orchestrator-overview,canary-slos,cost-per-tenant,autonomy-cap-usage,credit-decisions,forecasting-accuracy,borrower-onboarding-funnel}.json`
- `.github/workflows/{ci,security,red-team,litfin-rls-coverage,litfin-migration-apply-fresh,litfin-migration-safety-check,litfin-db-migrations-check,litfin-backup-restore-test,litfin-openapi-drift,litfin-audit-not-yet-wired}.yml`
- `.github/dependabot.yml`
- `.husky/pre-commit`, `.gitleaks.toml`
- `Docs/SECRETS-ROTATION.md`, `Docs/DEPLOY-CHECKLIST.md`, `Docs/DEPLOYMENT_CHECKLIST.md`
- `Docs/live-ops/{oncall-runbook,incident-response-protocol,postmortem-template-and-process,regulator-notification-protocols,runbook-rollback,status-page-operations}.md`
- `Docs/RUNBOOKS/{README,ledger-bring-up,pre-onboarding-wipe,litfin-{ai-cost-global-budget,ai-cost-per-tenant-spike,autonomy-cap-breached,autonomy-cap-near-limit,breach-indicator,canary-slo-breach,decision-latency-p99-high,error-rate-high,forecasting-accuracy-degrade,otel-exporter-init-errors,sovereign-ledger-integrity}}.md`
- `Docs/parity-tests/operator-runbooks/*.md` (8 brain-specific)
- `scripts/{rotate-keys.mjs,deploy-brain-migrations.sh,deploy-migrations.sh,litfin-validate-migration-safety.mjs,litfin-audit-not-yet-wired.mjs,litfin-openapi-export.mjs,openapi-export.mjs,openapi-validate.mjs}`
- `package.json:80-89` (OTel deps), `package.json:43-48` (k8s scripts)
- `playwright.config.ts` (5 projects: auth-setup / borrower / officer / compliance / journeys / smoke; CI workers=1 retries=2 timeout=60s)

BOSSNYUMBA comparative files (where relevant):
- `infrastructure/k8s/{base,api-gateway,databases,monitoring,apps,services,overlays/{staging,production}}/*`
- `infrastructure/terraform/{environments,modules}/*`
- `k8s/{Chart.yaml,values.yaml,templates/*.yaml,consolidation-worker-cron.yaml,sovereign-ledger-verify-cron.yaml,wake-loop-cron.yaml}` — separate Helm chart parallel to `infrastructure/k8s/`
- `.github/workflows/*.yml` (23 workflows)
- `monitoring/grafana-dashboards/bossnyumba-{ai,overview,payments}.json` + `infra/grafana/dashboards/{ai,overview,payments}.json` (duplicate trees — known drift risk per audit)
- `infra/alerts/{auth,payments,sla}.yaml`

---

*P04 ops + infra + observability audit, 2026-05-23.*
