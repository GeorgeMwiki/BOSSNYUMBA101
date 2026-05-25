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

  // ─── tenant-portal — MVP marketplace pages pending i18n extraction ─
  [
    'apps/tenant-portal/src/app/marketplace/applications/page.tsx',
    'Tenant-portal applications page heading pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/join/page.tsx',
    'Tenant-portal join page heading pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/listings/page.tsx',
    'Tenant-portal listings page filter placeholder pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/orgs/[orgId]/page.tsx',
    'Tenant-portal orgs-detail empty-state copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/orgs/page.tsx',
    'Tenant-portal orgs filter placeholder pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/page.tsx',
    'Tenant-portal marketplace landing copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/tenancies/page.tsx',
    'Tenant-portal tenancies page copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/app/marketplace/tenders/page.tsx',
    'Tenant-portal tenders page copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/AskPanel.tsx',
    'Tenant-portal AskPanel copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/ApplicationDraftAssistant.tsx',
    'Tenant-portal ApplicationDraftAssistant copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/MarketplaceHeader.tsx',
    'Tenant-portal MarketplaceHeader nav labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/OrgJoinForm.tsx',
    'Tenant-portal OrgJoinForm labels/placeholders pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/PriceNegotiator.tsx',
    'Tenant-portal PriceNegotiator copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/tenant-portal/src/components/marketplace/TenancyWidget.tsx',
    'Tenant-portal TenancyWidget copy pending i18n extraction in P89 (tracked-gap).',
  ],

  // ─── chat-ui — generative-UI shared components ────────────────────
  [
    'packages/chat-ui/src/components/DegradedBanner.tsx',
    'DegradedBanner aria-label — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'packages/chat-ui/src/components/ProactiveHint.tsx',
    'ProactiveHint aria-label="Dismiss hint" — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'packages/chat-ui/src/generative-ui/block-generator.ts',
    'Block-generator emits demo/scaffold labels for generative-UI blocks; pending tenant-data wire-up in P89.',
  ],

  // ─── genui + dynamic-sections — render-time shared components ──────
  [
    'packages/genui/src/components/ChatEmbed.tsx',
    'ChatEmbed empty-state copy — generative-UI component pending i18n extraction in P89.',
  ],
  [
    'packages/genui/src/components/PdfViewer.tsx',
    'PdfViewer zoom aria-labels — accessibility-only strings pending i18n extraction in P89.',
  ],
  [
    'packages/dynamic-sections/src/seed/section-components.tsx',
    'Dynamic-sections seed file — KRA Filings is a Kenya-specific tax surface; section title pending i18n in P89.',
  ],
  [
    'packages/dynamic-sections/src/seed/seed-sections.ts',
    'Dynamic-sections seed data — section labels (KRA Filings etc.) pending i18n extraction in P89.',
  ],
]);
