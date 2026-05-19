/**
 * @bossnyumba/domain-risk-safeguards
 *
 * BOSSNYUMBA-specific domain-risk safeguards (Phase M-F). Closes the L3
 * BOSSNYUMBA-specific items:
 *   - L3 #9  — Disparate-impact quarterly audit (HUD May-2024 + EU AI
 *               Act HIGH RISK + SafeRent settlement playbook)
 *   - L3 #10 — Human-in-the-loop HARD gate for Voyager skill promotion
 *   - L3 fair-housing-risk — quarterly DI audit
 *   - L3 jurisdictional-creep class scanner — codifies the silent-TZ
 *               fallback class as CI-enforced
 *   - L3 Klarna pattern — never auto-resolve disputes/refunds/late-fee
 *               waivers/lease amendments/eviction; draft + route only
 *   - L3 tenant-privacy risk — biometric / chat transcript / M-Pesa SMS
 *               / lease PDF threat-model declarations + cron sweeps +
 *               egress audit
 *
 * The package is wire-agnostic: every external dependency is a Port,
 * and verdicts are plain frozen objects.
 */

export * from './types.js';

// Module 1 — Disparate-impact audit
export {
  computeFourFifths,
  computeChiSquared,
  computeCohensD,
  auditCohort,
  runQuarterlyDiAudit,
} from './disparate-impact/index.js';

// Module 2 — Skill-promotion HARD gate
export { evaluateSkillPromotion } from './skill-promotion-gate/index.js';

// Module 3 — Klarna-pattern wrap
export {
  routeKlarnaAction,
  requiresKlarnaWrap,
  KLARNA_SLA_HOURS,
  KLARNA_SUPPORT_TIER,
} from './klarna-pattern/index.js';

// Module 4 — Jurisdictional-creep class scanner
export {
  isAllowlistedPath,
  scanSource,
  scanSources,
} from './jurisdictional-scanner/index.js';

// Module 5 — Tenant-privacy threat-model enforcement
export {
  TENANT_PRIVACY_DECLARATIONS,
  ALL_PII_CHANNELS,
  sweepRetention,
  recordEgressEvent,
} from './tenant-privacy/index.js';

// Module 6 — Quarterly compliance report
export {
  aggregateQuarterlyReport,
  renderQuarterlyReportMarkdown,
  reportFilename,
} from './quarterly-report/index.js';
