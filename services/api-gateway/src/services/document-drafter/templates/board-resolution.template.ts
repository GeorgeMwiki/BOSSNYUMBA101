/**
 * Board resolution template — bilingual sw/en.
 *
 * For portfolio landlords with multiple shareholders/directors who need
 * to record a formal decision (e.g. approve a vendor, sell a unit,
 * authorise borrowing). Captures the meeting facts and the resolution
 * text.
 */

import { z } from 'zod';
import type { UniversalTemplate } from './types.js';

const vars = z.object({
  companyName: z.string().min(1).max(200),
  resolutionNumber: z.string().min(1).max(80),
  meetingDate: z.string().min(1).max(40),
  resolutionTitle: z.string().min(1).max(200),
  whereasClauses: z.array(z.string()).min(1).max(8),
  resolvedClauses: z.array(z.string()).min(1).max(8),
  directors: z.array(
    z.object({ name: z.string().min(1).max(120), role: z.string().min(1).max(80) }),
  ).min(1).max(15),
});

export const boardResolutionTemplate: UniversalTemplate = {
  id: 'board-resolution',
  title: { en: 'Board Resolution', sw: 'Azimio la Bodi' },
  kind: 'resolution',
  description:
    'Formal board resolution: whereas + resolved clauses, director signatures.',
  variables: vars,
  composeMarkdown(raw, context) {
    const v = vars.parse(raw);
    const lang = context.language ?? 'en';
    if (lang === 'sw') {
      return [
        `# AZIMIO LA BODI`,
        '',
        `**Kampuni:** ${v.companyName}`,
        `**Azimio Na.:** ${v.resolutionNumber}`,
        `**Tarehe ya Mkutano:** ${v.meetingDate}`,
        `**Mada:** ${v.resolutionTitle}`,
        '',
        '---',
        '',
        `## ILHALI`,
        '',
        ...v.whereasClauses.map((c, i) => `${i + 1}. ${c}`),
        '',
        `## IMEAZIMIWA`,
        '',
        ...v.resolvedClauses.map((c, i) => `${i + 1}. ${c}`),
        '',
        '---',
        '',
        '## Wakurugenzi',
        '',
        ...v.directors.map(
          (d) => `- **${d.name}** (${d.role}) ___________________`,
        ),
      ].join('\n');
    }
    return [
      `# BOARD RESOLUTION`,
      '',
      `**Company:** ${v.companyName}`,
      `**Resolution No.:** ${v.resolutionNumber}`,
      `**Meeting Date:** ${v.meetingDate}`,
      `**Title:** ${v.resolutionTitle}`,
      '',
      '---',
      '',
      `## WHEREAS`,
      '',
      ...v.whereasClauses.map((c, i) => `${i + 1}. ${c}`),
      '',
      `## RESOLVED THAT`,
      '',
      ...v.resolvedClauses.map((c, i) => `${i + 1}. ${c}`),
      '',
      '---',
      '',
      '## Directors',
      '',
      ...v.directors.map(
        (d) => `- **${d.name}** (${d.role}) ___________________`,
      ),
    ].join('\n');
  },
  renderHints: { classification: 'internal', headerLogo: true, coverPage: false },
};
