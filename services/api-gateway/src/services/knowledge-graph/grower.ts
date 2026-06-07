/**
 * Knowledge-graph grower — Wave COMPANY-BRAIN (C-4).
 * Ported from Borjie grower.ts, retailored for real-estate.
 *
 * After a doc lands in `intelligence_corpus_chunks`, walk its chunks +
 * extracted facts, detect entity mentions, and:
 *
 *   1. UPSERT each new entity into `entity_index` so the brain can
 *      resolve a natural-language phrase ("Tenant Asha") to a row.
 *   2. INSERT typed edges into `entity_cross_references` linking the
 *      new entities back to the upload (kind='doc_upload') and to each
 *      other when they co-occur in the same chunk.
 *
 * Heuristic-only — no LLM call. Cheap, deterministic, and good enough
 * to surface the first 5-15 entities per doc on day 1. The LATS
 * deliberation pipeline picks up where this leaves off when the
 * landlord asks deeper questions.
 *
 * Memory durability: never deletes from entity_index nor
 * entity_cross_references. Upserts only.
 */

import { sql } from 'drizzle-orm';
import { entityIndex, entityCrossReferences } from '@bossnyumba/database';
import type { ParsedDoc, TextChunk } from '../brain-ingestion/types.js';
import { getDb } from '../../composition/db-client.js';

export interface GrowKnowledgeInput {
  readonly tenantId: string;
  readonly uploadId: string;
  readonly originalFilename: string;
  readonly parsed: ParsedDoc;
  readonly chunks: ReadonlyArray<TextChunk>;
}

export interface GrowKnowledgeResult {
  readonly entitiesExtracted: number;
  readonly crossRefsCreated: number;
  readonly previewEntities: ReadonlyArray<{
    readonly kind: string;
    readonly id: string;
    readonly displayName: string;
  }>;
}

interface ExtractedEntity {
  readonly kind: string;
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  /** Chunk index where the entity first appeared. */
  readonly chunkIndex: number;
}

// ─── extraction heuristics ─────────────────────────────────────────

/**
 * Pull money amounts (TZS, USD, KES, EUR, GBP, RWF, UGX, ZMW, NGN, GHS,
 * ZAR) out of a chunk. Conservative — only matches when a currency code
 * is present.
 */
// eslint-disable-next-line security/detect-unsafe-regex -- reason: mandatory separator between digit groups prevents backtracking overlap; applied to internal corpus text, not raw user input
const MONEY_RE = /\b(TZS|USD|KES|EUR|GBP|RWF|UGX|ZMW|NGN|GHS|ZAR|TSh|KSh|Sh)\s?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)\b/gi;

const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/g;

const EMAIL_RE = /\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi;

const PHONE_RE = /\b(\+?2557\d{8}|\+?255\d{9}|07\d{8}|\+?2547\d{8}|\+?254\d{9})\b/g;

/**
 * Real-estate domain literal tokens. Each hit promotes the doc to
 * mention the corresponding canonical entity in entity_index.
 */
