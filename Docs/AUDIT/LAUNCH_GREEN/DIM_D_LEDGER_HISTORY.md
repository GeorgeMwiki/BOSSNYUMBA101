# DIM-D Parity Audit — Settlement + Lease History + Scanners + Compliance + Scale + Jurisdictions

**Audit date:** 2026-05-30
**Branch:** `verify/launch-green-dim-d-ledger-history`
**Auditor:** automation
**Borjie reference repo:** `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/Borjie` (main)

## Methodology

For each item D1–D13 we (a) located the matching code in BossNyumba,
(b) compared it side-by-side with the Borjie equivalent, (c) ran the
unit-test suite where one exists, and (d) where a gap existed, ported
the Borjie carbon-copy and re-ran the suite. RLS / live-DB checks were
documented because the dev Postgres URL is unreachable from this audit
shell (no network probe).

## Results table

| Item | Status | Evidence |
|------|--------|----------|
| D1 Settlement orchestrator | PASS | `services/api-gateway/src/services/settlement/orchestrator.ts` (368 lines) implements `signMoveIn` → idempotency lookup → math → ledger port → payout port → cockpit event → `listForTenant`. Suite: 4/4 tests pass. |
| D2 Double-entry ledger | PASS | `services/payments-ledger/src/services/ledger.service.ts` (566 lines). Grep for `db.insert(ledger` outside `LedgerService.post()` returns ZERO hits in `services/`/`packages/`. All money references route via `LedgerService.post()` / `postJournalEntry` / `postReversal`. |
| D3 Lease history (real-estate CoC) | PASS | `services/api-gateway/src/services/lease-history/service.ts` (293 lines). 12 actions × 5 roles in `types.ts` (`LEASE_HISTORY_ACTIONS`/`LEASE_HISTORY_ACTOR_ROLES`). SHA-256 `prevAuditHash` chain. `brokenAt` first mismatch in `showTrace`. `lease_history.append_step` + `lease_history.show_trace` brain tools wired. Suite: 6/6 tests pass. |
| D4 Opportunity scanner ≥33 rules | PASS | `services/api-gateway/src/services/opportunity-scanner/scan-rules.ts` — 33 rule entries; `scanAndPublishOpportunities` exported from `index.ts`. Suite passes inside the 45/45 scanner sweep. |
| D5 Risk scanner ≥33 rules | PASS | `services/api-gateway/src/services/risk-scanner/scan-rules.ts` — 33 rule entries; `scanAndPublishRisks` exported. Categories cover cash-flow / regulatory / tax / estate / operational / legal / hr / compliance / counterparty / market / security / reputational. |
| D6 M-Pesa / Stripe providers + HMAC | **PARTIAL → PASS after fix** | Stripe verifyWebhookSignature was already HMAC-correct. **M-Pesa `verifyWebhookSignature` was returning `true` unconditionally** — silent auth-bypass footgun. Ported the Borjie fix (#182 / `9facfc79`): HMAC-SHA256(secret, raw) + `timingSafeEqual`, fail-closed on empty/wrong/missing inputs. Added 7-case test `mpesa-provider-verify.test.ts` — all pass. |
| D7 Compliance plugins (TZ/KE/UG/NG real-estate) | PASS | `packages/compliance-plugins/src/countries/{tz,ke,ug,ng}/index.ts` — each pack carries withholding %, lease law citations, deposit caps, tribunal rules. Real-estate (not mining) flavour confirmed. |
| D8 Scale tiers T1-T5 | PASS | `packages/database/src/seeds/scale-tier-fixtures.seed.ts` exposes `t1_single_unit / t2_small_portfolio / t3_mid_portfolio / t4_large_portfolio / t5_multi_country`. `packages/owner-os-tabs/src/scale-defaults.ts` provides `scaleTierLabel` + tier-specific defaults. Suite: 19/19 scale-defaults tests pass. Schema ref: `packages/database/src/schemas/index.ts:505` (`tenants.scale_tier`). |
| D9 8 jurisdictions seeded | PASS | `packages/database/src/seeds/regulator-jurisdictions.seed.ts` enumerates TZ / KE / UG / NG / ZA / GB / US / AU = 8 country codes. Each pack carries multiple regulator rows (tenancy + revenue + data-protection + housing-tribunal). |
| D10 Jurisdiction lock at signup (migration 0149 equivalent) | **MISSING → PORTED** | BossNyumba's slot 0149 was already taken (`0149_sensor_routing_control.sql`). Ported the Borjie 0149_lock_tenant_jurisdiction.sql as **migration 0292_lock_tenant_jurisdiction.sql** (+ down counterpart). Adds `tenants.jurisdiction_locked_at` (timestamptz), `jurisdiction_locked_by_user_id` (FK→users.id) and backfills `locked_at = created_at` for legacy rows with a country code. Idempotent, forward-only. |
| D11 SOTA jurisdiction discovery | PARTIAL | Brain-tool `bossnyumba.jurisdiction.discover` (`services/api-gateway/src/composition/brain-tools/jurisdiction-discovery-tools.ts`, 229 lines) is mounted and falls back gracefully when `httpClient` is unavailable. The underlying service tree (`services/api-gateway/src/services/jurisdiction-discovery/` with `service.ts`, `synthesizer.ts`, `drizzle-cache.ts`, `drizzle-corpus.ts`) is **not** present in BN — Borjie's port has it (1338 lines across 7 files). Discovery currently runs in degraded fallback (validityScore=0.2, origin='fallback'). Recommendation: schedule a follow-up port slice to wire the full synthesizer service + the `/internal/jurisdiction-discovery/discover` route the brain tool already targets. |
| D12 6 inviolable autonomy rails | PASS | `packages/central-intelligence/src/kernel/autonomy/inviolable-rails.ts` enumerates `kill_switch_open / family_member_target / non_domestic_currency / envelope_exceeded / capex_over_envelope / eviction_autonomy_refused`. The eviction rail (C09) replaces Borjie's mining-specific 6th rail and refuses on `category === 'evictions-initial-notice'` bilingually. Suite: 27/27 autonomy tests pass. |
| D13 RLS FORCE on tenant-scoped tables | PASS (static; live-Postgres check deferred) | Sampling: migration `0287_settlements_lease_history_push_tokens.sql` lines 84, 157, 256 emit `ALTER TABLE … FORCE ROW LEVEL SECURITY` for `settlements`, `lease_history`, `device_push_tokens`. Sweep migration `0173_force_rls_sweep.sql` plus 10+ other FORCE migrations cover the historical schema. The api-gateway middleware that binds `app.current_tenant_id` GUC is wired in `services/api-gateway/src/index.ts` (per CLAUDE.md hard rule). Live `pg_class.relrowsecurity` probe deferred — dev Postgres URL unreachable from audit shell; no surface kill was performed. |

## Carbon-copy ports applied this audit

| Slice | File(s) | Borjie SHA / origin |
|-------|---------|---------------------|
| M-Pesa HMAC verifyWebhookSignature fail-closed fix | `services/payments-ledger/src/providers/mpesa-provider.ts` (HMAC-SHA256 + `timingSafeEqual` + crypto imports) + new test `services/payments-ledger/src/__tests__/mpesa-provider-verify.test.ts` (7 cases) | Borjie fix #182 / commit `9facfc79` |
| Jurisdiction lock columns + FK + backfill | `packages/database/src/migrations/0292_lock_tenant_jurisdiction.sql` + `packages/database/src/migrations/down/0292_down_lock_tenant_jurisdiction.sql` | Borjie migration `0149_lock_tenant_jurisdiction.sql` |

## Live evidence excerpts

```
$ pnpm --filter @bossnyumba/api-gateway exec vitest run \
    src/services/settlement src/services/lease-history \
    src/services/opportunity-scanner src/services/risk-scanner
 Test Files  5 passed (5)
      Tests  55 passed (55)

$ pnpm --filter @bossnyumba/payments-ledger-service exec vitest run \
    src/__tests__/mpesa-provider-verify.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ pnpm --filter @bossnyumba/central-intelligence exec vitest run \
    src/kernel/autonomy/__tests__/autonomy.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

## Blockers / follow-ups

1. **D11** (jurisdiction-discovery service tree) — Brain tool present + degrades gracefully, but the production synthesizer / drizzle cache / corpus search live in Borjie only. Needs a dedicated port slice (estimate: 1338 lines across 7 files + a new internal route handler + the schema for `discovered_jurisdictions` cache table, which Borjie ships in migration 0148). Marked PARTIAL — does not block launch because the fallback path returns a structured response with a `promotionHint`, but caps validityScore at 0.2 for unseeded countries.
2. **D13** RLS FORCE — static grep evidence is unambiguous (`ALTER TABLE … FORCE ROW LEVEL SECURITY` for sampled tables) but a live `pg_class.relrowsecurity` check could not be performed against a dev Postgres in this audit. Documented per audit charter; surgical-no-killall discipline preserved.

## Money-path invariant

Re-asserted in this audit: grep `db\.insert(ledger` across `services/` + `packages/` returns ZERO hits. All money writes route via `LedgerService.post()` / `postJournalEntry` / `postReversal`. CLAUDE.md hard rule "Money path goes through `LedgerService.post()`" holds.

## Eviction autonomy refused (C09)

`packages/central-intelligence/src/kernel/autonomy/inviolable-rails.ts` lines 120-130 unconditionally returns `block` with reason `eviction_autonomy_refused` when `category === 'evictions-initial-notice'`. Bilingual en/sw message returned to the brain. 27/27 autonomy tests pin this behaviour.
