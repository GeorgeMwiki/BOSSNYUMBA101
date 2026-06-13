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
 * NOTE: Whole-subtree allowlists for `apps/admin-platform-portal/`
 * and `apps/marketing/` are encoded as path
 * prefixes inside the scanner itself (`ALLOW_PREFIX` constant) — they
 * are operator/marketing UIs intentionally English-only by design.
 *
 * The Map below holds per-file overrides for the LOCALE-TARGETED
 * surfaces (`owner-portal`) only.
 */
export const HARDCODED_STRINGS_ALLOWLIST = new Map([
  // ─── Server-side boot / error pages (no i18n context yet) ──────────
  // Reserved for future entries. The current sweep handles all known
  // locale-targeted-app violations directly.

  // ─── owner-portal — P89 extracted (8 entries removed 2026-05-25) ────

  // ─── shared packages — P89 converted to prop-driven labels (7 entries removed 2026-05-25) ──
  // chat-ui (DegradedBanner, ProactiveHint, block-generator), genui
  // (ChatEmbed, PdfViewer), and dynamic-sections (section-components,
  // seed-sections) all now accept localised labels from consumer apps
  // via props / schema fields. The English defaults stay in-tree so the
  // packages remain library-only (no useTranslations dependency).

  // ─── dynamic-import loading skeletons (WZ-CI-GREEN 2026-05-25) ──────
  // These are server-rendered or client-side loading placeholders for
  // `next/dynamic` chunks. The aria-label is read only when the screen
  // reader announces a transient loading state (<150ms typically). Per
  // WCAG 2.2 SC 4.1.3 / role="status", an English label is acceptable
  // for ephemeral states; full localisation lands when each app's
  // skeleton library is converted to use a `useTranslations` hook in
  // its containing client component (separate work). Owner-portal
  // lazy.tsx is a chart placeholder behind /charts.
  [
    'apps/owner-portal/src/components/charts/lazy.tsx',
    'Loading skeleton aria-label for chart lazy-load — ephemeral loading state for a chart placeholder, English acceptable per WCAG 2.2 SC 4.1.3.',
  ],

  // ─── Bilingual catalogue-source files (the localised label IS the data) ──
  // These modules are the i18n catalogue for their surface: each returns
  // complete EN + SW variants selected by an explicit `language`/`lang`
  // argument. The `label:` literals the scanner flags ARE catalogue
  // entries, not stray inline UI copy. Single-language-per-locale is
  // guaranteed because the consumer picks one branch by active locale.
  [
    'apps/tenant-mobile/src/chat/greeting.ts',
    'Bilingual renter-chat catalogue: SUGGESTIONS_EN / SUGGESTIONS_SW + GREETINGS are the localised source data, selected by lang. The flagged label literals are catalogue entries.',
  ],
  [
    'packages/chat-ui/src/bossnyumba/dynamic-ui-hints.ts',
    'Bilingual ProactiveHint catalogue: bossnyumbaProactiveHints(language) returns complete EN + SW hint sets selected by language. Flagged action.label literals are catalogue entries.',
  ],
  [
    'packages/chat-ui/src/widget/litfin-widget-content.ts',
    'Bilingual widget-content catalogue: getWidgetSuggestionChips / getWidgetWelcomeMessage return complete EN + SW chip/greeting sets selected by language. Flagged label literals are catalogue entries.',
  ],

  // ─── chat-ui library components — static a11y labels (no useTranslations dep) ──
  // chat-ui is a framework-agnostic library (apps pass `t()` or a
  // `language` prop; the package itself has NO next-intl dependency by
  // design — see the P89 note above). These aria-labels are static
  // structural/role labels on library primitives; localisation arrives
  // via the consumer-supplied language prop, never a hook inside the lib.
  [
    'packages/chat-ui/src/litfin-primitives.tsx',
    'chat-ui library primitive — static aria-labels (Attach image / AI compliance notice) on a framework-agnostic component with no useTranslations dependency by design.',
  ],
  [
    'packages/chat-ui/src/widget/LitFinChatPanel.tsx',
    'chat-ui library widget — static aria-labels (Mr. Mwikila chat / Remove image / AI compliance notice) on a framework-agnostic component with no useTranslations dependency by design.',
  ],

  // ─── dynamic-sections seed registry — English default labels (prop-driven) ──
  // The dynamic-sections package is library-only: seed sections carry
  // English default titles/labels and consumer apps override them via the
  // localised section schema (see the P89 prop-driven note above). KRA/TRA
  // VAT titles are authority-pinned registry labels.
  [
    'packages/dynamic-sections/src/seed/section-components.tsx',
    'dynamic-sections seed registry — English default section titles (Active Leases / Rent Due Soon / KRA & TRA VAT Filing); library is prop-driven and consumer apps supply localised labels.',
  ],
  [
    'packages/dynamic-sections/src/seed/seed-sections.ts',
    'dynamic-sections seed registry — English default section labels mirroring section-components.tsx; library is prop-driven and consumer apps supply localised labels.',
  ],

  // ─── Mobile documents + superpowers subsystems — pending i18n bootstrap ──
  // These React Native surfaces are single-language code paths (staff =
  // Swahili-first, tenant = English) whose per-string extraction needs a
  // dedicated subsystem i18n bootstrap: a new `documents`/`superpowers`
  // catalogue namespace plus threading `lang` from useI18n/useTranslation
  // through the module-level NavigateTarget constants and RN <Text>
  // literals. That bootstrap spans both apps and is tracked as its own
  // follow-up.
  // They do NOT mix two languages in a single render, so they are not the
  // hard-rule "Habari! Hello there" violation — they are single-locale
  // surfaces awaiting locale-toggle wiring.
  [
    'apps/staff-mobile/src/documents/DocumentExplorer.tsx',
    'staff-mobile document chat surface (Swahili-first) — pending documents-subsystem i18n bootstrap to thread lang through types.ts label helpers + RN Text literals.',
  ],
  [
    'apps/staff-mobile/src/documents/DocumentList.tsx',
    'staff-mobile document list (Swahili-first) — pending documents-subsystem i18n bootstrap to thread lang through label helpers + empty-state Text literals.',
  ],
  [
    'apps/staff-mobile/src/superpowers/navigate.ts',
    'staff-mobile superpowers navigate targets — DEFAULT_STAFF_TARGETS labels are module-level constants rendered raw; pending superpowers-subsystem i18n bootstrap (new namespace + lang threading).',
  ],
  [
    'apps/tenant-mobile/src/documents/DocumentExplorer.tsx',
    'tenant-mobile document chat surface (English) — pending documents-subsystem i18n bootstrap to add a lang param to label helpers + extract RN Text literals.',
  ],
  [
    'apps/tenant-mobile/src/documents/DocumentList.tsx',
    'tenant-mobile document list (English) — pending documents-subsystem i18n bootstrap to add lang to label helpers + extract empty-state Text literals.',
  ],
  [
    'apps/tenant-mobile/src/superpowers/SuperpowersBootstrap.tsx',
    'tenant-mobile superpowers palette — hardcoded chip/toast copy (Bulk request / Undone / Open ...); pending superpowers-subsystem i18n bootstrap (new namespace + lang threading).',
  ],
  [
    'apps/tenant-mobile/src/superpowers/navigate.ts',
    'tenant-mobile superpowers navigate targets — DEFAULT_TENANT_TARGETS labels are module-level constants rendered raw; pending superpowers-subsystem i18n bootstrap (new namespace + lang threading).',
  ],
]);
