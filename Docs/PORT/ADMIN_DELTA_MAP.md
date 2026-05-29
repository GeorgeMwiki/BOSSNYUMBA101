# Admin Delta Map — Borjie admin-web -> BossNyumba admin-platform-portal

**Owner:** Coordinator (this agent) compiles the map; **admin port
is owned by API agent #226** (because every missing surface needs a
backing endpoint, and the API agent already owns service-side work).

**Last updated:** 2026-05-29
**Status:** Map only — no code touched yet (avoiding collision while
other agents are active).

---

## 1. Surface inventory

| Source: `Borjie/apps/admin-web/src/app`           | Target: `BossNyumba/apps/admin-platform-portal/src/app` | Action            |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| `ai-costs`                                        | `ai-costs`                                              | KEEP (already present) |
| `ask`, `ask/[threadId]`                           | `ask`, `ask/[threadId]`                                 | KEEP                   |
| `audit`                                           | (missing)                                               | **PORT**          |
| `control-tower`                                   | `control-tower`                                         | KEEP                   |
| `dashboard`                                       | (missing — BossNyumba uses `/` as root dashboard)       | **PORT or merge into root** |
| `data-privacy`                                    | `data-privacy`                                          | KEEP                   |
| `decision-trace`, `decision-trace/[id]`           | `decision-trace`, `decision-trace/[id]`                 | KEEP                   |
| `feature-flags`                                   | `feature-flags`                                         | KEEP                   |
| `forecasts`                                       | `forecasts`                                             | KEEP                   |
| `industry`                                        | `industry`                                              | KEEP                   |
| `insights`                                        | `insights`                                              | KEEP                   |
| `integrations`                                    | `integrations`                                          | KEEP                   |
| `internal` (parent)                               | (missing)                                               | **PORT** parent shell  |
| `internal/ab-tests`                               | (missing)                                               | **PORT**          |
| `internal/analytics`                              | (missing)                                               | **PORT**          |
| `internal/audit-log`                              | (missing)                                               | **PORT**          |
| `internal/audit-pack`                             | (missing)                                               | **PORT**          |
| `internal/citations`                              | (missing)                                               | **PORT**          |
| `internal/compliance-queue`                       | (missing)                                               | **PORT**          |
| `internal/corpus`                                 | (missing)                                               | **PORT**          |
| `internal/decision-log`                           | (missing)                                               | **PORT**          |
| `internal/flags`                                  | (missing — overlaps `feature-flags`)                    | **MERGE into `feature-flags`** |
| `internal/juniors`                                | (missing)                                               | **PORT**          |
| `internal/killswitch`                             | (missing)                                               | **PORT** (HIGH risk — wire through `kill-switch` policy gate) |
| `internal/marketplace`                            | (missing)                                               | **PORT**          |
| `internal/models`                                 | (missing)                                               | **PORT**          |
| `internal/prompts`                                | (missing)                                               | **PORT**          |
| `internal/regulator-pipeline`                     | (missing)                                               | **PORT** (rename to `housing-regulator-pipeline`) |
| `internal/rollback`                               | (missing)                                               | **PORT**          |
| `internal/slo`                                    | (missing)                                               | **PORT**          |
| `internal/support`                                | (missing)                                               | **PORT**          |
| `internal/tenants`                                | (missing — overlaps top-level `tenants` in Borjie)      | **MERGE** with platform-tenants surface |
| `jarvis`                                          | `jarvis`                                                | KEEP                   |
| `legacy-migration`                                | `legacy-migration`                                      | KEEP                   |
| `login`, `sign-in`                                | `login`                                                 | KEEP — pick ONE (login)|
| `mission-eval`, `mission-eval/[scenarioId]`       | `mission-eval`, `mission-eval/[scenarioId]`             | KEEP                   |
| `persona-drift`                                   | `persona-drift`                                         | KEEP                   |
| `platform/billing`                                | `platform/billing`                                      | KEEP                   |
| `platform/feature-flags`                          | `platform/feature-flags`                                | KEEP                   |
| `platform/overview`                               | `platform/overview`                                     | KEEP                   |
| `platform/subscriptions`                          | `platform/subscriptions`                                | KEEP                   |
| `radar`                                           | `radar`                                                 | KEEP                   |
| `regulator/requests`                              | (missing)                                               | **PORT** (rename to `housing-regulator/requests`) |
| `session-replay`, `session-replay/[sessionId]`    | same                                                    | KEEP                   |
| `system-health`                                   | `system-health`                                         | KEEP                   |
| `tenants` (top-level)                             | (missing)                                               | **PORT**          |
| `warehouse`                                       | `warehouse`                                             | KEEP                   |
| `webhook-dlq`                                     | `webhook-dlq`                                           | KEEP                   |
| `workforce-tab-policies`                          | (missing)                                               | **PORT**          |
| n/a                                               | `advisor/{acquisition,estate-auto,estate-department,expansion,geo,green-angle,lifecycle,sustainability}` | KEEP (BossNyumba-original advisor suite) |

