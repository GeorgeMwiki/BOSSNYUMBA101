/**
 * Hardcoded-tax-rate-coverage allow-list.
 *
 * Production files that legitimately reference a numeric tax-rate literal
 * (`0.16`, `0.18`, `0.075`, `0.30`, etc.) in a financial-tax context
 * outside `packages/compliance-plugins/` and outside the jurisdictional
 * registry. Test files are auto-allowlisted at the scanner level.
 *
 * The platform's vision: tax rates are per-jurisdiction parameters that
 * MUST live in the compliance-plugin or jurisdictional-rules registry.
 * A literal `0.16` in business logic silently couples that path to one
 * country's VAT, which silently breaks for every other jurisdiction.
 *
 * AM-4 baseline-to-zero drive (May 2026): the three previous entries
 * have been rebound through `getJurisdictionalRules(country).
 * taxAuthority.{vatRatePct,rentalWithholdingRatePct}` and the source
 * files no longer carry literal rates:
 *   - packages/central-intelligence/src/kernel/tool-spec/hq-tools/
 *     platform.file_kra_mri.ts → reads TZ MRI rate from registry.
 *   - services/mcp-server-firs/src/adapter.ts → reads NG VAT from
 *     registry.
 *   - services/reports/src/compliance/tz-tra-formatter.ts → reads TZ
 *     WHT + VAT from registry.
 *
 * Adding a new tax-rate literal in business logic → register here with a
 * justification ≥ 8 characters, OR move it to the appropriate
 * compliance-plugin / jurisdictional-rules entry (preferred).
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const HARDCODED_TAX_RATE_ALLOWLIST = new Map([]);
