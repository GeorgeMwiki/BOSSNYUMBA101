# Owner Portal Vite Map — Borjie owner-web -> BossNyumba owner-portal

**Owner:** Coordinator compiles the map; **owner-portal port owned by
brain agent #227** (most owner surfaces are SSE-fed dashboards over
the brain) coordinating with API agent #226 for endpoint shape.

**Last updated:** 2026-05-29

---

## 1. Architecture mismatch

| Aspect             | Borjie owner-web                                    | BossNyumba owner-portal                                |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| Framework          | Next 15 App Router                                  | Vite 5 + React 18 + React Router 6                     |
| Rendering          | RSC + streaming + Server Actions                    | Pure SPA — fetch from `@bossnyumba/api-client`         |
| Routing            | File-system: `(routes)/<segment>/page.tsx`          | `App.tsx` `<Routes>` declaring `<Route path .../>`     |
| Data fetching      | `async function Page()` calls server functions      | `useQuery` (@tanstack/react-query) + `apiClient.*`     |
| Auth gate          | Middleware + RSC `cookies()`                        | `<PrivateRoute>` HoC + `useAuth()` context             |
| Layout             | `(routes)/layout.tsx`                               | `<Layout>` component wrapping `<Suspense>`             |
| i18n               | `getLocale()` + `getMessages()` server-side         | `<LocaleProvider>` context + client-side messages      |
| Forms              | Server Actions                                      | React Hook Form + zod + `apiClient` POST               |
| Streaming/SSE      | `app/api/<x>/route.ts` SSE                          | EventSource client; brain emits over the API gateway   |
| Optimistic updates | `useOptimistic` + `revalidatePath`                  | `@tanstack/react-query` `mutate` + `setQueryData`      |

**Conclusion:** Do not file-copy any `.tsx`. Each Borjie page body
is mostly portable; the wrappers (`Nav`, `Footer`, layouts, server
boundary) are not. The pattern below works for ~80% of Borjie pages.

---

## 2. Port pattern (per page)

For each Borjie `apps/owner-web/src/app/(routes)/<segment>/page.tsx`:

1. Read the file. Identify:
   - Pure presentational JSX (portable verbatim)
   - Server-side data calls (must move to React Query)
   - i18n calls (`getMessages(locale).foo.bar`) — must move to client
     locale provider
   - `<Link>` from `next/link` — replace with `react-router-dom`'s
     `<Link to=...>`
   - `<Image>` from `next/image` — replace with plain `<img>` or
     BossNyumba `<Img>` design-system component (if it exists)
2. Create the BossNyumba twin:
   - File path: `apps/owner-portal/src/pages/<Segment>Page.tsx`
     (or keep the `app/<segment>/page.tsx` convention if the directory
     already exists — both are used here).
   - Default-export a single component.
3. Add a `<Route path="/segment" element={<SegmentPage />} />` in
   `App.tsx` (lazy-load if recharts / heavy).
4. If the page touches the AI surface, route through Mr. Mwikila
   (`MwikilaWidgetMount` already exists; reuse).

---

## 3. Per-screen mapping (54 Borjie owner-web pages)

### 3A — PURE (lift-and-shift with import path edits)

| Borjie route                          | BossNyumba target                                       | Notes                                                |
| ------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `(routes)/ask`                        | `app/ask/page.tsx` (new)                                | Ask Mr. Mwikila — reuses existing chat shell         |
| `(routes)/cockpit`                    | `pages/CockpitPage.tsx`                                 | Already partially present via `executive-brief`      |
| `(routes)/community`                  | `pages/CommunityPage.tsx`                               | Community housing partner relations                  |
| `(routes)/notifications`              | `pages/NotificationsPage.tsx`                           | Bell tray                                             |
| `(routes)/reports`                    | `pages/ReportsPage.tsx` (already)                       | KEEP — already ported                                |
| `(routes)/sales`                      | `pages/SalesPage.tsx`                                   | Leasing pipeline (renamed sales -> leasing)          |
| `(routes)/settings`                   | `pages/SettingsPage.tsx` (already)                      | KEEP                                                  |
| `(routes)/settings/jurisdiction`      | `pages/settings/JurisdictionPage.tsx`                   | TZ / KE multi-juris                                  |
| `(routes)/settings/saved-searches`    | `pages/settings/SavedSearchesPage.tsx`                  |                                                       |
| `(routes)/settings/connected-agents`  | `pages/settings/ConnectedAgentsPage.tsx`                | OAuth agents                                          |
| `(routes)/personal-kb`                | `pages/PersonalKbPage.tsx`                              | Personal knowledge base                              |
| `(routes)/personal-kb/[personId]`     | `pages/PersonalKbDetailPage.tsx`                        | Param route                                           |

