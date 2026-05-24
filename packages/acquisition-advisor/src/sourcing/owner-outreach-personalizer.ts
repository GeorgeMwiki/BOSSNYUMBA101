/**
 * Owner outreach personalizer — assembles the right outreach
 * template per owner archetype.
 *
 * Per HubSpot Real-Estate Outbound Benchmark 2024 + HassConsult
 * internal data 2024 (WhatsApp 6.8% response rate in EA).
 */

import type { OutreachTemplate, OwnerArchetype } from '../types.js';

const RESPONSE_RATES = {
  email: 0.007,
  mail: 0.014,
  whatsapp: 0.068,
  handwritten: 0.042,
  phone: 0.022,
} as const;

const TEMPLATES: Readonly<Record<OwnerArchetype, Omit<OutreachTemplate, 'expectedResponseRate'>>> = {
  agingBoutique: {
    archetype: 'agingBoutique',
    subject: 'Confidential estate-planning conversation about {{propertyAddress}}',
    bodyTemplate:
      `Hello {{ownerName}}, I represent a long-term institutional buyer ` +
      `with capacity to provide a fully-cash, no-financing-contingency, ` +
      `1031-cooperative close on {{propertyAddress}}. ` +
      `Many of our most successful transactions have begun as quiet ` +
      `estate-planning conversations. Would you have 20 minutes for a ` +
      `confidential exploratory call?`,
    hook: 'Cap-gains deferral via 1031 + simple, quiet close',
    channel: 'handwritten',
  },
  familyOfficeGen3: {
    archetype: 'familyOfficeGen3',
    subject: 'Concentration-risk re-balancing for {{familyName}} holdings',
    bodyTemplate:
      `Dear {{ownerName}}, our acquisitions desk has noted your holdings ` +
      `at {{propertyAddress}} have appreciated meaningfully and now ` +
      `represent a concentration risk in the portfolio. We are an ` +
      `institutional buyer with discreet capacity to provide partial ` +
      `or full liquidity in the next 90 days, including JV / pref-equity ` +
      `structures if outright sale is not preferred.`,
    hook: 'Liquidity + diversification without market exposure',
    channel: 'email',
  },
  distressedSponsor: {
    archetype: 'distressedSponsor',
    subject: 'Loan-assumption proposal for {{propertyAddress}}',
    bodyTemplate:
      `{{ownerName}}, we understand the {{propertyAddress}} loan matures ` +
      `in {{maturityWindow}}. We are an experienced loan-assumption ` +
      `buyer with the lender relationship to close the assumption in 60-90 ` +
      `days, avoiding the defeasance / yield-maintenance cost of a payoff. ` +
      `Open to a confidential conversation?`,
    hook: 'Loan-assumption — avoid defeasance + yield maintenance',
    channel: 'phone',
  },
  outOfStateHeir: {
    archetype: 'outOfStateHeir',
    subject: 'Simple, hassle-free sale of {{propertyAddress}}',
    bodyTemplate:
      `Hello {{ownerName}}, managing a property from {{ownerCity}} can be ` +
      `time-consuming. We are an off-market institutional buyer who can ` +
      `provide a simple, no-broker, no-financing-contingency cash close in ` +
      `30-45 days. No staging, no open houses, no buyer-side drama.`,
    hook: 'Off-market simple close, no management burden',
    channel: 'mail',
  },
  capitalStackTiredGP: {
    archetype: 'capitalStackTiredGP',
    subject: 'GP roll / preferred-equity recap for {{propertyAddress}}',
    bodyTemplate:
      `{{ownerName}}, we recap GPs who are at end-of-fund or seeking ` +
      `liquidity without forced sale. Structures include preferred-equity, ` +
      `GP-LP roll, partial buy-out — all preserving your operating role. ` +
      `Happy to discuss confidentially.`,
    hook: 'Pref-equity / GP-LP roll — preserve operating role',
    channel: 'phone',
  },
  eaGenerationalFamily: {
    archetype: 'eaGenerationalFamily',
    subject: 'Joint-venture upgrade for {{familyName}} land at {{propertyAddress}}',
    bodyTemplate:
      `Habari {{ownerName}}, tunaheshimu urithi wa familia yenu wa ` +
      `{{propertyAddress}}. Tunashauri kuanzisha mazungumzo ya ` +
      `ushirikiano (JV) ambayo yataheshimu urithi wa familia, kusafisha ` +
      `hati / title, na kupandisha thamani ya ardhi. Tunafadhili 100% ya ` +
      `mchakato wa upgrade.`,
    hook: 'JV upgrade — keep ownership, clean title, upgrade asset',
    channel: 'whatsapp',
  },
};

export function getOutreachTemplate(
  archetype: OwnerArchetype,
): OutreachTemplate {
  const base = TEMPLATES[archetype];
  if (!base) {
    throw new Error(`unknown owner archetype: ${archetype}`);
  }
  return {
    ...base,
    expectedResponseRate: RESPONSE_RATES[base.channel],
  };
}

export function listOutreachTemplates(): ReadonlyArray<OutreachTemplate> {
  return (Object.keys(TEMPLATES) as ReadonlyArray<OwnerArchetype>).map(
    getOutreachTemplate,
  );
}

export const OUTREACH_RESPONSE_RATES = RESPONSE_RATES;
