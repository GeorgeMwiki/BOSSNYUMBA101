/**
 * Registry of the TypeScript-module real-estate templates.
 * Ported from Borjie, retailored for BossNyumba.
 *
 * Wave UNIVERSAL-DOC-DRAFTER. Each template ships as a TS module with
 * a `composeMarkdown(vars, context)` API that returns the final
 * document body in one call (no separate placeholder pass).
 */

import type { UniversalTemplate } from './types.js';
import { memoInternalTemplate } from './memo-internal.template.js';
import { leaseAgreementTemplate } from './lease-agreement.template.js';
import { rentIncreaseNoticeTemplate } from './rent-increase-notice.template.js';
import { evictionNoticeTemplate } from './eviction-notice.template.js';
import { vendorRfpTemplate } from './vendor-rfp.template.js';
import { tenantWelcomeLetterTemplate } from './tenant-welcome-letter.template.js';
import { boardResolutionTemplate } from './board-resolution.template.js';

export const UNIVERSAL_TEMPLATES: ReadonlyArray<UniversalTemplate> = [
  memoInternalTemplate,
  leaseAgreementTemplate,
  rentIncreaseNoticeTemplate,
  evictionNoticeTemplate,
  vendorRfpTemplate,
  tenantWelcomeLetterTemplate,
  boardResolutionTemplate,
];

const INDEX_BY_ID = new Map<string, UniversalTemplate>(
  UNIVERSAL_TEMPLATES.map((t) => [t.id, t]),
);

export function findUniversalTemplate(
  id: string,
): UniversalTemplate | undefined {
  return INDEX_BY_ID.get(id);
}

export function listUniversalTemplates(): ReadonlyArray<{
  readonly id: string;
  readonly title: { en: string; sw: string };
  readonly kind: string;
  readonly description: string;
}> {
  return UNIVERSAL_TEMPLATES.map((t) => ({
    id: t.id,
    title: t.title,
    kind: t.kind,
    description: t.description,
  }));
}
