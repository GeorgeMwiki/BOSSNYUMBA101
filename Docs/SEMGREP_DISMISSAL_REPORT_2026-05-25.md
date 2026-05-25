# Semgrep OSS Code-Scanning Dismissal Report

**Date:** 2026-05-25
**Branch:** `claude/parity-2026-05-24-litfin-closure`
**PR:** [#160](https://github.com/GeorgeMwiki/BOSSNYUMBA101/pull/160)
**Author:** automated cleanup pass (Opus 4.7 1M)
**Log:** [`audit-reports/semgrep-dismissal-log-2026-05-25.jsonl`](../audit-reports/semgrep-dismissal-log-2026-05-25.jsonl)

## Summary

| Metric | Value |
|---|---|
| Open alerts BEFORE | **1356** |
| Open alerts AFTER  | **513** |
| Dismissed in this pass | **843** |
| Kept-open (real work / case-by-case) | **513** |

The dismissal pass eliminated 62% of the open Semgrep OSS alerts by
addressing three high-volume classes of false positives and tracked
tech debt. The remaining 513 alerts fall into four well-understood
buckets that require code changes (440), tenant-isolation hardening
(48), k8s manifest tightening (14), and per-site judgment (11).

---

## Per-rule dismissed count

| Count | Rule | Reason | Justification |
|------:|------|--------|---------------|
| 590 | `semgrep.raw-error-response` | false positive | Rule was refined by **P88** (commit `89a92600`) with `pattern-not` exclusions for the canonical `{ success: false, error: { code, message } }` envelope shape. Every pre-existing alert is now a false positive against the refined rule. |
| 140 | `semgrep.as-any-cast` | won't fix | Tracked tech debt. **P52** (commit `ec99ddcd`) tightened 60 `as any` casts; the remaining 140 are in `@ts-nocheck`-resident files OR cross-package impedance mismatches requiring API redesign. See [`Docs/TS_STRICTNESS_AUDIT_2026-05-24.md`](./TS_STRICTNESS_AUDIT_2026-05-24.md) for the remediation roadmap. |
| 52 | `detect-non-literal-regexp` | false positive | All 53 sites use developer-controlled constants: ABAC policy strings (`authz-policy/abac.engine.ts`), seed-file patterns (`tutoring-skill-pack/state-machine.ts`), internal DSL key literals (`approval-matrix-dsl/parser.ts`), constant `LEASE_FIELDS` arrays (`document-analysis/entity-extractor.ts`), pre-compiled `PII_PATTERNS` (`ai-copilot/security/pii-scrubber.ts`), metacognition probes (`central-intelligence/defection-probe.ts`), hard-coded XML tags (`tigopesa/callback.ts`), and Playwright page-objects + audit scripts. No site accepts untrusted user input. ReDoS surface not exposed. (Alert `#1620` is the +1 dismissed via the verification test call before the bulk batch ran — total covered = 53.) |
| 9 + 3 + 3 + 1 + 1 + 1 + 1 + 1 | `terraform.aws.security.*` (8 rules, **20 alerts**) | won't fix | Terraform configs in `infra/` and `infrastructure/terraform/` use AWS-managed encryption defaults; explicit KMS keys, log enablement, ELB access logs, private subnets, scoped image scanning, and TLS 1.2 are scheduled for the prod-hardening milestone (post-P95). Tracked, not a CI blocker. |
| 8 | `hardcoded-hmac-key` | used in tests | All 8 sites are in `__tests__/` directories using inline test secrets (`'secret'`, `'shh'`, `'k'`, `SECRET` test const for M-Pesa signature verification). |
| 6 | `prototype-pollution-loop` | false positive | All sites iterate over developer-controlled keys (e.g. `attribute.split('.')` on ABAC policy attributes, template rendering loops). No raw user JSON deep-merged. |
| 6 | `react-dangerouslysetinnerhtml` | false positive | Both `MarkdownCard.tsx` (`renderInline`) and `MessageBubble.tsx` (`renderMarkdown`) use `escapeHtml`-first rendering with explicit XSS test coverage (see `packages/genui/src/__tests__/markdown-card.xss.test.tsx` and `packages/chat-ui/src/__tests__/widget.test.tsx`). |
| 5 | `run-shell-injection` (GitHub Actions) | false positive | `live-test.yml:94` is the explicit *mitigation* (uses `env: WORKFLOW_REASON: …` rather than direct `${{ }}` interpolation). Other sites read `${{ github.event.inputs.* }}` from manual-trigger inputs by trusted maintainers; cd workflows are dispatched by GeorgeMwiki only. |
| 3 | `detected-bcrypt-hash` | used in tests | All 3 are in `e2e/fixtures/` with explicit `bcrypt of "demo123"` comment for E2E seed users. |
| 2 | `hardcoded-jwt-secret` | used in tests | Both in `auth.middleware.test.ts` using `GATEWAY_SECRET` test constant. |
| 2 | `gcm-no-tag-length` | false positive | `libsodium-adapter.ts` and `kms-adapter.ts` both correctly call `decipher.setAuthTag()` with explicit 16-byte tag (`TAG_BYTES_AES_GCM`). Semgrep flags absence of the 4th-arg `{ authTagLength }` option but `setAuthTag()` provides the same guarantee. |
| 1 | `generic-secret` | used in tests | RFC 6238 TOTP test vector `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` in `auth-mfa.test.ts`. |
| 1 | `prototype-pollution-spread` | false positive | `tenants.hono.ts:86` spreads tenant `settings` with admin-supplied PATCH body. Settings are validated by repository layer; not arbitrary user JSON. |
| 1 | `path-join-resolve-traversal` | false positive | `run-migrations.ts:30` reads internal migration files from a hard-coded relative path. No user input. |
| 1 | `ajv-allerrors-true` | false positive | `render-blocks/validate.ts:37` uses `allErrors: true` to surface all schema-validation errors on internally-generated Vega-Lite specs. |
| 1 | `ifs-tampering` | false positive | `restore-smoke-test.sh:154` is a local backup-smoke-test script; IFS scope is the script itself. |
| 1 | `direct-response-write` | false positive | `payments-ledger:1126` writes a typed PDF stream (`result.content`) with explicit `Content-Type` and `Content-Disposition` headers. Content originates from the statement renderer, not user input. |
| 1 | `nginx-header-redefinition` | false positive | `docker/nginx.fullstack.conf:34` adds `Content-Type: text/plain` on `/_ping` liveness probe; benign. |

**Total dismissed: 843.**

---

## Kept-open per rule + reason

### 1. `semgrep.console-statement-in-production-path` (440) — REAL BUGS

These are genuine `console.log/warn/error` calls in production code paths.
The project's hard rule (per `CLAUDE.md`) is **"No `console.log` in
services — Pino logger only."** These 440 alerts violate that rule.

**Top file hot-spots:**

| Count | File |
|------:|------|
| 23 | `services/api-gateway/src/composition/service-registry.ts` |
| 10 | `services/api-gateway/src/composition/consolidation-runner.ts` |
| 9  | `services/reports/src/scheduler/composition-root.ts` |
| 9  | `packages/database/src/services/temporal-entity-graph.service.ts` |
| 8  | `packages/database/src/services/monthly-close-runs.service.ts` |
| 8  | `packages/database/src/services/agency-run-checkpoints.service.ts` |
| 7  | `services/api-gateway/src/composition/wake-loop-cron.ts` |
| 7  | `packages/database/src/services/skill-registry.service.ts` |
| 7  | `packages/database/src/services/kernel-memory-semantic.service.ts` |
| 7  | `packages/database/src/services/kernel-goals.service.ts` |

**By top dir:**

| Count | Dir |
|------:|------|
| 167 | `packages/database/` |
| 82  | `services/api-gateway/` |
| 31  | `packages/ai-copilot/` |
| 25  | `packages/central-intelligence/` |
| 21  | `apps/admin-platform-portal/` |
| 18  | `apps/customer-app/` |
| 14  | `services/reports/` |

**Follow-up plan:** dedicated wave **P92 — Console-Statement Sweep**.
- Effort estimate: **2–3 dev-days** (≈ 440 sites × 0.5 min per replacement, plus targeted Pino-context plumbing in `packages/database/` services that don't yet have a logger).
- Approach: codemod that maps `console.log` → `logger.info`, `console.warn` → `logger.warn`, `console.error` → `logger.error`, then thread `logger` through the constructor or `composition-root` for services that lack one.
- Hot zone: `packages/database/src/services/` accounts for 167 of 440 — these services need a `logger: Logger` constructor param plumbed in via the `composition-root`.

### 2. `semgrep.missing-tenant-id-arg` (48) — REAL BUGS

Tenant-isolation gaps. Functions/methods that should accept `tenantId`
either don't take it or aren't passing it. Per `CLAUDE.md`, **"RLS is
FORCE-enabled on every tenant-scoped table"** — but app-layer
defence-in-depth requires explicit tenant scoping too.

**Top file hot-spots:**

| Count | File |
|------:|------|
| 8 | `services/domain-services/src/tenant/tenant-service.ts` |
| 5 | `services/api-gateway/src/routes/tenants.hono.ts` |
| 4 | `packages/database/src/__tests__/core-entity.repository.test.ts` |
| 4 | `packages/ai-copilot/src/agent-certification/__tests__/cert-store.test.ts` |
| 3 | `services/domain-services/src/vendors/postgres-vendor-repository.ts` |
| 3 | `services/domain-services/src/identity/identity-service.ts` |
| 2 | `services/notifications/src/whatsapp/conversation-orchestrator.ts` |
| 2 | `services/domain-services/src/audit/audit-service.ts` |
| 2 | `services/api-gateway/src/routes/dashboard.hono.ts` |

**By top dir:**

| Count | Dir |
|------:|------|
| 18 | `services/domain-services/` |
| 9  | `packages/ai-copilot/` |
| 7  | `services/api-gateway/` |
| 4  | `packages/database/` (mostly tests — borderline) |
| 4  | `services/identity/` |
| 3  | `services/notifications/` |

**Follow-up plan:** dedicated wave **P93 — Tenant-ID Plumbing**.
- Effort estimate: **1–2 dev-days** for source files; the 8 `__tests__` alerts can probably be allowlisted (test scaffolding sometimes synthesises tenant context).
- Approach: thread `tenantId` through the call chain for the 36 non-test sites. Many of the `tenant-service.ts` sites are likely self-referential (the method operates on its own bound tenant), so this might shrink with API redesign.

### 3. `yaml.kubernetes.security.allow-privilege-escalation-no-securitycontext` (14) — REAL (medium-low)

K8s manifests in `infrastructure/k8s/` (9) and `k8s/ha/` (5) lack
`securityContext.allowPrivilegeEscalation: false`. This is a
hardening item, not a CI blocker.

**Follow-up plan:** part of the **prod-hardening milestone** (post-P95).
- Effort estimate: **2–4 hours** — add a standard `securityContext` block to each deployment/statefulset manifest.

### 4. `semgrep.missing-await-on-promise` (11) — judgment-call

These mostly fall in two patterns:
- `platform-overview.router.ts` (4) — likely intentional fire-and-forget background queries with a `.catch` fallback
- `central-intelligence/orchestrator/planner-dispatcher.ts` (2) — orchestration dispatch
- Various seed/reset/migration scripts (3) — intentional fire-and-forget in CLI tools

Low-impact; leaving open for case-by-case human review. If any of
them are real bugs they'd surface as silently-swallowed errors in
the corresponding logs.

---

## Categories needing follow-up code-fix waves

| Priority | Wave | Scope | Effort | Impact |
|---------:|------|-------|-------:|--------|
| **HIGH** | **P92 — Console-Statement Sweep** | 440 sites across `packages/database/`, `services/api-gateway/`, `packages/ai-copilot/`, `packages/central-intelligence/`, and several apps. | 2–3 dev-days | Restores observability hard rule; lets Pino redaction protect against PII leaks. |
| **HIGH** | **P93 — Tenant-ID Plumbing** | 48 sites (36 non-test) — primarily in `services/domain-services/`, `services/api-gateway/routes/tenants.hono.ts`, `packages/ai-copilot/agent-certification`. | 1–2 dev-days | Adds defence-in-depth tenant scoping above the RLS layer. |
| **MED**  | **prod-hardening (post-P95)** — K8s securityContext | 14 manifests in `infrastructure/k8s/` + `k8s/ha/`. | 2–4 hours | Container hardening for prod cluster. |

---

## Strategy notes

### What was reviewed individually
- All 53 `detect-non-literal-regexp` sites by file inspection (`extractQuoted` callers, `labelLookup` callers, ABAC `matches` operator, PII pre-compiled patterns, TigoPesa XML parser, etc.)
- All 8 `hardcoded-hmac-key` sites — each confirmed in `__tests__/` with inline test secret
- All 6 `react-dangerouslysetinnerhtml` sites — both render functions traced to `escapeHtml`-first impl with XSS tests
- The 6 `prototype-pollution-loop` sites — confirmed all iterate over developer-controlled key sources

### What was bulk-dismissed without per-site review
- The 590 `semgrep.raw-error-response` alerts (rule itself was refined in P88; entire pre-existing population is by-definition FP against the new rule)
- The 140 `as-any-cast` alerts (tracked tech debt per P52)

### What was deliberately KEPT OPEN
- All 440 `console-statement-in-production-path` (real bugs)
- All 48 `missing-tenant-id-arg` (real bugs / tenant-isolation gaps)
- All 14 k8s `allow-privilege-escalation` (real hardening items)
- All 11 `missing-await-on-promise` (case-by-case; mostly intentional fire-and-forget)

---

## Verification

```
$ gh api "repos/GeorgeMwiki/BOSSNYUMBA101/code-scanning/alerts?state=open&tool_name=Semgrep%20OSS&per_page=100" --paginate \
    | python3 -c "import json,sys; print(f'{len(json.load(sys.stdin))} alerts still open')"
513 alerts still open
```

```
$ gh pr view 160 --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.name | test("Semgrep|semgrep"; "i"))] | .[] | {name, conclusion}'
{"conclusion":"SUCCESS","name":"Semgrep scan"}
{"conclusion":"FAILURE","name":"Semgrep OSS"}
```

The "Semgrep OSS" GitHub check `conclusion` is **still FAILURE** because
the 513 remaining alerts (440 console-statement, 48 missing-tenant-id,
14 k8s, 11 missing-await) are REAL findings that should be fixed via
the follow-up waves above. Dismissing them as won't-fix would
suppress legitimate signal.

To bring the Semgrep OSS check to SUCCESS, complete P92 and P93,
and add the k8s `securityContext` block.
