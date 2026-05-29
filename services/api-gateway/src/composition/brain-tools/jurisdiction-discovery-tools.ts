/**
 * Jurisdiction-discovery brain tools — JC-1 + JC-6 (real-estate edition).
 *
 * Companion to:
 *   - services/api-gateway/src/services/jurisdiction-resolver/
 *   - packages/database/src/seeds/regulator-jurisdictions.seed.ts
 *
 * Catalogue:
 *   - bossnyumba.jurisdiction.discover   — JC-1, on-demand jurisdiction lookup.
 *                                          Mr. Mwikila NEVER says "I don't know"
 *                                          about a country — instead he calls
 *                                          this tool and answers from the
 *                                          discovered profile.
 *   - bossnyumba.jurisdiction.switch     — JC-6, per-turn / per-session override.
 *                                          NEVER 'permanent' — that path is owned
 *                                          by BOSSNYUMBA internal admin (JC-7).
 *
 * Persona scope: every persona can ask about a jurisdiction. The
 * switch tool is also persona-wide but its `scope` enum is restricted
 * to 'turn' | 'session' — 'permanent' is rejected at validation time
 * with a bilingual sw/en message pointing the user at support.
 *
 * Ported from Borjie — real-estate retailored. The regulator-domain
 * enum tracks landlord-tenant authorities, not mining regulators.
 */

import { z } from 'zod';

import { PERSONA_SLUGS, type PersonaToolDescriptor } from './types.js';

const ALL_PERSONAS = PERSONA_SLUGS;

// ─── Schemas ──────────────────────────────────────────────────────────

const DiscoverInput = z.object({
  /** ISO-3166-1 alpha-2 code or English country name (e.g. "GH", "Ghana"). */
  country: z.string().min(2).max(60),
});

const DiscoveredRegulatorSchema = z.object({
  name: z.string(),
  domain: z.enum([
    'rental_housing',
    'revenue_tax',
    'data_protection',
    'tenant_tribunal',
    'building_safety',
    'unknown',
  ]),
  mandate: z.string().optional(),
  url: z.string().optional(),
});

const DiscoverySourceSchema = z.object({
  kind: z.enum(['web_search', 'corpus', 'fallback']),
  id: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
});

const DiscoverOutput = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  regulators: z.array(DiscoveredRegulatorSchema),
  currency: z.string(),
  languages: z.array(z.string()),
  legalFramework: z.string().optional(),
  validityScore: z.number().min(0).max(1),
  origin: z.enum(['seed', 'cache', 'discovered', 'fallback']),
  lowConfidence: z.boolean(),
  sources: z.array(DiscoverySourceSchema),
  /** Promotion hint surfaced to the user-facing answer. */
  promotionHint: z.string(),
});

// JC-6 — 'permanent' is INTENTIONALLY excluded from the enum so the
// validator rejects it at the door. The tool description states the
// rule explicitly so the LLM knows not to attempt it.
const SwitchInput = z.object({
  countryCode: z
    .string()
    .min(2)
    .max(2)
    .regex(/^[A-Z]{2}$/u, 'countryCode must be ISO-3166-1 alpha-2'),
  scope: z.enum(['turn', 'session']),
});

const SwitchOutput = z.object({
  acknowledged: z.literal(true),
  countryCode: z.string(),
  scope: z.enum(['turn', 'session']),
  message: z.object({
    en: z.string(),
    sw: z.string(),
  }),
});

// ─── Descriptors ──────────────────────────────────────────────────────

export const jurisdictionDiscoverTool: PersonaToolDescriptor<
  typeof DiscoverInput,
  typeof DiscoverOutput
