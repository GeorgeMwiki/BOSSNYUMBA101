/**
 * Residential lease agreement template — bilingual sw/en.
 *
 * Captures the canonical TZ / KE residential tenancy clauses:
 * parties, premises, term, rent + service charge, deposit, utilities,
 * inspection / move-in condition, termination, jurisdiction. The
 * compose path renders a single-language doc; downstream `language=
 * bilingual` callers can stitch sw + en with a `---` divider.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  landlordName: z.string().min(1).max(200),
  landlordAddress: z.string().min(1).max(400),
  tenantName: z.string().min(1).max(200),
  tenantId: z.string().min(1).max(80).optional(),
  premisesAddress: z.string().min(1).max(400),
  unitDescriptor: z.string().min(1).max(200),
  termMonths: z.number().int().positive().max(120),
  startDate: z.string().min(1).max(40),
  monthlyRentAmount: z.number().nonnegative(),
  currencyCode: z.string().length(3).default('TZS'),
  paymentDayOfMonth: z.number().int().min(1).max(28).default(1),
  depositMonths: z.number().int().min(0).max(12).default(2),
  serviceChargeAmount: z.number().nonnegative().optional(),
  noticePeriodDays: z.number().int().min(7).max(180).default(30),
  jurisdiction: z.string().min(2).max(80).default('TZ'),
});

export const leaseAgreementTemplate: UniversalTemplate = {
  id: 'lease-agreement',
  title: {
    en: 'Residential Lease Agreement',
    sw: 'Mkataba wa Kupanga Nyumba',
  },
  kind: 'contract',
  description:
    'Standard residential lease agreement (TZ / KE / pan-African). Parties, premises, term, rent, deposit, termination.',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    const today = new Date().toISOString().slice(0, 10);
    if (lang === 'sw') {
      return [
        `# MKATABA WA KUPANGA NYUMBA`,
        '',
        `Mkataba huu umefanyika tarehe ${today} kati ya:`,
        '',
        `**Mwenye Nyumba:** ${v.landlordName}`,
        `Anwani: ${v.landlordAddress}`,
        '',
        `**Mpangaji:** ${v.tenantName}${v.tenantId ? ` (NIDA ${v.tenantId})` : ''}`,
        '',
        '## 1. Nyumba',
        '',
        `Nyumba iliyokodiwa: ${v.unitDescriptor} katika ${v.premisesAddress}.`,
        '',
        '## 2. Muda',
        '',
        `Muda wa kodi ni miezi ${v.termMonths} kuanzia ${v.startDate}.`,
        '',
        '## 3. Kodi na Malipo',
        '',
        `Kodi ya kila mwezi: ${v.currencyCode} ${v.monthlyRentAmount.toLocaleString()}.`,
        `Malipo yafanyike kabla au siku ya ${v.paymentDayOfMonth} ya kila mwezi.`,
        v.serviceChargeAmount
          ? `Ada ya huduma: ${v.currencyCode} ${v.serviceChargeAmount.toLocaleString()} kwa mwezi.`
          : '',
        '',
        '## 4. Amana',
        '',
        `Mpangaji atalipa amana sawa na kodi ya miezi ${v.depositMonths}, ambayo itarudishwa baada ya ukaguzi wa kuondoka kama hakuna uharibifu.`,
        '',
        '## 5. Matumizi na Matengenezo',
        '',
        '- Mpangaji atatumia nyumba kwa makazi tu.',
        '- Matengenezo madogo ya kawaida ni jukumu la mpangaji.',
        '- Matengenezo makubwa ni jukumu la mwenye nyumba.',
        '',
        '## 6. Kusitisha',
        '',
        `Upande wowote anaweza kusitisha mkataba kwa taarifa ya maandishi ya siku ${v.noticePeriodDays}.`,
        '',
        '## 7. Sheria Inayoongoza',
        '',
        `Mkataba huu unaongozwa na sheria za ${v.jurisdiction}.`,
        '',
        '---',
        '',
        '**Sahihi za Pande:**',
        '',
        `Mwenye Nyumba: __________________________ Tarehe: __________`,
        '',
        `Mpangaji: __________________________ Tarehe: __________`,
      ]
        .filter((l) => l !== '')
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    }
    return [
      `# RESIDENTIAL LEASE AGREEMENT`,
      '',
      `This agreement is made on ${today} between:`,
      '',
      `**Landlord:** ${v.landlordName}`,
      `Address: ${v.landlordAddress}`,
      '',
      `**Tenant:** ${v.tenantName}${v.tenantId ? ` (ID ${v.tenantId})` : ''}`,
      '',
      '## 1. Premises',
      '',
      `The leased premises: ${v.unitDescriptor} at ${v.premisesAddress}.`,
      '',
      '## 2. Term',
      '',
      `The lease term is ${v.termMonths} months commencing ${v.startDate}.`,
      '',
      '## 3. Rent & Payment',
      '',
      `Monthly rent: ${v.currencyCode} ${v.monthlyRentAmount.toLocaleString()}.`,
      `Payment due on or before the ${v.paymentDayOfMonth}th of each month.`,
      v.serviceChargeAmount
        ? `Service charge: ${v.currencyCode} ${v.serviceChargeAmount.toLocaleString()} per month.`
        : '',
      '',
      '## 4. Deposit',
      '',
      `Tenant shall pay a deposit equivalent to ${v.depositMonths} month(s) of rent, refundable after the move-out inspection less any damages.`,
      '',
      '## 5. Use & Maintenance',
      '',
      '- Tenant shall use the premises for residential purposes only.',
      '- Minor routine maintenance is the tenant\'s responsibility.',
      '- Major maintenance is the landlord\'s responsibility.',
      '',
      '## 6. Termination',
      '',
      `Either party may terminate by giving ${v.noticePeriodDays} days\' written notice.`,
      '',
      '## 7. Governing Law',
      '',
      `This agreement is governed by the laws of ${v.jurisdiction}.`,
      '',
      '---',
      '',
      '**Signatures:**',
      '',
      `Landlord: __________________________ Date: __________`,
      '',
      `Tenant: __________________________ Date: __________`,
    ]
      .filter((l) => l !== '')
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  },
  renderHints: { classification: 'confidential', headerLogo: true, coverPage: false },
};
