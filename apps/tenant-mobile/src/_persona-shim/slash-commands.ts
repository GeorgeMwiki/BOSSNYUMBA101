/**
 * Slash-command catalog — per-role command set surfaced by the mobile
 * composer's `/` menu. The brain ultimately routes the typed slug to
 * the matching persona-gated tool; this catalog drives ONLY the menu
 * rendering, not the tool execution path.
 *
 * Each command carries:
 *   - id         the slash token (after the leading `/`)
 *   - label      bilingual sw/en (chooses on locale)
 *   - hint       bilingual sw/en short caption
 *   - personaSlugs personas allowed to invoke this command
 *
 * The brain resolves the command id to the tool id via the persona's
 * `toolCatalogIds`. Adding a command here does NOT grant access — the
 * persona must already be allowed to call the tool.
 *
 * 5–8 commands per role per the brief.
 */

export interface MobileSlashCommand {
  readonly id: string;
  readonly label: { readonly en: string; readonly sw: string };
  readonly hint: { readonly en: string; readonly sw: string };
  readonly personaSlugs: ReadonlyArray<string>;
}

const OWNER: ReadonlyArray<string> = ['T1_owner_strategist'];
const MANAGER: ReadonlyArray<string> = [
  'T1_manager_dispatch',
  'T3_module_manager',
];
const SUPERVISOR: ReadonlyArray<string> = ['T1_supervisor_shift'];
const FIELD: ReadonlyArray<string> = ['T1_field_technician', 'T4_field_employee'];
const INSPECTOR: ReadonlyArray<string> = ['T1_inspector'];
const TREASURY: ReadonlyArray<string> = ['T1_treasury_clerk'];
const SAFETY: ReadonlyArray<string> = ['T1_safety_officer'];
const COMPLIANCE: ReadonlyArray<string> = ['T1_compliance_clerk'];
const TENANT: ReadonlyArray<string> = [
  'T1_tenant_marketplace_director',
  'T5_customer_concierge',
];

/**
 * Workforce slash-command catalog. Returned as a frozen tuple so the
 * mobile composer can pass it directly into the menu filter.
 */
export const WORKFORCE_SLASH_COMMANDS: ReadonlyArray<MobileSlashCommand> =
  Object.freeze([
    // Owner (mobile)
    {
      id: 'brief',
      label: { en: 'Daily brief', sw: 'Muhtasari wa siku' },
      hint: { en: 'Show today snapshot', sw: 'Onyesha ufupisho wa leo' },
      personaSlugs: OWNER,
    },
    {
      id: 'cash',
      label: { en: 'Cash and runway', sw: 'Hela na muda' },
      hint: { en: 'Treasury status', sw: 'Hali ya hazina' },
      personaSlugs: OWNER,
    },
    {
      id: 'decisions',
      label: { en: 'Pending decisions', sw: 'Maamuzi yanayosubiri' },
      hint: { en: 'Approvals waiting', sw: 'Idhinisho zinazosubiri' },
      personaSlugs: OWNER,
    },
    {
      id: 'crew',
      label: { en: 'Crew status', sw: 'Hali ya timu' },
      hint: { en: 'Who is on shift', sw: 'Nani yuko kazini' },
      personaSlugs: [...MANAGER, ...SUPERVISOR],
    },
    {
      id: 'dispatch',
      label: { en: 'Dispatch board', sw: 'Bodi ya utumaji' },
      hint: { en: 'Work-order routing', sw: 'Utumaji wa kazi' },
      personaSlugs: MANAGER,
    },
    {
      id: 'incidents',
      label: { en: 'Recent incidents', sw: 'Ajali za karibuni' },
      hint: { en: 'Last 7 days', sw: 'Siku 7 zilizopita' },
      personaSlugs: [...MANAGER, ...SUPERVISOR, ...SAFETY],
    },
    {
      id: 'approvals',
      label: { en: 'Pending approvals', sw: 'Idhinisho zinazosubiri' },
      hint: { en: 'For your sign-off', sw: 'Zinazohitaji idhini yako' },
      personaSlugs: MANAGER,
    },
    // Supervisor
    {
      id: 'shift',
      label: { en: 'My shift today', sw: 'Zamu yangu leo' },
      hint: { en: 'Roster + tasks', sw: 'Zamu na kazi' },
      personaSlugs: [...SUPERVISOR, ...FIELD],
    },
    {
      id: 'clock-in',
      label: { en: 'Clock in', sw: 'Ingia kazini' },
      hint: { en: 'Start your shift', sw: 'Anza zamu' },
      personaSlugs: [...SUPERVISOR, ...FIELD],
    },
    {
      id: 'clock-out',
      label: { en: 'Clock out', sw: 'Toka kazini' },
      hint: { en: 'End your shift', sw: 'Maliza zamu' },
      personaSlugs: [...SUPERVISOR, ...FIELD],
    },
    {
      id: 'tasks',
      label: { en: 'My tasks', sw: 'Kazi zangu' },
      hint: { en: 'Open work items', sw: 'Kazi zilizoanzishwa' },
      personaSlugs: [...SUPERVISOR, ...FIELD, ...INSPECTOR],
    },
    {
      id: 'toolbox',
      label: { en: 'Safety check-in', sw: 'Ukaguzi wa usalama' },
      hint: { en: 'Acknowledge today', sw: 'Thibitisha leo' },
      personaSlugs: [...SUPERVISOR, ...FIELD, ...SAFETY],
    },
    {
      id: 'incident-report',
      label: { en: 'Report incident', sw: 'Ripoti ajali' },
      hint: { en: 'Log a safety event', sw: 'Andika tukio la usalama' },
      personaSlugs: [...SUPERVISOR, ...FIELD, ...SAFETY],
    },
    // Inspector
    {
      id: 'sample',
      label: { en: 'Submit inspection', sw: 'Wasilisha ukaguzi' },
      hint: { en: 'Unit condition note', sw: 'Hali ya nyumba' },
      personaSlugs: INSPECTOR,
    },
    {
      id: 'drill-log',
      label: { en: 'Condition log', sw: 'Logi ya hali' },
      hint: { en: 'Today findings + grade', sw: 'Matokeo na daraja la leo' },
      personaSlugs: INSPECTOR,
    },
    {
      id: 'inspection-results',
      label: { en: 'Inspection results', sw: 'Matokeo ya ukaguzi' },
      hint: { en: 'Latest reports', sw: 'Ripoti za hivi karibuni' },
      personaSlugs: INSPECTOR,
    },
    // Treasury
    {
      id: 'cashflow',
      label: { en: 'Cashflow', sw: 'Mtiririko wa fedha' },
      hint: { en: 'In / out today', sw: 'Ndani na nje leo' },
      personaSlugs: TREASURY,
    },
    {
      id: 'payouts',
      label: { en: 'Pending payouts', sw: 'Malipo yanayosubiri' },
      hint: { en: 'Workers + suppliers', sw: 'Wafanyakazi na wauzaji' },
      personaSlugs: TREASURY,
    },
    {
      id: 'rent',
      label: { en: 'Rent status', sw: 'Hali ya kodi' },
      hint: { en: 'Collections + arrears', sw: 'Makusanyo na malimbikizo' },
      personaSlugs: TREASURY,
    },
    // Safety officer
    {
      id: 'incidents-open',
      label: { en: 'Open incidents', sw: 'Ajali wazi' },
      hint: { en: 'Awaiting close-out', sw: 'Zinazosubiri kufungwa' },
      personaSlugs: SAFETY,
    },
    {
      id: 'ppe-check',
      label: { en: 'PPE check', sw: 'Ukaguzi wa vifaa vya ulinzi' },
      hint: { en: 'Inspection log', sw: 'Logi ya ukaguzi' },
      personaSlugs: SAFETY,
    },
    // Compliance clerk
    {
      id: 'licences',
      label: { en: 'Leases', sw: 'Mikataba ya pango' },
      hint: { en: 'Expiry + status', sw: 'Kuisha muda na hali' },
      personaSlugs: COMPLIANCE,
    },
    {
      id: 'audit-trail',
      label: { en: 'Audit trail', sw: 'Njia ya ukaguzi' },
      hint: { en: 'Recent entries', sw: 'Maingizo ya karibuni' },
      personaSlugs: COMPLIANCE,
    },
    {
      id: 'reports',
      label: { en: 'Reports', sw: 'Ripoti' },
      hint: { en: 'Compliance set', sw: 'Seti ya utii' },
      personaSlugs: COMPLIANCE,
    },
  ]);

