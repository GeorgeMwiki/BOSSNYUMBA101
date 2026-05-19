/**
 * Quarterly compliance report — Markdown renderer.
 *
 * Renders the structured report into the format that lives under
 * `Docs/compliance/quarterly/<quarter>-<tenant-or-platform>.md` and is
 * also read by the K-G universal in-chat tab renderer.
 */

import type { QuarterlyComplianceReport } from '../types.js';

export function renderQuarterlyReportMarkdown(
  report: QuarterlyComplianceReport,
): string {
  const scopeLabel =
    report.scope === 'tenant'
      ? `Tenant \`${report.tenantId ?? 'unknown'}\``
      : 'Platform-wide';
  const klarnaBreach = report.klarnaPattern.executes > 0;

  let out = '';
  out += `# Quarterly Compliance Report — ${report.quarter}\n`;
  out += `_Scope: ${scopeLabel}_\n`;
  out += `_Generated at: ${report.generatedAt}_\n\n`;

  out += '## 1. Disparate-Impact Audit (HUD May-2024 + EU AI Act + SafeRent)\n\n';
  out += `- Cohorts examined: **${report.disparateImpact.cohortsExamined}**\n`;
  out += `- Concerns: **${report.disparateImpact.concerns}**\n`;
  out += `- Breaches: **${report.disparateImpact.breaches}**\n`;
  if (report.disparateImpact.topBreach !== null) {
    const tb = report.disparateImpact.topBreach;
    out += '\n### Top concern / breach\n\n';
    out += `- Action class: \`${tb.actionClass}\`\n`;
    out += `- Proxy: \`${tb.proxy}\`\n`;
    out += `- 4/5ths impact ratio: **${tb.fourFifths.impactRatio.toFixed(3)}**`;
    out += ` (passes = ${tb.fourFifths.passes ? 'yes' : 'no'})\n`;
    out += `- Chi-squared: **${tb.chiSquared.chiSquared.toFixed(3)}**`;
    out += ` (critical α=0.05: ${tb.chiSquared.criticalAt0p05.toFixed(3)},`;
    out += ` rejects null = ${tb.chiSquared.rejectsNull ? 'yes' : 'no'})\n`;
    out += `- Cohen's d: **${tb.cohensD.d.toFixed(3)}**`;
    out += ` (magnitude = ${tb.cohensD.magnitude})\n`;
    out += `- Verdict: **${tb.verdict.toUpperCase()}**\n`;
  }
  out += '\n';

  out += '## 2. Skill-Promotion HARD Gate (Voyager runaway prevention)\n\n';
  out += `- Proposals: **${report.skillPromotion.proposals}**\n`;
  out += `- Approvals: **${report.skillPromotion.approvals}**\n`;
  out += `- Denials: **${report.skillPromotion.denials}**\n`;
  out += `- Quarantines: **${report.skillPromotion.quarantines}**\n\n`;

  out += '## 3. Klarna-Pattern (draft-and-route)\n\n';
  out += `- Routes: **${report.klarnaPattern.routes}**\n`;
  out += `- Executes (must be 0): **${report.klarnaPattern.executes}**`;
  if (klarnaBreach) {
    out += ' — **BREACH — Klarna-pattern wrap was bypassed.**';
  }
  out += '\n\n';

  out += '## 4. Jurisdictional-Creep Class Scanner\n\n';
  out += `- Files scanned: **${report.jurisdictionalCreep.filesScanned}**\n`;
  out += `- Findings: **${report.jurisdictionalCreep.findings}**\n`;
  out += '\n### Class breakdown\n\n';
  out += '| Class | Count |\n|---|---|\n';
  out += `| literal-tz-outside-rules | ${report.jurisdictionalCreep.classBreakdown['literal-tz-outside-rules']} |\n`;
  out += `| switch-jurisdiction-no-default | ${report.jurisdictionalCreep.classBreakdown['switch-jurisdiction-no-default']} |\n`;
  out += `| country-or-tz-silent-fallback | ${report.jurisdictionalCreep.classBreakdown['country-or-tz-silent-fallback']} |\n`;
  out += '\n';

  out += '## 5. Tenant-Privacy (retention + egress audit)\n\n';
  out += `- Retention sweeps: **${report.tenantPrivacy.retentionSweeps}**\n`;
  out += `- Records deleted (retention enforced): **${report.tenantPrivacy.recordsDeleted}**\n`;
  out += `- Egress events: **${report.tenantPrivacy.egressAudits}**\n`;
  out += '\n### Per-channel\n\n';
  out += '| Channel | Sweeps | Egress |\n|---|---|---|\n';
  out += `| biometric-smartlock | ${report.tenantPrivacy.perChannel['biometric-smartlock'].sweeps} | ${report.tenantPrivacy.perChannel['biometric-smartlock'].egress} |\n`;
  out += `| chat-transcript | ${report.tenantPrivacy.perChannel['chat-transcript'].sweeps} | ${report.tenantPrivacy.perChannel['chat-transcript'].egress} |\n`;
  out += `| mpesa-sms | ${report.tenantPrivacy.perChannel['mpesa-sms'].sweeps} | ${report.tenantPrivacy.perChannel['mpesa-sms'].egress} |\n`;
  out += `| lease-pdf | ${report.tenantPrivacy.perChannel['lease-pdf'].sweeps} | ${report.tenantPrivacy.perChannel['lease-pdf'].egress} |\n`;

  return out;
}

/**
 * Filename convention used by the quarterly-report cron writer.
 */
export function reportFilename(report: QuarterlyComplianceReport): string {
  if (report.scope === 'platform') {
    return `${report.quarter}-platform.md`;
  }
  return `${report.quarter}-${report.tenantId ?? 'unknown'}.md`;
}
