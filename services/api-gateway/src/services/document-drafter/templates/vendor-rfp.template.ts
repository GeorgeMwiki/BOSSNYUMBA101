/**
 * Vendor RFP template — for property maintenance / cleaning / security
 * contracts. Bilingual sw/en.
 *
 * The landlord uses this to invite competing bids for a recurring
 * vendor service. The template encodes the scope, response format,
 * evaluation criteria, and timeline.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  rfpNumber: z.string().min(1).max(80),
  serviceCategory: z.enum([
    'maintenance',
    'cleaning',
    'security',
    'landscaping',
    'pest_control',
    'plumbing',
    'electrical',
    'painting',
    'other',
  ]),
  scope: z.string().min(1).max(2000),
  estateName: z.string().min(1).max(200),
  numberOfUnits: z.number().int().positive(),
  durationMonths: z.number().int().positive().max(60),
  responseDeadline: z.string().min(1).max(40),
  contractStartDate: z.string().min(1).max(40),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().max(120),
  evaluationCriteria: z.array(z.string()).optional(),
});

export const vendorRfpTemplate: UniversalTemplate = {
  id: 'vendor-rfp',
  title: { en: 'Vendor RFP', sw: 'Ombi la Bei kwa Wakala' },
  kind: 'rfp',
  description:
    'Request-for-proposal to vendors for recurring property services (maintenance, cleaning, security, landscaping).',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    const criteria = v.evaluationCriteria ?? [
      lang === 'sw' ? 'Bei na thamani ya pesa' : 'Price and value for money',
      lang === 'sw' ? 'Uzoefu na nyaraka' : 'Experience and references',
      lang === 'sw' ? 'Idadi ya watu na zana' : 'Crew size and equipment',
      lang === 'sw' ? 'SLA na muda wa majibu' : 'SLA and response time',
      lang === 'sw' ? 'Bima na utiifu' : 'Insurance and compliance',
    ];
    if (lang === 'sw') {
      return [
        `# OMBI LA BEI (RFP) — ${v.rfpNumber}`,
        '',
        `## 1. Utangulizi`,
        '',
        `Mali "${v.estateName}" (jumla ya nyumba ${v.numberOfUnits}) inahitaji huduma ya **${v.serviceCategory}** kwa kipindi cha miezi ${v.durationMonths}, kuanzia ${v.contractStartDate}.`,
        '',
        `## 2. Wigo wa Kazi`,
        '',
        v.scope.trim(),
        '',
        `## 3. Sehemu za Jibu Lako`,
        '',
        '- Wasifu wa kampuni + nyaraka tatu za hivi karibuni',
        '- Bei ya kila mwezi + ujumla wa kipindi chote',
        '- SLA + muda wa majibu kwa hitilafu',
        '- Idadi ya watu na zana watakaohusika',
        '- Hati ya bima halali',
        '',
        `## 4. Vigezo vya Uchaguzi`,
        '',
        ...criteria.map((c, i) => `${i + 1}. ${c}`),
        '',
        `## 5. Muda`,
        '',
        `- Tarehe ya mwisho ya kuwasilisha jibu: **${v.responseDeadline}**`,
        `- Tarehe ya kuanza kazi: ${v.contractStartDate}`,
        '',
        `## 6. Mawasiliano`,
        '',
        `Mwasiliani: ${v.contactName}`,
        `Barua-pepe: ${v.contactEmail}`,
      ].join('\n');
    }
    return [
      `# REQUEST FOR PROPOSAL — ${v.rfpNumber}`,
      '',
      `## 1. Introduction`,
      '',
      `"${v.estateName}" (total ${v.numberOfUnits} units) requires **${v.serviceCategory}** services for a period of ${v.durationMonths} months, commencing ${v.contractStartDate}.`,
      '',
      `## 2. Scope of Work`,
      '',
      v.scope.trim(),
      '',
      `## 3. Required Response Sections`,
      '',
      '- Company profile + three recent references',
      '- Monthly price + total for the full period',
      '- SLA + response time on faults',
      '- Crew size and equipment to be deployed',
      '- Proof of valid insurance',
      '',
      `## 4. Evaluation Criteria`,
      '',
      ...criteria.map((c, i) => `${i + 1}. ${c}`),
      '',
      `## 5. Timeline`,
      '',
      `- Response submission deadline: **${v.responseDeadline}**`,
      `- Contract start date: ${v.contractStartDate}`,
      '',
      `## 6. Contact`,
      '',
      `Contact: ${v.contactName}`,
      `Email: ${v.contactEmail}`,
    ].join('\n');
  },
  renderHints: { classification: 'public', headerLogo: true, coverPage: true },
};
