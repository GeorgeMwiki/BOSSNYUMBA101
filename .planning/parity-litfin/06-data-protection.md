# P6 — Data Protection Parity (LITFIN ↔ BOSSNYUMBA101)

> **Status as of 2026-05-18** — see `00-STATUS-2026-05-18.md`. Of the 11 gaps below, **9 are now SHIPPED** and **1 is in-flight in Phase D9 (cross-tenant denials audit, migration `0153_cross_tenant_denials.sql`)**. **The 2026-05-15 balance is fully INVERTED**: BOSSNYUMBA is now AHEAD of LITFIN on 5 of the 7 axes in this doc. The "P6 counts" table below understates the BOSSNYUMBA-ahead state.
>
> Headline shipments (all in `00-STATUS-2026-05-18.md` §3):
> - ✅ **DP aggregator** (Laplace + Gaussian + crypto-RNG + reserve-before-read invariant) — `packages/graph-privacy/src/aggregators/dp-aggregator.ts:272`. **BOSSNYUMBA AHEAD** — LITFIN lacks Gaussian mechanism.
> - ✅ **Cohort signal + tier-scaled k-anonymity (5 → 7 → 10 → 15 → 20 → 25)** — `kernel/cohort-signal.ts:75`. **BOSSNYUMBA AHEAD** — LITFIN uses single global k=5. See §3 item 5.
> - ✅ **Privacy-budget composer (persistent ε,δ ledger)** — `packages/database/src/services/privacy-budget-composer.service.ts:438` + migrations `0116` and `0130`. **BOSSNYUMBA AHEAD** — LITFIN's `computePrivacyBudget` is pure / non-persistent. See §3 item 4.
> - ✅ **DSAR compiler + RTBF executor** — `packages/ai-copilot/src/gdpr/dsar-compiler.ts:245` + `dsar-rtbf-executor.ts:875`.
> - ✅ **Data-classification registry** — `packages/database/src/security/data-classification.ts:650`.
> - ✅ **Sovereign action ledger** — `packages/database/src/services/sovereign-action-ledger.service.ts:399` + migration `0129_sovereign_action_ledger.sql`.
> - ✅ **Tenant-isolation enforcer with AsyncLocalStorage `runWithTenantContext` + `TenantScoped` generic** — `packages/ai-copilot/src/security/tenant-isolation.ts:41-272`. **BOSSNYUMBA AHEAD** — LITFIN has no type-level scope binding. See §3 item 6.
> - ✅ **Field-level encryption-at-rest (PII columns + KMS-rotation hook)** — migration `0143_field_encryption_audit.sql` + 11 source files + 48 tests (Phase D1 ✅).
> - ⚠️ **Cross-tenant denials audit** — migration `0153_cross_tenant_denials.sql` SHIPPED; route wiring is the remaining Phase D9 task.
> - ✅ **CoT PII scrub + queryCot API + RLS** — migration `0146_cot_reservoir_rls.sql` + sanitiser + `queryCot` (Phase D3 ✅).

Slice: differential-privacy aggregation, cohort signals, k-anonymity,
tenant isolation, retention/GDPR, data classification.

Mode: read-only, file:line citations, no edits.

## Counts

| Concern                                  | LITFIN | BOSS  |
|------------------------------------------|--------|-------|
| DP-noise primitives                      | 2      | 1     |
| Privacy-budget ledgers (composition)     | 1      | 2     |
| k-anonymity primitives                   | 2      | 1     |
| Awareness-scope modules                  | 1      | 1     |
| Cohort signal mix-in                     | 1      | 1     |
| Tenant-isolation enforcers (deep-scan)   | 1      | 2     |
| DSAR / right-to-be-forgotten orchestrator| 1      | 1     |
| Retention policy engine                  | 0¹     | 1     |
| Data classification registries           | 2      | 0     |

