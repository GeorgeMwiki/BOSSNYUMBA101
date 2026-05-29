/**
 * Universal Drafter template module contract.
 * Ported from Borjie, retailored for BossNyumba (real-estate).
 *
 * Wave UNIVERSAL-DOC-DRAFTER. Real-estate templates are authored as
 * TypeScript modules (not paired markdown files) so the brain can pass
 * structured fillVars validated by zod and so each template can
 * compose context-aware prose.
 */

import type { z } from 'zod';

/** Language codes the drafter targets. */
export type DraftLanguage = 'sw' | 'en' | 'bilingual';

/** Document kinds the BossNyumba drafter produces. */
export type DraftKind =
  | 'contract' // lease, vendor contract
  | 'rfp' // vendor RFP
  | 'rfp_response'
  | 'letter' // tenant / regulator / vendor letter
  | 'notice' // rent increase / lease termination
  | 'memo' // internal memo
  | 'mou' // partnership / cooperative
  | 'resolution' // board resolution
  | 'plan' // business plan / investor plan
  | 'report' // audit / financial / inspection
  | 'proposal' // sponsorship / partnership
  | 'sop' // safety / ops SOP
  | 'training' // training material
  | 'manual'; // operations manual

export interface BilingualTitle {
  readonly en: string;
  readonly sw: string;
}

export interface OwnerProfileLite {
  readonly id?: string;
  readonly displayName?: string;
  readonly tenantTradingName?: string;
  readonly jurisdiction?: string;
}

export interface TemplateComposeContext {
  readonly ownerProfile?: OwnerProfileLite;
  readonly scope?: Record<string, unknown>;
  readonly dataResolvers?: Record<string, (key: string) => Promise<unknown>>;
  readonly language?: DraftLanguage;
  readonly tenantTradingName?: string;
}

export interface TemplateRenderHints {
  readonly preferredFormat?: 'md' | 'pdf' | 'docx' | 'pptx' | 'html';
  readonly classification?: 'public' | 'internal' | 'confidential';
  readonly headerLogo?: boolean;
  readonly coverPage?: boolean;
}

export interface UniversalTemplate {
  readonly id: string;
  readonly title: BilingualTitle;
  readonly kind: DraftKind;
  readonly description: string;
  readonly variables: z.ZodTypeAny;
  readonly composeMarkdown: (
    vars: Record<string, unknown>,
    context: TemplateComposeContext,
  ) => Promise<string> | string;
  readonly renderHints: TemplateRenderHints;
}
