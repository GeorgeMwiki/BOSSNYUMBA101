/**
 * Document Drafter — public service API (real-estate edition).
 *
 * Composes legal / commercial / regulatory documents (leases, RFPs,
 * rent-increase notices, eviction notices, welcome letters, memos,
 * board resolutions) and renders them through 5 format backends
 * (md/pdf/docx/pptx/html).
 *
 * The drafter is composition-root agnostic: the persistence port is
 * pluggable (the api-gateway will bind a Drizzle implementation once
 * the `document_drafts` table is wired). The compose + render path is
 * pure and self-contained for unit testing.
 */

import {
  findUniversalTemplate,
  listUniversalTemplates,
  UNIVERSAL_TEMPLATES,
} from './templates/universal-registry.js';
import type { TemplateComposeContext } from './templates/types.js';
import {
  renderDraft,
  type RenderFormat,
  type RenderResult,
  type RenderRichOptions,
} from './renderers/index.js';
import type { BrandContext } from './brand.js';

export interface ComposeDraftInput {
  readonly templateId: string;
  readonly language: 'sw' | 'en' | 'bilingual';
  readonly fillVars: Record<string, unknown>;
  readonly context?: Omit<TemplateComposeContext, 'language'>;
}

export interface ComposeDraftResult {
  readonly templateId: string;
  readonly language: 'sw' | 'en' | 'bilingual';
  readonly contentMd: string;
  /** Bilingual concatenation (sw above, divider, en below) when
   * language='bilingual'. */
  readonly isBilingualMerge: boolean;
}

export async function composeDraft(
  input: ComposeDraftInput,
): Promise<ComposeDraftResult> {
  const template = findUniversalTemplate(input.templateId);
  if (!template) {
    throw new Error(`document-drafter: unknown template "${input.templateId}"`);
  }
  const baseContext: TemplateComposeContext = {
    ...(input.context ?? {}),
    language: input.language,
  };
  if (input.language === 'bilingual') {
    const sw = await template.composeMarkdown(input.fillVars, {
      ...baseContext,
      language: 'sw',
    });
    const en = await template.composeMarkdown(input.fillVars, {
      ...baseContext,
      language: 'en',
    });
    return Object.freeze({
      templateId: input.templateId,
      language: 'bilingual' as const,
      contentMd: `${sw}\n\n---\n\n${en}`,
      isBilingualMerge: true,
    });
  }
  const md = await template.composeMarkdown(input.fillVars, baseContext);
  return Object.freeze({
    templateId: input.templateId,
    language: input.language,
    contentMd: md,
    isBilingualMerge: false,
  });
}

export async function renderComposedDraft(
  composed: ComposeDraftResult,
  format: RenderFormat,
  brand: BrandContext,
  opts: RenderRichOptions = {},
): Promise<RenderResult> {
  return renderDraft(format, composed.contentMd, brand, opts);
}

export {
  findUniversalTemplate,
  listUniversalTemplates,
  UNIVERSAL_TEMPLATES,
} from './templates/universal-registry.js';
export type {
  UniversalTemplate,
  TemplateComposeContext,
  TemplateRenderHints,
  BilingualTitle,
  OwnerProfileLite,
  DraftKind,
  DraftLanguage,
} from './templates/types.js';
export {
  renderDraft,
  type RenderFormat,
  type RenderResult,
  type RenderRichOptions,
} from './renderers/index.js';
export {
  DEFAULT_BRAND_STYLE,
  type BrandContext,
  type BrandStyle,
} from './brand.js';