¹ LITFIN encodes retention windows inline in the DSAR orchestrator
(`RETENTION_EXEMPT_TABLES`); no separate policy engine.

## Header-line matrix

### 1. DP aggregator — noise mechanism + composition

| Property               | LITFIN                                  | BOSS                                                                                   |
|------------------------|-----------------------------------------|----------------------------------------------------------------------------------------|
| Laplace mechanism      | yes (`addLaplaceNoise`)                 | yes (`createDpAggregator` + `createCryptoNoiseSource`)                                 |
| Gaussian mechanism     | **no** (intentional — pure-DP)          | **yes** (`DPMechanism.kind === 'gaussian'` with σ via Dwork et al.)                    |
| Crypto-grade RNG       | yes for `anonymization/` only           | yes (`crypto.randomBytes` rejection-sampled to 53-bit mantissa)                        |
| Insecure RNG paths     | `core/graph/meta/differential-privacy.ts` uses `Math.random()` | **none** (`UNSAFE_` prefix marks the seeded test source) |
| Sensitivity clipping   | caller's responsibility                 | defensive clipping inside `combineContributions`                                       |
| Composition tracking   | basic-only, `computePrivacyBudget` is **pure** (no persistence) | **basic + advanced** selectable per ledger; serialised reserves; persistent schema    |
| Reserve-before-read    | not enforced (caller pattern)           | **enforced** as ordered invariant in `aggregate()`                                     |
| Refusal shape          | `exhausted` boolean field               | structured `AggregateRefusal` with `reason` discriminated union                        |

LITFIN citations:
- `src/core/anonymization/differential-privacy.ts:23-63` Laplace + `secureUniform`
- `src/core/graph/meta/differential-privacy.ts:58-83` `Math.random` Laplace
- `src/core/graph/meta/differential-privacy.ts:258-290` `computePrivacyBudget` (basic, no delta)

BOSS citations:
- `packages/graph-privacy/src/aggregators/dp-aggregator.ts:49-122` orchestration
- `packages/graph-privacy/src/aggregators/dp-aggregator.ts:73-90` reserve-first invariant
- `packages/graph-privacy/src/aggregators/dp-aggregator.ts:152-167` Laplace/Gaussian apply
- `packages/graph-privacy/src/budget-ledger.ts:66-94` doReserve atomic check
- `packages/graph-privacy/src/budget-ledger.ts:147-158` advanced composition (Dwork)
- `packages/graph-privacy/src/noise.ts:21-36` cryptographic Laplace+Gaussian
- `packages/graph-privacy/src/types.ts:54-73` DPMechanism schema
- `packages/database/src/schemas/platform-privacy-budget.schema.ts:26-56` persisted budget
- `packages/database/src/migrations/0116_platform_privacy_budget.sql` migration

### 2. Cohort signal — k threshold + fallback

| Property                                  | LITFIN                          | BOSS                                                  |
|-------------------------------------------|---------------------------------|-------------------------------------------------------|
| Default k                                 | 5 (industry-standard)           | 5 (tenant/lease) → 25 (industry)                      |
| Variable k by tier                        | **no** (single global default)  | **yes** (`cohortMinK(tier)` lattice 5→7→10→15→20→25)  |
| Sub-threshold fallback                    | drops rows silently             | returns empty promptFragment + empty findings array   |
| Caller surface                            | `kAnonymize<T>` filter          | `buildCohortMixin({...})` returning rendered fragment |
| Fingerprint / citation                    | absent                          | yes (`fingerprint: string` on every finding)          |
| Quasi-identifier specification            | required by caller              | opaque (cohort source produces findings as-of date)   |

LITFIN: `src/core/anonymization/k-anonymity.ts:31-69` `applyKAnonymity`;
`src/core/anonymization/differential-privacy.ts:128-144` `kAnonymize`.

BOSS: `packages/central-intelligence/src/kernel/cohort-signal.ts:38-66`
`buildCohortMixin`; line 50 enforces `f.k >= minK`; lines 51-53 produce
structured empty-mixin fallback rather than throw.

