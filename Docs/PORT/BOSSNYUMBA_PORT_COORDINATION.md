# BossNyumba Port — Coordination

**Owner:** Coordinator agent (#228 follow-up)
**Last updated:** 2026-05-29
**Status:** ACTIVE — five sibling agents porting in parallel.

This document is the canonical coordination contract for the
Borjie -> BossNyumba port. Every agent working in this repo MUST read
this before opening files.

---

## 1. Repository ground truth

| Field           | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Source repo     | `Borjie` — mining estate OS                                 |
| Target repo     | `BOSSNYUMBA101` — property / real estate OS                 |
| Target remote   | `git@github.com:GeorgeMwiki/BOSSNYUMBA101.git`              |
| Target branch   | `port/borjie-2026-05-29-*` (one branch per port slice)      |
| Marketing branch| `port/borjie-2026-05-29-marketing`                          |

**Branch convention** (mandatory):
- Coordinator + marketing: `port/borjie-2026-05-29-marketing`
- DB:                      `port/borjie-2026-05-29-db`
- API:                     `port/borjie-2026-05-29-api`
- Brain:                   `port/borjie-2026-05-29-brain`
- Mobile:                  `port/borjie-2026-05-29-mobile`
- Ops / infra:             `port/borjie-2026-05-29-ops`

Do **not** open ports on `chore/wz2-ci-followup`, `main`, or any
random branch. CI gates assume the `port/borjie-2026-05-29-*` pattern
so reviewers can group the wave.

---

## 2. Canonical persona — Mr. Mwikila

**Mr. Mwikila is the canonical first-person AI persona at BossNyumba.**
It was adopted explicitly (see commit `e7bdc9cd feat(persona):
MR_MWIKILA_CANONICAL_DISPLAY constant + UI lock — ported from Borjie`),
and locked into the UI surface (3 spec docs in `Docs/PERSONA/`).

DO NOT:
- Rename Mr. Mwikila to anything else in any port.
- Introduce a competing persona (e.g. "Mr. Nyumba", "Nyumba AI", etc.).
- Strip Mr. Mwikila copy from ported marketing pages.

DO:
- Preserve `MR_MWIKILA_CANONICAL_DISPLAY` constant on import.
- Re-frame Mr. Mwikila's domain expertise for real-estate (property
  finance, leasing, compliance, maintenance, tenant relations) rather
  than mining (licences, royalty, off-take).
- Keep the bilingual sw/en posture — Mr. Mwikila speaks Swahili by
  default and switches to English on request.

The user requirement from the brief is explicit: *"same code just
tailored to real estate."* That includes the persona name.

---

## 3. Architecture parity table (per app)

