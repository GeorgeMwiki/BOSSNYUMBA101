/**
 * Deterministic heuristic intent generator — Wave COMPANY-BRAIN (Y-A).
 * Ported from Borjie, retailored for real-estate (BossNyumba).
 *
 * The brilliant LLM path is the production default, but we ALWAYS have
 * a deterministic fallback because:
 *
 *   1. CI / dev runs lack an LLM key. The full ingest → intent demo
 *      must still produce a credible proposal so the owner-portal tests
 *      cover the happy path.
 *   2. The LLM may be down or rate-limited. The landlord cockpit must
 *      still show SOMETHING actionable, not a blank card.
 *   3. The deterministic path is the regression test bed for the
 *      "every proposal cites evidence" invariant. If the heuristic ever
 *      emits a proposal without an evidence id, CI fails immediately.
 *
 * The heuristic uses pattern-matching over the snapshot's entity
 * counts + key facts to surface up to:
 *
 *   - 3 tabs        (tenants / arrears / lease-renewal calendar)
 *   - 3 reminders   (tax filings, lease renewals, overdue rent)
 *   - 3 opportunities (re-engage lapsed tenant, rent escalation review)
 *   - 3 risks       (overdue rent, missing inspection records,
 *                    expiring lease)
 *
 * Every proposal pulls its evidence id from the actual chunk samples
 * passed in — we NEVER fabricate a chunk id, so the recall layer can
 * always render the source.
 */

import type {
  IngestIntent,
  IngestSnapshot,
  ProposedOpportunity,
  ProposedReminder,
  ProposedRisk,
  ProposedTab,
} from './types.js';

const SECONDS_PER_DAY = 24 * 60 * 60;

function pickEvidenceIds(
  snapshot: IngestSnapshot,
  max: number,
): ReadonlyArray<string> {
  const ids = snapshot.chunkSamples
    .map((c) => c.chunkId)
    .filter((id) => id.length > 0);
  return ids.slice(0, Math.max(1, Math.min(max, 5)));
}

function entityCountByKind(snapshot: IngestSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of snapshot.availableEntities) {
    out.set(e.kind, (out.get(e.kind) ?? 0) + 1);
  }
  return out;
}