### 3. Tenant isolation — query layer + audit trail

| Property                         | LITFIN                                          | BOSS                                                                  |
|----------------------------------|-------------------------------------------------|-----------------------------------------------------------------------|
| WHERE-clause enforcer            | `buildTenantFilter` plain helper                | `appendTenantFilter` + AsyncLocalStorage `runWithTenantContext`       |
| Type-level guarantee             | none                                            | `TenantScoped`-bounded generic methods                                |
| Deep-scan of nested results      | yes (`scanForCrossTenantData`)                  | absent (super-admin bypass is the relief valve)                       |
| Cross-tenant denial audit row    | **no** (returns violations object)              | **no** persisted denial-audit; throws `TenantIsolationError`          |
| Super-admin bypass               | `internal-admin` scope (still k-anon outside cases)| `isSuperAdmin: boolean` flag — no per-row consent gate              |
| Aggregator-side tenant separation| anonymization pipeline strips ids               | DP aggregator NEVER reads per-tenant raw values; takes contributions  |

LITFIN: `src/core/litfin-ai/security/tenant-isolation.ts:41-123`
deep-scan; `:170-228` `scrubCrossTenantData` redaction; `src/core/brain/awareness-scopes.ts:215-249` internal-admin "k-anonymous cross-tenant trend reports" requirement.

BOSS: `packages/authz-policy/src/engine/tenant-isolation.ts:41-100`
enforcer; `:218-272` SQL helper; `services/domain-services/src/compliance/gdpr-service.ts:388-402` `TENANT_MISMATCH` distinct from `NOT_FOUND`.

### 4. Awareness scopes — tier set + invariants

| Property                              | LITFIN                                                   | BOSS                                                       |
|---------------------------------------|----------------------------------------------------------|------------------------------------------------------------|
| Tier set                              | borrower / officer / org-admin / internal-admin (4 roles)| tenant→lease→unit→block→property→portfolio→org→industry (8)|
| `commonAncestor`                      | absent                                                   | yes (`awareness-scopes.ts:48-50`)                          |
| `contains` containment lattice        | absent (role enumeration only)                           | yes (`awareness-scopes.ts:43-45`)                          |
| `locusPhrase` rendered to prompt      | renderScopeAsContext (multi-section, EN/SW)              | `locusPhrase(tier, scope)` single line per tier            |
| `cohortMinK` derived from tier        | absent                                                   | yes (`awareness-scopes.ts:99-110`)                         |
| Platform/tenant-vs-industry guard     | enforced through inviolable layer                        | `isTierCompatibleWithScope` returns `{ok,reason}`          |
| Forecast-horizon binding              | yes (`forecastHorizons: ReadonlyArray<string>`)          | implicit (tier informs tools, not horizons explicitly)     |

LITFIN: `src/core/brain/awareness-scopes.ts:42-272` (role-based).
BOSS:  `packages/central-intelligence/src/kernel/awareness-scopes.ts:23-110` (tier-based lattice).

**Models differ in axis**: LITFIN scopes are by ROLE (who is asking),
BOSS scopes are by TIER (what nesting level the reasoning lives at).
The two are complementary, not duplicative — see Gap G1.

### 5. Retention / GDPR — RTBF path, retention windows, export format