### 3B — RSC -> React-Query rewrites (most pages)

| Borjie route                                  | BossNyumba target                            | Data source                       |
| --------------------------------------------- | -------------------------------------------- | --------------------------------- |
| `(routes)/chain-of-custody`                   | `pages/ChainOfTitlePage.tsx` (renamed)       | `/api/chain-of-title`             |
| `(routes)/compliance`                         | `app/compliance/page.tsx` (already)          | KEEP                              |
| `(routes)/compliance/licences`                | `app/compliance/licenses/page.tsx` (already) | KEEP                              |
| `(routes)/counterparties`                     | `pages/CounterpartiesPage.tsx`               | tenants + leasing-agencies        |
| `(routes)/document-intelligence`              | `pages/DocumentIntelligencePage.tsx`         | OCR + extraction                  |
| `(routes)/documents`                          | `pages/DocumentsPage.tsx` (already)          | KEEP                              |
| `(routes)/estate`                             | `pages/EstatePage.tsx`                       | Estate-level rollup               |
| `(routes)/estate/assets`                      | `pages/estate/AssetsPage.tsx`                | Asset register                    |
| `(routes)/estate/capital-movements`           | `pages/estate/CapitalMovementsPage.tsx`      | Treasury moves                    |
| `(routes)/estate/entities`                    | `pages/estate/EntitiesPage.tsx`              | Holding entities                  |
| `(routes)/estate/succession`                  | `pages/estate/SuccessionPage.tsx`            | Trust + family-office             |
| `(routes)/finance`                            | `pages/FinancialPage.tsx` (already)          | KEEP — verify match               |
| `(routes)/fleet`                              | `pages/FleetPage.tsx`                        | Repurpose for vehicles + handymen |
| `(routes)/fleet/maintenance`                  | `pages/fleet/MaintenancePage.tsx`            | KEEP existing MaintenancePage if equivalent |
| `(routes)/geology`                            | (drop — mining-specific, no real-estate equiv) | DROP                            |
| `(routes)/group`                              | `pages/GroupPage.tsx`                        | Group / multi-entity owners       |
| `(routes)/inventory`                          | `pages/InventoryPage.tsx`                    | Unit inventory                    |
| `(routes)/licence`                            | `pages/LeasePage.tsx` (singular - licence -> lease) | One-off lease ops          |
| `(routes)/licences`                           | `app/compliance/licenses/page.tsx` (already) | DUP — keep one                    |
| `(routes)/lmbm`                               | `pages/LmbmPage.tsx`                         | LMBM — preserve term-of-art       |
| `(routes)/marketplace`                        | `pages/parcels-marketplace/ParcelsMarketplacePage.tsx` (already) | KEEP        |
| `(routes)/marketplace/inbound`                | `pages/parcels-marketplace/InboundPage.tsx`  | Inbound listings                  |
| `(routes)/master-brain`                       | `pages/MasterBrainPage.tsx`                  | Master Brain — preserve term      |
| `(routes)/mwikila`                            | `pages/MwikilaPage.tsx`                      | Mr. Mwikila operator surface — **PRESERVE NAME** |
| `(routes)/mwikila/delegation`                 | `pages/mwikila/DelegationPage.tsx`           | Mr. Mwikila delegation matrix     |
| `(routes)/mwikila/inbox`                      | `pages/mwikila/InboxPage.tsx`                | Mr. Mwikila approval inbox        |
| `(routes)/onboarding`                         | `app/onboarding/page.tsx` (already)          | KEEP                              |
| `(routes)/payroll`                            | `pages/PayrollPage.tsx`                      | Staff payroll                     |
| `(routes)/people`                             | `pages/PeoplePage.tsx`                       | All people directory              |
| `(routes)/portfolio-map`                      | `pages/PortfolioMapPage.tsx`                 | Geo map view                      |
| `(routes)/regulatory-calendar`                | `pages/RegulatoryCalendarPage.tsx`           | Inspection deadlines              |
| `(routes)/safety`                             | `pages/SafetyPage.tsx`                       | Building safety / fire / hazards  |
| `(routes)/site-cockpit`                       | `pages/PropertyCockpitPage.tsx` (renamed)    | Single-property cockpit           |
| `(routes)/sites`                              | `pages/PropertiesPage.tsx` (already)         | KEEP — same screen                |
| `(routes)/treasury`                           | `pages/TreasuryPage.tsx`                     | Rental-window treasury            |
| `(routes)/workforce`                          | `pages/workforce/WorkforcePage.tsx` (already)| KEEP                              |
| `(routes)/workforce/openings`                 | `pages/workforce/OpeningsPage.tsx`           | Job openings                      |
| `(routes)/workforce-tabs`                     | `pages/workforce/TabsPolicyPage.tsx`         | Workforce tabs policy             |
| `(routes)/workforce-tabs/kiosk`               | `pages/workforce/KioskPage.tsx`              | Tablet kiosk shell                |

