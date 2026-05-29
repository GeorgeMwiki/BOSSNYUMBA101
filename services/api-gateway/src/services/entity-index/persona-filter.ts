/**
 * Persona-aware filter for the entity-index query layer (real-estate).
 *
 * Port from Borjie services/api-gateway/src/services/entity-index/
 * persona-filter.ts, retailored for real-estate personas + vocabulary.
 *
 * The same `entity.search` / `entity.resolve` / `entity.full_picture`
 * query under owner JWT vs manager JWT vs tenant JWT must return:
 *
 *   1. DIFFERENT ROWS — managers see only properties they manage;
 *      tenants see only their own lease + maintenance; owners see all.
 *
 *   2. DIFFERENT FIELDS — rent figures, arrears, tenant PII are
 *      redacted for maintenance contractors / inspectors.
 *
 *   3. DIFFERENT VOCABULARY — maintenance contractors get crew-
 *      appropriate summary ("Plumbing job at Nyumba 4B") not exec
 *      language ("$8K bathroom flood repair, lease at risk").
 *
 * Pure, dependency-free. No DB / HTTP / I/O.
 */

export const ENTITY_INDEX_PERSONAS = [
  'owner_strategist',
  'admin_strategist',
  'property_manager',
  'maintenance_contractor',
  'tenant',
  'applicant',
  'inspector',
  'auditor',
] as const;
export type EntityIndexPersona = (typeof ENTITY_INDEX_PERSONAS)[number];

const SENSITIVE_PATTERNS_EN: ReadonlyArray<RegExp> = Object.freeze([
  /\$\s*[\d,]+(\.\d+)?\s*(M|K|million|thousand)?/gi,
  /TZS\s*[\d,]+(\.\d+)?\s*(M|K|million|thousand)?/gi,
  /KES\s*[\d,]+(\.\d+)?/gi,
  /USD\s*[\d,]+(\.\d+)?/gi,
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,
  /arrears\s+\d/gi,
  /rent\s+\$?\d/gi,
]);

const SENSITIVE_PATTERNS_SW: ReadonlyArray<RegExp> = Object.freeze([
  /TZS\s*[\d,]+(\.\d+)?/gi,
  /madeni\s+\d/gi,
  /kodi\s+\d/gi,
]);

const REDACTED_LABEL: Record<'en' | 'sw', string> = {
  en: '[redacted]',
  sw: '[siri]',
};

const CONTRACTOR_KIND_VOCAB: Record<string, { en: string; sw: string }> = {
  lease: { en: 'Tenancy', sw: 'Upangaji' },
  rent_invoice: { en: 'Billing record', sw: 'Bili' },
  maintenance_ticket: { en: 'Maintenance job', sw: 'Kazi ya matengenezo' },
  tenant: { en: 'Occupant', sw: 'Mkazi' },
  property: { en: 'Building', sw: 'Jengo' },
};

export interface EntityIndexRow {
  readonly kind: string;
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly tags?: ReadonlyArray<string>;
  readonly lifecycleStage?: string;
  readonly refreshedAt?: string;
  readonly scopeId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PersonaProjection {
  /** Allowed scope ids; null = no scope restriction. */
  readonly scopeIdsAllowed: ReadonlyArray<string> | null;
  /** When true, post-query redactor strips money / arrears / rent. */
  readonly redactFinancials: boolean;
  /** When true, kind vocabulary is swapped to contractor-appropriate. */
  readonly rewriteVocabulary: boolean;
  /** Counterparty cap for tenant / applicant personas. */
  readonly counterpartyId: string | null;
}

export interface ComputePersonaProjectionInput {
  readonly persona: EntityIndexPersona;
  readonly actorScopeIds: ReadonlyArray<string>;
  readonly counterpartyId?: string | null;
}

export function computePersonaProjection(
  input: ComputePersonaProjectionInput,
): PersonaProjection {
  const { persona, actorScopeIds, counterpartyId = null } = input;

  switch (persona) {
    case 'owner_strategist':
    case 'admin_strategist':
    case 'auditor':
      return Object.freeze({
        scopeIdsAllowed: null,
        redactFinancials: false,
        rewriteVocabulary: false,
        counterpartyId: null,
      });
    case 'property_manager':
      return Object.freeze({
        scopeIdsAllowed: Object.freeze([...actorScopeIds]),
        redactFinancials: false,
        rewriteVocabulary: false,
        counterpartyId: null,
      });
    case 'maintenance_contractor':
    case 'inspector':
      return Object.freeze({
        scopeIdsAllowed: Object.freeze([...actorScopeIds]),
        redactFinancials: true,
        rewriteVocabulary: true,
        counterpartyId: null,
      });
    case 'tenant':
    case 'applicant':
      return Object.freeze({
        scopeIdsAllowed: Object.freeze([...actorScopeIds]),
        redactFinancials: true,
        rewriteVocabulary: false,
        counterpartyId,
      });
    default:
      return Object.freeze({
        scopeIdsAllowed: Object.freeze([]),
        redactFinancials: true,
        rewriteVocabulary: true,
        counterpartyId: null,
      });
  }
}

function redactText(text: string, language: 'en' | 'sw'): string {
  const label = REDACTED_LABEL[language];
  const patterns = language === 'sw' ? SENSITIVE_PATTERNS_SW : SENSITIVE_PATTERNS_EN;
  let out = text;
  for (const pattern of patterns) {
    out = out.replace(pattern, label);
  }
  return out;
}

export function applyPersonaFilter(
  rows: ReadonlyArray<EntityIndexRow>,
  projection: PersonaProjection,
  language: 'en' | 'sw' = 'en',
): ReadonlyArray<EntityIndexRow> {
  if (!projection.redactFinancials && !projection.rewriteVocabulary) {
    return rows;
  }
  return rows.map((row) => {
    let displayName = row.displayName;
    let summary = row.summary;

    if (projection.rewriteVocabulary) {
      const vocab = CONTRACTOR_KIND_VOCAB[row.kind];
      if (vocab) {
        displayName = `${vocab[language]}: ${row.displayName}`;
      }
    }
    if (projection.redactFinancials) {
      summary = redactText(summary, language);
    }
    return Object.freeze({
      ...row,
      displayName,
      summary,
    });
  });
}
