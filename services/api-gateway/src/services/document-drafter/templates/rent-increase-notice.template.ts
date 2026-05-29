/**
 * Rent-increase notice template — bilingual sw/en.
 *
 * Issued by the landlord to a tenant when monthly rent will change at
 * lease renewal. Mandatory under most TZ / KE / pan-African tenancy
 * laws; the law usually specifies the minimum notice period before
 * the new rate can take effect.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  tenantName: z.string().min(1).max(200),
  unitDescriptor: z.string().min(1).max(200),
  premisesAddress: z.string().min(1).max(400),
  currentRentAmount: z.number().nonnegative(),
  newRentAmount: z.number().nonnegative(),
  currencyCode: z.string().length(3).default('TZS'),
  effectiveDate: z.string().min(1).max(40),
  noticeDate: z.string().min(1).max(40).optional(),
  landlordName: z.string().min(1).max(200),
  reason: z.string().min(0).max(400).optional(),
  noticePeriodDays: z.number().int().min(30).max(180).default(60),
});

export const rentIncreaseNoticeTemplate: UniversalTemplate = {
  id: 'rent-increase-notice',
  title: {
    en: 'Rent Increase Notice',
    sw: 'Taarifa ya Kuongeza Kodi',
  },
  kind: 'notice',
  description:
    'Statutory notice to a tenant that monthly rent will increase from a given effective date.',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    const today = v.noticeDate ?? new Date().toISOString().slice(0, 10);
    const delta = v.newRentAmount - v.currentRentAmount;
    const pct = v.currentRentAmount > 0
      ? (delta / v.currentRentAmount) * 100
      : 0;
    if (lang === 'sw') {
      return [
        `# TAARIFA YA KUONGEZA KODI YA NYUMBA`,
        '',
        `**Tarehe:** ${today}`,
        '',
        `**Kwa:** ${v.tenantName}`,
        `**Nyumba:** ${v.unitDescriptor}, ${v.premisesAddress}`,
        '',
        '---',
        '',
        `Ndugu ${v.tenantName},`,
        '',
        `Hii ni taarifa ya kuongeza kodi yako ya kila mwezi kuanzia tarehe ${v.effectiveDate}, kama ifuatavyo:`,
        '',
        `- **Kodi ya sasa:** ${v.currencyCode} ${v.currentRentAmount.toLocaleString()}`,
        `- **Kodi mpya:** ${v.currencyCode} ${v.newRentAmount.toLocaleString()}`,
        `- **Tofauti:** ${v.currencyCode} ${delta.toLocaleString()} (${pct.toFixed(1)}%)`,
        '',
        v.reason
          ? `**Sababu:** ${v.reason}`
          : '',
        '',
        `Taarifa hii inakupa siku ${v.noticePeriodDays} kabla ya tarehe ya kuanza kutumika, kulingana na sheria.`,
        '',
        `Tafadhali wasiliana nasi kama una maswali yoyote.`,
        '',
        `Wako kwa heshima,`,
        '',
        `${v.landlordName}`,
      ]
        .filter((l) => l !== '')
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    }
    return [
      `# RENT INCREASE NOTICE`,
      '',
      `**Date:** ${today}`,
      '',
      `**To:** ${v.tenantName}`,
      `**Premises:** ${v.unitDescriptor}, ${v.premisesAddress}`,
      '',
      '---',
      '',
      `Dear ${v.tenantName},`,
      '',
      `This is to notify you that your monthly rent will increase from ${v.effectiveDate}, as follows:`,
      '',
      `- **Current rent:** ${v.currencyCode} ${v.currentRentAmount.toLocaleString()}`,
      `- **New rent:** ${v.currencyCode} ${v.newRentAmount.toLocaleString()}`,
      `- **Change:** ${v.currencyCode} ${delta.toLocaleString()} (${pct.toFixed(1)}%)`,
      '',
      v.reason ? `**Reason:** ${v.reason}` : '',
      '',
      `This notice gives you ${v.noticePeriodDays} days before the new rate takes effect, as required by law.`,
      '',
      `Please reach out if you have any questions.`,
      '',
      `Yours sincerely,`,
      '',
      `${v.landlordName}`,
    ]
      .filter((l) => l !== '')
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  },
  renderHints: { classification: 'confidential', headerLogo: true },
};