> = {
  id: 'bossnyumba.jurisdiction.discover',
  name: 'Discover a jurisdiction (web + corpus + seed)',
  description:
    'On-demand jurisdiction lookup. Use this WHENEVER the user asks about ' +
    "a country we have not seeded — Mr. Mwikila NEVER says \"I don't know\"" +
    ' about a country. Pass the country (alpha-2 like "GH" or name like ' +
    '"Ghana"). Returns rental-housing / revenue / data-protection / tribunal ' +
    'authorities, currency, language, legal framework, validity score, and ' +
    'source citations. ALWAYS cite the returned sources in the user-facing ' +
    'reply.',
  personaSlugs: ALL_PERSONAS,
  inputSchema: DiscoverInput,
  outputSchema: DiscoverOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      // Loopback unavailable — return a low-confidence stub so the
      // brain still has structure to render. Mr. Mwikila NEVER says
      // "I don't know"; the prompt section signals the gap explicitly.
      const code = input.country.trim().slice(0, 2).toUpperCase();
      return {
        countryCode: code || 'XX',
        countryName: input.country,
        regulators: [
          {
            name: `${input.country} housing authority (best-effort)`,
            domain: 'rental_housing' as const,
          },
        ],
        currency: 'UNKNOWN',
        languages: ['en'],
        validityScore: 0.2,
        origin: 'fallback' as const,
        lowConfidence: true,
        sources: [],
        promotionHint:
          'Discovery is degraded — once the system reconnects to the web/corpus probes I can ' +
          'verify these details and offer to permanently add this jurisdiction (requires BOSSNYUMBA ' +
          'internal admin approval).',
      };
    }
    return client.post<{
      countryCode: string;
      countryName: string;
      regulators: ReadonlyArray<{
        name: string;
        domain:
          | 'rental_housing'
          | 'revenue_tax'
          | 'data_protection'
          | 'tenant_tribunal'
          | 'building_safety'
          | 'unknown';
        mandate?: string;
        url?: string;
      }>;
      currency: string;
      languages: ReadonlyArray<string>;
      legalFramework?: string;
      validityScore: number;
      origin: 'seed' | 'cache' | 'discovered' | 'fallback';
      lowConfidence: boolean;
      sources: ReadonlyArray<{
        kind: 'web_search' | 'corpus' | 'fallback';
        id: string;
        title: string;
        snippet?: string;
      }>;
      promotionHint: string;
    }>('/internal/jurisdiction-discovery/discover', {
      tenantId: ctx.tenantId,
      country: input.country,
    });
  },
};

export const jurisdictionSwitchTool: PersonaToolDescriptor<
  typeof SwitchInput,
  typeof SwitchOutput
> = {
  id: 'bossnyumba.jurisdiction.switch',
  name: 'Switch jurisdiction context for this turn or session',
  description:
    'Apply a jurisdiction override for the CURRENT turn or chat session ' +
    'only. Use when the user explicitly mentions another country ' +
    '("for our Uganda operation"). NEVER pass scope="permanent" — the ' +
    "tenant's jurisdiction is LOCKED at signup and only BOSSNYUMBA " +
    'internal admin can change it (JC-7). If the user asks to switch ' +
    'permanently, respond bilingually that the change requires BOSSNYUMBA ' +
    'support, then offer to draft the request.',
  personaSlugs: ALL_PERSONAS,
  inputSchema: SwitchInput,
  outputSchema: SwitchOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, _ctx) {
    // No remote call — the override is purely a brain-side context flag
    // surfaced back to the orchestrator. The output payload teaches the
    // model how to phrase the bilingual confirmation.
    const sw =
      input.scope === 'turn'
        ? `Sawa — nitatumia muktadha wa ${input.countryCode} kwa swali hili tu.`
        : `Sawa — nitatumia muktadha wa ${input.countryCode} kwa mazungumzo haya yote, lakini akaunti yako bado imefungwa kwa nchi yake ya usajili.`;
    const en =
      input.scope === 'turn'
        ? `Got it — applying the ${input.countryCode} context for THIS question only.`
        : `Got it — using ${input.countryCode} context for this conversation, but your account remains locked to its signup jurisdiction.`;
    return {
      acknowledged: true as const,
      countryCode: input.countryCode,
      scope: input.scope,
      message: { en, sw },
    };
  },
};

export const JURISDICTION_DISCOVERY_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  jurisdictionDiscoverTool,
  jurisdictionSwitchTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
