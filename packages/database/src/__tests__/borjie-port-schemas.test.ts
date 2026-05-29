/**
 * Schema introspection tests for the Borjie port batch
 * (migrations 0274-0283).
 *
 * Validates Drizzle column declarations match migration shape +
 * bilingual sw/en labels exist where required + enum value sets
 * are sane. Runs without a database.
 */

import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import {
  marketingPilotApplications,
  PROPERTY_FOCUS_VALUES,
} from '../schemas/marketing-pilot-applications.schema.js';
import {
  onboardingState,
  ONBOARDING_STATUSES,
} from '../schemas/onboarding-state.schema.js';
import {
  regulatorJurisdictions,
  REGULATOR_SETS,
  REGULATOR_MANDATES,
} from '../schemas/regulator-jurisdictions.schema.js';
import {
  tabProposalsInbox,
  TAB_PROPOSAL_DETECTORS,
} from '../schemas/tab-proposals-inbox.schema.js';
import {
  corpusDocUploads,
  corpusDocSummaries,
  CORPUS_DOC_SOURCE_KINDS,
  CORPUS_DOC_STATUSES,
} from '../schemas/corpus-doc-uploads.schema.js';
import {
  requestForApplications,
  requestForApplicationResponses,
  RFA_STATUSES,
  RFA_PROPERTY_TYPES,
} from '../schemas/request-for-applications.schema.js';
import {
  moveInOutConditionReports,
  CONDITION_REPORT_KINDS,
  CONDITION_REPORT_STATUSES,
  CONDITION_REPORT_AUTHORITIES,
} from '../schemas/move-in-out-condition-reports.schema.js';
import {
  maintenanceTasks,
  maintenanceToolboxTalks,
  MAINTENANCE_TASK_CATEGORIES,
  MAINTENANCE_TASK_STATUSES,
} from '../schemas/maintenance-tasks.schema.js';

// ─────────────────────────────────────────────────────────────────────
// 0275 — marketing_pilot_applications
// ─────────────────────────────────────────────────────────────────────

