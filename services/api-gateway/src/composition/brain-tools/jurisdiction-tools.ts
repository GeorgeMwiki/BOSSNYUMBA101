/**
 * Jurisdiction brain tools — JA-4 (real-estate edition).
 *
 *   - `bossnyumba.jurisdiction.show_current` (JA-4)
 *        Returns a formatted bilingual snapshot of the tenant's
 *        jurisdiction (country, named authorities, currency, language,
 *        time zone) plus a bilingual sw/en offer to switch context.
 *        LOW stakes, READ-only, persona-gated to owner + admin.
 *
 *   - `bossnyumba.jurisdiction.switch` is owned by the JC-6 catalog in
 *     `jurisdiction-discovery-tools.ts` — keeps a single source of truth
 *     and prevents duplicate-id collisions in `mergeDescriptors`.
 *
 * Composition root: registered through brain-tools/index.ts so the
 * persona-runtime ToolDispatcher discovers the show-current tool at
 * boot.
 *
 * Ported from Borjie — adapted: depends on the lightweight
 * jurisdiction-resolver service in `services/jurisdiction-resolver/`
 * (real-estate authorities, not mining). The DB-backed tenant config
 * lookup is wired through a small `TenantConfigPort` so tests can
 * supply an in-memory fake without touching Drizzle.
 */

import { z } from 'zod';

import {
  createJurisdictionResolver,
  type ResolvedJurisdiction,
  type TenantConfigPort,
} from '../../services/jurisdiction-resolver/index.js';
import type { PersonaToolDescriptor } from './types.js';

const OWNER_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

// ─────────────────────────────────────────────────────────────────────
// Module-level config (test-injectable)
// ─────────────────────────────────────────────────────────────────────

let _tenantConfigPort: TenantConfigPort | undefined;

/**
 * Wire the live tenant-config port at composition boot. The api-gateway
 * composition root calls this once with the Drizzle-backed
 * `getTenantCountry` lookup. Tests supply an in-memory port.
 */
export function configureJurisdictionTools(port: TenantConfigPort): void {
  _tenantConfigPort = port;
}

async function resolveTenantJurisdiction(
  tenantId: string,
): Promise<ResolvedJurisdiction> {
  if (!_tenantConfigPort) {
    throw new Error(
      'jurisdiction-tools: TenantConfigPort not configured — call configureJurisdictionTools at boot',
    );
  }
  const resolver = createJurisdictionResolver({
    tenantConfig: _tenantConfigPort,
  });
  return resolver.resolve(tenantId);
}

// ─────────────────────────────────────────────────────────────────────
// JA-4 — bossnyumba.jurisdiction.show_current
// ─────────────────────────────────────────────────────────────────────

const ShowCurrentInput = z.object({
  language: z.enum(['en', 'sw']).optional().default('en'),
});

const ShowCurrentOutput = z.object({
  country: z.string(),
  countryName: z.string(),
  currency: z.string(),
  defaultLanguage: z.string(),
  locale: z.string(),
  timeZone: z.string(),
  rentalHousingAuthority: z.string(),
  revenueAuthority: z.string(),
  dataProtectionAuthority: z.string(),
  tribunalAuthority: z.string(),
  formattedEn: z.string(),
  formattedSw: z.string(),
  source: z.enum(['tenant', 'override', 'unseeded']),
});

/**
 * Render the bilingual user-facing snapshot. Both languages are
 * always returned so the brain orchestrator can pick the right one
 * (or render both side-by-side for sw-primary tenants who want EN
 * confirmation).
 */
function renderShowCurrent(
  resolved: ResolvedJurisdiction,
): { formattedEn: string; formattedSw: string } {
  const authorityListEn = [
    resolved.authorities.rentalHousingAuthority,
    resolved.authorities.revenueAuthority,
    resolved.authorities.tribunalAuthority,
    resolved.authorities.dataProtectionAuthority,
  ].join(', ');

  const formattedEn = `Your portfolio is in ${resolved.country} (${resolved.countryName}). Authorities: ${authorityListEn}. Currency: ${resolved.currency}. Default language: ${resolved.defaultLanguage}. Want to switch context for this conversation? Say e.g. "in Tanzania, ..." for a one-turn answer, or call bossnyumba.jurisdiction.switch with scope:'session' for the whole chat.`;

  const formattedSw = `Mali yako iko ${resolved.country} (${resolved.countryName}). Mamlaka: ${authorityListEn}. Sarafu: ${resolved.currency}. Lugha chaguo-msingi: ${resolved.defaultLanguage}. Unataka kubadili eneo kwa mazungumzo haya? Sema kwa mfano "in Tanzania, ..." kwa zamu moja, au tumia bossnyumba.jurisdiction.switch (scope:'session') kwa mazungumzo yote.`;

  return { formattedEn, formattedSw };
}

export const jurisdictionShowCurrentTool: PersonaToolDescriptor<
  typeof ShowCurrentInput,
  typeof ShowCurrentOutput
> = {
  id: 'bossnyumba.jurisdiction.show_current',
  name: 'Jurisdiction — show current',
  description:
    "Return the tenant's current jurisdiction snapshot — country, named authorities " +
    '(rental housing / revenue / tribunal / data protection), currency, default language, ' +
    'time zone — plus a bilingual sw/en offer to switch context for the current conversation. ' +
    'Use when the owner asks "what jurisdiction am I in", "which authorities apply", ' +
    '"what currency are we using", or any equivalent localisation question. READ-only, ' +
    'LOW stakes, persona-gated to owner + admin. Companion to bossnyumba.jurisdiction.switch ' +
    '(JC-6) for actually applying an override.',
  personaSlugs: OWNER_ADMIN,
  inputSchema: ShowCurrentInput,
  outputSchema: ShowCurrentOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    void input;
    const resolved = await resolveTenantJurisdiction(ctx.tenantId);
    const { formattedEn, formattedSw } = renderShowCurrent(resolved);
    return {
      country: resolved.country,
      countryName: resolved.countryName,
      currency: resolved.currency,
      defaultLanguage: resolved.defaultLanguage,
      locale: resolved.locale,
      timeZone: resolved.timeZone,
      rentalHousingAuthority: resolved.authorities.rentalHousingAuthority,
      revenueAuthority: resolved.authorities.revenueAuthority,
      dataProtectionAuthority: resolved.authorities.dataProtectionAuthority,
      tribunalAuthority: resolved.authorities.tribunalAuthority,
      formattedEn,
      formattedSw,
      source: resolved.source,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// Catalogue export
// ─────────────────────────────────────────────────────────────────────

export const JURISDICTION_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  jurisdictionShowCurrentTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
