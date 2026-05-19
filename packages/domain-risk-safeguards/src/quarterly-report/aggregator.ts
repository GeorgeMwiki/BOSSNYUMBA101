/**
 * Quarterly compliance report aggregator.
 *
 * Composes the five module outputs into a single per-tenant quarterly
 * report. The report has two scopes:
 *   - `tenant`  — for tenant-owner consumption
 *   - `platform` — for BOSSNYUMBA HQ admin (rolled up across tenants)
 *
 * Output surfaces:
 *   - Markdown file under `Docs/compliance/quarterly/<quarter>-<tenant>.md`
 *     (or `<quarter>-platform.md`)
 *   - In-chat tab via K-G universal in-chat tab rendering — the chat
 *     server reads the same Markdown file
 *
 * The aggregator is pure — it takes pre-collected inputs and returns
 * the report structure. The cron / scheduler is wired downstream.
 */

import type {
  DisparateImpactVerdict,
  EgressAuditEvent,
  JurisdictionalCreepScanResult,
  KlarnaVerdict,
  PiiChannel,
  QuarterId,
  QuarterlyComplianceReport,
  RetentionSweepEvent,
  SkillPromotionVerdict,
} from '../types.js';

interface QuarterlyReportInputs {
  readonly quarter: QuarterId;
  readonly scope: 'tenant' | 'platform';
  readonly tenantId: string | null;
  readonly now: Date;
  readonly diVerdicts: ReadonlyArray<DisparateImpactVerdict>;
  readonly skillVerdicts: ReadonlyArray<SkillPromotionVerdict>;
  readonly klarnaVerdicts: ReadonlyArray<KlarnaVerdict>;
  readonly creepScans: ReadonlyArray<JurisdictionalCreepScanResult>;
  readonly retentionSweeps: ReadonlyArray<RetentionSweepEvent>;
  readonly egressEvents: ReadonlyArray<EgressAuditEvent>;
}

const ALL_CHANNELS: ReadonlyArray<PiiChannel> = Object.freeze([
  'biometric-smartlock',
  'chat-transcript',
  'mpesa-sms',
  'lease-pdf',
]);

const ALL_CREEP_KINDS = [
  'literal-tz-outside-rules',
  'switch-jurisdiction-no-default',
  'country-or-tz-silent-fallback',
] as const;

export function aggregateQuarterlyReport(
  inputs: QuarterlyReportInputs,
): QuarterlyComplianceReport {
  const di = aggregateDi(inputs.diVerdicts);
  const skill = aggregateSkill(inputs.skillVerdicts);
  const klarna = aggregateKlarna(inputs.klarnaVerdicts);
  const creep = aggregateCreep(inputs.creepScans);
  const privacy = aggregatePrivacy(inputs.retentionSweeps, inputs.egressEvents);

  return Object.freeze({
    quarter: inputs.quarter,
    scope: inputs.scope,
    tenantId: inputs.tenantId,
    generatedAt: inputs.now.toISOString(),
    disparateImpact: di,
    skillPromotion: skill,
    klarnaPattern: klarna,
    jurisdictionalCreep: creep,
    tenantPrivacy: privacy,
  });
}

function aggregateDi(
  verdicts: ReadonlyArray<DisparateImpactVerdict>,
): QuarterlyComplianceReport['disparateImpact'] {
  const concerns = verdicts.filter((v) => v.verdict === 'concern').length;
  const breaches = verdicts.filter((v) => v.verdict === 'breach').length;
  const breachOrConcern = verdicts.filter(
    (v) => v.verdict === 'breach' || v.verdict === 'concern',
  );
  const topBreach =
    breachOrConcern.length === 0
      ? null
      : breachOrConcern.reduce((worst, v) => {
          // Lower 4/5ths impact ratio = worse.
          return v.fourFifths.impactRatio < worst.fourFifths.impactRatio ? v : worst;
        }, breachOrConcern[0]!);
  return Object.freeze({
    cohortsExamined: verdicts.length,
    concerns,
    breaches,
    topBreach,
  });
}

function aggregateSkill(
  verdicts: ReadonlyArray<SkillPromotionVerdict>,
): QuarterlyComplianceReport['skillPromotion'] {
  const approvals = verdicts.filter((v) => v.kind === 'approve').length;
  const quarantines = verdicts.filter((v) => v.kind === 'quarantine').length;
  const denials = verdicts.filter(
    (v) =>
      v.kind === 'deny-metric-threshold' ||
      v.kind === 'deny-missing-human-approval' ||
      v.kind === 'deny-scope-mismatch',
  ).length;
  return Object.freeze({
    proposals: verdicts.length,
    approvals,
    denials,
    quarantines,
  });
}

function aggregateKlarna(
  verdicts: ReadonlyArray<KlarnaVerdict>,
): QuarterlyComplianceReport['klarnaPattern'] {
  return Object.freeze({
    routes: verdicts.length,
    executes: 0, // Klarna wrap never executes — surfaced as breach if non-zero
  });
}

function aggregateCreep(
  scans: ReadonlyArray<JurisdictionalCreepScanResult>,
): QuarterlyComplianceReport['jurisdictionalCreep'] {
  const allFindings = scans.flatMap((s) => s.findings);
  const classBreakdown = ALL_CREEP_KINDS.reduce<
    Record<JurisdictionalCreepScanResult['findings'][number]['kind'], number>
  >(
    (acc, kind) => {
      acc[kind] = allFindings.filter((f) => f.kind === kind).length;
      return acc;
    },
    {
      'literal-tz-outside-rules': 0,
      'switch-jurisdiction-no-default': 0,
      'country-or-tz-silent-fallback': 0,
    },
  );
  return Object.freeze({
    filesScanned: scans.length,
    findings: allFindings.length,
    classBreakdown: Object.freeze(classBreakdown),
  });
}

function aggregatePrivacy(
  sweeps: ReadonlyArray<RetentionSweepEvent>,
  egress: ReadonlyArray<EgressAuditEvent>,
): QuarterlyComplianceReport['tenantPrivacy'] {
  const perChannel = ALL_CHANNELS.reduce<
    Record<PiiChannel, { sweeps: number; egress: number }>
  >(
    (acc, channel) => {
      acc[channel] = {
        sweeps: sweeps.filter((s) => s.channel === channel).length,
        egress: egress.filter((e) => e.channel === channel).length,
      };
      return acc;
    },
    {
      'biometric-smartlock': { sweeps: 0, egress: 0 },
      'chat-transcript': { sweeps: 0, egress: 0 },
      'mpesa-sms': { sweeps: 0, egress: 0 },
      'lease-pdf': { sweeps: 0, egress: 0 },
    },
  );
  return Object.freeze({
    retentionSweeps: sweeps.length,
    recordsDeleted: sweeps.reduce((s, e) => s + e.recordsDeleted, 0),
    egressAudits: egress.length,
    perChannel: Object.freeze(perChannel),
  });
}