describe('marketing_pilot_applications (0275)', () => {
  it('declares the canonical column set', () => {
    const cfg = getTableConfig(marketingPilotApplications);
    const names = cfg.columns.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        'acknowledged_at',
        'acknowledged_by',
        'company',
        'created_at',
        'email',
        'id',
        'metadata',
        'name',
        'phone',
        'portfolio_size',
        'property_focus',
        'source_ip',
        'user_agent',
      ].sort(),
    );
  });

  it('renamed mining_focus → property_focus + canonical enum', () => {
    expect(PROPERTY_FOCUS_VALUES).toContain('residential');
    expect(PROPERTY_FOCUS_VALUES).toContain('commercial');
    expect(PROPERTY_FOCUS_VALUES).toContain('mixed');
    expect(PROPERTY_FOCUS_VALUES).toContain('industrial');
    expect(PROPERTY_FOCUS_VALUES).toContain('student_housing');
    expect(PROPERTY_FOCUS_VALUES).toContain('vacation_rental');
    expect(PROPERTY_FOCUS_VALUES).not.toContain('mining');
    expect(PROPERTY_FOCUS_VALUES).not.toContain('gold');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0278 — onboarding_state
// ─────────────────────────────────────────────────────────────────────

describe('onboarding_state (0278)', () => {
  it('uses tenant_id as primary key (1 row per tenant)', () => {
    const cfg = getTableConfig(onboardingState);
    const pk = cfg.columns.find((c) => c.primary);
    expect(pk?.name).toBe('tenant_id');
  });

  it('status enum is pending/ready/demoed/dismissed', () => {
    expect([...ONBOARDING_STATUSES]).toEqual([
      'pending',
      'ready',
      'demoed',
      'dismissed',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0277 — regulator_jurisdictions
// ─────────────────────────────────────────────────────────────────────

describe('regulator_jurisdictions (0277)', () => {
  it('declares the canonical column set', () => {
    const cfg = getTableConfig(regulatorJurisdictions);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('country_code');
    expect(names).toContain('name_en');
    expect(names).toContain('name_local');
    expect(names).toContain('regulator_set');
    expect(names).toContain('mandate');
  });

  it('covers 9 real-estate regulator sets globally', () => {
    expect(REGULATOR_SETS).toContain('TZ-set');
    expect(REGULATOR_SETS).toContain('KE-set');
    expect(REGULATOR_SETS).toContain('UG-set');
    expect(REGULATOR_SETS).toContain('NG-set');
    expect(REGULATOR_SETS).toContain('ZA-set');
    expect(REGULATOR_SETS).toContain('UK-set');
    expect(REGULATOR_SETS).toContain('US-set');
    expect(REGULATOR_SETS).toContain('AU-set');
    expect(REGULATOR_SETS).toContain('generic');
    expect(REGULATOR_SETS.length).toBe(9);
  });

  it('mandates are real-estate-focused (no mining domain leakage)', () => {
    expect(REGULATOR_MANDATES).toContain('tenancy-tribunal');
    expect(REGULATOR_MANDATES).toContain('housing-authority');
    expect(REGULATOR_MANDATES).toContain('building-safety');
    expect(REGULATOR_MANDATES).toContain('property-tax');
    expect(REGULATOR_MANDATES).toContain('land-registry');
    expect(REGULATOR_MANDATES).toContain('rental-protection');
    expect(REGULATOR_MANDATES).toContain('hoa-strata');
    expect(REGULATOR_MANDATES).toContain('data-protection');
    expect(REGULATOR_MANDATES).not.toContain('mining-licensing');
    expect(REGULATOR_MANDATES).not.toContain('royalty');
    expect(REGULATOR_MANDATES).not.toContain('transparency-eiti');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0279 — tab_proposals_inbox
// ─────────────────────────────────────────────────────────────────────

describe('tab_proposals_inbox (0279)', () => {
  it('carries bilingual sw/en title + reason columns', () => {
    const cfg = getTableConfig(tabProposalsInbox);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('title_en');
    expect(names).toContain('title_sw');
    expect(names).toContain('reason_en');
    expect(names).toContain('reason_sw');
  });

  it('detector enum is real-estate-tailored (no mining branding)', () => {
    expect(TAB_PROPOSAL_DETECTORS).toContain('drill_down_repeat');
    expect(TAB_PROPOSAL_DETECTORS).toContain('navigation_loop');
    expect(TAB_PROPOSAL_DETECTORS).toContain('persona_escalation');
    expect(TAB_PROPOSAL_DETECTORS).toContain('manual');
    expect(TAB_PROPOSAL_DETECTORS).not.toContain('mwikila_escalation');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0280 — corpus_doc_uploads + corpus_doc_summaries
// ─────────────────────────────────────────────────────────────────────

describe('corpus_doc_uploads + corpus_doc_summaries (0280)', () => {
  it('source kinds cover the documents landlords upload', () => {
    expect(CORPUS_DOC_SOURCE_KINDS).toContain('pdf');
    expect(CORPUS_DOC_SOURCE_KINDS).toContain('photo');
    expect(CORPUS_DOC_SOURCE_KINDS).toContain('audio');
    expect(CORPUS_DOC_SOURCE_KINDS).toContain('csv');
    expect(CORPUS_DOC_SOURCE_KINDS).toContain('xlsx');
  });

  it('status lifecycle is pending → indexed (+ failed/redacted)', () => {
    expect(CORPUS_DOC_STATUSES).toContain('pending');
    expect(CORPUS_DOC_STATUSES).toContain('parsing');
    expect(CORPUS_DOC_STATUSES).toContain('chunking');
    expect(CORPUS_DOC_STATUSES).toContain('embedded');
    expect(CORPUS_DOC_STATUSES).toContain('indexed');
    expect(CORPUS_DOC_STATUSES).toContain('failed');
    expect(CORPUS_DOC_STATUSES).toContain('redacted');
  });

  it('summaries carry bilingual sw/en columns', () => {
    const cfg = getTableConfig(corpusDocSummaries);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('summary_md');
    expect(names).toContain('summary_en');
    expect(names).toContain('summary_sw');
  });

  it('uploads carry tenant + uploader + size + storage url', () => {
    const cfg = getTableConfig(corpusDocUploads);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('tenant_id');
    expect(names).toContain('uploaded_by_user_id');
    expect(names).toContain('size_bytes');
    expect(names).toContain('storage_url');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0281 — request_for_applications + responses
// ─────────────────────────────────────────────────────────────────────

describe('request_for_applications (0281)', () => {
  it('property type enum covers real-estate categories', () => {
    expect(RFA_PROPERTY_TYPES).toContain('residential');
    expect(RFA_PROPERTY_TYPES).toContain('commercial');
    expect(RFA_PROPERTY_TYPES).toContain('mixed');
    expect(RFA_PROPERTY_TYPES).toContain('industrial');
    expect(RFA_PROPERTY_TYPES).toContain('student_housing');
    expect(RFA_PROPERTY_TYPES).toContain('vacation_rental');
  });

  it('RFA status enum matches lifecycle open→filled/expired/cancelled', () => {
    expect([...RFA_STATUSES]).toEqual([
      'open',
      'filled',
      'expired',
      'cancelled',
    ]);
  });

  it('RFA columns shift mineral → property semantics', () => {
    const cfg = getTableConfig(requestForApplications);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('landlord_id');
    expect(names).toContain('property_type');
    expect(names).toContain('bedrooms_min');
    expect(names).toContain('rent_per_month');
    expect(names).toContain('available_from');
    expect(names).toContain('lease_term_months');
    expect(names).toContain('neighbourhood');
    expect(names).not.toContain('mineral_kind');
    expect(names).not.toContain('tonnage_min');
    expect(names).not.toContain('unit_price_tzs');
  });

  it('responses table carries applicant + offered_rent', () => {
    const cfg = getTableConfig(requestForApplicationResponses);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('applicant_id');
    expect(names).toContain('offered_rent');
    expect(names).toContain('move_in_by');
    expect(names).not.toContain('seller_id');
    expect(names).not.toContain('offered_tonnage');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0282 — move_in_out_condition_reports
// ─────────────────────────────────────────────────────────────────────

describe('move_in_out_condition_reports (0282)', () => {
  it('report kind covers move-in/out/mid-lease/damage/safety', () => {
    expect(CONDITION_REPORT_KINDS).toContain('move_in');
    expect(CONDITION_REPORT_KINDS).toContain('move_out');
    expect(CONDITION_REPORT_KINDS).toContain('mid_lease');
    expect(CONDITION_REPORT_KINDS).toContain('damage');
    expect(CONDITION_REPORT_KINDS).toContain('safety');
  });

  it('status lifecycle includes landlord + tenant double-sign', () => {
    expect(CONDITION_REPORT_STATUSES).toContain('draft');
    expect(CONDITION_REPORT_STATUSES).toContain('manager_ok');
    expect(CONDITION_REPORT_STATUSES).toContain('landlord_signed');
    expect(CONDITION_REPORT_STATUSES).toContain('tenant_signed');
    expect(CONDITION_REPORT_STATUSES).toContain('submitted');
    expect(CONDITION_REPORT_STATUSES).toContain('delivered');
    expect(CONDITION_REPORT_STATUSES).toContain('superseded');
  });

  it('authority enum covers real-estate authorities (no PCCB/NEMC/TMAA)', () => {
    expect(CONDITION_REPORT_AUTHORITIES).toContain('rht-za');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('tpos-uk');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('nsw-tribunal-au');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('deposit-scheme-uk');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('housing-tz');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('rent-tribunal-ke');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('lands-ministry-ug');
    expect(CONDITION_REPORT_AUTHORITIES).toContain('none');
    expect(CONDITION_REPORT_AUTHORITIES).not.toContain('pccb');
    expect(CONDITION_REPORT_AUTHORITIES).not.toContain('nemc');
    expect(CONDITION_REPORT_AUTHORITIES).not.toContain('tmaa');
  });

  it('carries bilingual sw/en draft columns', () => {
    const cfg = getTableConfig(moveInOutConditionReports);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('draft_md_sw');
    expect(names).toContain('draft_md_en');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 0283 — maintenance_tasks + toolbox_talks
// ─────────────────────────────────────────────────────────────────────

describe('maintenance_tasks + toolbox_talks (0283)', () => {
  it('category enum is real-estate maintenance (no mining)', () => {
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('plumbing');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('electrical');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('hvac');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('roofing');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('painting');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('landscaping');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('pest_control');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('cleaning');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('safety');
    expect(MAINTENANCE_TASK_CATEGORIES).toContain('inspection');
    expect(MAINTENANCE_TASK_CATEGORIES).not.toContain('drilling');
    expect(MAINTENANCE_TASK_CATEGORIES).not.toContain('blasting');
  });

  it('lifecycle states are sane', () => {
    expect(MAINTENANCE_TASK_STATUSES).toContain('pending');
    expect(MAINTENANCE_TASK_STATUSES).toContain('in_progress');
    expect(MAINTENANCE_TASK_STATUSES).toContain('done');
    expect(MAINTENANCE_TASK_STATUSES).toContain('blocked');
    expect(MAINTENANCE_TASK_STATUSES).toContain('cancelled');
  });

  it('tasks carry building_id (real-estate scope, not site_id)', () => {
    const cfg = getTableConfig(maintenanceTasks);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('building_id');
    expect(names).not.toContain('site_id');
  });

  it('toolbox talks scope to building_id + bilingual topic', () => {
    const cfg = getTableConfig(maintenanceToolboxTalks);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toContain('building_id');
    expect(names).toContain('topic_sw');
    expect(names).toContain('topic_en');
    expect(names).not.toContain('site_id');
  });
});
