/**
 * Persona catalog — the default roster of personae that ship with the Brain.
 *
 * Every tenant gets this catalog at onboarding. Tenants may customize
 * visibility / tools / advisor gates via overrides in the tenant settings,
 * but the catalog is the known-good baseline.
 */

import { Persona, PERSONA_IDS } from './persona.js';
import { RiskLevel } from '../types/core.types.js';
import {
  ESTATE_MANAGER_PROMPT,
  JUNIOR_LEASING_PROMPT,
  JUNIOR_MAINTENANCE_PROMPT,
  JUNIOR_FINANCE_PROMPT,
  JUNIOR_COMPLIANCE_PROMPT,
  JUNIOR_COMMUNICATIONS_PROMPT,
  COWORKER_PROMPT,
  MIGRATION_WIZARD_PROMPT,
} from './system-prompts.js';

/**
 * Tool names — match `graph-agent-toolkit` and the skills module.
 * Kept as string literals here to avoid a build-time dependency on graph-sync.
 */
const GRAPH_TOOLS = {
  GET_CASE_TIMELINE: 'get_case_timeline',
  GET_TENANT_RISK_DRIVERS: 'get_tenant_risk_drivers',
  GET_VENDOR_SCORECARD: 'get_vendor_scorecard',
  GET_UNIT_HEALTH: 'get_unit_health',
  GET_PARCEL_COMPLIANCE: 'get_parcel_compliance',
  GET_PROPERTY_ROLLUP: 'get_property_rollup',
  GENERATE_EVIDENCE_PACK: 'generate_evidence_pack',
  GET_PORTFOLIO_OVERVIEW: 'get_portfolio_overview',
  GET_GRAPH_STATS: 'get_graph_stats',
} as const;

const SKILLS = {
  MPESA_RECONCILE: 'skill.kenya.mpesa_reconcile',
  KRA_RENTAL_SUMMARY: 'skill.kenya.kra_rental_summary',
  SERVICE_CHARGE_RECONCILE: 'skill.kenya.service_charge_reconcile',
  SWAHILI_DRAFT: 'skill.kenya.swahili_draft',
  ASSIGN_TO_TEAM_MEMBER: 'skill.hr.assign_to_team_member',
  DRAFT_OWNER_STATEMENT: 'skill.finance.draft_owner_statement',
  DRAFT_ARREARS_NOTICE: 'skill.finance.draft_arrears_notice',
  LEASE_ABSTRACT: 'skill.leasing.abstract',
  RENEWAL_PROPOSE: 'skill.leasing.renewal_propose',
  TRIAGE_MAINTENANCE: 'skill.maintenance.triage',
  ASSIGN_WORK_ORDER: 'skill.maintenance.assign_work_order',
  DRAFT_TENANT_NOTICE: 'skill.comms.draft_tenant_notice',
  DRAFT_CAMPAIGN: 'skill.comms.draft_campaign',
  MIGRATION_EXTRACT: 'skill.migration.extract',
  MIGRATION_DIFF: 'skill.migration.diff',
  MIGRATION_COMMIT: 'skill.migration.commit',
  ADVISE: 'skill.core.advise',
} as const;

/**
 * Estate Manager — admin-facing brain.
 */
export const ESTATE_MANAGER_TEMPLATE: Persona = {
  id: PERSONA_IDS.ESTATE_MANAGER,
  kind: 'manager',
  displayName: 'BossNyumba Estate Manager',
  missionStatement:
    'Run the estate business on behalf of the admin — plan, delegate, report.',
  systemPrompt: ESTATE_MANAGER_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_PORTFOLIO_OVERVIEW,
    GRAPH_TOOLS.GET_PROPERTY_ROLLUP,
    GRAPH_TOOLS.GET_TENANT_RISK_DRIVERS,
    GRAPH_TOOLS.GET_UNIT_HEALTH,
    GRAPH_TOOLS.GET_CASE_TIMELINE,
    GRAPH_TOOLS.GET_PARCEL_COMPLIANCE,
    GRAPH_TOOLS.GET_GRAPH_STATS,
    SKILLS.ADVISE,
  ],
  defaultContextTools: [
    GRAPH_TOOLS.GET_PORTFOLIO_OVERVIEW,
  ],
  visibilityBudget: 'management',
  defaultVisibility: 'management',
  modelTier: 'standard',
  advisorEnabled: true,
  advisorHardCategories: [
    'lease_interpretation',
    'large_financial_posting',
    'tenant_termination',
    'compliance_ruling',
  ],
  minReviewRiskLevel: RiskLevel.MEDIUM,
  delegatesTo: [
    PERSONA_IDS.JUNIOR_LEASING,
    PERSONA_IDS.JUNIOR_MAINTENANCE,
    PERSONA_IDS.JUNIOR_FINANCE,
    PERSONA_IDS.JUNIOR_COMPLIANCE,
    PERSONA_IDS.JUNIOR_COMMUNICATIONS,
    PERSONA_IDS.MIGRATION_WIZARD,
  ],
};