| Property                              | LITFIN                                                   | BOSS                                                       |
|---------------------------------------|----------------------------------------------------------|------------------------------------------------------------|
| Right-to-be-forgotten path            | `fulfilDsarRequest` → `runErase`                         | `GdprService.executeDeletion`                              |
| Erase vs pseudonymize policy          | DELETE non-exempt, pseudonymize retention-exempt         | **always pseudonymize** (preserves referential integrity)  |
| Retention-exempt catalogue            | 3 tables hard-coded (`kyc/loan_disbursements/audit`)     | unified via `DataRetentionManager.DefaultRetentionPolicies`|
| Statutory-basis annotation            | inline reason string (AMLA s.16, BFIA s.46, BOT 2019)    | `legalBasis` + `jurisdiction` on each policy               |
| Tenant-mismatch on RTBF execution     | not modelled (LITFIN is single-jurisdiction)             | explicit `TENANT_MISMATCH` error (`gdpr-service.ts:397-402`)|
| Two-step (request→execute) approval   | single-step worker                                       | yes (pending→processing→completed/rejected)                |
| Export format                         | JSON archive + signed URL (7-day TTL), private bucket    | (no DSAR export module found — gap G3)                     |
| Legal hold                            | absent                                                   | yes (`LegalHold` + `isUnderLegalHold` in retention manager)|
| Event emission (audit)                | platform_events row                                      | `GdprDeletionRequested` + `GdprDeletionExecuted` envelope  |

LITFIN: `src/core/privacy/dsar-orchestrator.ts:38-197`;
`src/core/dsar/dsar-compiler.ts:1-100` (export pipeline);
`src/app/api/privacy/dsar/route.ts` (HTTP entrypoint).

BOSS: `services/domain-services/src/compliance/gdpr-service.ts:298-492`;
`packages/database/src/schemas/gdpr.schema.ts:18-52`;
`packages/database/src/migrations/0034_gdpr_deletion_requests.sql`;
`packages/enterprise-hardening/src/compliance/data-retention.ts:136-266`;
`services/api-gateway/src/routes/gdpr.router.ts`.

### 6. Data classification — per-row sensitivity label

| Property                          | LITFIN                                                            | BOSS                                                                                  |
|-----------------------------------|-------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| Sensitivity-level enum            | RESTRICTED / CONFIDENTIAL / INTERNAL / PUBLIC                     | OPERATIONAL / FINANCIAL / LEGAL / AUDIT / PII / BACKUP / ANALYTICS (retention-shaped) |
| Per-field registry                | yes — `FIELD_CLASSIFICATIONS` (`lib/security/data-classification.ts:42+`) | **none** — classification is on the RETENTION policy, not the field            |
| Per-field encryption flag         | yes (`encrypt: boolean` + `AES-256-GCM`)                          | no (handled at infra layer, not in app code)                                          |
| Display masking pattern           | yes (per `maskType`)                                              | no                                                                                    |
| Access-rule per classification    | yes (RBAC-tied — `ALL_AUTHENTICATED`, `ASSIGNED_CASE_ROLES_ONLY`) | no — classification not joined to authz                                               |
| RBAC-tied PII view audit          | "EVERY_VIEW" logging on CONFIDENTIAL/RESTRICTED                   | no per-row PII-view audit                                                             |

LITFIN: `src/lib/security/data-classification.ts:42-100`;
`src/core/rbac/data-classification.ts:19-100`.

BOSS: `packages/enterprise-hardening/src/compliance/data-retention.ts:39-50`
(`RetentionClassification`) — overlap of concept, but it labels POLICY,
not field, and is wired to retention, not access.

## Highest-leverage gaps (numbered, with owner heuristic)

### G1. No per-FIELD data-classification registry (BOSS missing LITFIN-grade discipline)

LITFIN's `FIELD_CLASSIFICATIONS` table assigns RESTRICTED/CONFIDENTIAL/
INTERNAL/PUBLIC + `encrypt: boolean` + `maskType` to every personal-data
column. BOSS classifies POLICIES (financial, PII, audit) for retention
purposes, but no row of personal data carries a classification label
that the API/UI layers can consult before display. This blocks:
- Deterministic masking on rendering (e.g. national_id → `****0421`).
- Audit-log granularity ("CONFIDENTIAL viewed by user X").
- Encryption-at-rest decisions tied to field, not table.

