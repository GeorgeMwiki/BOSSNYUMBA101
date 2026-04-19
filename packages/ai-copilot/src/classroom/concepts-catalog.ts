/**
 * Estate-management concept catalog (Wave 11).
 *
 * BOSSNYUMBA's AI Professor sub-persona uses this catalog to teach the
 * operator / employee (NOT the tenant). Concepts form a DAG: each concept
 * lists prerequisites that should be mastered first.
 *
 * The catalog is intentionally flat data (pure) — the runtime classroom
 * modules consume it without mutating.
 */

export interface Concept {
  readonly id: string;
  readonly titleEn: string;
  readonly titleSw: string;
  readonly summaryEn: string;
  readonly summarySw: string;
  readonly category:
    | 'financial'
    | 'tenancy'
    | 'compliance'
    | 'maintenance'
    | 'operations';
  readonly prerequisites: readonly string[];
  readonly bloomLevels: readonly (
    | 'remember'
    | 'understand'
    | 'apply'
    | 'analyze'
    | 'evaluate'
    | 'create'
  )[];
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const ESTATE_CONCEPTS: readonly Concept[] = [
  // --- financial foundations
  {
    id: 'rent_affordability',
    titleEn: 'Rent affordability basics',
    titleSw: 'Msingi wa uwezo wa kulipa kodi',
    summaryEn: '30% of gross income rule and salary-to-rent ratio screens.',
    summarySw: 'Kanuni ya 30% ya mapato na uwiano wa mshahara kwa kodi.',
    category: 'financial',
    prerequisites: [],
    bloomLevels: ['remember', 'understand'],
    difficulty: 'beginner',
  },
  {
    id: 'deposit_structures',
    titleEn: 'Deposit structures',
    titleSw: 'Muundo wa amana',
    summaryEn: 'Security, advance, and holding deposits + refund timelines.',
    summarySw: 'Amana ya dhamana, ya awali, na ya kushikilia + muda wa kurejesha.',
    category: 'financial',
    prerequisites: ['rent_affordability'],
    bloomLevels: ['understand', 'apply'],
    difficulty: 'beginner',
  },
  {
    id: 'rent_escalation',
    titleEn: 'Rent escalation clauses',
    titleSw: 'Vifungu vya kupanda kwa kodi',
    summaryEn: 'CPI-indexed, fixed %, or negotiated annual escalations.',
    summarySw: 'Kupanda kwa kodi: kulingana na mfumuko wa bei, asilimia fasili, au mazungumzo.',
    category: 'financial',
    prerequisites: ['deposit_structures'],
    bloomLevels: ['apply', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'gepg_reconciliation',
    titleEn: 'GePG reconciliation',
    titleSw: 'Ulinganishaji wa GePG',
    summaryEn: 'Match GePG receipts to ledger, resolve unapplied payments.',
    summarySw: 'Kulinganisha risiti za GePG na daftari, kutatua malipo yasiyotumika.',
    category: 'financial',
    prerequisites: ['deposit_structures'],
    bloomLevels: ['apply', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'arrears_ladder',
    titleEn: 'Arrears intervention ladder',
    titleSw: 'Ngazi ya uingiliaji kwa madeni',
    summaryEn: 'Reminder → call → notice → legal escalation sequence.',
    summarySw: 'Mfumo: ukumbusho → simu → notisi → hatua za kisheria.',
    category: 'financial',
    prerequisites: ['gepg_reconciliation'],
    bloomLevels: ['apply', 'analyze', 'evaluate'],
    difficulty: 'intermediate',
  },
  // --- tenancy
  {
    id: 'tenancy_risk_5ps',
    titleEn: 'Tenancy risk — 5 Ps',
    titleSw: 'Hatari ya upangaji — Ps 5',
    summaryEn: 'People, Property, Payments, Paperwork, Policies.',
    summarySw: 'Watu, Mali, Malipo, Nyaraka, Sera.',
    category: 'tenancy',
    prerequisites: ['rent_affordability'],
    bloomLevels: ['understand', 'apply', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'tenant_screening',
    titleEn: 'Tenant screening checklist',
    titleSw: 'Orodha ya uchunguzi wa mpangaji',
    summaryEn: 'ID, employment, credit history, references, prior tenancy.',
    summarySw: 'Kitambulisho, ajira, historia ya mkopo, marejeo, upangaji wa awali.',
    category: 'tenancy',
    prerequisites: ['tenancy_risk_5ps'],
    bloomLevels: ['remember', 'apply'],
    difficulty: 'beginner',
  },
  {
    id: 'lease_renewal_options',
    titleEn: 'Lease renewal options',
    titleSw: 'Chaguzi za kurejesha mkataba',
    summaryEn: 'Renew-at-same, renew-with-escalation, month-to-month, non-renewal.',
    summarySw: 'Kurejesha kwa kodi sawa, kwa kupanda, kila mwezi, au kutorejesha.',
    category: 'tenancy',
    prerequisites: ['rent_escalation', 'tenancy_risk_5ps'],
    bloomLevels: ['analyze', 'evaluate'],
    difficulty: 'intermediate',
  },
  {
    id: 'move_out_inspection',
    titleEn: 'Move-out inspection',
    titleSw: 'Ukaguzi wa kuhama',
    summaryEn: 'Damage vs wear & tear; photographic evidence; deposit deductions.',
    summarySw: 'Uharibifu vs uchakavu wa kawaida; ushahidi wa picha; kukata amana.',
    category: 'tenancy',
    prerequisites: ['deposit_structures'],
    bloomLevels: ['apply', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'eviction_process',
    titleEn: 'Eviction process (TZ)',
    titleSw: 'Mchakato wa kufukuza mpangaji (TZ)',
    summaryEn: 'Statutory notice → ward tribunal → court → enforcement.',
    summarySw: 'Notisi ya kisheria → baraza la kata → mahakama → utekelezaji.',
    category: 'tenancy',
    prerequisites: ['arrears_ladder', 'lease_renewal_options'],
    bloomLevels: ['analyze', 'evaluate'],
    difficulty: 'advanced',
  },
  // --- compliance
  {
    id: 'far_conditional_survey',
    titleEn: 'FAR conditional survey',
    titleSw: 'Uchunguzi wa FAR wa masharti',
    summaryEn: 'Periodic regulator survey; triggers, response deadlines.',
    summarySw: 'Uchunguzi wa mara kwa mara; visababishi na mwisho wa muda wa kujibu.',
    category: 'compliance',
    prerequisites: [],
    bloomLevels: ['remember', 'understand'],
    difficulty: 'intermediate',
  },
  {
    id: 'compliance_workflows',
    titleEn: 'Compliance workflows',
    titleSw: 'Mfumo wa utekelezaji wa sheria',
    summaryEn: 'Deadlines, evidence capture, regulator exports.',
    summarySw: 'Tarehe za mwisho, kukusanya ushahidi, kutuma kwa wadhibiti.',
    category: 'compliance',
    prerequisites: ['far_conditional_survey'],
    bloomLevels: ['apply', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'health_safety',
    titleEn: 'Health and safety obligations',
    titleSw: 'Majukumu ya afya na usalama',
    summaryEn: 'Fire safety, electrical inspections, water potability.',
    summarySw: 'Usalama wa moto, ukaguzi wa umeme, maji salama.',
    category: 'compliance',
    prerequisites: ['compliance_workflows'],
    bloomLevels: ['remember', 'apply'],
    difficulty: 'intermediate',
  },
  {
    id: 'data_protection',
    titleEn: 'Data protection (PDPA TZ)',
    titleSw: 'Ulinzi wa data (PDPA TZ)',
    summaryEn: 'Tenant PII handling, retention, subject-access requests.',
    summarySw: 'Kushughulikia taarifa za kibinafsi, kuhifadhi, maombi ya data.',
    category: 'compliance',
    prerequisites: ['compliance_workflows'],
    bloomLevels: ['understand', 'apply'],
    difficulty: 'advanced',
  },
  {
    id: 'landlord_register',
    titleEn: 'Landlord registration',
    titleSw: 'Usajili wa mwenye nyumba',
    summaryEn: 'Mandatory registration, annual renewal, penalties.',
    summarySw: 'Usajili wa lazima, urejeshaji wa kila mwaka, adhabu.',
    category: 'compliance',
    prerequisites: ['compliance_workflows'],
    bloomLevels: ['remember'],
    difficulty: 'beginner',
  },
  // --- maintenance
  {
    id: 'maintenance_triage',
    titleEn: 'Maintenance triage',
    titleSw: 'Utenganishaji wa kazi za matengenezo',
    summaryEn: 'Urgency tiers, SLA targets, vendor dispatch.',
    summarySw: 'Kiwango cha haraka, malengo ya SLA, kutuma fundi.',
    category: 'maintenance',
    prerequisites: [],
    bloomLevels: ['understand', 'apply'],
    difficulty: 'beginner',
  },
  {
    id: 'preventive_maintenance',
    titleEn: 'Preventive maintenance',
    titleSw: 'Matengenezo ya kuzuia',
    summaryEn: 'Scheduled checks for HVAC, plumbing, roofing.',
    summarySw: 'Ukaguzi wa kawaida wa hewa, mabomba, na paa.',
    category: 'maintenance',
    prerequisites: ['maintenance_triage'],
    bloomLevels: ['understand', 'apply'],
    difficulty: 'intermediate',
  },
  {
    id: 'vendor_management',
    titleEn: 'Vendor management',
    titleSw: 'Usimamizi wa wauzaji',
    summaryEn: 'Vetting, rate cards, quality scores, SLAs.',
    summarySw: 'Uchunguzi, viwango vya bei, alama za ubora, SLA.',
    category: 'maintenance',
    prerequisites: ['maintenance_triage'],
    bloomLevels: ['analyze', 'evaluate'],
    difficulty: 'intermediate',
  },
  {
    id: 'capex_planning',
    titleEn: 'CapEx planning',
    titleSw: 'Mipango ya matumizi makubwa',
    summaryEn: 'Component life-cycle, reserve fund, depreciation.',
    summarySw: 'Maisha ya vipengele, hifadhi ya fedha, kushuka kwa thamani.',
    category: 'maintenance',
    prerequisites: ['preventive_maintenance'],
    bloomLevels: ['analyze', 'evaluate', 'create'],
    difficulty: 'advanced',
  },
  {
    id: 'work_order_lifecycle',
    titleEn: 'Work-order lifecycle',
    titleSw: 'Mzunguko wa agizo la kazi',
    summaryEn: 'Created → assigned → in-progress → QA → closed.',
    summarySw: 'Kuumbwa → kugawiwa → inafanyika → uhakiki → kufungwa.',
    category: 'maintenance',
    prerequisites: ['maintenance_triage'],
    bloomLevels: ['remember', 'apply'],
    difficulty: 'beginner',
  },
  // --- operations
  {
    id: 'kyc_onboarding',
    titleEn: 'KYC onboarding',
    titleSw: 'Utambuzi wa wateja',
    summaryEn: 'Identity verification + sanctions screening for prospects.',
    summarySw: 'Uthibitishaji wa kitambulisho na uchunguzi wa vikwazo.',
    category: 'operations',
    prerequisites: [],
    bloomLevels: ['remember', 'apply'],
    difficulty: 'beginner',
  },
  {
    id: 'complaint_handling',
    titleEn: 'Complaint handling',
    titleSw: 'Kushughulikia malalamiko',
    summaryEn: 'Logging, SLAs, escalation, resolution communication.',
    summarySw: 'Kuandika, SLA, kupeleka juu, mawasiliano ya utatuzi.',
    category: 'operations',
    prerequisites: ['kyc_onboarding'],
    bloomLevels: ['apply', 'analyze'],
    difficulty: 'beginner',
  },
  {
    id: 'occupancy_management',
    titleEn: 'Occupancy management',
    titleSw: 'Usimamizi wa upangaji',
    summaryEn: 'Vacancy forecasting, marketing, turnover optimization.',
    summarySw: 'Utabiri wa vikao tupu, uuzaji, uboreshaji wa mabadiliko.',
    category: 'operations',
    prerequisites: ['tenant_screening'],
    bloomLevels: ['analyze', 'evaluate'],
    difficulty: 'intermediate',
  },
  {
    id: 'owner_reporting',
    titleEn: 'Owner reporting cadence',
    titleSw: 'Ratiba ya ripoti kwa mmiliki',
    summaryEn: 'Monthly statements, variance narratives, KPI packs.',
    summarySw: 'Taarifa za kila mwezi, maelezo ya tofauti, viashiria vya utendaji.',
    category: 'operations',
    prerequisites: ['gepg_reconciliation'],
    bloomLevels: ['analyze', 'evaluate', 'create'],
    difficulty: 'intermediate',
  },
  {
    id: 'dashboard_kpis',
    titleEn: 'Dashboard KPIs',
    titleSw: 'Viashiria vya dashibodi',
    summaryEn: 'Collections %, occupancy %, NOI, arrears aging.',
    summarySw: 'Asilimia ya makusanyo, upangaji, faida, umri wa madeni.',
    category: 'operations',
    prerequisites: ['owner_reporting'],
    bloomLevels: ['understand', 'analyze'],
    difficulty: 'intermediate',
  },
  {
    id: 'communication_playbooks',
    titleEn: 'Communication playbooks',
    titleSw: 'Vitabu vya mawasiliano',
    summaryEn: 'Scripts for arrears, renewal, maintenance, termination.',
    summarySw: 'Maandiko ya mazungumzo: madeni, kurejesha, matengenezo, kumaliza.',
    category: 'operations',
    prerequisites: ['complaint_handling'],
    bloomLevels: ['apply', 'create'],
    difficulty: 'intermediate',
  },
  {
    id: 'escalation_matrix',
    titleEn: 'Escalation matrix',
    titleSw: 'Mfumo wa kupeleka juu',
    summaryEn: 'Who gets notified at which severity and when.',
    summarySw: 'Ni nani anapata taarifa katika kila hatari na wakati gani.',
    category: 'operations',
    prerequisites: ['complaint_handling'],
    bloomLevels: ['apply', 'evaluate'],
    difficulty: 'intermediate',
  },
  {
    id: 'budget_vs_actual',
    titleEn: 'Budget vs actual analysis',
    titleSw: 'Uchambuzi wa bajeti na halisi',
    summaryEn: 'Monthly variance, root-cause narratives, forecast revisions.',
    summarySw: 'Tofauti ya mwezi, sababu za msingi, marekebisho ya utabiri.',
    category: 'operations',
    prerequisites: ['owner_reporting', 'dashboard_kpis'],
    bloomLevels: ['analyze', 'evaluate'],
    difficulty: 'advanced',
  },
  {
    id: 'incident_postmortem',
    titleEn: 'Incident postmortem',
    titleSw: 'Uchunguzi wa tukio',
    summaryEn: 'Timeline, root cause, preventive actions, lessons learned.',
    summarySw: 'Rahaishaji wa muda, sababu, hatua za kuzuia, mafunzo.',
    category: 'operations',
    prerequisites: ['escalation_matrix'],
    bloomLevels: ['analyze', 'evaluate', 'create'],
    difficulty: 'advanced',
  },
  {
    id: 'roi_lifecycle',
    titleEn: 'ROI lifecycle',
    titleSw: 'Mzunguko wa ROI',
    summaryEn: 'Acquisition → stabilisation → optimisation → disposal.',
    summarySw: 'Kununua → kuimarisha → kuboresha → kuuza.',
    category: 'operations',
    prerequisites: ['capex_planning', 'budget_vs_actual'],
    bloomLevels: ['analyze', 'evaluate', 'create'],
    difficulty: 'advanced',
  },
];

export function getConcept(id: string): Concept | null {
  return ESTATE_CONCEPTS.find((c) => c.id === id) ?? null;
}

/**
 * Return true if all prerequisites of `conceptId` appear in `mastered`.
 * Mastery is determined by the caller — this only checks edge coverage.
 */
export function prerequisitesMet(
  conceptId: string,
  mastered: readonly string[]
): boolean {
  const c = getConcept(conceptId);
  if (!c) return false;
  const set = new Set(mastered);
  return c.prerequisites.every((p) => set.has(p));
}

/**
 * Topologically sort a list of concept IDs so prerequisites always come
 * first. Pure — returns a new array.
 */
export function topoSortConcepts(ids: readonly string[]): readonly string[] {
  const wanted = new Set(ids);
  const visited = new Set<string>();
  const out: string[] = [];
  function visit(id: string): void {
    if (visited.has(id) || !wanted.has(id)) return;
    visited.add(id);
    const c = getConcept(id);
    if (!c) return;
    for (const p of c.prerequisites) visit(p);
    out.push(id);
  }
  for (const id of ids) visit(id);
  return out;
}
