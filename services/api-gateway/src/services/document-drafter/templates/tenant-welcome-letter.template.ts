/**
 * Tenant welcome letter template — bilingual sw/en.
 *
 * Sent on the day a new tenant signs the lease + pays the deposit.
 * Captures the practical move-in info: keys, utilities, caretaker
 * contact, payment instructions, house rules link.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  tenantName: z.string().min(1).max(200),
  unitDescriptor: z.string().min(1).max(200),
  premisesAddress: z.string().min(1).max(400),
  moveInDate: z.string().min(1).max(40),
  caretakerName: z.string().min(1).max(200),
  caretakerPhone: z.string().min(1).max(40),
  paymentMobileMoneyTill: z.string().min(1).max(40).optional(),
  paymentBankAccount: z.string().min(1).max(120).optional(),
  monthlyRentAmount: z.number().nonnegative(),
  currencyCode: z.string().length(3).default('TZS'),
  paymentDayOfMonth: z.number().int().min(1).max(28).default(1),
  landlordName: z.string().min(1).max(200),
});

export const tenantWelcomeLetterTemplate: UniversalTemplate = {
  id: 'tenant-welcome-letter',
  title: { en: 'Tenant Welcome Letter', sw: 'Barua ya Karibu Mpangaji' },
  kind: 'letter',
  description:
    'Welcome letter on move-in day: keys, utilities, caretaker, payment instructions.',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    if (lang === 'sw') {
      return [
        `# KARIBU ${v.tenantName.toUpperCase()}!`,
        '',
        `**Tarehe ya kuingia:** ${v.moveInDate}`,
        `**Nyumba:** ${v.unitDescriptor}, ${v.premisesAddress}`,
        '',
        '---',
        '',
        `Karibu sana katika nyumba yako mpya. Tunafurahi kukukaribisha.`,
        '',
        '## Mambo ya Kuingia',
        '',
        '- Funguo zitakabidhiwa siku ya kuingia, baada ya ukaguzi wa hali ya nyumba.',
        '- Mita za maji na umeme zinaweza kuhitaji jina lako kupewa upya.',
        '- Tafadhali soma sheria za nyumba (ratiba ya kelele, taka, mgeni).',
        '',
        `## Mlinzi`,
        '',
        `Kwa msaada wa siku-kwa-siku, wasiliana na mlinzi:`,
        '',
        `- **Jina:** ${v.caretakerName}`,
        `- **Simu:** ${v.caretakerPhone}`,
        '',
        `## Malipo ya Kodi`,
        '',
        `Kodi ya kila mwezi: **${v.currencyCode} ${v.monthlyRentAmount.toLocaleString()}**`,
        `Tarehe ya malipo: siku ya ${v.paymentDayOfMonth} ya kila mwezi.`,
        '',
        v.paymentMobileMoneyTill
          ? `- Lipa kupitia Till ya M-Pesa/Tigo: **${v.paymentMobileMoneyTill}**`
          : '',
        v.paymentBankAccount
          ? `- Au akaunti ya benki: ${v.paymentBankAccount}`
          : '',
        '',
        `Kama una swali lolote, wasiliana nasi wakati wowote.`,
        '',
        `Karibu nyumbani!`,
        '',
        `${v.landlordName}`,
      ]
        .filter((l) => l !== '')
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    }
    return [
      `# WELCOME, ${v.tenantName.toUpperCase()}!`,
      '',
      `**Move-in date:** ${v.moveInDate}`,
      `**Premises:** ${v.unitDescriptor}, ${v.premisesAddress}`,
      '',
      '---',
      '',
      `Welcome to your new home. We are delighted to have you with us.`,
      '',
      '## Move-in Checklist',
      '',
      '- Keys handed over on move-in day, after the condition inspection.',
      '- Water and electricity meters may need to be re-registered in your name.',
      '- Please review the house rules (quiet hours, refuse, guests).',
      '',
      `## Caretaker`,
      '',
      `For day-to-day support, contact the caretaker:`,
      '',
      `- **Name:** ${v.caretakerName}`,
      `- **Phone:** ${v.caretakerPhone}`,
      '',
      `## Rent Payment`,
      '',
      `Monthly rent: **${v.currencyCode} ${v.monthlyRentAmount.toLocaleString()}**`,
      `Due on day ${v.paymentDayOfMonth} of each month.`,
      '',
      v.paymentMobileMoneyTill
        ? `- Pay via mobile money till: **${v.paymentMobileMoneyTill}**`
        : '',
      v.paymentBankAccount
        ? `- Or via bank account: ${v.paymentBankAccount}`
        : '',
      '',
      `Reach out any time with questions.`,
      '',
      `Welcome home!`,
      '',
      `${v.landlordName}`,
    ]
      .filter((l) => l !== '')
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  },
  renderHints: { classification: 'internal', headerLogo: true },
};
