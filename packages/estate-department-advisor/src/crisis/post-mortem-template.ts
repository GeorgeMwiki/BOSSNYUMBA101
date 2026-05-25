/**
 * post-mortem-template — adapted from Atlassian Incident Management
 * Handbook (open-source) for real-estate incidents.
 */

export const POSTMORTEM_TEMPLATE: ReadonlyArray<string> = [
  'Incident summary',
  'Trigger (what set off the response)',
  'Detection timeline (when, by whom, by what signal)',
  'Response timeline (every action with timestamp + owner)',
  'Root cause (5-whys analysis)',
  'Contributing factors (organisational / procedural / technical)',
  'Tenant impact (units affected, displaced, complaints filed)',
  'Owner / investor impact (capital, distribution, NAV)',
  'Financial impact (out-of-pocket + insurance recovery + lost rent)',
  'Regulatory / legal impact (filings made, hearings scheduled)',
  'What went well',
  'What needs improvement',
  'Action items (owner + due date + acceptance criteria)',
  'Follow-up review date (typical: 30 days)',
];
