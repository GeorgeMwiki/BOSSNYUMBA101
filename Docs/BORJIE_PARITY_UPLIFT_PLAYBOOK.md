# BossNyumba → Borjie-Parity Uplift + Zero-Leak Playbook

**Audience:** a fresh Claude Code session opened in `BOSSNYUMBA101` (this repo).
**Goal:** bring BossNyumba to Borjie's *current* engineering level **and** guarantee
**zero cross-domain naming leaks** — to the smallest detail, all fronts at once,
multiple agents, no follow-ups left behind.
**Authored:** 2026-06-04, from a 3-agent evidence sweep of both codebases.
**Repos:**
- BossNyumba (THIS repo): `Cursor Projects/BOSSNYUMBA101` — branch `main` — domain **real estate** — brand **BossNyumba** — remote `GeorgeMwiki/BOSSNYUMBA101`.
- Borjie (sibling reference): `…/Borjie` — domain **mining** — brand **Borjie** — remote `GeorgeMwiki/BORJIE-101`.

---

## 0. READ FIRST — corrected reality (do NOT rebuild what exists)

BossNyumba is **not behind** Borjie on infrastructure. The two are
near-isomorphic sibling monoliths from a shared LITFIN ancestor that actively
cross-port (`port/borjie-2026-05-29-*` branches; `@bossnyumba/owner-os-tabs`
is literally "Ported from Borjie's @borjie/owner-os-tabs").