const REAL_ESTATE_TOKENS: ReadonlyArray<{
  readonly re: RegExp;
  readonly kind: string;
  readonly canonicalId: string;
  readonly displayName: string;
}> = [
  // unit / property types
  { re: /\b(apartment|flat)\b/gi, kind: 'unit_type', canonicalId: 'apartment', displayName: 'Apartment' },
  { re: /\bnyumba\b/gi, kind: 'unit_type', canonicalId: 'house', displayName: 'Nyumba (House)' },
  { re: /\bbungalow\b/gi, kind: 'unit_type', canonicalId: 'bungalow', displayName: 'Bungalow' },
  { re: /\b(studio|bedsitter|single-?room)\b/gi, kind: 'unit_type', canonicalId: 'studio', displayName: 'Studio / Bedsitter' },
  { re: /\b(maisonette|townhouse|town\s?house)\b/gi, kind: 'unit_type', canonicalId: 'maisonette', displayName: 'Maisonette / Townhouse' },
  { re: /\b(godown|warehouse)\b/gi, kind: 'unit_type', canonicalId: 'warehouse', displayName: 'Godown / Warehouse' },
  { re: /\b(office\s?space|commercial\s?unit)\b/gi, kind: 'unit_type', canonicalId: 'office', displayName: 'Office Space' },
  // lease + financial concepts
  { re: /\b(lease|kodisha|kodi\s?ya\s?nyumba)\b/gi, kind: 'concept', canonicalId: 'lease', displayName: 'Lease (Kodi)' },
  { re: /\b(rent|kodi)\b/gi, kind: 'concept', canonicalId: 'rent', displayName: 'Rent (Kodi)' },
  { re: /\b(deposit|amana|caution)\b/gi, kind: 'concept', canonicalId: 'deposit', displayName: 'Deposit (Amana)' },
  { re: /\b(service\s?charge|council\s?levy)\b/gi, kind: 'concept', canonicalId: 'service_charge', displayName: 'Service Charge' },
  { re: /\b(arrears|madeni)\b/gi, kind: 'concept', canonicalId: 'arrears', displayName: 'Arrears (Madeni)' },
  // operations
  { re: /\b(maintenance|matengenezo)\b/gi, kind: 'concept', canonicalId: 'maintenance', displayName: 'Maintenance (Matengenezo)' },
  { re: /\b(inspection|ukaguzi)\b/gi, kind: 'concept', canonicalId: 'inspection', displayName: 'Inspection (Ukaguzi)' },
  { re: /\b(eviction|kuondoa|kufukuza)\b/gi, kind: 'concept', canonicalId: 'eviction', displayName: 'Eviction (Kufukuza)' },
  { re: /\b(handover|hand-?over|makabidhiano)\b/gi, kind: 'concept', canonicalId: 'handover', displayName: 'Handover (Makabidhiano)' },
  // regulators + bodies (TZ / KE / pan-African real-estate stack)
  { re: /\bNHC\b/g, kind: 'regulator', canonicalId: 'nhc', displayName: 'NHC (National Housing Corporation)' },
  { re: /\bTRA\b/g, kind: 'regulator', canonicalId: 'tra', displayName: 'TRA (Tanzania Revenue Authority)' },
  { re: /\bKRA\b/g, kind: 'regulator', canonicalId: 'kra', displayName: 'KRA (Kenya Revenue Authority)' },
  { re: /\bBRELA\b/gi, kind: 'regulator', canonicalId: 'brela', displayName: 'BRELA' },
  { re: /\bBoT\b/g, kind: 'regulator', canonicalId: 'bot', displayName: 'Bank of Tanzania' },
  { re: /\b(municipal\s?council|halmashauri)\b/gi, kind: 'regulator', canonicalId: 'municipal_council', displayName: 'Municipal Council (Halmashauri)' },
  { re: /\b(housing\s?board|tribunal)\b/gi, kind: 'regulator', canonicalId: 'housing_tribunal', displayName: 'Housing Tribunal' },
  // people roles
  { re: /\b(landlord|mwenye\s?nyumba)\b/gi, kind: 'role', canonicalId: 'landlord', displayName: 'Landlord (Mwenye Nyumba)' },
  { re: /\b(tenant|mpangaji)\b/gi, kind: 'role', canonicalId: 'tenant', displayName: 'Tenant (Mpangaji)' },
  { re: /\b(caretaker|mlinzi|janitor)\b/gi, kind: 'role', canonicalId: 'caretaker', displayName: 'Caretaker (Mlinzi)' },
  { re: /\b(agent|wakala)\b/gi, kind: 'role', canonicalId: 'agent', displayName: 'Agent (Wakala)' },
];

/**
 * Extract proper nouns from a chunk using a conservative capitalised-
 * run detector. Won't catch lower-case ASCII names (rare in our
 * corpus) and tolerates Swahili names with vowel-heavy syllables.
 */
function extractProperNouns(text: string): ReadonlyArray<string> {
  // eslint-disable-next-line security/detect-unsafe-regex -- reason: bounded repetition {0,3} on non-overlapping capitalised-word groups; applied to internal corpus text, not raw user input
  const matches = text.match(/\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,3})\b/g) ?? [];
  const STOP = new Set([
    'BossNyumba',
    'Bossnyumba',
    'Mr',
    'Mrs',
    'Ms',
    'Tanzania',
    'Kenya',
    'Uganda',
    'Nigeria',
    'The',
    'This',
    'That',
    'These',
    'Those',
    'TZS',
    'USD',
    'KES',
    'NGN',
  ]);
  const unique = new Set<string>();
  for (const m of matches) {
    const trimmed = m.trim();
    if (trimmed.length < 4) continue;
    if (STOP.has(trimmed)) continue;
    unique.add(trimmed);
    if (unique.size >= 20) break;
  }
  return Object.freeze([...unique]);
}

function tokenSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function extractEntities(
  uploadId: string,
  parsed: ParsedDoc,
  chunks: ReadonlyArray<TextChunk>,
): ReadonlyArray<ExtractedEntity> {
  const entities = new Map<string, ExtractedEntity>();

  // 0. The upload itself is a first-class entity in the graph.
  entities.set(`doc_upload::${uploadId}`, {
    kind: 'doc_upload',
    id: uploadId,
    displayName: 'Uploaded document',
    summary: parsed.text.slice(0, 200),
    tags: Object.freeze([`source:${parsed.detectedLanguage}`]),
    chunkIndex: 0,
  });

  // 1. Real-estate domain literals.
  for (const tok of REAL_ESTATE_TOKENS) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const matches = chunk.text.match(tok.re);
      if (!matches) continue;
      const key = `${tok.kind}::${tok.canonicalId}`;
      if (!entities.has(key)) {
        entities.set(key, {
          kind: tok.kind,
          id: tok.canonicalId,
          displayName: tok.displayName,
          summary: `Mentioned in ${parsed.text.slice(0, 80)}…`,
          tags: Object.freeze([`hits:${matches.length}`]),
          chunkIndex: i,
        });
      }
    }
  }

  // 2. Money / dates / emails / phones — typed entities.
  const TYPED: ReadonlyArray<{ kind: string; re: RegExp }> = [
    { kind: 'money_mention', re: MONEY_RE },
    { kind: 'date_mention', re: DATE_RE },
    { kind: 'email_mention', re: EMAIL_RE },
    { kind: 'phone_mention', re: PHONE_RE },
  ];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    for (const t of TYPED) {
      // Each typed regex has the `g` flag — reset lastIndex per chunk.
      t.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const localCap = 6;
      let count = 0;
      while ((m = t.re.exec(chunk.text)) !== null && count < localCap) {
        const literal = m[0];
        const id = `${tokenSlug(literal)}__${i}`;
        const key = `${t.kind}::${id}`;
        if (!entities.has(key)) {
          entities.set(key, {
            kind: t.kind,
            id,
            displayName: literal,
            summary: `Found in chunk ${i}`,
            tags: Object.freeze([`chunk:${i}`]),
            chunkIndex: i,
          });
        }
        count += 1;
      }
    }

    // 3. Proper nouns → candidate entities (person, organisation, place).
    const nouns = extractProperNouns(chunk.text);
    for (const noun of nouns) {
      const id = tokenSlug(noun);
      const key = `candidate_entity::${id}`;
      if (!entities.has(key)) {
        entities.set(key, {
          kind: 'candidate_entity',
          id,
          displayName: noun,
          summary: `Mentioned proper noun (chunk ${i})`,
          tags: Object.freeze(['unresolved']),
          chunkIndex: i,
        });
      }
    }
  }

  return Object.freeze([...entities.values()]);
}

// ─── persistence ────────────────────────────────────────────────────

interface UpsertableDb {
  insert: (table: unknown) => {
    values: (row: Record<string, unknown>) => {
      onConflictDoUpdate: (args: {
        target: ReadonlyArray<unknown>;
        set: Record<string, unknown>;
      }) => Promise<unknown>;
      onConflictDoNothing: () => Promise<unknown>;
    };
  };
}

async function upsertEntities(
  db: UpsertableDb,
  tenantId: string,
  entities: ReadonlyArray<ExtractedEntity>,
): Promise<void> {
  for (const e of entities) {
    await db
      .insert(entityIndex)
      .values({
        tenantId,
        entityKind: e.kind,
        entityId: e.id,
        displayName: e.displayName,
        summary: e.summary,
        tags: [...e.tags],
        lifecycleStage: 'active',
      } as Record<string, unknown>)
      .onConflictDoUpdate({
        target: [
          entityIndex.tenantId,
          entityIndex.entityKind,
          entityIndex.entityId,
        ],
        set: {
          displayName: e.displayName,
          summary: e.summary,
          tags: [...e.tags],
          refreshedAt: sql`now()`,
        },
      });
  }
}