export const JUNIOR_LEASING_TEMPLATE: Persona = {
  id: PERSONA_IDS.JUNIOR_LEASING,
  kind: 'junior',
  displayName: 'Leasing Junior',
  missionStatement:
    'Domain expert for leasing: applicants, viewings, lease drafting, renewals, move-in/move-out.',
  systemPrompt: JUNIOR_LEASING_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_PROPERTY_ROLLUP,
    GRAPH_TOOLS.GET_UNIT_HEALTH,
    GRAPH_TOOLS.GET_TENANT_RISK_DRIVERS,
    SKILLS.LEASE_ABSTRACT,
    SKILLS.RENEWAL_PROPOSE,
    SKILLS.ASSIGN_TO_TEAM_MEMBER,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'team',
  defaultVisibility: 'team',
  modelTier: 'standard',
  advisorEnabled: true,
  advisorHardCategories: ['lease_interpretation', 'legal_drafting'],
  minReviewRiskLevel: RiskLevel.HIGH,
};

export const JUNIOR_MAINTENANCE_TEMPLATE: Persona = {
  id: PERSONA_IDS.JUNIOR_MAINTENANCE,
  kind: 'junior',
  displayName: 'Maintenance Junior',
  missionStatement:
    'Domain expert for maintenance: triage, dispatch, vendor management, emergencies.',
  systemPrompt: JUNIOR_MAINTENANCE_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_UNIT_HEALTH,
    GRAPH_TOOLS.GET_VENDOR_SCORECARD,
    SKILLS.TRIAGE_MAINTENANCE,
    SKILLS.ASSIGN_WORK_ORDER,
    SKILLS.ASSIGN_TO_TEAM_MEMBER,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'team',
  defaultVisibility: 'team',
  modelTier: 'standard',
  advisorEnabled: true,
  advisorHardCategories: ['irreversible_action'],
  minReviewRiskLevel: RiskLevel.MEDIUM,
};

export const JUNIOR_FINANCE_TEMPLATE: Persona = {
  id: PERSONA_IDS.JUNIOR_FINANCE,
  kind: 'junior',
  displayName: 'Finance Junior',
  missionStatement:
    'Domain expert for finance: ledger, arrears, owner statements, M-Pesa, KRA, service charge.',
  systemPrompt: JUNIOR_FINANCE_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_PROPERTY_ROLLUP,
    GRAPH_TOOLS.GET_PORTFOLIO_OVERVIEW,
    GRAPH_TOOLS.GET_TENANT_RISK_DRIVERS,
    SKILLS.MPESA_RECONCILE,
    SKILLS.KRA_RENTAL_SUMMARY,
    SKILLS.SERVICE_CHARGE_RECONCILE,
    SKILLS.DRAFT_OWNER_STATEMENT,
    SKILLS.DRAFT_ARREARS_NOTICE,
    SKILLS.ASSIGN_TO_TEAM_MEMBER,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'management',
  defaultVisibility: 'team',
  modelTier: 'standard',
  advisorEnabled: true,
  advisorHardCategories: [
    'large_financial_posting',
    'irreversible_action',
  ],
  minReviewRiskLevel: RiskLevel.HIGH,
};

