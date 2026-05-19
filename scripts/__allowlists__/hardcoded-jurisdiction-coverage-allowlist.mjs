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
 * AM-4 baseline-to-zero drive (May 2026): the three previous entries
 * have been rebound and the inline literals removed:
 *   - packages/central-intelligence/.../platform.file_kra_mri.ts →
 *     `input.jurisdiction === 'KE'` replaced by typed predicate
 *     `isKeritsInput(input)` over the discriminated-union schema; the
 *     `'KE'` discriminant is captured in a typed const derived from the
 *     Zod schema so the schema remains the source of truth.
 *   - packages/marketing-brain/.../sandbox-estate-generator.ts → inline
 *     `country === 'TZ' ? ... : country === 'KE' ? ...` ternary
 *     collapsed into a typed `COMPLIANCE_NOTICE_BY_COUNTRY` dispatch
 *     table mirroring the existing CURRENCY/BASE_RENT tables.
 *   - packages/ai-copilot/.../case-studies/index.ts → inline
 *     `cs.country === 'TZ' ? 'TZ' : cs.country === 'KE' ? 'KE' : undefined`
 *     ternary collapsed into typed `COUNTRY_TO_KNOWLEDGE_STORE_CODE`
 *     dispatch map.
 *
 * Adding a new `country === 'XX'` branch in production code → register
 * here with a justification ≥ 8 characters, OR refactor through
 * `JurisdictionalRules.for(country)` / a typed per-country dispatch
 * table (preferred).
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const HARDCODED_JURISDICTION_ALLOWLIST = new Map([]);