### 3C — DROP (mining-specific, no real-estate equivalent)

| Borjie route   | Why drop                                                 |
| -------------- | -------------------------------------------------------- |
| `geology`      | Geological survey — no property analogue                 |

(Anything else mining-specific gets renamed per `BOSSNYUMBA_PORT_COORDINATION.md` §4 domain map.)

---

## 4. Component inventory (53 dirs · ~222 files)

Most Borjie owner-web components are framework-agnostic and PURE:
- KPI cards (presentational, prop-driven)
- Charts (recharts wrappers)
- Tables (TanStack Table)
- Forms (React Hook Form + zod)
- SSE hooks (`useEventSource` etc — already framework-agnostic)
- Optimistic-update hooks (built on @tanstack/react-query — portable)

**LIFT-AND-SHIFT (estimated 80%):** any file whose top of file has
no `next/`, no `"use server"`, no `cookies()`, no `headers()`, no
`async function Page()` boundary call.

**REWRITE (estimated 20%):** components that import:
- `next/link` -> `react-router-dom`'s `<Link to=...>`
- `next/image` -> design-system `<Img>` or plain `<img>`
- `next/navigation`'s `useRouter` -> `useNavigate` from RR6
- `next/font` -> handled at `index.html` level
- `revalidatePath`, `cookies()`, `headers()` -> drop, replaced by
  React Query invalidation + `apiClient`

---

## 5. Suggested wave order

1. **Pure components first** (3A above) — quick wins.
2. **Mr. Mwikila + LMBM + Master Brain pages** (preserves the
   product identity that the user explicitly called out).
3. **Estate / treasury / capital-movements** (high-value owner KPIs).
4. **Compliance + workforce remainder.**
5. **Marketplace + inbox / delegation chrome.**
6. **Drop / merge cleanup pass.**

---

## 6. Per-page gate

Before merging each ported page:
- `pnpm --filter @bossnyumba/owner-portal typecheck` exit 0
- `pnpm --filter @bossnyumba/owner-portal build` exit 0
- `pnpm --filter @bossnyumba/owner-portal test` exit 0 (if a test
  already covers the surface — add new tests for new pages)
- Mr. Mwikila widget mount still works (`/mwikila` route renders)
- Bilingual sw/en — copy keys present in both locales

---

*Coordinator agent · 2026-05-29*