Owner: new `packages/data-classification` (small, pure registry).
Pattern: port `FIELD_CLASSIFICATIONS` → BOSS column inventory; wire to
`gdpr-service.ts` pseudonymisation catalogue so the targets agree.

### G2. DP composition theory only fully realised in BOSS — LITFIN cannot guarantee budget across sessions

BOSS has TWO ledger generations (`packages/ai-copilot/src/dp-memory/
privacy-budget-ledger.ts` per-tenant, `packages/graph-privacy/src/
budget-ledger.ts` platform-wide + advanced composition + persistence),
both with serialised reserves and persistent storage. LITFIN's
`computePrivacyBudget` (`core/graph/meta/differential-privacy.ts:271-290`)
is a pure function with no persistence (called out in the docstring
line 41-43). This means a LITFIN attacker who restarts the process —
or simply opens a new session — resets ε to zero. **BOSS is ahead here.**

However, BOSS's TWO ledgers risk drift: the per-tenant one (consumed
by `cross-tenant-query.ts`) and the platform one (consumed by
`dp-aggregator.ts`) compose independently. An attacker who alternates
between the two surfaces can compound their effective spend without
either ledger noticing. No gap on the LITFIN side; gap on the BOSS
side is a **unified composition view**.

Owner: `packages/graph-privacy` — add a `CombinedBudgetView` that
sums both ledgers per actor before either reserve admits.

### G3. BOSS RTBF has no data-export / DSAR-portability path

LITFIN ships `dsar-compiler.ts` covering 13 tables (profile +
applications + chat + voice + consent + audit) writing to a private
storage bucket with signed-URL TTL. BOSS's `gdpr-service.ts` only
emits pseudonymisation SQL — no path for the data-subject's "right to
data portability" (GDPR Art. 20 / PDPA s.27). The cron route
`/api/privacy/dsar/route.ts` and 7-day-TTL JSON pattern is portable.

Owner: `services/domain-services/src/compliance/` — new
`data-export-service.ts` mirroring `dsar-compiler.ts`, registered
beside the existing `GdprService`.

### Additional gaps (lower leverage but worth tracking)

- G4. Cross-tenant denials are thrown, not audit-logged. Neither
  project persists a row when `TenantIsolationError`/cross-tenant scrub
  fires. Recommend an `cross_tenant_denials` audit table fed from the
  enforcer's catch-site.
- G5. BOSS awareness-scopes (tier-lattice) and LITFIN awareness-scopes
  (role-discriminated) are complementary, not duplicates. The plan
  doc names BOSS's tier model as the parity item, but the two should
  be COMPOSED: `Scope = (role, tier)` so role drives RBAC and tier
  drives cohort-k. Today BOSS's `ScopeContext.kind` is binary
  tenant/platform and the tier is orthogonal — the role axis is
  effectively missing.
- G6. LITFIN's `core/anonymization/differential-privacy.ts` uses
  `Math.random()` for noise sampling. Acknowledged in-line as
  "fine for analytics", but it weakens the DP guarantee for any
  meta-graph release. BOSS's `noise.ts` is correct here. (Not a BOSS
  gap, but pertinent to overall parity scoring.)

## Compatibility summary

- DP-noise math: parity at the Laplace level; **BOSS is ahead** on
  Gaussian, cryptographic RNG, sensitivity clipping, and persistent
  composition.
- k-anonymity: parity; **BOSS is ahead** on tier-scaling.
- Cohort signal: BOSS-only design pattern (`buildCohortMixin`).
- Tenant isolation: complementary (LITFIN deep-scan + scrub vs BOSS
  query-layer enforcer + AsyncLocalStorage); merging gives stronger
  defence-in-depth than either alone.
- RTBF / GDPR: parity at the request-record level; **LITFIN is
  ahead** on data export and statutory-retention catalogue richness.
- Data classification: **LITFIN is far ahead** at the FIELD level;
  BOSS only classifies retention POLICIES.

## End of P6
