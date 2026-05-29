/**
 * Public-facing MCP tool catalog.
 *
 * Each entry mirrors a brain tool that already exists in the api-gateway
 * brain-tools composition (owned by sibling agents). We deliberately do
 * NOT import the brain-tools package here — that would couple the public
 * MCP surface to the internal kernel and force a redeploy of this service
 * every time a brain tool changes. Instead we publish a curated, stable
 * tool catalog: each entry has a name, a description, a JSON schema, the
 * required scopes, and the stakes tier. The handler dispatches by HTTP
 * to the corresponding `/api/v1/...` route exposed by api-gateway, which
 * in turn invokes the same brain-tool the home chat calls.
 *
 * This separation lets us:
 *   - Document a stable public catalog (versioned, semver-disciplined)
 *     without leaking internal kernel churn.
 *   - Enforce scope-narrowing here without re-implementing it in every
 *     brain-tool descriptor.
 *   - Render `tools/list` with bilingual descriptions even when the
 *     underlying brain tool has English-only descriptions internally.
 */

import type { BossNyumbaMcpToolDescriptor } from './types.js';

const obj = <T>(v: T): T => Object.freeze(v) as T;
const arr = <T>(v: ReadonlyArray<T>): ReadonlyArray<T> => Object.freeze(v);

// ─────────────────────────────────────────────────────────────────────
// property.drafts.* — draft composition + lock
// ─────────────────────────────────────────────────────────────────────

const draftsComposeFreeForm: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_drafts_compose_free_form',
  description:
    'Compose a free-form draft (memo, contract clause, letter, report section). Returns a draft id and the first revision content. Bilingual sw / en. Sw default.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      intent: obj({
        type: 'string' as const,
        description: 'Plain-language intent ("draft a 30-day NDA for X").',
      }),
      locale: obj({
        type: 'string' as const,
        enum: arr(['sw', 'en']),
        description: 'Target locale (default sw).',
      }),
      format: obj({
        type: 'string' as const,
        enum: arr(['markdown', 'pdf', 'docx']),
        description: 'Output format (default markdown).',
      }),
    }),
    required: arr(['intent']),
  }),
  requiredScopes: arr(['owner:draft']),
  stakes: 'MEDIUM',
  isWrite: true,
  requiresConfirmation: false,
});

const draftsList: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_drafts_list',
  description:
    'List the owner s drafts with pagination. Includes lock status and last revision summary.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      cursor: obj({ type: 'string' as const }),
      limit: obj({ type: 'number' as const }),
    }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const draftsView: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_drafts_view',
  description: 'View a single draft with all its revisions and lock status.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({ id: obj({ type: 'string' as const }) }),
    required: arr(['id']),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const draftsLock: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_drafts_lock',
  description:
    'Lock a draft revision making it immutable. Requires confirmation.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      revisionId: obj({ type: 'string' as const }),
      reason: obj({ type: 'string' as const }),
    }),
    required: arr(['revisionId']),
  }),
  requiredScopes: arr(['owner:draft']),
  stakes: 'HIGH',
  isWrite: true,
  requiresConfirmation: true,
});

// ─────────────────────────────────────────────────────────────────────
// property.media.* — media generation
// ─────────────────────────────────────────────────────────────────────

const mediaGenerate: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_media_generate',
  description:
    'Generate a media artefact (chart, image, infographic) tied to an entity.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      entityRef: obj({ type: 'string' as const }),
      kind: obj({
        type: 'string' as const,
        enum: arr(['chart', 'image', 'infographic']),
      }),
      prompt: obj({ type: 'string' as const }),
    }),
    required: arr(['kind', 'prompt']),
  }),
  requiredScopes: arr(['owner:write']),
  stakes: 'MEDIUM',
  isWrite: true,
  requiresConfirmation: false,
});

// ─────────────────────────────────────────────────────────────────────
// property.ui.* — tab spawning, pinning
// ─────────────────────────────────────────────────────────────────────