/**
 * Renter slash-command catalog. Used by the tenant-mobile chat composer.
 * Personas: T1_tenant_marketplace_director (face) + T5_customer_concierge
 * (legacy fallback). The command ids are resolved by the brain to tool
 * ids; they map onto property-domain concepts (units, listings,
 * applications, listing history).
 */
export const TENANT_SLASH_COMMANDS: ReadonlyArray<MobileSlashCommand> =
  Object.freeze([
    {
      id: 'search',
      label: { en: 'Search units', sw: 'Tafuta nyumba' },
      hint: { en: 'By type + rent', sw: 'Kwa aina na kodi' },
      personaSlugs: TENANT,
    },
    {
      id: 'listing',
      label: { en: 'Listing detail', sw: 'Maelezo ya orodha' },
      hint: { en: 'Open a unit', sw: 'Fungua nyumba' },
      personaSlugs: TENANT,
    },
    {
      id: 'place-bid',
      label: { en: 'Apply', sw: 'Wasilisha maombi' },
      hint: { en: 'Submit an application', sw: 'Tuma maombi' },
      personaSlugs: TENANT,
    },
    {
      id: 'my-bids',
      label: { en: 'My applications', sw: 'Maombi yangu' },
      hint: { en: 'Active + history', sw: 'Hai na historia' },
      personaSlugs: TENANT,
    },
    {
      id: 'market-intel',
      label: { en: 'Market intel', sw: 'Habari za soko' },
      hint: { en: 'Rent + trend', sw: 'Kodi na mwelekeo' },
      personaSlugs: TENANT,
    },
    {
      id: 'listing-history',
      label: { en: 'Listing history', sw: 'Historia ya orodha' },
      hint: { en: 'Unit timeline', sw: 'Historia ya nyumba' },
      personaSlugs: TENANT,
    },
    {
      id: 'kyc',
      label: { en: 'KYC status', sw: 'Hali ya KYC' },
      hint: { en: 'Verification stage', sw: 'Hatua ya uthibitisho' },
      personaSlugs: TENANT,
    },
    {
      id: 'accept-offer',
      label: { en: 'Accept offer', sw: 'Kubali ofa' },
      hint: { en: 'Take a counter', sw: 'Pokea ofa ya kupinga' },
      personaSlugs: TENANT,
    },
  ]);

/**
 * Look up slash commands available for a given persona slug. The
 * composer typically calls this once and stores the result.
 */
export function slashCommandsForPersona(
  personaSlug: string,
  app: 'workforce' | 'tenant',
): ReadonlyArray<MobileSlashCommand> {
  const catalog =
    app === 'workforce' ? WORKFORCE_SLASH_COMMANDS : TENANT_SLASH_COMMANDS;
  return catalog.filter((cmd) => cmd.personaSlugs.includes(personaSlug));
}
