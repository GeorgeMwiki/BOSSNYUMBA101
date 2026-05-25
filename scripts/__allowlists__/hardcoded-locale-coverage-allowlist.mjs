/**
 * Hardcoded-locale-coverage allow-list.
 *
 * Production files that legitimately reference a literal BCP-47 locale tag
 * (`'en-KE'`, `'sw-TZ'`, `'en-US'`, `'en-NG'`, etc.). Test files and
 * fixture files are auto-allowlisted at the scanner level. The
 * jurisdictional registry and i18n bundle directories are auto-allowed
 * via path filter.
 *
 * The platform's vision is "locale follows the user". Business logic must
 * route through `JurisdictionalRules.for(country).defaultLocale` or the
 * user's `language_preference` field; an `Intl.DateTimeFormat('en-KE')`
 * baked into a chart helper silently breaks for every other jurisdiction.
 *
 * Legitimate categories:
 *   1. i18n bundle files / message catalogs (auto-allowed by path).
 *   2. Jurisdictional registry (auto-allowed by path).
 *   3. Per-country plugin scaffolds in `packages/compliance-plugins/`
 *      (auto-allowed by path) — each plugin declares its own locale.
 *   4. UI render-time defaults — when no locale resolved upstream, the
 *      formatter falls back to `'en-US'` as the platform-default tip
 *      of the resolution chain.
 *   5. Tracked-gap entries pending migration to `JurisdictionalRules.for()`.
 *
 * Adding a new locale literal to production code → register here with
 * a justification ≥ 8 characters explaining why business logic needs it.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const HARDCODED_LOCALE_ALLOWLIST = new Map([
  // ─── Currency-to-locale mapping (registry-style) ───────────────────
  [
    'packages/genui/src/format.ts',
    'GenUI format module exposes CURRENCY_TO_LOCALE map (KES→en-KE, TZS→sw-TZ, USD→en-US) as the i18n registry.',
  ],

  // ─── Seed / bootstrap data ─────────────────────────────────────────
  [
    'packages/database/src/seeds/demo-org-seed.ts',
    'Demo-tenant seed file bootstraps initial locale per country for the demo-orgs.',
  ],

  // ─── GenUI render-time fallback to en-US ───────────────────────────
  [
    'packages/genui/src/components/Heatmap.tsx',
    'Heatmap render-time fallback to en-US when no locale resolved upstream; UI render-only.',
  ],
  [
    'packages/genui/src/components/Gauge.tsx',
    'Gauge render-time fallback to en-US when no locale resolved upstream; UI render-only.',
  ],
  [
    'packages/genui/src/components/SliderInput.tsx',
    'SliderInput render-time fallback to en-US when no locale resolved upstream; UI render-only.',
  ],
  [
    'packages/genui/src/components/MetricSparkline.tsx',
    'MetricSparkline render-time fallback to en-US when no locale resolved upstream; UI render-only.',
  ],

  // ─── Central-intelligence kernel UI/log formatting ─────────────────
  [
    'packages/central-intelligence/src/kernel/kernel.ts',
    'Kernel logging formatter uses en-US for stable cross-language audit-log number serialisation.',
  ],
  [
    'packages/central-intelligence/src/kernel/sub-mds/leasing-after-hours-contact/tools/schedule-viewing-draft.ts',
    'Viewing-draft month abbreviation uses en-US for stable cross-language drafting; tracked-gap pending locale wire.',
  ],

  // ─── AI-copilot multi-script harness baseline fixtures ─────────────
  [
    'packages/ai-copilot/src/multi-script-harness/fixtures.ts',
    'Multi-script-harness baseline test fixtures enumerate per-locale script-correctness scenarios.',
  ],

  // ─── AI-copilot kernel and skill helpers (legitimate-locale uses) ──
  [
    'packages/ai-copilot/src/head-briefing/markdown-renderer.ts',
    'Head-briefing markdown-renderer formats large numbers in en-US for stable cross-language audit output.',
  ],
  [
    'packages/ai-copilot/src/services/preference-profile-engine.ts',
    'Preference-profile-engine uses en-US toLocaleString as the timezone-clock baseline; not user-facing.',
  ],
  [
    'packages/ai-copilot/src/skills/domain/finance.ts',
    'Finance skill formats money in en-KE for Kenya-scoped finance utility; jurisdiction-scoped helper.',
  ],
  [
    'packages/ai-copilot/src/skills/kenya/swahili-draft.ts',
    'Swahili-draft skill formats Kenya amounts in en-KE; the skill is Kenya-only by definition (path).',
  ],
  [
    'packages/ai-copilot/src/voice-persona-dna/profiles.ts',
    'Voice-persona-DNA profiles enumerate primary/insert locales per persona; this IS the persona registry.',
  ],

  // ─── Chat-UI web-speech fallback ───────────────────────────────────
  [
    'packages/chat-ui/src/voice/web-speech-adapter.ts',
    'Web-speech adapter falls back to en-US when navigator.language is unavailable; SSR-safety only.',
  ],

  // ─── Compliance-plugin per-country plugin entries (registry) ──────
  [
    'packages/compliance-plugins/src/plugins/kenya.ts',
    'Kenya country plugin declares en-KE locale; this IS the per-country registry entry.',
  ],
  [
    'packages/compliance-plugins/src/plugins/nigeria.ts',
    'Nigeria country plugin declares en-NG locale; this IS the per-country registry entry.',
  ],
  [
    'packages/compliance-plugins/src/plugins/south-africa.ts',
    'South Africa country plugin declares en-ZA locale; this IS the per-country registry entry.',
  ],
  [
    'packages/compliance-plugins/src/plugins/tanzania.ts',
    'Tanzania country plugin declares sw-TZ locale; this IS the per-country registry entry.',
  ],
  [
    'packages/compliance-plugins/src/plugins/uganda.ts',
    'Uganda country plugin declares en-UG locale; this IS the per-country registry entry.',
  ],
  [
    'packages/compliance-plugins/src/plugins/united-states.ts',
    'United States country plugin declares en-US locale; this IS the per-country registry entry.',
  ],

  // ─── Payment-ledger invoice/statement date formatting ──────────────
  [
    'services/payments-ledger/src/services/invoice.generator.ts',
    'Invoice generator formats dates in en-GB DD-MMM-YYYY for stable invoice presentation; tracked-gap pending locale wire.',
  ],
  [
    'services/payments-ledger/src/services/statement.generator.ts',
    'Statement generator formats dates in en-GB DD-MMM-YYYY for stable statement presentation; tracked-gap pending locale wire.',
  ],

  // ─── Frontend-app UI date-format fallbacks (tracked-gap) ───────────
  [
    'apps/customer-app/src/app/onboarding/complete/page.tsx',
    'Customer onboarding complete page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/app/announcements/[id]/page.tsx',
    'Estate-manager announcements page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/app/calendar/events/page.tsx',
    'Estate-manager calendar events page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/app/calendar/page.tsx',
    'Estate-manager calendar page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/app/inspections/[id]/page.tsx',
    'Estate-manager inspections page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/app/schedule/page.tsx',
    'Estate-manager schedule page formats dates en-US; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/components/DateDisplay.tsx',
    'Estate-manager DateDisplay component formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/estate-manager-app/src/screens/work-orders/WorkOrderDetail.tsx',
    'Estate-manager work-order-detail formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/owner-portal/src/pages/DesktopReview.tsx',
    'Owner-portal desktop-review formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/owner-portal/src/pages/FinancialPage.tsx',
    'Owner-portal financial page formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/owner-portal/src/pages/MessagesPage.tsx',
    'Owner-portal messages page formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'apps/owner-portal/src/pages/financial/Disbursements.tsx',
    'Owner-portal disbursements page formats dates en-US default; tracked-gap pending tenant-locale resolution.',
  ],
  [
    'packages/ai-copilot/src/security/canary-tokens.ts',
    'canary-tokens uses toLocaleLowerCase("en-US") for DETERMINISTIC case-fold of canary token comparison; forcing en-US is the SAFE choice (omitting locale would use runtime locale and break token-leak detection in non-Latin-script locales).',
  ],
]);