function buildTabsForTenants(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedTab | null {
  // Heuristic: when at least a few tenant-shaped entities are found
  // (or the doc clearly enumerates a tenant list via the filename),
  // propose a Tenants tab.
  const counts = entityCountByKind(snapshot);
  const candidateCount = counts.get('candidate_entity') ?? 0;
  const tenantRoleHit = snapshot.availableEntities.some(
    (e) => e.kind === 'role' && e.id === 'tenant',
  );
  const isTenantsDoc =
    /tenant|mpangaji|leaseholder|occupant/i.test(snapshot.filename) ||
    snapshot.keyFacts.some((f) =>
      /tenant|mpangaji|leaseholder/i.test(f.value),
    ) ||
    tenantRoleHit ||
    candidateCount >= 5;
  if (!isTenantsDoc) return null;
  return {
    tabType: 'tenants',
    titleEn: 'Tenants — top 12',
    titleSw: 'Wapangaji — 12 wakuu',
    reasonEn: `Detected ${candidateCount} candidate entities and tenant-shaped context — recommend cataloging the top occupants into a dedicated tab.`,
    reasonSw: `Imegundua wahusika ${candidateCount} na muktadha wa wapangaji — pendekeza kuandika wapangaji wakuu kwenye kichupo.`,
    evidenceIds,
    confidence: candidateCount >= 12 ? 0.82 : 0.62,
    config: {
      ranking: 'arrears_desc',
      limit: 12,
      sourceUpload: snapshot.receipt.uploadId,
    },
  };
}

function buildTabsForComplianceCalendar(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedTab | null {
  const counts = entityCountByKind(snapshot);
  const conceptHit = counts.get('concept') ?? 0;
  const regulatorHit = counts.get('regulator') ?? 0;
  if (conceptHit === 0 && regulatorHit === 0) return null;
  return {
    tabType: 'compliance',
    titleEn: 'Tax & licence calendar',
    titleSw: 'Kalenda ya kodi na leseni',
    reasonEn: `Detected ${conceptHit} compliance mention(s) and ${regulatorHit} regulator mention(s) — recommend a compliance calendar tab so deadlines stay visible.`,
    reasonSw: `Imegundua dhana za utiifu ${conceptHit} na ya mdhibiti ${regulatorHit} — pendekeza kichupo cha kalenda ya utiifu ili tarehe zionekane.`,
    evidenceIds,
    confidence: 0.7,
    config: {
      lookAheadDays: 90,
      sourceUpload: snapshot.receipt.uploadId,
    },
  };
}

function buildTabsForUnitBreakdown(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedTab | null {
  const units = snapshot.availableEntities.filter(
    (e) => e.kind === 'unit_type',
  );
  if (units.length < 2) return null;
  const sample = units.slice(0, 4).map((m) => m.displayName).join(', ');
  return {
    tabType: 'portfolio',
    titleEn: `Portfolio by unit type (${units.length})`,
    titleSw: `Mali kwa aina ya nyumba (${units.length})`,
    reasonEn: `Detected ${units.length} distinct unit types in this doc (${sample}) — recommend a per-unit-type occupancy and rent tab.`,
    reasonSw: `Imegundua aina za nyumba ${units.length} (${sample}) — pendekeza kichupo cha umiliki na kodi kwa kila aina.`,
    evidenceIds,
    confidence: 0.65,
    config: {
      unitTypeIds: units.map((m) => m.id).slice(0, 8),
      view: 'monthly',
      sourceUpload: snapshot.receipt.uploadId,
    },
  };
}

function buildRemindersForTax(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
  now: Date,
): ProposedReminder | null {
  const hasTax =
    snapshot.keyFacts.some((f) =>
      /tax|tra|kra|service\s?charge|levy/i.test(f.value),
    ) ||
    /tax|tra|kra|service\s?charge|levy/i.test(snapshot.filename) ||
    snapshot.availableEntities.some(
      (e) => e.kind === 'regulator' && (e.id === 'tra' || e.id === 'kra'),
    );
  if (!hasTax) return null;
  // 14 days out — gives the landlord time to gather docs.
  const triggerAt = new Date(now.getTime() + 14 * SECONDS_PER_DAY * 1000);
  return {
    titleEn: 'File monthly tax return (14d notice)',
    titleSw: 'Wasilisha kodi ya kila mwezi (siku 14)',
    bodyEn: `This ingested doc references taxes — schedule the monthly TRA/KRA filing reminder so it lands two weeks before deadline.`,
    bodySw: `Hati uliyowasilisha inahusu kodi — panga kumbusho la kufungua TRA/KRA wiki mbili kabla ya mwisho.`,
    triggerAtIso: triggerAt.toISOString(),
    channel: 'email',
    reasonEn: 'Tax mention found in upload — preemptive reminder reduces 5% late-penalty risk.',
    reasonSw: 'Kodi imetajwa kwenye hati — kumbusho la mapema linapunguza adhabu ya 5%.',
    evidenceIds,
    confidence: 0.75,
  };
}

function buildRemindersForArrears(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
  now: Date,
): ProposedReminder | null {
  const moneyFacts = snapshot.availableEntities.filter(
    (e) => e.kind === 'money_mention',
  );
  if (moneyFacts.length < 3) return null;
  // 7 days out — arrears age fast.
  const triggerAt = new Date(now.getTime() + 7 * SECONDS_PER_DAY * 1000);
  return {
    titleEn: `Follow up on ${moneyFacts.length} outstanding amounts`,
    titleSw: `Fuatilia kiasi ${moneyFacts.length} kilichobaki`,
    bodyEn: `Detected ${moneyFacts.length} monetary mentions in this doc — many docs of this shape are unpaid rent or arrears. Worth following up in a week.`,
    bodySw: `Imegundua kiasi cha pesa ${moneyFacts.length} — hati za aina hii mara nyingi ni kodi isiyolipwa. Fuatilia ndani ya wiki moja.`,
    triggerAtIso: triggerAt.toISOString(),
    channel: 'email',
    reasonEn: 'High count of monetary mentions; following up early reduces days-sales-outstanding (DSO).',
    reasonSw: 'Idadi kubwa ya kiasi cha pesa; ufuatiliaji wa mapema unapunguza muda wa kulipwa.',
    evidenceIds,
    confidence: 0.6,
  };
}

function buildOpportunityReengageLapsed(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedOpportunity | null {
  const candidates = snapshot.availableEntities.filter(
    (e) => e.kind === 'candidate_entity',
  );
  if (candidates.length < 3) return null;
  const sample = candidates.slice(0, 3).map((c) => c.displayName).join(', ');
  return {
    kind: 'reengage_lapsed_tenant',
    titleEn: 'Re-engage lapsed tenants',
    titleSw: 'Rejea wapangaji waliokoma',
    reasonEn: `Identified candidate tenants (${sample}) — if their last payment is >60 days old, a personalised outreach is a typical 6-15% retention bet.`,
    reasonSw: `Wahusika wanaowezekana (${sample}) — kama hawajalipa kwa siku 60+, mawasiliano binafsi mara nyingi yanafanikiwa 6-15%.`,
    expectedValueTzs: null,
    timeWindowDays: 30,
    evidenceIds,
    confidence: 0.55,
  };
}

function buildOpportunityRentEscalation(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedOpportunity | null {
  const units = snapshot.availableEntities.filter(
    (e) => e.kind === 'unit_type',
  );
  if (units.length < 2) return null;
  return {
    kind: 'rent_escalation_review',
    titleEn: 'Review rent escalation across unit types',
    titleSw: 'Pitia ongezeko la kodi kati ya aina za nyumba',
    reasonEn: `Doc references ${units.length} different unit types — checking current market rates reveals which units are under-rented vs. market.`,
    reasonSw: `Hati inataja aina za nyumba ${units.length} — kuangalia bei za soko kunaweza kuonyesha nyumba zenye kodi ndogo kuliko soko.`,
    expectedValueTzs: null,
    timeWindowDays: 14,
    evidenceIds,
    confidence: 0.5,
  };
}

function buildRiskOverdueTax(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedRisk | null {
  const dateFacts = snapshot.availableEntities.filter(
    (e) => e.kind === 'date_mention',
  );
  const hasTax =
    snapshot.keyFacts.some((f) => /tax|tra|kra|levy/i.test(f.value)) ||
    snapshot.availableEntities.some(
      (e) => e.kind === 'regulator' && (e.id === 'tra' || e.id === 'kra'),
    );
  if (!hasTax || dateFacts.length === 0) return null;
  return {
    kind: 'overdue_tax_filing',
    titleEn: 'Verify tax filings are not overdue',
    titleSw: 'Hakikisha kodi haijachelewa',
    reasonEn: `Tax mentions + ${dateFacts.length} date(s) in this doc — confirm the most recent filing was lodged within the regulator window.`,
    reasonSw: `Kodi umetajwa na tarehe ${dateFacts.length} — hakikisha uwasilishaji wa hivi karibuni umefanyika ndani ya muda wa mdhibiti.`,
    severity: 'high',
    evidenceIds,
    confidence: 0.65,
  };
}

function buildRiskMissingInspections(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedRisk | null {
  const moneyFacts = snapshot.availableEntities.filter(
    (e) => e.kind === 'money_mention',
  );
  const candidates = snapshot.availableEntities.filter(
    (e) => e.kind === 'candidate_entity',
  );
  // If we see lots of money and tenants but no inspection context, the
  // condition-report backfill is the right risk to surface.
  if (moneyFacts.length < 3 || candidates.length < 2) return null;
  return {
    kind: 'missing_inspection_records',
    titleEn: 'Backfill inspection records for these units',
    titleSw: 'Jaza rekodi za ukaguzi kwa nyumba hizi',
    reasonEn: `${moneyFacts.length} payment references against ${candidates.length} candidate tenants — without a per-unit move-in / move-out inspection record, deposit disputes are hard to defend.`,
    reasonSw: `Malipo ${moneyFacts.length} kwa wapangaji ${candidates.length} — bila rekodi ya ukaguzi kwa kila nyumba, mizozo ya amana ni vigumu kushinda.`,
    severity: 'medium',
    evidenceIds,
    confidence: 0.55,
  };
}

function buildRiskExpiringLease(
  snapshot: IngestSnapshot,
  evidenceIds: ReadonlyArray<string>,
): ProposedRisk | null {
  const leaseHits = snapshot.availableEntities.filter(
    (e) => e.kind === 'concept' && (e.id === 'lease' || e.id === 'rent'),
  );
  if (leaseHits.length === 0) return null;
  return {
    kind: 'expiring_lease',
    titleEn: 'Check lease expiry windows',
    titleSw: 'Angalia muda wa kuisha kwa kodi za nyumba',
    reasonEn: `Detected ${leaseHits.length} lease reference(s) — confirm none of them expire within the next 90 days without a renewal plan.`,
    reasonSw: `Imegundua makubaliano ya kodi ${leaseHits.length} — hakikisha hakuna yanayoisha ndani ya siku 90 bila mpango wa kufanya upya.`,
    severity: 'high',
    evidenceIds,
    confidence: 0.7,
  };
}

export interface HeuristicOptions {
  readonly now?: () => Date;
}

export function generateHeuristicIntent(
  snapshot: IngestSnapshot,
  options?: HeuristicOptions,
): IngestIntent {
  const now = options?.now?.() ?? new Date();
  const evidenceIds = pickEvidenceIds(snapshot, 3);

  // If we have ZERO chunk samples, we still need at least one evidence
  // id (the upload id) to satisfy the brilliance contract.
  const finalEvidenceIds =
    evidenceIds.length > 0
      ? evidenceIds
      : Object.freeze([`upload:${snapshot.receipt.uploadId}`]);

  const tabs = [
    buildTabsForTenants(snapshot, finalEvidenceIds),
    buildTabsForComplianceCalendar(snapshot, finalEvidenceIds),
    buildTabsForUnitBreakdown(snapshot, finalEvidenceIds),
  ].filter((t): t is ProposedTab => t !== null);

  const reminders = [
    buildRemindersForTax(snapshot, finalEvidenceIds, now),
    buildRemindersForArrears(snapshot, finalEvidenceIds, now),
  ].filter((r): r is ProposedReminder => r !== null);

  const opportunities = [
    buildOpportunityReengageLapsed(snapshot, finalEvidenceIds),
    buildOpportunityRentEscalation(snapshot, finalEvidenceIds),
  ].filter((o): o is ProposedOpportunity => o !== null);

  const risks = [
    buildRiskOverdueTax(snapshot, finalEvidenceIds),
    buildRiskMissingInspections(snapshot, finalEvidenceIds),
    buildRiskExpiringLease(snapshot, finalEvidenceIds),
  ].filter((r): r is ProposedRisk => r !== null);

  const total =
    tabs.length + reminders.length + opportunities.length + risks.length;
  const narrativeEn =
    total === 0
      ? `Mr. Mwikila ingested ${snapshot.filename} — no high-confidence proposals from the deterministic pass; the brilliant LLM pass will run when reachable.`
      : `Mr. Mwikila scanned ${snapshot.filename} and surfaced ${tabs.length} tab idea(s), ${reminders.length} reminder(s), ${opportunities.length} opportunity, ${risks.length} risk(s) — accept any below to act on them.`;
  const narrativeSw =
    total === 0
      ? `Mr. Mwikila ameingiza ${snapshot.filename} — hakuna mapendekezo ya juu kutoka kwa mfumo wa kawaida.`
      : `Mr. Mwikila amechanganua ${snapshot.filename} na amependekeza vichupo ${tabs.length}, kumbusho ${reminders.length}, fursa ${opportunities.length}, hatari ${risks.length} — kubali yoyote ili kufanya kazi.`;

  return Object.freeze({
    proposedTabs: Object.freeze(tabs),
    proposedReminders: Object.freeze(reminders),
    proposedOpportunities: Object.freeze(opportunities),
    proposedRisks: Object.freeze(risks),
    confidence: total === 0 ? 0.2 : 0.55,
    narrativeEn,
    narrativeSw,
    reasonTag: 'heuristic-v1',
    provider: 'heuristic',
    generatedAtIso: now.toISOString(),
  });
}
