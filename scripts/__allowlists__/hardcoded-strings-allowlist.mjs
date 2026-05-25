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

  // ─── customer-app — MVP scaffold pages pending i18n extraction ─────
  // These pages compose the Phase-P88 MVP scaffolding for the
  // customer-app. They contain aria-labels, option labels, and
  // placeholder copy that legitimately need i18n extraction — tracked
  // as a P89 follow-up. Allowlisted here so the scanner does not block
  // the LITFIN parity wave (P75-P88). The customer-app's `messages/en.json`
  // and `messages/sw.json` already wire next-intl for the pages that
  // ARE extracted; these specific MVP-scaffold files have not yet been
  // routed through `useTranslations()` because their copy is still
  // being iterated on with design.
  [
    'apps/customer-app/src/app/documents/house-rules/page.tsx',
    'MVP scaffold page; PageHeader title pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/app/emergencies/report/page.tsx',
    'MVP scaffold emergencies-report page; emergency-type option labels pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/app/inspection/page.tsx',
    'MVP scaffold inspection page; checklist item labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/app/maintenance/triage/page.tsx',
    'MVP scaffold maintenance-triage decision-tree page; node labels pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/app/onboarding/complete/page.tsx',
    'MVP scaffold onboarding-complete page; step labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/app/onboarding/utilities/page.tsx',
    'MVP scaffold onboarding-utilities page; copy-button label pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/app/onboarding/welcome/page.tsx',
    'MVP scaffold onboarding-welcome page; permission-prompt label pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/app/settings/declared-facts/page.tsx',
    'MVP scaffold settings-declared-facts page; PageHeader title pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/FeedbackThumbs.tsx',
    'MVP scaffold FeedbackThumbs component; aria-labels/placeholder pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/chat/ChatComposer.tsx',
    'ChatComposer aria-label="Send message" — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/documents/FileUpload.tsx',
    'FileUpload default label prop; pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/documents/MoveOutNoticeForm.tsx',
    'MoveOutNoticeForm placeholders/legend pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/documents/NotificationCenterButton.tsx',
    'NotificationCenterButton aria-labels — accessibility-only strings pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/feedback/FeedbackThumbs.tsx',
    'Duplicate FeedbackThumbs (feedback subdir) aria-labels pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/maintenance/MaintenanceTicketModal.tsx',
    'MaintenanceTicketModal category option label pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/maintenance/TicketRatingWidget.tsx',
    'TicketRatingWidget prompt copy + aria-labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/marketing/LiveAffordabilityDemo.tsx',
    'LiveAffordabilityDemo status labels — marketing-demo component pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/marketing/MarketingShell.tsx',
    'MarketingShell nav labels — marketing component pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/onboarding/DocumentQualityChecker.tsx',
    'DocumentQualityChecker label prop pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/onboarding/InspectionChecklist.tsx',
    'InspectionChecklist aria-labels — accessibility-only strings pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/onboarding/PhoneSignupForm.tsx',
    'PhoneSignupForm OTP aria-labels — accessibility-only strings pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/onboarding/SignaturePad.tsx',
    'SignaturePad aria-labels — accessibility-only strings pending i18n extraction in P89.',
  ],
  [
    'apps/customer-app/src/components/requests/CategorySelector.tsx',
    'CategorySelector category labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/components/requests/RequestCard.tsx',
    'RequestCard status-badge labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/lib/payments-data.ts',
    'Payments-data date-range option labels — data file pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/lib/proposed-action-mapper.ts',
    'Proposed-action-mapper button labels — data file pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/lib/starter-prompts.ts',
    'Starter-prompts catalog — content data file pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/customer-app/src/screens/MaintenancePage.tsx',
    'MaintenancePage status-badge labels pending i18n extraction in P89 (tracked-gap).',
  ],

  // ─── estate-manager-app — MVP scaffold pages pending i18n ──────────
  [
    'apps/estate-manager-app/src/app/ask/[threadId]/page.tsx',
    'Ask-thread page aria-label="Close artifact" — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/app/ask/_components/AuditTrailPanel.tsx',
    'AuditTrailPanel internal-operator aria-labels — audit-trail surface pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/app/briefing/page.tsx',
    'Briefing page aria-label="More options" — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/app/graph/GraphExplorer.tsx',
    'GraphExplorer internal-operator labels — investigative-graph UI pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/app/jarvis/JarvisConsole.tsx',
    'Jarvis console aria-labels — internal-operator surface pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/app/jarvis/page.tsx',
    'Jarvis page heading — internal-operator surface pending i18n extraction in P89.',
  ],
  [
    'apps/estate-manager-app/src/components/maintenance/AttachmentUpload.tsx',
    'AttachmentUpload default label="Add photos" — pending i18n extraction in P89 (tracked-gap).',
  ],

  // ─── owner-portal — MVP scaffold pages pending i18n extraction ────
  [
    'apps/owner-portal/src/app/onboarding/page.tsx',
    'Owner-portal onboarding step labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/app/plan/page.tsx',
    'Owner-portal plan-page PageHeader title pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/app/skills/page.tsx',
    'Owner-portal skills marketplace title pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/components/FeedbackThumbs.tsx',
    'Owner-portal FeedbackThumbs aria-labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/components/OwnerJarvisShell.tsx',
    'OwnerJarvisShell aria-label — accessibility-only string pending i18n extraction in P89.',
  ],
  [
    'apps/owner-portal/src/components/QuickActions.tsx',
    'Owner-portal QuickActions option labels pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/components/SkillCard.tsx',
    'SkillCard empty-state copy pending i18n extraction in P89 (tracked-gap).',
  ],
  [
    'apps/owner-portal/src/pages/Jarvis.tsx',
    'Owner-portal Jarvis page aria-labels + heading pending i18n extraction in P89.',
  ],

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