const uiTabsList: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_ui_tabs_list',
  description: 'List the owner s open cockpit tabs.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const uiTabsSpawn: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_ui_tabs_spawn',
  description: 'Spawn a new cockpit tab of a given kind.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      kind: obj({ type: 'string' as const }),
      params: obj({ type: 'object' as const }),
    }),
    required: arr(['kind']),
  }),
  requiredScopes: arr(['owner:reminders']),
  stakes: 'LOW',
  isWrite: true,
  requiresConfirmation: false,
});

// ─────────────────────────────────────────────────────────────────────
// property.opportunities.* + property.risks.*
// ─────────────────────────────────────────────────────────────────────

const opportunitiesScan: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_opportunities_scan',
  description:
    'Scan the estate for opportunities (price-arbitrage, buyer-fit, settlement timing).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({ scope: obj({ type: 'string' as const }) }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const risksScan: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_risks_scan',
  description:
    'Scan the estate for risks (compliance, financial, safety, geological).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({ scope: obj({ type: 'string' as const }) }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

// ─────────────────────────────────────────────────────────────────────
// property.calibration.* + decisions.* + entity.*
// ─────────────────────────────────────────────────────────────────────

const calibrationStatus: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_calibration_status',
  description:
    'Read the calibration monitor s current state (over- / under-confidence per persona).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const decisionsList: BossNyumbaMcpToolDescriptor = obj({
  name: 'decisions_list',
  description:
    'List recent decision-journal entries with their retrospection ratings.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      since: obj({ type: 'string' as const, format: 'date-time' }),
      limit: obj({ type: 'number' as const }),
    }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const decisionsCreate: BossNyumbaMcpToolDescriptor = obj({
  name: 'decisions_create',
  description:
    'Log a decision in the journal. Optional `expectedOutcome` powers the 24h retrospective worker.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      title: obj({ type: 'string' as const }),
      rationale: obj({ type: 'string' as const }),
      expectedOutcome: obj({ type: 'string' as const }),
      stakes: obj({
        type: 'string' as const,
        enum: arr(['LOW', 'MEDIUM', 'HIGH']),
      }),
    }),
    required: arr(['title', 'rationale']),
  }),
  requiredScopes: arr(['owner:write']),
  stakes: 'MEDIUM',
  isWrite: true,
  requiresConfirmation: false,
});

const entityIndexSummary: BossNyumbaMcpToolDescriptor = obj({
  name: 'entity_index_summary',
  description:
    'Return a compact summary of the owner s estate entities (sites, scopes, licences, buyers). Repomap-equivalent.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

// ─────────────────────────────────────────────────────────────────────
// scope.* + md.* + property.listings.* + maintenance + inspections + occupancy
// ─────────────────────────────────────────────────────────────────────

const scopeNodesList: BossNyumbaMcpToolDescriptor = obj({
  name: 'scope_nodes_list',
  description: 'List the owner s scope nodes (sites, plots, pits, processing).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const scopeNodesCreate: BossNyumbaMcpToolDescriptor = obj({
  name: 'scope_nodes_create',
  description: 'Create a new scope node attached to an existing parent.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      name: obj({ type: 'string' as const }),
      kind: obj({
        type: 'string' as const,
        enum: arr(['site', 'plot', 'pit', 'processing']),
      }),
      parentId: obj({ type: 'string' as const }),
    }),
    required: arr(['name', 'kind']),
  }),
  requiredScopes: arr(['owner:write']),
  stakes: 'MEDIUM',
  isWrite: true,
  requiresConfirmation: false,
});

