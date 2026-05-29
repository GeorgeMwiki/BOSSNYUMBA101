/**
 * Eviction notice template — bilingual sw/en.
 *
 * Issued when the tenant breaches the lease (non-payment, lease-end
 * non-renewal, breach of conduct clauses). Statutory under TZ / KE
 * tenancy law — most jurisdictions require a numbered grounds list, a
 * remedy window, and a court / tribunal escalation clause.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  tenantName: z.string().min(1).max(200),
  unitDescriptor: z.string().min(1).max(200),
  premisesAddress: z.string().min(1).max(400),
  noticeDate: z.string().min(1).max(40).optional(),
  vacateByDate: z.string().min(1).max(40),
  remedyWindowDays: z.number().int().min(7).max(60).default(14),
  arrearsAmount: z.number().nonnegative().optional(),
  arrearsCurrency: z.string().length(3).default('TZS'),
  arrearsMonths: z.number().int().min(0).max(60).optional(),
  reason: z.enum(['arrears', 'lease_breach', 'lease_end', 'nuisance']),
  landlordName: z.string().min(1).max(200),
  jurisdiction: z.string().min(2).max(80).default('TZ'),
});

const SW_REASONS = {
  arrears: 'kushindwa kulipa kodi',
  lease_breach: 'kuvunja masharti ya mkataba',
  lease_end: 'kumalizika kwa mkataba',
  nuisance: 'usumbufu na uvunjifu wa amani',
};
const EN_REASONS = {
  arrears: 'non-payment of rent',
  lease_breach: 'breach of lease terms',
  lease_end: 'expiry of lease term',
  nuisance: 'nuisance and breach of quiet enjoyment',
};

export const evictionNoticeTemplate: UniversalTemplate = {
  id: 'eviction-notice',
  title: { en: 'Notice to Vacate', sw: 'Taarifa ya Kuondoka' },
  kind: 'notice',
  description:
    'Statutory notice to vacate, grounds, remedy window, escalation.',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    const today = v.noticeDate ?? new Date().toISOString().slice(0, 10);
    if (lang === 'sw') {
      return [
        `# TAARIFA YA KUONDOKA`,
        '',
        `**Tarehe:** ${today}`,
        `**Kwa:** ${v.tenantName}`,
        `**Nyumba:** ${v.unitDescriptor}, ${v.premisesAddress}`,
        '',
        '---',
        '',
        `Ndugu ${v.tenantName},`,
        '',
        `Hii ni taarifa rasmi kwamba unatakiwa kuondoka katika nyumba uliyokodisha hapo juu kufikia tarehe ${v.vacateByDate}.`,
        '',
        '## Sababu',
        '',
        `Sababu ya taarifa hii ni: **${SW_REASONS[v.reason]}**.`,
        v.reason === 'arrears' && v.arrearsAmount
          ? `Kiasi cha madeni: ${v.arrearsCurrency} ${v.arrearsAmount.toLocaleString()}${v.arrearsMonths ? ` (miezi ${v.arrearsMonths})` : ''}.`
          : '',
        '',
        '## Muda wa Kurekebisha',
        '',
        `Unayo siku ${v.remedyWindowDays} kuanzia tarehe ya taarifa hii kurekebisha hali (mfano: kulipa madeni au kurekebisha ukiukaji). Ikiwa hali itarekebishwa ndani ya muda huo, taarifa hii itasitishwa.`,
        '',
        '## Hatua Inayofuata',
        '',
        `Iwapo hutaondoka kufikia ${v.vacateByDate} na sababu hazitaweza kurekebishwa, tutawasilisha shauri katika baraza la kodi/mahakama ya ${v.jurisdiction} bila taarifa nyingine.`,
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
      `# NOTICE TO VACATE`,
      '',
      `**Date:** ${today}`,
      `**To:** ${v.tenantName}`,
      `**Premises:** ${v.unitDescriptor}, ${v.premisesAddress}`,
      '',
      '---',
      '',
      `Dear ${v.tenantName},`,
      '',
      `This is formal notice that you are required to vacate the above premises by ${v.vacateByDate}.`,
      '',
      '## Grounds',
      '',
      `The grounds for this notice: **${EN_REASONS[v.reason]}**.`,
      v.reason === 'arrears' && v.arrearsAmount
        ? `Arrears amount: ${v.arrearsCurrency} ${v.arrearsAmount.toLocaleString()}${v.arrearsMonths ? ` (${v.arrearsMonths} month(s))` : ''}.`
        : '',
      '',
      '## Remedy Window',
      '',
      `You have ${v.remedyWindowDays} days from the date of this notice to remedy the situation (e.g. pay arrears or cure the breach). If remedied within that window, this notice will be withdrawn.`,
      '',
      '## Escalation',
      '',
      `If you do not vacate by ${v.vacateByDate} and the grounds remain unremedied, we will proceed to the housing tribunal / courts of ${v.jurisdiction} without further notice.`,
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
