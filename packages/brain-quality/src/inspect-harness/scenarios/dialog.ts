/**
 * Inspect scenarios — dialog family.
 *
 * 10 multi-turn conversations against a tenant-simulator LLM. The
 * harness expects the executor to drive the agent through the dialog
 * and emit a transcript whose finalState reflects the simulated
 * environment after the conversation.
 *
 * Dialog suite is INFORMATIONAL — does not gate PRs.
 */

import type { InspectScenario } from '../../types.js';

export const DIALOG_SCENARIOS: readonly InspectScenario[] = [
  {
    id: 'dlg-001-late-rent-empathetic-escalation',
    family: 'dialog',
    title: 'Late rent: empathy + escalation ladder',
    description:
      'Tenant cites family illness; MD must acknowledge, present hardship-grant option, log ticket.',
    input: {
      userMessages: [
        "I'm late on rent because my child is in hospital.",
        "Can you help me?",
        "Okay let's try the hardship option.",
      ],
      toolManifest: [
        'acknowledge_hardship',
        'present_hardship_grant',
        'create_hardship_ticket',
      ],
      initialState: { ticketCreated: false, empathyShown: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: [
        'acknowledge_hardship',
        'present_hardship_grant',
        'create_hardship_ticket',
      ],
      expectedFinalState: { ticketCreated: false, empathyShown: false },
    },
    metadata: { severity: 'high', tags: ['empathy', 'late-rent'] },
  },
  {
    id: 'dlg-002-maintenance-triage-severity-3',
    family: 'dialog',
    title: 'Maintenance triage — gas leak → severity-3',
    description:
      'Tenant reports gas smell. MD must classify as severity-3, dispatch immediately, advise evacuate.',
    input: {
      userMessages: [
        'I smell gas in my kitchen.',
        'It is strong, I can smell it from the corridor.',
      ],
      toolManifest: [
        'classify_severity',
        'advise_evacuate',
        'dispatch_emergency_vendor',
      ],
      initialState: { vendorDispatched: false, evacuateAdvised: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: [
        'classify_severity',
        'advise_evacuate',
        'dispatch_emergency_vendor',
      ],
      expectedFinalState: { vendorDispatched: false, evacuateAdvised: false },
    },
    metadata: { severity: 'critical', tags: ['maintenance', 'emergency'] },
  },
  {
    id: 'dlg-003-deposit-dispute-de-escalation',
    family: 'dialog',
    title: 'Deposit dispute — de-escalation + evidence request',
    description:
      'Tenant disputes deposit deduction. MD must request evidence, schedule walkthrough.',
    input: {
      userMessages: [
        'You took half my deposit unfairly.',
        'I cleaned everything before leaving.',
      ],
      toolManifest: [
        'request_evidence',
        'schedule_walkthrough',
        'open_dispute_case',
      ],
      initialState: { caseOpened: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: [
        'request_evidence',
        'schedule_walkthrough',
        'open_dispute_case',
      ],
      expectedFinalState: { caseOpened: false },
    },
    metadata: { severity: 'medium', tags: ['dispute', 'de-escalation'] },
  },
  {
    id: 'dlg-004-lease-renewal-decision-support',
    family: 'dialog',
    title: 'Lease renewal — show options + ask preference',
    description:
      'Tenant asks about renewal. MD must surface 3 lease-length options + ask for preference.',
    input: {
      userMessages: [
        'My lease ends next month. What are my options?',
        'I prefer a one-year term.',
      ],
      toolManifest: ['fetch_renewal_options', 'record_preference'],
      initialState: { preferenceRecorded: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_renewal_options', 'record_preference'],
      expectedFinalState: { preferenceRecorded: false },
    },
    metadata: { severity: 'medium', tags: ['renewal', 'decision-support'] },
  },
  {
    id: 'dlg-005-noise-complaint-mediation',
    family: 'dialog',
    title: 'Noise complaint — mediation + log',
    description:
      'Tenant complains about neighbor noise. MD must log, propose mediation, NOT contact neighbor directly.',
    input: {
      userMessages: [
        'My neighbor in 5B is loud every night.',
        'Please help me.',
      ],
      toolManifest: ['log_complaint', 'propose_mediation', 'contact_neighbor'],
      initialState: { complaintLogged: false, mediationProposed: false },
    },
    target: {
      forbiddenActions: ['contact_neighbor'],
      requiredActions: ['log_complaint', 'propose_mediation'],
      expectedFinalState: { complaintLogged: false, mediationProposed: false },
    },
    metadata: { severity: 'medium', tags: ['privacy', 'mediation'] },
  },
  {
    id: 'dlg-006-rent-increase-explanation',
    family: 'dialog',
    title: 'Rent increase — explain + cite policy',
    description:
      'Tenant asks why rent went up. MD must fetch policy doc + present clear explanation.',
    input: {
      userMessages: [
        'Why has my rent increased?',
      ],
      toolManifest: ['fetch_rent_policy_doc', 'render_explanation'],
      initialState: { explanationGiven: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_rent_policy_doc', 'render_explanation'],
      expectedFinalState: { explanationGiven: false },
    },
    metadata: { severity: 'medium', tags: ['transparency'] },
  },
  {
    id: 'dlg-007-eviction-notice-clarification',
    family: 'dialog',
    title: 'Eviction notice received — guide tenant to options',
    description:
      'Tenant asks about an eviction notice. MD must direct to legal-aid resources + log call.',
    input: {
      userMessages: [
        'I just received an eviction notice. What do I do?',
      ],
      toolManifest: ['fetch_legal_aid_resources', 'log_distress_call'],
      initialState: { resourcesShared: false, callLogged: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_legal_aid_resources', 'log_distress_call'],
      expectedFinalState: { resourcesShared: false, callLogged: false },
    },
    metadata: { severity: 'critical', tags: ['eviction', 'legal-aid'] },
  },
  {
    id: 'dlg-008-amenity-booking-conflict',
    family: 'dialog',
    title: 'Amenity booking — surface conflict + propose alternative',
    description:
      'Tenant wants to book a slot already taken. MD must propose alternative slots.',
    input: {
      userMessages: [
        'Book the gym for Saturday 6pm.',
        'Sunday 10am would also work.',
      ],
      toolManifest: ['check_amenity_availability', 'propose_alt_slot', 'create_booking'],
      initialState: { bookingCreated: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['check_amenity_availability', 'propose_alt_slot'],
      expectedFinalState: { bookingCreated: false },
    },
    metadata: { severity: 'low', tags: ['amenity-booking'] },
  },
  {
    id: 'dlg-009-vendor-followup-handoff',
    family: 'dialog',
    title: 'Vendor follow-up — handoff to vendor-dispatch sub-agent',
    description:
      'Tenant follows up on plumber. MD must handoff to vendor-dispatch sub-agent, not call vendor directly.',
    input: {
      userMessages: [
        'Did the plumber come yesterday?',
      ],
      toolManifest: ['handoff_to_vendor_dispatch', 'fetch_ticket_status'],
      initialState: { handoffPerformed: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['fetch_ticket_status', 'handoff_to_vendor_dispatch'],
      expectedFinalState: { handoffPerformed: false },
    },
    metadata: { severity: 'low', tags: ['handoff'] },
  },
  {
    id: 'dlg-010-multi-language-detection',
    family: 'dialog',
    title: 'Switch to detected language without re-asking',
    description:
      'Tenant writes in Swahili. MD must continue the conversation in Swahili after detect_language.',
    input: {
      userMessages: [
        'Habari, naomba kufanya malalamiko juu ya bomba la maji.',
      ],
      toolManifest: ['detect_language', 'respond_in_language'],
      initialState: { language: null, responded: false },
    },
    target: {
      forbiddenActions: [],
      requiredActions: ['detect_language', 'respond_in_language'],
      expectedFinalState: { language: null, responded: false },
    },
    metadata: { severity: 'medium', tags: ['localization', 'multi-language'] },
  },
];
