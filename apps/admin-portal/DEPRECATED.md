# DEPRECATED — Migration complete

**Status:** All pages have been migrated. This app is now a "moved" landing only.

- HQ-flavoured pages → `apps/admin-platform-portal/` (BossNyumba HQ)
- Agency-admin pages → `apps/owner-portal/` (the consolidated owner + agency-admin portal)

The shell that remains here is a single landing page (`src/App.tsx`) that links visitors to the two destinations. Bundle is ~144 KB JS — minimal scaffolding. The package.json keeps only `react` + `react-dom`; everything else (design-system, chat-ui, api-sdk, react-router-dom, recharts, lucide, next-intl, zod, react-query, react-hook-form, observability, spotlight, domain-models) was removed.

Do not add new pages here. New work targets `admin-platform-portal` (HQ work) or `owner-portal` (customer-side admin work).

## The 4-portal model (target state)

BossNyumba has exactly four user-facing portals:

| Portal | Path | Audience | Tier |
|---|---|---|---|
| `apps/admin-platform-portal/` | port 3020 | **BossNyumba HQ** (us, internal) | sovereign / industry |
| `apps/owner-portal/` | port 3001 | **Owners** (and the agency admins they appoint) — owners *are* the admins | portfolio / org |
| `apps/estate-manager-app/` | port 3003 | Estate managers (mobile) | property |
| `apps/customer-app/` | port 3002 | Tenant residents (mobile) | lease |

The owner's portal IS the admin portal. There is NO separate "agency
admin" application — owners administer their own work inside their
portal, and they can add admin sub-users there.

The internal BossNyumba HQ (`admin-platform-portal`) is for us. It is
NOT a customer-facing surface and MUST NEVER be conflated with
`owner-portal` or with this deprecated `admin-portal`.

## Why this app exists today

`apps/admin-portal/` predates the clean 4-portal split. It accumulated
two distinct concerns:

1. **HQ-flavoured pages** (`src/app/platform/*`,
   `PlatformOverviewPage`, `PlatformSubscriptionsPage`,
   `PlatformBillingPage`, `SystemHealthPage`, `AuditLogPage`,
   `Configuration`, `AiCosts`, `FeatureFlags`, etc.) — these belong in
   `apps/admin-platform-portal/`.
2. **Agency-admin pages** (`TenantsPage`, `UsersPage`, `RolesPage`,
   `BillingPage` for one org, `Classroom`, `DelegationMatrix`,
   `Exceptions`, `HeadOfEstates`, etc.) — these belong in
   `apps/owner-portal/`.

The `/jarvis` page that was added here is now redundant — agency
admins should reach their personal Nyumba Mind via `owner-portal/jarvis`.

## Migration plan

1. Audit each page in `src/pages/` and `src/app/` and tag it as
   `→ admin-platform-portal` or `→ owner-portal`.
2. Move HQ-flavoured pages to `apps/admin-platform-portal/`.
3. Move agency-admin pages to `apps/owner-portal/`.
4. Update any docs / runbooks that reference port 3000.
5. Remove this app once the move is complete and a deprecation
   window has passed for any external links.

Until step 5 lands, the app continues to build but should not receive
new features. Anything new goes into `admin-platform-portal` (HQ work)
or `owner-portal` (customer-side admin work).

## Routing change

The api-gateway route `/api/v1/admin/jarvis` (mounted by
`services/api-gateway/src/routes/jarvis-router-factory.ts`) is left in
place for backwards-compatibility but should be considered deprecated
alongside this app. New consumers should hit
`/api/v1/owner/jarvis` (for agency admins / owners) or
`/api/v1/platform/jarvis` (for BossNyumba HQ).

## Reference

See `.planning/jarvis-architecture.md` for the full Nyumba Mind
architecture (personas, surfaces, scope hierarchy, grounding pyramid,
privacy isolation).