On `main`, BossNyumba is **at parity or AHEAD** of Borjie on:
brain kernel (`packages/central-intelligence/src/kernel/` — kernel/compose/
policy-gate/inviolable/killswitch/four-eye/LATS/debate/sub-mds/sensors),
`ai-copilot` (personas/governance/GDPR/audit), `agent-platform` (a2a/webhooks/
idempotency), observability + red-team, **45 CI workflows (a superset of
Borjie's)**, RLS-FORCE (`FORCE ROW LEVEL SECURITY` ×113), **292 migrations**
(Borjie: 187), `dynamic-sections` + `owner-os-tabs`, `chat-ui`
(ProactiveHint/MasteryGate/SuperpowerChips), double-entry ledger
(`services/payments-ledger/src/services/ledger.service.ts`), and **10 apps**
(6 web + Expo staff/tenant + Flutter customer/estate-manager).

**Therefore the uplift is exactly THREE fronts — run them all in parallel:**

- **FRONT A — ZERO-LEAK REMEDIATION (the headline mandate; biggest + highest-risk).**
  BossNyumba apps still contain **wholesale un-ported Borjie MINING code** that
  calls `/api/v1/mining/*` routes which **do not exist** in BossNyumba's gateway
  → those surfaces are *functionally broken*, not just cosmetically wrong.
- **FRONT B — THE 9 MISSING LITFIN-PORT PACKAGES** (the only genuine
  Borjie-ahead capability delta), ported with property-domain naming.
- **FRONT C — RECENT BORJIE HARDENING + HEALTH PARITY** (migration-runner
  hardening, clean-DB provisioning discipline, `@ts-nocheck` purge, Stub→real
  LLM adapters, route-convention migration).

> "Mr. Mwikila" is the **founder's surname** and the canonical brain persona in
> BOTH products by design. **It is NOT a leak — never rename it.** "tenant" is
> legitimate multi-tenancy vocabulary in both. "mining" is legitimate in
> BossNyumba ONLY for *process mining* (`mcp-server-process-intel`) and
> *mineral wool* (insulation). Everything else mining = a leak.

---

## 1. THE NAMING LAW — zero-leak guarantee (memorize before touching code)

### 1.1 Bidirectional rename map (mining ↔ property)

| Borjie (mining) | BossNyumba (property) — USE THIS | Level |
|---|---|---|
| `Borjie` / `@borjie/*` / `BORJIE_*` | `BossNyumba` / `@bossnyumba/*` / `BOSSNYUMBA_*` | brand / pkg ns / env |
| `licences`, `licence_events`, `licence_dormancy_scores` | `leases`, `lease_events` | DB / entity |
| `sites`, `site_sections`, `site_layouts` | `properties`, `units`, `blocks`, `buildings`, `occupancies` | DB / entity |
| `buyers`, `buyer_kyc_records`, `buyer_risk_reports` | `tenants` (renter), `tenant_risk_reports`, `tenant_litigation_history` | DB / entity |
| `ore_grade_snapshots`, `ore_parcels`, `ore_stockpiles` | `property_grade_snapshots` | DB |
| `mineral_prices`, `mineral_chain_of_custody` | `property_valuations` | DB |
| `production_records`, `production_tonnage_events` | `arrears_cases`, rent ledger | DB |
| `royalty_return_drafts`, royalty | security deposit / rent | domain |
| `request_for_bid_responses`, `bid_negotiations`, `bid_messages` | `request_for_applications`, `unit_waitlists` | DB |
| `mining_tasks`, `mining_sic_pings`, `mining_toolbox_talks` | `maintenance_tasks`, condition reports | DB |
| `/api/v1/mining/*`, `/geology/*`, `/cooperatives/*`, `/production/*` | `/api/v1/arrears`, `/applications`, `/leases`, `/maintenance`, `/units`, `/customers` | route |
| persona voice: royalty / ore / LBMA / EIA / Mining Commission / weighbridge | lease reading / rent / maintenance triage / tenant conversations | persona DOMAIN |
| `Mr. Mwikila` | `Mr. Mwikila` | **SHARED — never rename** |

### 1.2 The 9 porting rules (apply in BOTH directions; here: mining→property)
1. **Swap package namespace wholesale** `@borjie/* → @bossnyumba/*`; verify the
   target package **exists** (there is currently a dangling
   `@bossnyumba/mining-shift-planner` import in `apps/staff-mobile` — that
   package does not exist; it must be replaced, not just renamed).
2. **Swap env-var prefix** `BORJIE_* → BOSSNYUMBA_*` (both repos currently clean — keep it).
3. **Translate DOMAIN NOUNS via §1.1**, not just brand strings. Leaks hide in:
   action IDs (`lease.*`, `md:create-lease`), DB field names (`landlordTin`),
   route prefixes (`/api/v1/mining/*`), persona capability IDs
   (`mwikila.track.royalty`), and **marketing/few-shot copy** (highest-volume,
   lowest-visibility surface).
4. **Re-localize the persona's DOMAIN, keep the persona NAME.** Mr. Mwikila stays;
   his vocabulary flips (royalty/ore/licences → rent/units/leases). Greetings and
   capability registries are the tell.
5. **Route surfaces must match the gateway.** BossNyumba calls property routes
   (`/api/v1/arrears`, `/api/v1/applications`, `/api/v1/leases`), NEVER
   `/api/v1/mining/*`. Grep mobile apps + `_persona-shim` specifically.
6. **`tenant` is allowed in BOTH** (multi-tenant SaaS org). Do NOT blindly rename
   `tenant`. Distinguish `tenants` (org table — KEEP) from property-renter
   semantics (which BossNyumba legitimately also calls tenant — that is the
   correct domain word here).
7. **`mining` in BossNyumba is allowed ONLY** for *process mining*
   (`services/mcp-server-process-intel`) and *mineral wool* (building material in
   `packages/sustainability-advisor`). Any mineral/royalty/ore/weighbridge/
   mining-licence usage is a leak.
8. **Provenance comments** ("Ported from Borjie", "Mirrors @borjie/…") are
   tolerated as lineage but are brand-hygiene smell; for zero foreign-brand-string
   goal, neutralize to "ported from the parent fork." KEEP the existing anti-leak
   guardrails (`apps/marketing/src/app/api/chat/route.ts` "NEVER mention Borjie";
   namespace-assertion tests) and extend them.
9. **CI workflow prefix:** BossNyumba uses **no prefix** (`ci.yml`, `codeql.yml`).
   Keep it bare — do NOT introduce `borjie-`/`bossnyumba-` prefixes.

### 1.3 Zero-leak verification commands (the acceptance oracle)
Run from repo root; exclude `node_modules dist .next build .turbo *.lock`.
```bash
# MINING LEAKS (target: 0 in app/service/package SOURCE; allow only process-mining + mineral-wool + neutral provenance)
grep -rniE '\b(royalty|mineral(?!\s+wool)|ore\b|weighbridge|mining[- ]?(licen|commission|shift))' \
  apps/ packages/ services/ --include=*.ts --include=*.tsx --include=*.dart \
  | grep -viE 'process[- ]mining|mineral wool|parent fork' | wc -l        # must be 0
grep -rni '/api/v1/mining' apps/ services/ packages/ | wc -l               # must be 0
grep -rni 'AskBorjie\|@bossnyumba/mining' apps/ packages/ services/ | wc -l # must be 0
grep -rni 'mwikila\.\(track\.royalty\|.*licence\)' apps/ packages/ services/ | wc -l  # must be 0
# BRAND leaks (Borjie surfacing to users; provenance comments are separate — see rule 8)
grep -rniE '"borjie"|>\s*borjie\b|brand.*borjie' apps/ packages/ services/ --include=*.ts --include=*.tsx | wc -l
```
A wave is "leak-clean" only when the first four counts are **0**.

---

## 2. WAVES — attack all at once, parallel agents, DISJOINT ownership

Run all three fronts concurrently. Within each front, assign **one agent per
disjoint file/package set** (no two agents touch the same file) — mirror the
Borjie multi-agent wave model. Reserve a migration-number block per agent to
avoid collisions (see §2.4). Each agent: code-review its own diff, keep build
green, leave zero TODO/stub markers in its lane.

### FRONT A — ZERO-LEAK REMEDIATION (mining → property)  ⚠️ highest priority
Un-port the mining code that wears BossNyumba names. Each app is a disjoint lane.

| Lane | Owner agent | Scope (file counts from sweep) | Key targets |
|---|---|---|---|
| A1 | agent-staff-mobile | `apps/staff-mobile/` — **61 files** | `src/api/config.ts` (`CHAT_PREFIX=/api/v1/mining/chat`, mining route prefix); dangling `@bossnyumba/mining-shift-planner` import in `src/onboarding/certifications.ts:4` (replace with property staff-scheduling pkg); `src/onboarding/intelligence.ts:206` (OSHA-TZ mining); `src/sync/endpoints.ts:9` (weighbridge); `app/worker/W-M-05.tsx:16` (`/api/v1/mining/cockpit/sic-pings`); `READINESS.md:49` (Geita/Mwanza mining sites); rename `AskBorjie.tsx` → `AskMwikila.tsx`/property name. Re-point ALL routes to property endpoints. |
| A2 | agent-tenant-mobile | `apps/tenant-mobile/` — **30 files** | `src/api/config.ts:28` (`MINING_PREFIX`); `src/buyer-signup/api.ts:52` (`/api/v1/mining/buyers/kyc`); `src/api/marketplace.ts:62` (mirrors Borjie `routes/mining/bids.hono.ts`); `_persona-shim/capabilities/capability-registry.ts:314` (`mwikila.track.royalty`, Mining Commission); `_persona-shim/capabilities/jurisdiction-overrides.ts:60` (Prospecting/Retention/Mining Licence); `dashboard/BuyerDashboard.tsx:68` ("Mining market — live auctions"). Reframe buyer→tenant/applicant, marketplace→unit-listings. |
| A3 | agent-web-residual | `apps/owner-portal/` (20 files) + `apps/marketing/` (12 files) | residual mining copy/strings; keep the existing "NEVER mention Borjie" guard in `apps/marketing/src/app/api/chat/route.ts`. |
| A4 | agent-route-contract | `services/api-gateway/src/routes/` | confirm property routes exist for everything A1/A2 now call (`/api/v1/arrears`, `/applications`, `/leases`, `/maintenance`, `/units`, `/customers`); add any missing thin handlers so the apps are not broken. NO `mining/` dir. |

**Acceptance:** §1.3 mining-leak + `/api/v1/mining` + AskBorjie + capability-ID
counts all **0**; every app builds; every route an app calls resolves 200/aware.

### FRONT B — PORT THE 9 LITFIN-PORT PACKAGES (mining→property naming)
Source of truth = Borjie `packages/<name>/`. Create `@bossnyumba/<name>` with
property-domain naming, ports-and-adapters (inject stores — never write DB
directly), wired into `services/api-gateway/src/composition/`. One agent per pkg.

| Lane | Borjie package | What it does → BossNyumba framing |
|---|---|---|
| B1 | `belief-engine` | Epistemic belief store + convince-loop (revise only when confidence-Δ>0.25), DPO learner, LinUCB bandit, Mem0 ADD/UPDATE/DELETE/NOOP, nightly Pearson belief×outcome. Property beliefs (tenant reliability, unit demand). |
| B2 | `learning-signal-emitter` | (action,outcome)→reward→per-tier-isolation→fan to belief/mastery/pattern/reflexion/preference sinks. |
| B3 | `ledger-attestor` | Merkle root over audit/ledger hash-chain → SignerPort → S3 object-lock/transparency-log. (BossNyumba has `audit-hash-chain` but NO Merkle/object-lock — extend.) |
| B4 | `channel-gateway` | Canonicalize WhatsApp/SMS/USSD/voice/email/web → one `ChannelEvent`; verify provider sigs; sender→tenant-tier; cross-channel state sync. |
| B5 | `ussd-engine` | Pure USSD menu-tree + session SM; bilingual en/sw; 182-char budget; 180s TTL. Feature-phone ingress for tenants/landlords. **No equivalent today.** |
| B6 | `document-reconciliation` | Cross-doc fact reconciliation (Levenshtein/E164/Jaccard/date/amount), EML/MSG/M-PESA-SMS/QR extractors, per-issuer fingerprints, Platt calibration, self-consistency vote. (Extends `document-analysis`.) |
| B7 | `privacy-router` | Sensitivity-tier→provider routing (RESTRICTED→local/deny, CONFIDENTIAL→cloud+PII-strip). (Extends `data-classification` with provider routing.) |
| B8 | `regulator-sim` | Audit-replay asserting CoT-present/bilingual/model-card-fresh/four-eye-distinct/fairness-delta + PDPA subject-access/erasure drills. |
| B9 | `blind-review` | Anonymize→shuffle→N-reviewer Turing panel, indistinguishability bar ≤0.55. |

**Acceptance:** each package built (dist emitted), unit-tested ≥80%, wired in a
`*-wiring.ts` composition file, default-OFF feature flag, ZERO mining vocabulary,
`@bossnyumba/*` namespace.

### FRONT C — RECENT BORJIE HARDENING + HEALTH PARITY
| Lane | Owner agent | Task |
|---|---|---|
| C1 | agent-migration-runner | Port Borjie's hardened `packages/database/src/run-migrations.ts`: baseline-then-delta phasing, `stripWrappingTransaction`, filename allowlist + traversal guard, and the **hang defenses** (`max:1`, `prepare:false`, `statement_timeout` 10m, `idle_in_transaction_session_timeout` 5m, per-migration 300s client deadline race, bounded `sql.end({timeout:5})`). |
| C2 | agent-clean-db | Validate clean-DB provisioning on throwaway PG17 (Supabase image): run the full chain on a fresh DB; fix any broken-on-fresh migration **in place** to its intended final shape (Borjie pattern: `now()`-in-index → drop predicate; uuid-FK-to-text-PK → TEXT; DROP INDEX on constraint-backed → DROP CONSTRAINT; ALTER on not-yet-created table/type → existence-guard deferring to the foundation migration). Resolve the KI-001/KI-004 ledger-drift with a boot-time `scripts/verify-migrations.ts`. |
| C3 | agent-ts-nocheck | Purge `@ts-nocheck` — **142 files in `services/api-gateway`** (+21 domain-services, +21 database). Fix the underlying types; do not mass-delete the directive blindly. |
| C4 | agent-stub-llm | Replace `Stub*` LLM adapters with real ones per `Docs/KNOWN_ISSUES.md` (KI-009 DocChat `StubAnthropicDocChatLlm`, KI-008 negotiation, KI-007 inspection narrative, KI-013 migration-wizard, KI-014 OCR Textract/Vision). |
| C5 | agent-route-convention | Migrate **112 legacy `*.router.ts` → `*.hono.ts`** in `services/api-gateway/src/routes/` (Borjie convention); add null-guards on services (KI-003, 40+ routers). |
| C6 | agent-security-deps | Run `pnpm audit --prod --audit-level high`; add `pnpm.overrides` for any HIGH transitive vuln (Borjie pattern — e.g. the `@remix-run/* >=2.17.5` fix). Match Borjie's CodeQL/Semgrep/gitleaks green. |

**Acceptance:** `@ts-nocheck` count → 0 in api-gateway; no `Stub*` on live AI paths;
0 `*.router.ts` remaining; `pnpm audit --prod --audit-level high` clean; CI green.

### 2.4 Collision avoidance (multi-agent)
- **Disjoint file ownership** — assign each file to exactly one lane; never two
  agents in the same file. Apps (A1–A3) and packages (B1–B9) are naturally disjoint.
- **Reserve migration-number blocks** per agent that adds migrations (e.g. C2 owns
  `0304–0309`, B-lanes that need tables own `0310+` in 5-wide blocks). Append-only;
  never edit a shipped numbered migration (immutable rule) — fix-in-place applies
  ONLY to migrations that have never applied clean on fresh (Borjie precedent).
- **One integration branch** (e.g. `uplift/borjie-parity-2026-06`) with per-lane
  feature branches merged via PR after CI + leak-scan green.

---

## 3. HARD RULES (shared invariants — NEVER violate; identical to Borjie)
1. Money path only through `LedgerService.post()` / `postJournalEntry` (atomic + idempotent + hash-chained, integer minor units).
2. RLS FORCE on every tenant-scoped table; `app.current_tenant_id` GUC bound per-transaction (`with-tenant-context.ts`); no app-side double-filter.
3. Supabase JWT canonical auth; **no Clerk**.
4. **No user-visible "modes"** — invisible persona lens routing; chat sends only `{message, language, sessionId}`.
5. Kill-switch fail-closed; never catch+ignore.
6. Webhooks at-least-once; consumers idempotent via `Idempotency-Key`.
7. AI audit chain hash-chained, append-only.
8. Predictions APPEND to rule-based decisions, never replace.
9. **Migrations immutable** — append a new numbered file; never edit a shipped one (fix-in-place is the narrow exception only for migrations that never applied clean on fresh).
10. OTel bootstrap runs FIRST in `services/api-gateway/src/index.ts`.
11. Multi-currency, TZS at launch; `formatCurrency(amount, currencyCode)`; never hard-code TZS/USD/KES/UGX/NGN.
12. English default · absolute sw/en toggle (zero EN/SW mixing); full EN+SW for personas/prompts/UI.
13. Evidence-required AI output (≥1 `evidence_id`).
14. No `console.log` in services (Pino only). No reflective CORS. No raw HTML interpolation (DOMPurify). No `process.env` outside bootstrap.

### BossNyumba-specific (from `PROJECT_BOUNDARY.md`)
- **Domain is REAL ESTATE only — NEVER mining.** No mineral licences, royalty, PCCB, weighbridge, ore.
- Exclude sibling projects: **Pongezi**, Borjie, LitFin — never conflate.
- Brand string **BossNyumba**; assistant **Mr. Mwikila**; repo **BOSSNYUMBA101**; CI workflows **un-prefixed**.

---

## 4. DEFINITION OF DONE (the parity + zero-leak proof)
- [ ] §1.3 leak-scan: mining-leak / `/api/v1/mining` / `AskBorjie` / mining-capability-ID counts all **0**.
- [ ] No dangling foreign imports (`@borjie/*`, non-existent `@bossnyumba/mining-*`).
- [ ] All 9 LITFIN-port packages exist as `@bossnyumba/*`, built, wired, flag-gated, property-named, ≥80% tested.
- [ ] Migration runner hardened (prepare:false + timeouts + client deadline); clean-DB chain applies 100% on fresh PG17; ledger-drift guard landed.
- [ ] `@ts-nocheck` = 0 in api-gateway; 0 `*.router.ts`; no `Stub*` on live AI paths.
- [ ] `pnpm audit --prod --audit-level high` clean; CI (codeql/semgrep/gitleaks/migration-apply-fresh/red-team/probes) green.
- [ ] Both build + typecheck + test green; bilingual zero-mix verified; PRODUCTION_READINESS checklist ticked.
- [ ] Every PR carries a leak-scan-clean attestation in its body.

---

## 5. PARALLEL-AGENT ORCHESTRATION (how to "attack all at once")
1. Confirm single clean repo (already done: 1 worktree, 154 branches preserved).
2. Cut integration branch `uplift/borjie-parity-2026-06` off `main`.
3. Spawn lanes A1–A4, B1–B9, C1–C6 **concurrently** as worktree-isolated agents
   (disjoint files; reserved migration blocks). Each lane: implement → self
   code-review → leak-scan its own diff (§1.3) → build green → PR.
4. A serial **integration-checker** verifies cross-lane wiring + runs the full
   §4 gate before each merge to the integration branch.
5. When all lanes green + §4 fully checked → PR integration branch → `main`.
6. Borjie reciprocal cleanup (OPTIONAL, separate session): Borjie has the mirror
   leaks (`packages/marketing-brain` property copy, `tz-tra-formatter` landlord
   fields, `offtake-coordinator` `lease.*` action IDs) — note for a Borjie session;
   out of scope for THIS BossNyumba uplift.

---

## 6. EVIDENCE INDEX (load-bearing paths)
- Borjie target: `services/api-gateway/src/index.ts` (OTel-first), `…/composition/` (DI seam), `packages/central-intelligence/src/kernel/{kernel,policy-gate,inviolable,self-awareness}.ts`, `packages/ai-copilot/src/juniors/lens-router.ts`, `services/payments-ledger/src/services/ledger.service.ts`, `packages/database/src/run-migrations.ts` + `rls/with-tenant-context.ts`, `packages/{belief-engine,ussd-engine,channel-gateway,regulator-sim,blind-review,privacy-router,ledger-attestor,document-reconciliation,learning-signal-emitter}/`.
- BossNyumba state: `Docs/MEMORY.md` (Wave 28+), `Docs/KNOWN_ISSUES.md` (15 KIs), `Docs/CODEMAPS/INDEX.md`, `Docs/PROJECT_BOUNDARY.md`, `packages/database/src/migrations/` (0001–0303), `.github/workflows/` (45).
- Leak hotspots (fix first): `apps/staff-mobile/` (61), `apps/tenant-mobile/` (30), `apps/owner-portal/` (20), `apps/marketing/` (12).