---

## 2. Counted delta

**Borjie admin-web routes:** 51 (counting `page.tsx` leaves)
**BossNyumba admin-platform-portal routes:** 36

**Net to port:** ~22 surfaces (most are `internal/*` + `audit` +
`tenants` + `workforce-tab-policies` + `regulator/requests`).

This is lower than the brief's "34" estimate because BossNyumba's
**advisor/** suite (8 routes) is an original and exists alongside the
ported `industry / insights / forecasts / radar / jarvis / mission-eval`
shells. So the actual delta is ~22.

---

## 3. Risk classification

| Risk     | Routes                                                          | Why                                                |
| -------- | --------------------------------------------------------------- | -------------------------------------------------- |
| HIGH     | `internal/killswitch`, `internal/rollback`                      | Touches HIGH-risk policy prefix; wire fail-closed  |
| HIGH     | `internal/regulator-pipeline` (rename `housing-regulator-pipeline`) | Regulator-facing — RLS critical                 |
| MEDIUM   | `internal/audit-log`, `internal/audit-pack`, `internal/decision-log`, `audit` | Hash-chained append-only; preserve invariants |
| MEDIUM   | `internal/corpus`, `internal/citations`                         | Evidence-required AI guard — preserve              |
| MEDIUM   | `internal/juniors`, `internal/models`, `internal/prompts`       | Brain-config — coordinate with brain agent (#227)  |
| LOW      | `internal/{ab-tests, analytics, marketplace, slo, support}`, `tenants`, `workforce-tab-policies` | UI shells over standard endpoints |

---

## 4. Naming translations (mining -> real estate)

| Source                                | Target                                       |
| ------------------------------------- | -------------------------------------------- |
| `regulator/requests`                  | `housing-regulator/requests`                 |
| `internal/regulator-pipeline`         | `internal/housing-regulator-pipeline`        |
| `internal/marketplace` (mineral OTC)  | `internal/marketplace` (rental-listings OTC) |
| `internal/juniors` (junior agents)    | `internal/juniors` — KEEP NAME (term-of-art) |
| `internal/corpus` (mining corpus)     | `internal/corpus` (real-estate corpus)       |

Mr. Mwikila references throughout stay verbatim.

---

## 5. Handoff to API agent #226

API agent owns the actual port. Coordinator did the discovery /
classification only. Suggested execution order (lowest-risk first):

1. `tenants` (top-level)
2. `audit`
3. `workforce-tab-policies`
4. `internal/{ab-tests, analytics, slo, support, marketplace}`
5. `internal/{audit-log, audit-pack, decision-log, citations, corpus}`
6. `internal/{juniors, models, prompts}` — coordinate with #227 brain
7. `housing-regulator/requests` + `internal/housing-regulator-pipeline`
8. `internal/killswitch` + `internal/rollback` (HIGH — last, with
   policy-gate review)

Per-route gate before merge:
- Build green: `pnpm --filter @bossnyumba/admin-platform-portal build`
- RLS audit covered (run `borjie-audit-coverage.yml` equivalent)
- Mr. Mwikila persona preserved in any AI surface
- Bilingual sw/en where copy is exposed

---

*Coordinator agent · 2026-05-29*