export const JUNIOR_COMPLIANCE_TEMPLATE: Persona = {
  id: PERSONA_IDS.JUNIOR_COMPLIANCE,
  kind: 'junior',
  displayName: 'Compliance Junior',
  missionStatement:
    'Domain expert for compliance: DPA 2019, KRA, landlord-tenant law, cases, evidence packs.',
  systemPrompt: JUNIOR_COMPLIANCE_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_PARCEL_COMPLIANCE,
    GRAPH_TOOLS.GET_CASE_TIMELINE,
    GRAPH_TOOLS.GENERATE_EVIDENCE_PACK,
    GRAPH_TOOLS.GET_TENANT_RISK_DRIVERS,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'management',
  defaultVisibility: 'management',
  modelTier: 'advanced', // Compliance drafts go straight to Opus by default.
  advisorEnabled: true,
  advisorHardCategories: [
    'compliance_ruling',
    'legal_drafting',
    'tenant_termination',
  ],
  minReviewRiskLevel: RiskLevel.HIGH,
};

export const JUNIOR_COMMUNICATIONS_TEMPLATE: Persona = {
  id: PERSONA_IDS.JUNIOR_COMMUNICATIONS,
  kind: 'junior',
  displayName: 'Communications Junior',
  missionStatement:
    'Domain expert for tenant/owner communications — notices, replies, campaigns, Swahili-first.',
  systemPrompt: JUNIOR_COMMUNICATIONS_PROMPT,
  allowedTools: [
    SKILLS.DRAFT_TENANT_NOTICE,
    SKILLS.DRAFT_CAMPAIGN,
    SKILLS.SWAHILI_DRAFT,
    SKILLS.ASSIGN_TO_TEAM_MEMBER,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'team',
  defaultVisibility: 'team',
  modelTier: 'basic', // Haiku is sufficient for most drafts; advisor for policy-sensitive.
  advisorEnabled: true,
  advisorHardCategories: ['legal_drafting', 'tenant_termination'],
  minReviewRiskLevel: RiskLevel.MEDIUM,
};

export const COWORKER_TEMPLATE: Persona = {
  id: PERSONA_IDS.COWORKER_FAMILY,
  kind: 'coworker',
  displayName: 'Your Coworker',
  missionStatement:
    'Private coworker for a single employee — help, teach, draft, report only when asked.',
  systemPrompt: COWORKER_PROMPT,
  allowedTools: [
    GRAPH_TOOLS.GET_UNIT_HEALTH,
    GRAPH_TOOLS.GET_CASE_TIMELINE,
    SKILLS.SWAHILI_DRAFT,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'team', // cannot publish wider than team
  defaultVisibility: 'private', // default private
  modelTier: 'basic', // Haiku with Opus advisor
  advisorEnabled: true,
  advisorHardCategories: [
    'lease_interpretation',
    'compliance_ruling',
    'irreversible_action',
  ],
  minReviewRiskLevel: RiskLevel.MEDIUM,
};

export const MIGRATION_WIZARD_TEMPLATE: Persona = {
  id: PERSONA_IDS.MIGRATION_WIZARD,
  kind: 'utility',
  displayName: 'Migration Wizard',
  missionStatement:
    'Chat-first onboarding: extract, normalize, diff, and commit legacy data with admin review.',
  systemPrompt: MIGRATION_WIZARD_PROMPT,
  allowedTools: [
    SKILLS.MIGRATION_EXTRACT,
    SKILLS.MIGRATION_DIFF,
    SKILLS.MIGRATION_COMMIT,
    SKILLS.ADVISE,
  ],
  visibilityBudget: 'management',
  defaultVisibility: 'management',
  modelTier: 'standard',
  advisorEnabled: true,
  advisorHardCategories: ['irreversible_action'],
  minReviewRiskLevel: RiskLevel.HIGH,
};

/**
 * All template personae that ship with BossNyumba by default.
 */
export const DEFAULT_PERSONAE: Persona[] = [
  ESTATE_MANAGER_TEMPLATE,
  JUNIOR_LEASING_TEMPLATE,
  JUNIOR_MAINTENANCE_TEMPLATE,
  JUNIOR_FINANCE_TEMPLATE,
  JUNIOR_COMPLIANCE_TEMPLATE,
  JUNIOR_COMMUNICATIONS_TEMPLATE,
  COWORKER_TEMPLATE,
  MIGRATION_WIZARD_TEMPLATE,
];

export const TOOL_IDS = { ...GRAPH_TOOLS, ...SKILLS };
