/**
 * Hardcoded-strings (UI-copy) allow-list (Piece P).
 *
 * The vision is Swahili-ready, locale-resolved UI: every USER-FACING
 * English string in apps, chat-ui, genui, and dynamic-sections MUST
 * live in a message catalogue (`messages/en.json` / `messages/sw.json`)
 * and be loaded through `useTranslations()`.
 *
 * The scanner is intentionally conservative — it only flags JSX text
 * nodes and attribute strings (aria-label, title, placeholder, alt,
 * label) that contain capitalised English words.
 *
 * Auto-skipped (NOT a violation):
 *   - Test, fixture, mocks, stories directories.
 *   - Storybook files.
 *   - i18n catalogue dirs: `**\/messages/`, `**\/locales/`,
 *     `**\/translations/`, `**\/i18n/`.
 *   - Files importing `useTranslations` AND containing `t(`-style calls.
 *
 * Explicit allow-list:
 *   Files that legitimately render dev-only English (admin platform
 *   portals not yet localised, error pages emitted server-side at boot,
 *   etc.). Every entry carries an ≥ 8-character justification.
 */

/**
 * NOTE: Whole-subtree allowlists for `apps/admin-platform-portal/`,
 * `apps/admin-portal/`, and `apps/marketing/` are encoded as path
 * prefixes inside the scanner itself (`ALLOW_PREFIX` constant) — they
 * are operator/marketing UIs intentionally English-only by design.
 *
 * The Map below holds per-file overrides for the LOCALE-TARGETED
 * surfaces (`customer-app`, `owner-portal`, `estate-manager-app`,
 * `bossnyumba_app`) only.
 */
export const HARDCODED_STRINGS_ALLOWLIST = new Map([
  // ─── Server-side boot / error pages (no i18n context yet) ──────────
  // Reserved for future entries. The current sweep handles all known
  // locale-targeted-app violations directly.

  // ─── customer-app — P89 extracted (28 entries removed 2026-05-25) ──

  // ─── estate-manager-app — P89 extracted (7 entries removed 2026-05-25) ──

  // ─── owner-portal — P89 extracted (8 entries removed 2026-05-25) ────

  // ─── tenant-portal — pending app-level i18n bootstrap ──────────────
  //
  // The tenant-portal package does NOT yet have next-intl wired up — no
  // `messages/` dir, no `i18n.ts`, no `NextIntlClientProvider` in the
  // layout, no next-intl in `package.json`. Per P89 scope-deferral, we
  // keep these 14 surfaces allowlisted with a more honest reason:
  // they need an app-level i18n bootstrap PR before per-string extraction
  // can land. That bootstrap is its own follow-up tracked outside this
  // wave (the work spans: pnpm-lock + dep add, plugin/next config update,
  // RootLayout provider, server-side message loader, empty messages JSON
  // pair, locale-cookie middleware). Doing it inline here would explode
  // the P89 scope and conflict with the parallel P88 lockfile owner.
  [
    'apps/tenant-portal/src/app/marketplace/applications/page.tsx',
    'Tenant-portal applications page heading pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/join/page.tsx',
    'Tenant-portal join page heading pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/listings/page.tsx',
    'Tenant-portal listings page filter placeholder pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/orgs/[orgId]/page.tsx',
    'Tenant-portal orgs-detail empty-state copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/orgs/page.tsx',
    'Tenant-portal orgs filter placeholder pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/page.tsx',
    'Tenant-portal marketplace landing copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/tenancies/page.tsx',
    'Tenant-portal tenancies page copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/tenders/page.tsx',
    'Tenant-portal tenders page copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/AskPanel.tsx',
    'Tenant-portal AskPanel copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/ApplicationDraftAssistant.tsx',
    'Tenant-portal ApplicationDraftAssistant copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/MarketplaceHeader.tsx',
    'Tenant-portal MarketplaceHeader nav labels pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/OrgJoinForm.tsx',
    'Tenant-portal OrgJoinForm labels/placeholders pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/PriceNegotiator.tsx',
    'Tenant-portal PriceNegotiator copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/TenancyWidget.tsx',
    'Tenant-portal TenancyWidget copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/error.tsx',
    'Tenant-portal root error boundary copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],
  [
    'apps/tenant-portal/src/app/not-found.tsx',
    'Tenant-portal 404 page copy pending app-level i18n bootstrap (no next-intl wired yet).',
  ],

  // ─── shared packages — P89 converted to prop-driven labels (7 entries removed 2026-05-25) ──
  // chat-ui (DegradedBanner, ProactiveHint, block-generator), genui
  // (ChatEmbed, PdfViewer), and dynamic-sections (section-components,
  // seed-sections) all now accept localised labels from consumer apps
  // via props / schema fields. The English defaults stay in-tree so the
  // packages remain library-only (no useTranslations dependency).
]);
