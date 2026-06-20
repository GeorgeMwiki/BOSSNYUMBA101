// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/scope/recent-entities — applicant-scoped @-mention feed.
 *
 * Backs the tenant-mobile chat composer @-menu
 * (apps/tenant-mobile/src/chat/recentEntities.ts → fetchRecentEntities).
 * The client expects `{ data: { entities: [{ id, label: { en, sw },
 * kind }] } }` and tolerates an empty list on any error so the composer
 * stays operational offline.
 *
 * Source of truth: the real RFAs (request-for-applications) this
 * applicant has actually touched — i.e. the vacancy listings they have
 * submitted a response to. We read `request_for_application_responses`
 * (which carries `applicant_id` + `tenant_id`) joined to
 * `request_for_applications` for the listing detail, newest first.
 *
 * Tenant isolation: every query filters on the JWT-derived tenantId AND
 * the JWT-derived applicantId (userId). RLS FORCE on both tables is the
 * backstop; the explicit predicates keep the result applicant-scoped
 * even under a service-role connection.
 *
 * No clean source / degraded mode → `{ data: { entities: [] } }` from a
 * REAL mounted 200 route (never a 404), so the composer renders cleanly.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import {
  requestForApplications,
  requestForApplicationResponses,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { getDbReadonly } from '../composition/db-client';

const scopeRecentEntitiesRouter = new Hono();
scopeRecentEntitiesRouter.use('*', authMiddleware);

// Bounded query params — `limit` is clamped to a sane window; `kind` is
// accepted for forward-compatibility with the client's filter but does
// not currently narrow the RFA source (the only applicant-scoped source
// wired today). Unknown values fall back to defaults rather than 400 so
// the composer never hard-fails on a param mismatch.
const QuerySchema = z.object({
  kind: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const DEFAULT_LIMIT = 20;

const PROPERTY_TYPE_LABEL_SW: Readonly<Record<string, string>> = {
  residential: 'Makazi',
  commercial: 'Biashara',
  mixed: 'Mchanganyiko',
  industrial: 'Viwanda',
  student_housing: 'Wanafunzi',
  vacation_rental: 'Likizo',
  other: 'Nyingine',
};

const PROPERTY_TYPE_LABEL_EN: Readonly<Record<string, string>> = {
  residential: 'Residential',
  commercial: 'Commercial',
  mixed: 'Mixed-use',
  industrial: 'Industrial',
  student_housing: 'Student housing',
  vacation_rental: 'Vacation rental',
  other: 'Other',
};

/**
 * Build a bilingual, single-locale-rendered label for an RFA the
 * applicant responded to. Prefers the neighbourhood; otherwise falls
 * back to the property-type vocabulary. Both `en` and `sw` are always
 * present so the client renders one language per active locale with no
 * cross-language fallback.
 */
function buildRfaLabel(row: {
  neighbourhood: string | null;
  propertyType: string | null;
}): { readonly en: string; readonly sw: string } {
  const neighbourhood =
    typeof row.neighbourhood === 'string' && row.neighbourhood.trim().length > 0
      ? row.neighbourhood.trim()
      : null;
  const typeKey =
    typeof row.propertyType === 'string' ? row.propertyType : 'other';
  const typeEn = PROPERTY_TYPE_LABEL_EN[typeKey] ?? PROPERTY_TYPE_LABEL_EN.other;
  const typeSw = PROPERTY_TYPE_LABEL_SW[typeKey] ?? PROPERTY_TYPE_LABEL_SW.other;
  if (neighbourhood) {
    return {
      en: `${typeEn} — ${neighbourhood}`,
      sw: `${typeSw} — ${neighbourhood}`,
    };
  }
  return { en: typeEn, sw: typeSw };
}

scopeRecentEntitiesRouter.get('/recent-entities', async (c) => {
  const auth = c.get('auth') ?? {};
  const tenantId = typeof auth.tenantId === 'string' ? auth.tenantId : null;
  const applicantId =
    typeof auth.userId === 'string'
      ? auth.userId
      : typeof auth.sub === 'string'
      ? auth.sub
      : null;

  // No identity / no DB → REAL 200 empty list (never 404).
  const db = getDbReadonly();
  if (!db || !tenantId || !applicantId) {
    return c.json({ success: true, data: { entities: [] } });
  }

  const parsed = QuerySchema.safeParse({
    kind: c.req.query('kind'),
    limit: c.req.query('limit'),
  });
  const limit = parsed.success && parsed.data.limit ? parsed.data.limit : DEFAULT_LIMIT;

  try {
    // Distinct RFAs this applicant has responded to, newest response
    // first. The join keeps the listing detail (neighbourhood / type)
    // for a meaningful @-mention label. RLS FORCE + the explicit
    // tenant/applicant predicates keep this strictly applicant-scoped.
    const rows = (await db
      .select({
        id: requestForApplications.id,
        neighbourhood: requestForApplications.neighbourhood,
        propertyType: requestForApplications.propertyType,
        respondedAt: requestForApplicationResponses.createdAt,
      })
      .from(requestForApplicationResponses)
      .innerJoin(
        requestForApplications,
        eq(requestForApplicationResponses.rfaId, requestForApplications.id),
      )
      .where(
        and(
          eq(requestForApplicationResponses.tenantId, tenantId),
          eq(requestForApplicationResponses.applicantId, applicantId),
        ),
      )
      .orderBy(desc(requestForApplicationResponses.createdAt))
      .limit(limit)) as ReadonlyArray<{
      id: string;
      neighbourhood: string | null;
      propertyType: string | null;
      respondedAt: Date | string | null;
    }>;

    // De-dupe by RFA id (an applicant may respond more than once to the
    // same listing); preserve newest-first order.
    const seen = new Set<string>();
    const entities = rows
      .filter((row) => {
        if (!row || typeof row.id !== 'string' || row.id.length === 0) return false;
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .map((row) => ({
        id: row.id,
        label: buildRfaLabel(row),
        // The client's KIND_MAP recognises 'scope_node' → 'scope'; these
        // are scope nodes the applicant can @-mention.
        kind: 'scope_node' as const,
      }));

    return c.json({ success: true, data: { entities } });
  } catch (error) {
    // Honest empty on failure — the composer tolerates `entities: []`.
    return c.json({
      success: true,
      data: { entities: [] },
      meta: {
        degraded: true,
        reason:
          error instanceof Error ? error.message : 'recent-entities query failed',
      },
    });
  }
});

export default scopeRecentEntitiesRouter;
