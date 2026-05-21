# Deep Production-Readiness Audit — 2026-05-20

**Branch:** `claude/intelligent-morse-66a8e5`
**Method:** 6 parallel deep-audit agents (security, code-quality, build/test, production gaps, architecture, E2E) over `apps/`, `packages/`, `services/`, `e2e/`, `infra/`, `.github/`, `docker-compose.*`. Each agent briefed to skip findings already in `.audit/production-readiness-gaps.md`, `.audit/post-phase-f-bug-sweep.md`, `Docs/KNOWN_ISSUES.md`, `Docs/TODO_BACKLOG.md`.

---

## VERDICT: NOT PRODUCTION-READY

The codebase ships sophisticated multi-tenant, AI-native plumbing — but launching to public users today would expose **5 critical security vulnerabilities, 3 architectural blockers, and a red CI**. Surprisingly, the most urgent finding is not from the security agent: the codebase **does not pass typecheck, lint, or unit tests on `main` as of 2026-05-20**. The fix is mechanical (CI is missing a `pnpm build` step before downstream packages typecheck/test against unbuilt `dist/`), but until it's green every other audit finding is unverifiable.

**Estimated effort to launch-ready baseline: 8-12 engineer-weeks**, split as:
- 1 week: green CI + close 5 CRITICAL security bugs
- 2 weeks: architectural decisions (monolith honesty, ORM unify, Postgres HA)
- 2 weeks: production-readiness hygiene (idempotency, healthchecks, observability, kill-switch guards)
- 2 weeks: E2E coverage (cross-tenant isolation, session/refresh, 31 hard-skipped customer-app surfaces, top-5 missing flows)
- 1-2 weeks: HIGH-priority bug closures (16 items)

---

## CRITICAL BLOCKERS — fix before any production traffic (17 items)

| # | Category | Issue | File:Line | Effort |
|---|---|---|---|---|
| **B1** | Build | `pnpm typecheck` fails (80 errors); `pnpm test` fails (10 real + 38 cascading); 2 packages fail lint; CI on `main` is RED today | `package.json`, every workspace pkg missing `prepare`/`build` ordering in CI | 4-6h |
| **B2** | CI | Latest `main` Trivy + Dependabot runs are `failure`; PRs landing red | `.github/workflows/*.yml` | 2h |
| **S1** | Security | `xlsx@0.18.5` has unpatched CVE-2023-30533 (prototype pollution) + CVE-2024-22363 (ReDoS). Triggers on any malicious `.xlsx` upload to ingest pipeline | `packages/file-ingest/package.json:53` | 1h |
| **S2** | Security | **SSRF** via `X-Tenant-ID` header → URL path. Tenant ID flows from request header into `fetch(\`${apiBase}/internal/tenants/${tenantId}\`)` with no validation | `services/api-gateway/src/middleware/tenant-context.middleware.ts:208` | 1h |
| **S3** | Security | **Path traversal** in S3/storage key — `file.originalName` interpolated directly into upload path. Attacker uploads `originalName="../../../tenant-B/secret.pdf"` to write into another tenant's prefix | `services/document-intelligence/src/services/document-collection.service.ts:235` | 1h |
| **S4/C1** | Security+Bug | **4-eye executor bypass** — `markExecuted(planId, ctx.executor_actor_id)` accepts ANY actorId. Proposer can self-execute their own approved plan; the documented 4-eye guarantee terminates at approval | `packages/file-ingest/src/approval/executor.ts:202`, `approval-ledger.ts:132-156` | 2h |
| **S5** | Security | Provenance hash **excludes `tenant_id`** — two tenants sharing same `conversation_id`+`file_hash` produce identical provenance hashes; cross-tenant collision risk | `packages/file-ingest/src/provenance/hash.ts:14-20` | 30min |
| **C2** | Bug | `Math.random()` for entity_id fallback — breaks documented "re-ingesting the same file yields the same entity ids" invariant; two empty-dedup-key uploads collide | `packages/file-ingest/src/approval/executor.ts:64-69` | 30min |
| **C3** | Bug | No rollback on partial batch failure — ledger left in `approved` state after partial writes; plan re-executable with no replay protection | `packages/file-ingest/src/approval/executor.ts:177-202` | 2h |
| **A1** | Arch | **api-gateway is a god-monolith.** 6 "services" (identity, notifications, document-intelligence, domain-services, reports, webhooks) all ship `replicas: 0` — they run in-process. One OOM kill = entire platform offline. Docs claim microservices; reality is modular monolith | `docker-compose.production.yml:255,277,299,321,372,394` | Doc 2d / Refactor 2w/svc |
| **A2** | Arch | **Dual ORMs in one DB.** Prisma manages `payment_intents` in `services/payments-ledger/`; Drizzle manages everything else. Two migration toolchains, zero shared FK enforcement | `services/payments-ledger/prisma/schema.prisma` vs `packages/database/src/schemas/*.ts` | 3-5d |
| **A3** | Arch | **Postgres SPOF.** Single container, no standby, no WAL archive. Both schemas live here. One failure = total outage | `docker-compose.production.yml:42-76` | 1w ops |
| **P1** | Prod | K8s cronjobs use `:latest` container tag — unintended version skew at next pod recreate | `k8s/{consolidation-worker,wake-loop,sovereign-ledger-verify}-cron.yaml:18` | 30min |
| **P2** | Prod | Certbot container uses `:latest` | `docker-compose.production.yml:552` | 5min |
| **P3** | Prod | **Webhook handlers missing idempotency** — duplicate webhook deliveries create duplicate notifications/state | `services/api-gateway/src/routes/notification-webhooks.router.ts`, `inngest-webhook.router.ts` | 4h |
| **P4** | Prod | Consolidation worker has **no liveness probe** — can hang silently with no restart | `docker-compose.production.yml:136-154` | 2h |
| **P5** | Prod | Per-tenant rate-limit silently degrades to in-memory on Redis failure → silent budget weakening at scale (N replicas × limit per tenant) | `services/api-gateway/src/middleware/per-tenant-rate-budget.ts:14-17`, `services/api-gateway/src/index.ts` | 4h |