| Surface              | Borjie (source)                           | BossNyumba (target)                             | Strategy                       |
| -------------------- | ----------------------------------------- | ----------------------------------------------- | ------------------------------ |
| Marketing            | `apps/marketing` (Next 15 App Router)     | `apps/marketing` (Next 15 App Router)           | **Wholesale port** (1 -> ~34 pages) |
| Admin / internal     | `apps/admin-web` (Next 15, 35+ routes)    | `apps/admin-platform-portal` (Next 15, 25 routes)| **Delta port** of missing surfaces (see `ADMIN_DELTA_MAP.md`) |
| Owner cockpit        | `apps/owner-web` (Next 15 App Router, 54 pages) | `apps/owner-portal` (Vite + React + React Router SPA) | **Conceptual port** — same screens / behavior, rewritten in Vite SPA style (see `OWNER_PORTAL_VITE_MAP.md`) |
| Workforce mobile     | `apps/workforce-mobile` (Expo)            | `apps/customer-app`, `apps/estate-manager-app`, `apps/bossnyumba_app` | Owned by mobile agent (#229)   |
| Buyer mobile         | `apps/buyer-mobile` (Expo)                | `apps/tenant-portal` (Vite SPA), `apps/customer-app` | Owned by mobile agent (#229)  |

**Architectural mismatch** (critical):
`Borjie owner-web` is Next.js App Router with `(routes)` groups, RSC
data fetching, and `server` actions. `BossNyumba owner-portal` is a
**Vite + React 18 + React Router** SPA — pure client-side, fetches
through `@bossnyumba/api-client`, no RSC, no server actions.

DO NOT wholesale-copy Borjie's `owner-web/src/app/(routes)/*/page.tsx`
into BossNyumba's `owner-portal/src/pages/`. Port surfaces
**conceptually**: same routes, same behaviour, same KPIs — implemented
the Vite way. See `OWNER_PORTAL_VITE_MAP.md` for the per-screen guide.

---

## 4. Domain map — mining -> real estate

Every ported file MUST translate domain vocabulary. Search-replace
checklist for any file you touch:

| Mining domain (Borjie)                   | Real-estate domain (BossNyumba)                  |
| ---------------------------------------- | ------------------------------------------------ |
| **Mineral / commodity**                  | **Property / unit**                              |
| Mineral / ore                            | Property / unit                                  |
| Deposit                                  | Asset                                            |
| Concession                               | Estate / lot                                     |
| Block                                    | Building / block                                 |
| **Licences**                             | **Leases / titles**                              |
| Primary Mining Licence (PML)             | Individual landlord title / single-unit lease    |
| Special Mining Licence (SML)             | Portfolio landlord lease / multi-unit deed       |
| Prospecting licence                      | Property survey / valuation report               |
| **Royalty / fiscal**                     | **Rent / fees**                                  |
| Royalty payment                          | Rent payment                                     |
| Royalty rate                             | Rent escalator                                   |
| Local government levy                    | Service charge / council levy                    |
| **Operations**                           | **Property ops**                                 |
| Mine / pit                               | Property / unit                                  |
| Adit / shaft                             | Floor / wing                                     |
| Tailings dam                             | Drainage / sewer system                          |
| Heap leach                               | Common-area maintenance                          |
| Plant                                    | Facility / amenity                               |
| **People**                               | **People**                                       |
| PML owner                                | Individual landlord                              |
| SML owner                                | Portfolio landlord                               |
| Mineral buyer                            | Tenant / prospect                                |
| Off-taker                                | Leasing agency / corporate-housing partner       |
| Cooperative                              | Housing cooperative                              |
| Regulator (Mining Commission / NEMC)     | Housing regulator (housing board / municipality) |
| CSR community                            | Community housing partner                        |
| **Workflows**                            | **Workflows**                                    |
| Request-for-Bid (RFB)                    | Request-for-Application (RFA)                    |
| Chain of custody                         | Chain of title                                   |
| Assay                                    | Inspection / survey                              |
| Gold-window treasury                     | Rental-window treasury                           |
| **Acronyms**                             | **Acronyms**                                     |
| LMBM                                     | LMBM (legal-master-brain-memory — retain name)   |
| Master Brain                             | Master Brain (retain)                            |
| Mwikila                                  | Mwikila (retain — canonical persona)             |

**Currencies**: TZS-primary stays. KES + USD continue to be supported.
No hard-coding currency at module level — use
`formatCurrency(amount, currencyCode)`.

**Languages**: Swahili-first, English on toggle. Tanzania + Kenya are
bilingual property markets.

---

## 5. Anti-conflict rules

Five sibling agents (#225 DB · #226 API · #227 brain · #229 mobile ·
#230 ops) are working in this repo at the same time. To prevent merge
collisions:

1. **One branch per slice.** Don't push to another agent's branch.
2. **Touch only your slice's files.**
   - DB:      `packages/database/`, `infra/migrations/`
   - API:     `services/api-gateway/`, `services/payments-ledger/`,
              `services/notifications/`
   - Brain:   `packages/central-intelligence/`, `packages/ai-copilot/`
   - Mobile:  `apps/customer-app/`, `apps/estate-manager-app/`,
              `apps/bossnyumba_app/`, `apps/tenant-portal/`
   - Ops:     `infrastructure/`, `monitoring/`, `docker*`, `k8s/`,
              `.github/workflows/`
   - **Marketing (this agent):** `apps/marketing/`, `Docs/PORT/`
3. **Cross-cutting docs go in `Docs/PORT/`** (this folder). Use
   numbered prefixes (`01-`, `02-`) if you need ordering.
4. **Commit per page / per file, push every commit.** Long
   uncommitted work is collision risk.
5. **If two agents need the same file**, the agent who needs it for
   their core slice (e.g. API agent for an api-gateway change) owns
   it. Coordination doc deltas go in this folder, not in the file.
6. **Persona constant** (`MR_MWIKILA_CANONICAL_DISPLAY`) is owned by
   the brain agent. Marketing imports it read-only.
7. **i18n message files** are owned by the marketing agent for
   marketing copy, by the brain agent for chat / persona copy.
   Don't double-add keys without coordinating in
   `Docs/PORT/I18N_KEYS_INDEX.md` (TBD).

---

## 6. Build & test gates per slice

Each agent before pushing:

| Slice     | Pre-push gate                                          |
| --------- | ------------------------------------------------------ |
| Marketing | `pnpm --filter @bossnyumba/marketing build`            |
| Admin     | `pnpm --filter @bossnyumba/admin-platform-portal build`|
| Owner     | `pnpm --filter @bossnyumba/owner-portal build`         |
| API       | `pnpm --filter @bossnyumba/api-gateway test`           |
| DB        | `pnpm --filter @bossnyumba/database migrate:check`     |
| Brain     | `pnpm --filter @bossnyumba/central-intelligence test`  |
| Mobile    | `pnpm --filter @bossnyumba/customer-app typecheck`     |
| Ops       | Docker compose dry-run                                 |

Hard rules: no `@ts-ignore`, no `@ts-nocheck`, no `console.log` in
services (Pino only), no `pkill -9 node`.

---

## 7. Communication channels

- **Coordination docs:** `Docs/PORT/*.md` (this folder)
- **Per-slice progress:** commit messages on the slice branch
- **Cross-slice blockers:** open a one-line markdown stub in
  `Docs/PORT/BLOCKERS.md` (create when first blocker hits)
- **Persona changes:** `Docs/PERSONA/` (brain agent owns)

---

## 8. Definition of done — port wave 2026-05-29

- [x] Coordination docs published (this file + ADMIN_DELTA_MAP +
      OWNER_PORTAL_VITE_MAP)
- [ ] Marketing: 34 pages live, build green, Mr. Mwikila preserved,
      bilingual sw/en, WCAG 2.2 AA
- [ ] Admin: 34 missing surfaces delta-ported
- [ ] Owner: Vite-style equivalents of 54 Borjie owner-web screens
- [ ] Mobile: workforce + tenant flows ported
- [ ] DB: tenant.scale_tier + related migrations forward-only
- [ ] Brain: persona + LMBM + Master Brain + Mwikila modes online
- [ ] API: missing endpoints filled in
- [ ] Ops: CI green on all `port/borjie-2026-05-29-*` branches
- [ ] All branches merged to `main` (one PR per slice)

---

*Coordinator agent · 2026-05-29*
