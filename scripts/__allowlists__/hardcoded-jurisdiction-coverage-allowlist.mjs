/**
 * Hardcoded-jurisdiction-coverage allow-list.
 *
 * Production files that legitimately branch on a literal ISO-3166 country
 * code (`country === 'TZ'`, `if (jurisdiction === 'KE')`, etc.). Test
 * files and fixture files are auto-allowlisted at the scanner level. The
 * jurisdictional registry under `packages/domain-models/src/common/` is
 * also auto-allowed by path.
 *
 * The platform's vision: NEW business logic should NEVER branch on a
 * literal country code. Every per-country parameter belongs in
 * `JurisdictionalRules.for(country)` so adding a new jurisdiction is a
 * single-object edit. This catches the silent-TZ-fallback class of bugs.
 *
 * Legitimate categories:
 *   1. Jurisdictional registry (auto-allowed by path).
 *   2. Per-country plugin scaffolds (auto-allowed by path).
 *   3. Sandbox / demo generators that intentionally enumerate scenarios
 *      per jurisdiction for marketing demos.
 *   4. Tool-spec implementations pinned to a specific jurisdiction by
 *      design (e.g. `platform.file_kra_mri.ts` is by definition Kenya-
 *      only because KRA is the Kenyan tax authority).
 *
 * Adding a new `country === 'XX'` branch in production code → register
 * here with a justification ≥ 8 characters, OR refactor through
 * `JurisdictionalRules.for(country)`.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const HARDCODED_JURISDICTION_ALLOWLIST = new Map([
  // ─── Jurisdiction-pinned tool implementations ──────────────────────
  [
    'packages/central-intelligence/src/kernel/tool-spec/hq-tools/platform.file_kra_mri.ts',
    'KRA MRI tool is Kenya-only by definition; the jurisdiction === KE gate guards a Kenya-only adapter dispatch.',
  ],

  // ─── Sandbox / demo data generators ────────────────────────────────
  [
    'packages/marketing-brain/src/sandbox/sandbox-estate-generator.ts',
    'Sandbox estate generator enumerates per-country compliance scenarios for marketing demos; not business logic.',
  ],

  // ─── Case-study mapping registry ───────────────────────────────────
  [
    'packages/ai-copilot/src/knowledge/case-studies/index.ts',
    'Case-studies index maps cs.country to ISO countryCode; this IS the case-study registry mapping.',
  ],
]);