---

## HIGH PRIORITY — close before public launch (30+ items)

### Security (11 items)
1. **Prototype pollution** in `executor.ts:91,130` via `{ ...field_map }` then `Object.entries` — malicious LLM/persisted-plan with `__proto__` key survives Zod. Fix: `Object.create(null)`.
2. **Prompt injection** in `llm-proposer.ts:47-117` — raw header text + sample cell values fed verbatim to LLM. Fix: accept only schema (column names + types), escape via `JSON.stringify`.
3. **`Math.random()` collision** for entity IDs (cross-references CRITICAL C2 — same fix).
4. **No file-size / row / column caps** in CSV/Excel ingest — 500MB CSV OOMs api-gateway. Fix: enforce 25MB / 100k rows / 200 cols.
5. **Payouts worker has no tenant predicate** in `pickPendingBatch` — poisoned outbox row dispatches cross-tenant. Fix: shard per-tenant or verify before send. `services/api-gateway/src/services/payouts/payouts-worker.ts:188-215`.
6. **Dry-run lies** — checks only first attribute's provenance hash; empty-attribute entities reported as `exists=false`. `packages/file-ingest/src/approval/executor.ts:169-172`.
7. **SheetJS dangerous defaults** — formulas/external-links enabled. Fix: `{ cellFormula:false, cellHTML:false, bookVBA:false }`. `packages/file-ingest/src/schema-sniff/excel-adapter.ts:22`.
8. **Float math for fee percent** — `parseFloat(PLATFORM_FEE_PERCENT)`, host-dependent rounding drift. Fix: integer basis points. `services/payments-ledger/src/server.ts:157`.
9. **M-Pesa currency assumption** — `Math.round(amountMinor/100)` breaks for 3-decimal currencies. Fix: currency-aware `Money.toMajor()`. `services/api-gateway/src/services/payouts/providers/mpesa-b2c-adapter.ts:300-302`.
10. **Heuristic-map prototype write** — `fieldMap[col.name] = match.key` with attacker-controlled CSV header `__proto__`. Fix: `Object.create(null)`. `packages/file-ingest/src/proposal/heuristic-map.ts:130`.
11. **Executor doesn't re-validate field_map** against current entity-type descriptors at execute time — race condition between approve and execute.