const mdDailyBrief: BossNyumbaMcpToolDescriptor = obj({
  name: 'md_daily_brief',
  description:
    'Read Mr. Mwikila s daily brief — occupancy, cash, incident, licence countdown.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      asOfDate: obj({ type: 'string' as const, format: 'date' }),
      locale: obj({ type: 'string' as const, enum: arr(['sw', 'en']) }),
    }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const listingsListings: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_listings_listings',
  description: 'List buyer-facing listings listings for the owner s estate.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const maintenanceList: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_maintenance_list',
  description:
    'List active maintenance members with their roles and certifications.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({ scope: obj({ type: 'string' as const }) }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const inspectionsSamples: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_inspections_samples',
  description: 'List inspections samples captured for the owner s scopes.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({ scopeId: obj({ type: 'string' as const }) }),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const occupancyToday: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_occupancy_today',
  description:
    'Today s occupancy summary (tonnes, grade, recovery, dispatched units).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const landlordsList: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_landlords_list',
  description: 'List cooperative settlements (incoming and outgoing).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const insurancePolicies: BossNyumbaMcpToolDescriptor = obj({
  name: 'property_insurance_policies',
  description: 'List active insurance policies covering the estate.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const messagingThreads: BossNyumbaMcpToolDescriptor = obj({
  name: 'owner_messaging_threads',
  description: 'List the owner s active messaging threads.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const complianceStatus: BossNyumbaMcpToolDescriptor = obj({
  name: 'compliance_status',
  description:
    'Read the compliance posture (PCCB / PDPA / FAR) for the owner s estate.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const estateNetWorth: BossNyumbaMcpToolDescriptor = obj({
  name: 'estate_net_worth',
  description:
    'Read the estate-wide net-worth snapshot (assets, liabilities, equity, currency mix).',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const shareLinkCreate: BossNyumbaMcpToolDescriptor = obj({
  name: 'estate_share_link_create',
  description:
    'Generate a time-boxed share link for an entity. Returns the URL and expiry.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      entityRef: obj({ type: 'string' as const }),
      hours: obj({ type: 'number' as const }),
      recipientEmail: obj({ type: 'string' as const }),
    }),
    required: arr(['entityRef']),
  }),
  requiredScopes: arr(['owner:share']),
  stakes: 'MEDIUM',
  isWrite: true,
  requiresConfirmation: false,
});

const remindersList: BossNyumbaMcpToolDescriptor = obj({
  name: 'reminders_list',
  description: 'List the owner s active reminders.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:read']),
  stakes: 'LOW',
  isWrite: false,
  requiresConfirmation: false,
});

const remindersCreate: BossNyumbaMcpToolDescriptor = obj({
  name: 'reminders_create',
  description: 'Create a reminder firing at a specific time.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({
      at: obj({ type: 'string' as const, format: 'date-time' }),
      body: obj({ type: 'string' as const }),
    }),
    required: arr(['at', 'body']),
  }),
  requiredScopes: arr(['owner:reminders']),
  stakes: 'LOW',
  isWrite: true,
  requiresConfirmation: false,
});

const undoLast: BossNyumbaMcpToolDescriptor = obj({
  name: 'owner_undo_last',
  description: 'Undo the most recent action within the undo window.',
  inputSchema: obj({
    type: 'object' as const,
    properties: obj({}),
    required: arr([]),
  }),
  requiredScopes: arr(['owner:write']),
  stakes: 'HIGH',
  isWrite: true,
  requiresConfirmation: true,
});

export const BOSSNYUMBA_PUBLIC_MCP_TOOLS: ReadonlyArray<BossNyumbaMcpToolDescriptor> =
  Object.freeze([
    draftsComposeFreeForm,
    draftsList,
    draftsView,
    draftsLock,
    mediaGenerate,
    uiTabsList,
    uiTabsSpawn,
    opportunitiesScan,
    risksScan,
    calibrationStatus,
    decisionsList,
    decisionsCreate,
    entityIndexSummary,
    scopeNodesList,
    scopeNodesCreate,
    mdDailyBrief,
    listingsListings,
    maintenanceList,
    inspectionsSamples,
    occupancyToday,
    landlordsList,
    insurancePolicies,
    messagingThreads,
    complianceStatus,
    estateNetWorth,
    shareLinkCreate,
    remindersList,
    remindersCreate,
    undoLast,
  ]);

export function findPublicTool(
  name: string,
): BossNyumbaMcpToolDescriptor | undefined {
  return BOSSNYUMBA_PUBLIC_MCP_TOOLS.find((t) => t.name === name);
}