async function insertCrossRefs(
  db: UpsertableDb,
  tenantId: string,
  uploadId: string,
  entities: ReadonlyArray<ExtractedEntity>,
): Promise<number> {
  let inserted = 0;
  // Doc → entity ("doc_mentions_entity" via the 'related' enum value;
  // we use the existing enum domain to avoid a migration for a new
  // value).
  for (const e of entities) {
    if (e.kind === 'doc_upload' && e.id === uploadId) continue;
    await db
      .insert(entityCrossReferences)
      .values({
        tenantId,
        sourceKind: 'doc_upload',
        sourceId: uploadId,
        targetKind: e.kind,
        targetId: e.id,
        relationship: 'related',
        confidence: '0.700',
        derivationSource: 'kg.grower.docMentionsEntity',
        metadata: { chunkIndex: e.chunkIndex },
      } as Record<string, unknown>)
      .onConflictDoNothing();
    inserted += 1;
  }
  // Entity ↔ entity co-occurrence within the same chunk.
  const byChunk = new Map<number, ExtractedEntity[]>();
  for (const e of entities) {
    if (e.kind === 'doc_upload') continue;
    const arr = byChunk.get(e.chunkIndex) ?? [];
    arr.push(e);
    byChunk.set(e.chunkIndex, arr);
  }
  for (const [, group] of byChunk) {
    if (group.length < 2) continue;
    // Cap to avoid quadratic blowup on entity-dense chunks.
    const slice = group.slice(0, 6);
    for (let a = 0; a < slice.length; a++) {
      for (let b = a + 1; b < slice.length; b++) {
        const left = slice[a]!;
        const right = slice[b]!;
        await db
          .insert(entityCrossReferences)
          .values({
            tenantId,
            sourceKind: left.kind,
            sourceId: left.id,
            targetKind: right.kind,
            targetId: right.id,
            relationship: 'related',
            confidence: '0.500',
            derivationSource: 'kg.grower.coOccurrenceInChunk',
            metadata: { chunkIndex: left.chunkIndex },
          } as Record<string, unknown>)
          .onConflictDoNothing();
        inserted += 1;
      }
    }
  }
  return inserted;
}

// ─── public entrypoint ──────────────────────────────────────────────

/**
 * Grow the knowledge graph from a freshly-ingested doc.
 *
 * RLS (#16 follow-up): `boundDb` is the REQUEST-bound tenant transaction
 * handle (`c.get('db')`) threaded down from the corpus-upload handler,
 * which mounts `databaseMiddleware`. Passing it means the `entity_index`
 * + `entity_cross_references` writes below run inside the transaction
 * where `app.current_tenant_id` is bound via `SET LOCAL`, so RLS
 * enforces end-to-end under a non-BYPASSRLS role — instead of escaping
 * to the raw process-singleton client.
 *
 * When `boundDb` is omitted we fall back to the singleton `getDb()` so
 * out-of-request callers (and the no-DB unit tests) keep their existing
 * behaviour unchanged. The queries are identical either way; only the
 * connection the writes execute on differs.
 */
export async function growKnowledgeGraphFromDoc(
  input: GrowKnowledgeInput,
  boundDb?: UpsertableDb | null,
): Promise<GrowKnowledgeResult> {
  // `undefined` ⇒ no handle threaded in (out-of-request caller / tests):
  // resolve the process singleton. An explicit value (incl. null) is
  // honoured as-is so the caller's degraded-mode decision is respected.
  const db =
    boundDb === undefined
      ? (getDb() as unknown as UpsertableDb | null)
      : boundDb;
  const entities = extractEntities(input.uploadId, input.parsed, input.chunks);
  if (!db) {
    return Object.freeze({
      entitiesExtracted: entities.filter((e) => e.kind !== 'doc_upload').length,
      crossRefsCreated: 0,
      previewEntities: Object.freeze(
        entities
          .filter((e) => e.kind !== 'doc_upload')
          .slice(0, 5)
          .map((e) =>
            Object.freeze({
              kind: e.kind,
              id: e.id,
              displayName: e.displayName,
            }),
          ),
      ),
    });
  }
  await upsertEntities(db, input.tenantId, entities);
  const xrefs = await insertCrossRefs(
    db,
    input.tenantId,
    input.uploadId,
    entities,
  );
  return Object.freeze({
    entitiesExtracted: entities.filter((e) => e.kind !== 'doc_upload').length,
    crossRefsCreated: xrefs,
    previewEntities: Object.freeze(
      entities
        .filter((e) => e.kind !== 'doc_upload')
        .slice(0, 5)
        .map((e) =>
          Object.freeze({
            kind: e.kind,
            id: e.id,
            displayName: e.displayName,
          }),
        ),
    ),
  });
}

// ─── extraction-only test helper ───────────────────────────────────

/**
 * Pure extraction with no DB writes — used by unit tests to validate
 * the deterministic entity-detection heuristic without touching
 * Postgres.
 */
export function _extractEntitiesForTest(
  uploadId: string,
  parsed: ParsedDoc,
  chunks: ReadonlyArray<TextChunk>,
): ReadonlyArray<ExtractedEntity> {
  return extractEntities(uploadId, parsed, chunks);
}