### Code Quality (10 items)
1. **SectionMount lazy-component cache is module-global, not tenant-scoped** — two tenants with same `section.key` alias each other's loaders. `packages/dynamic-sections/src/components/SectionMount.tsx:54`.
2. **`useSwipeNav` missing `setPointerCapture`/`pointercancel`** — gesture state leaks if pointer leaves target. `packages/dynamic-sections/src/hooks/use-swipe-nav.ts:51-68`.
3. **Inconsistent error response shapes** — 4 distinct shapes coexist (`{error:'string'}`, `{error:{code,message}}`, `{success:false,error:'string'}`, `{success:false,error:{code,message}}`). Clients can't write a single parser. `services/api-gateway/src/routes/*`.
4. **Scanner audit workflow uses `actions/upload-artifact@v4`** while every other workflow is `@v7` (post-PR-#66 standard). `.github/workflows/audit-coverage.yml:85`.
5. **PDF free-text fallback drops PII unredacted** — `parsePdfText` stores raw lease scan text without `redactPayloadPii`. `packages/file-ingest/src/schema-sniff/pdf-adapter.ts:97-101`.
6. **`parseCsv` swallows papaparse errors** — malformed CSV silently truncates. `packages/file-ingest/src/schema-sniff/csv-adapter.ts:22-31`.
7. **`DynamicTabBar` fires phantom onChange** on section list update without ref-gate. `packages/dynamic-sections/src/components/DynamicTabBar.tsx:108`.
8. **145 `as any` casts** in production source — top concentrations: `vacancy-pipeline.router.ts` (6), `mcp-wiring.ts` (5), `service-registry.ts` (3) — all in API boundaries / DB row casts on MCP tool surface.
9. **2 lint hard errors** (irregular-whitespace, misleading-character-class) in `services/notifications` + `packages/ai-copilot`.
10. **10 real test failures** — role-gate + sovereign-ledger returning unexpected status codes (auth middleware drift, not stub/wire issue).

### Architecture (7 items)
1. **`tenants.region` column unused** — KMS, OCR, S3, log routing still read `env.AWS_REGION`. Multi-region data residency claim is false.
2. **AG-UI substrate currency enum** still hardcodes `'KES'|'TZS'|'USD'` in the brain↔UI wire protocol. Cross-references pre-existing audit but ships in `central-intelligence/kernel/tools/render-blocks/*`.
3. **NOT_YET_WIRED HQ tools** — Temporal eviction/owner-payout/KRA-MRI dispatchers + NIDA + e-Ardhi adapters all refuse clean. Real adapters exist in `packages/connectors/src/adapters/` but unbound in composition. Entire TZ statutory identity flow is broken. `services/api-gateway/src/composition/hq-tool-registry.ts:736,747,761,777,793`.
4. **Synchronous 13-step kernel pipeline** — one slow tool tail-latencies entire brain turn.
5. **No LLM-down fallback visibility** — sensor-failover exists but degraded outputs (heuristic baseline) don't surface a `degraded:true` flag to UI/operator.
6. **`disaster-recovery.ts` is shelf-ware** — exported, zero invocations across `services/` and `apps/`.
7. **8 single-points-of-failure** total: Postgres, Redis (single), Nginx, api-gateway monolith, in-memory rate buckets, Anthropic API for some plans, Inngest+Temporal not in production compose, outbox processor undefined.

### Production-Readiness (6 items)
1. **6 routes lack observability** (no logger calls): `agent-certifications`, `ai-chat`, `admin-jarvis-stream`, `ai-costs`, `applications`, `admin-jarvis`.
2. **5 services missing health checks**: identity, notifications, reports, webhooks, consolidation-worker.
3. **No backup restore test in CI** — `scripts/backup.sh` exists but no weekly validation it's actually restorable.
4. **No kill-switch guards** on lease-eviction, payment-reversal, account-deletion routes despite feature-flags service being wired.
5. **No NOT_NULL-with-backfill validation** pre-deploy script for migrations.
6. **`payments-ledger` `/healthz` may not be reachable** from compose health probe (server gates behind `/webhooks/` prefix).

### E2E Coverage (Top 5)
1. **Zero cross-tenant isolation E2E tests** — user-A-of-tenant-X reading tenant-Y data via URL/token swap is unverified. Multi-tenant launch blocker.
2. **31 hard-skipped customer-app tests** — "UI never finished" pattern across documents, onboarding, payments, communication, maintenance.
3. **No session expiry / 401 refresh tests** — owners staying logged in for days hit this on day 1.
4. **No rate-limit / 429 tests** — middleware ships, behaviour unverified.
5. **No M-Pesa STK callback E2E** — payments specs mock at gateway, not exercised through Daraja sandbox.

---

## MEDIUM PRIORITY — before world-launch

(20+ items: condensed) — local timezone issues in dedup normalisation (Turkish-I), in-memory approval-ledger TTL, MCP-server `python3` allowlist hardening, CSV-injection-formula prefix protection, lazy-component loader retry, payouts-worker stuck-in-`processing` sweeper, M-Pesa `Occasion` field leaking tenant ID to Daraja audit log, `vacancy-pipeline.router.ts` type-cast cleanup, 91 `@ts-nocheck` files in Hono-v4 cluster (already tracked in `TYPE_DEBT.md` waves 15-17).

---

## RECOMMENDED ACTION SEQUENCE

### Phase 0 — Unblock everything (1 week, 1 engineer)

1. **Day 1-2: Fix CI** — add `pnpm -r build` step in CI before `typecheck`/`test`; verify `package.json` `exports` for `design-system`, `observability`, `forecasting`, `realtime-rooms`, `enterprise-hardening`, `compliance-plugins`. Close the 80 module-resolution TS errors and 38 cascading test failures.
2. **Day 3: Fix 5 lint errors + 10 real test failures** (auth middleware drift in role-gate + sovereign-ledger).
3. **Day 4-5: Close 5 CRITICAL security bugs** (S1-S5): bump `xlsx`, validate tenant header, sanitise filename, enforce 4-eye executor distinct-actors, add tenant_id to provenance hash.

**Exit gate:** green CI on every workflow + zero CRITICAL security findings.

### Phase 1 — Architectural honesty (2 weeks, 2 engineers)

4. **Pick monolith OR microservices** — document the truth in `Docs/ARCHITECTURE.md`. Recommend modular monolith for launch (cheapest path: rename `@bossnyumba/*-service` → `@bossnyumba/*-lib`, delete `replicas:0` compose entries, rewrite arch doc).
5. **Unify ORM** — rewrite `services/payments-ledger/prisma/schema.prisma` into a Drizzle schema; add to main migration chain.
6. **Postgres HA** — Patroni or RDS Multi-AZ; WAL archive to S3.
7. **Redis Sentinel** (3 nodes) + production-compose Inngest container or document managed-Inngest dep loudly.
8. **Pin K8s + Certbot tags** (5min fix).
9. **Wire `tenants.region`** to KMS / OCR / S3 / log routing.

**Exit gate:** docs match reality, no `:latest` tags, no SPOFs in critical path.

### Phase 2 — Production hygiene (2 weeks, 2 engineers)

10. **Webhook idempotency** — add `idempotencyKey` header + Redis dedupe on `notification-webhooks` and `inngest-webhook`.
11. **Healthcheck coverage** — add probes for consolidation-worker, payments-ledger `/healthz`, notifications, identity (or document library-only).
12. **Per-tenant rate-limit → Redis-backed** (currently in-memory). Make Redis-down a loud 503, not a silent fallback.
13. **Observability backfill** — structured logging on 6 unlogged routes; import `@bossnyumba/observability` across 40+ unwired routers.
14. **Backup restore test** in CI — weekly drill: decrypt, restore to ephemeral DB, smoke test.
15. **Kill-switch guard decorators** on eviction, payment-reversal, account-deletion.
16. **Wire `disaster-recovery.ts`** OR delete it (currently shelfware).

**Exit gate:** every route logs, every service has a probe, every webhook is idempotent.

### Phase 3 — E2E coverage (2 weeks, 1-2 engineers)

17. **Cross-tenant isolation suite** (5-8 specs, dual-tenant fixtures).
18. **Un-skip + implement 31 hard-skipped customer-app surfaces** (UI + spec).
19. **Session/refresh/429** flows.
20. **M-Pesa STK callback E2E** via Daraja sandbox.
21. **Payout/disbursement** flow.
22. **GDPR/PDPA** data-export + account-delete (compliance landmine for KE/TZ).
23. **Firefox + WebKit** projects in `playwright.config.ts` (half of KE mobile market is iOS-Safari).

**Exit gate:** every app has a golden-path E2E; ≥20% negative-path ratio (currently 4.5%).

### Phase 4 — HIGH bug closures (1-2 weeks, 2 engineers)

24. Remaining 30+ HIGH items from the categorised lists above — security (prompt injection, file-size caps, payouts tenant predicate), code-quality (error-shape unify, lint cleanup, `as any` cleanup in API boundaries), arch (NOT_YET_WIRED HQ tools, currency-enum widen, degraded-mode visibility).

**Exit gate:** zero HIGH security findings; consistent error shape; LLM-down failures visible.

### Phase 5 — Soft launch (1 week)

25. Private beta with 1-2 tenants on production stack. Watch SLOs, error rates, backup-restore drill.
26. Document SLA + on-call runbook against the actual deployed topology.

---

## "READY / NOT READY" Capability Matrix

| Capability | Status | Notes |
|---|---|---|
| Install (`pnpm install`) | READY | Clean, no peer-dep errors |
| Typecheck | NOT READY | 80 TS errors (build-ordering, fixable in 4-6h) |
| Lint | NOT READY | 5 hard errors in 2 packages |
| Unit tests | NOT READY | 10 real failures, 38 cascading from build issue |
| CI | NOT READY | Trivy + Dependabot + Strict CI + Coverage failing |
| Secrets in code | READY | Clean — no hardcoded secrets, GitHub Secrets used in workflows |
| Migrations | READY | No destructive migrations; defaults present |
| Backups | PARTIAL | Script production-grade; no restore test in CI |
| Docker prod | PARTIAL | App services pinned; K8s cronjobs + Certbot use `:latest` |
| Observability | PARTIAL | Package exists, 6+ routes don't log, 40+ routers don't import it |
| Rate-limiting | PARTIAL | Global Redis-backed works; per-tenant is in-memory |
| Health checks | PARTIAL | 8 of 13 services have probes |
| Idempotency | PARTIAL | Core middleware exists; webhook handlers missing |
| Feature flags | PARTIAL | Service exists; no kill-switch guard enforcement |
| Tenant isolation | DATA-LAYER READY | RLS + cross_tenant_denials table + DP-cohort enforce; **zero E2E tests verify** |
| Postgres HA | NOT READY | Single replica, no standby |
| Redis HA | NOT READY | Single instance |
| ORM | NOT READY | Prisma + Drizzle drift |
| Service topology | NOT READY | 6 "services" are actually in-process libs |
| LLM degraded-mode UX | NOT READY | Failovers silent; no `degraded:true` flag |
| E2E coverage | NOT READY | 4.5% negative-path ratio; zero cross-tenant tests; 31 hard-skipped UIs |
| `tenants.region` wiring | NOT READY | Column ships, no consumer |
| NOT_YET_WIRED HQ tools | NOT READY | Temporal/NIDA/e-Ardhi unbound; entire TZ statutory flow broken |

---

## Cross-Validation Notes

Two independent agents (security + code-quality) flagged the **4-eye executor bypass** in `packages/file-ingest/src/approval/executor.ts:202`. Two independent agents (security + production) flagged **per-tenant rate-limit in-memory degradation**. Two agents (architecture + production) flagged **unused `tenants.region`**. These cross-validations raise confidence the findings are real, not artefacts of any one agent's framing.

The file-ingest pipeline (PR #103, merged 2 days ago) is the single hottest source of CRITICAL and HIGH findings — 8 critical/high issues concentrated in `packages/file-ingest/src/approval/*` and `packages/file-ingest/src/schema-sniff/*`. Recommend a focused hardening sprint on this package before it's wired into any app or service.

---

## Already-Known Issues (NOT Re-Audited)

These are tracked in earlier audit files; this report does not duplicate them. Cross-reference:
- `.audit/production-readiness-gaps.md` — currency enum, mock OCR provider default, hardcoded localhost URLs, `tenants.region` (cross-validated here)
- `.audit/post-phase-f-bug-sweep.md` — 8 CRITICAL + 4 HIGH closed in PR #90
- `Docs/KNOWN_ISSUES.md` — KI-001 through KI-013 (migration ledger drift, OpenAPI catalog drift, etc.)
- `Docs/TODO_BACKLOG.md` — `as any` cleanup waves
- `Docs/TYPE_DEBT.md` — 91 `@ts-nocheck` Hono-v4 cluster

---

**End of audit.**
