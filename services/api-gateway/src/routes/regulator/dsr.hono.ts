/**
 * /api/v1/regulator/dsr — G1-A closure (jurisdiction-aware DSR flow).
 *
 * Surfaces a per-jurisdiction Data Subject Request (DSR) flow tailored
 * to the landlord-tenant context. Where dsar.router.ts handles the
 * generic GDPR Art. 20 + TZ-PDPA s.27 export pipeline, this router
 * fans the same primitive across the regulator_jurisdictions catalogue
 * so a Kenya Rental Housing Tribunal subpoena is shaped differently
 * from a Tanzania PDPA notice or a Lagos Tenancy Law tenant request.
 *
 * Endpoints (all auth + tenant-scoped):
 *
 *   GET    /jurisdictions                 — list catalogue rows for the
 *                                            tenant's regulator_set (or
 *                                            a query-filtered country).
 *   GET    /jurisdictions/:slug           — one jurisdiction row.
 *   POST   /requests                       — admin captures inbound DSR
 *                                            tied to a jurisdiction slug.
 *   GET    /requests                        — list DSRs for this tenant.
 *   GET    /requests/:id                    — fetch one.
 *   POST   /requests/:id/dispatch-export    — route to the dsar pipeline
 *                                            and stamp the regulator
 *                                            jurisdiction onto the bundle.
 *
 * Storage:
 *   - jurisdictions catalogue: `regulator_jurisdictions` (tenant-agnostic).
 *   - DSR requests: `ai_audit_chain` rows of action
 *     `regulator.dsr.received` / `regulator.dsr.dispatched` until a
 *     dedicated regulator_dsr_requests table lands. The hash-chain row
 *     IS the durable record for now; the payload jsonb keeps the
 *     summary + jurisdiction slug + subject ref + scope.
 *
 * Tenant isolation:
 *   Every handler reads tenantId from the JWT; the regulator_jurisdictions
 *   table is tenant-agnostic and the DSR audit rows are tenant-scoped
 *   via the column on ai_audit_chain.
 *
 * Bilingual sw/en:
 *   Catalogue rows already carry nameEn + nameLocal; the router does
 *   not transform either — it returns both for the FE to render.
 */

// dsar.router.ts.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';

import {
  regulatorJurisdictions,
  REGULATOR_MANDATES,
} from '@bossnyumba/database';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('regulator-dsr');

// ---------------------------------------------------------------------------
// Hash-chain audit helper (kept inline for the gap-closure commit;
// long-term these route files should call the composition-layer
// ai-audit-chain-repo so audit-verify-cron.ts holds its invariant).
// ---------------------------------------------------------------------------

interface AuditAppendPayload {
  readonly action: string;
  readonly tenantId: string;
  readonly turnId: string;
  readonly userId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

async function appendAuditEntry(
  db: any,
  payload: AuditAppendPayload,
): Promise<string> {
  const id = randomUUID();
  const canonical = JSON.stringify({
    tenantId: payload.tenantId,
    turnId: payload.turnId,
    action: payload.action,
    userId: payload.userId,
    details: payload.details,
  });
  const latestResult: unknown = await db.execute(
    sql`SELECT COALESCE(MAX(sequence_id), 0) AS max_seq,
               (SELECT this_hash FROM ai_audit_chain
                WHERE tenant_id = ${payload.tenantId}
                ORDER BY sequence_id DESC LIMIT 1) AS last_hash
        FROM ai_audit_chain
        WHERE tenant_id = ${payload.tenantId}`,
  );
  const rows =
    (latestResult as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
    (latestResult as ReadonlyArray<Record<string, unknown>>);
  const head = rows[0] ?? {};
  const maxSeq = Number(head.max_seq ?? 0);
  const lastHash =
    typeof head.last_hash === 'string' && head.last_hash.length > 0
      ? head.last_hash
      : '';
  const sequenceId = maxSeq + 1;
  const prevHash = lastHash;
  const thisHash = createHash('sha256')
    .update(prevHash + canonical)
    .digest('hex');
  await db.execute(sql`
    INSERT INTO ai_audit_chain (
      id, tenant_id, sequence_id, turn_id, action,
      prev_hash, this_hash, payload, created_at
    ) VALUES (
      ${id},
      ${payload.tenantId},
      ${sequenceId},
      ${payload.turnId},
      ${payload.action},
      ${prevHash},
      ${thisHash},
      ${JSON.stringify({ userId: payload.userId, details: payload.details })}::jsonb,
      ${new Date().toISOString()}
    )
  `);
  return id;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ListJurisdictionsQuerySchema = z.object({
  country: z.string().length(2).optional(),
  mandate: z.enum(REGULATOR_MANDATES as unknown as [string, ...string[]]).optional(),
  set: z.string().optional(),
});

const SlugParamSchema = z.object({
  slug: z.string().min(1).max(120),
});

const DsrSubjectKindSchema = z.enum([
  'tenant',
  'landlord',
  'agent',
  'guarantor',
  'other-party',
]);

const CreateDsrRequestSchema = z.object({
  jurisdictionSlug: z.string().min(1).max(120),
  regulatorRef: z.string().min(1).max(200).optional(),
  subjectKind: DsrSubjectKindSchema,
  subjectRef: z.string().min(1).max(200),
  summarySw: z.string().max(2000).optional(),
  summaryEn: z.string().max(2000).optional(),
  scope: z
    .object({
      identity: z.boolean().optional(),
      contact: z.boolean().optional(),
      tenancyHistory: z.boolean().optional(),
      paymentHistory: z.boolean().optional(),
      maintenanceHistory: z.boolean().optional(),
      complaints: z.boolean().optional(),
    })
    .optional(),
  dueAt: z.string().datetime().optional(),
});

const DispatchExportBodySchema = z.object({
  // Optional override; defaults to the request's `subjectRef`.
  subjectId: z.string().min(1).max(200).optional(),
  format: z.enum(['json', 'pdf']).default('json'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return { status, body: { success: false as const, error: { code, message } } };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createRegulatorDsrRouter(): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', databaseMiddleware);
  app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

  // -------------------------------------------------------------------------
  // GET /jurisdictions — paginated catalogue rows.
  //
  // Defaults:
  //   - country: not set => returns all rows (capped at 200).
  //   - mandate: not set => no filter.
  //   - set: not set => no filter (FE can also pass `set=KE-set`).
  // -------------------------------------------------------------------------
  app.get(
    '/jurisdictions',
    zValidator('query', ListJurisdictionsQuerySchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId } = auth as { tenantId?: string };
      if (!tenantId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'REGULATOR_DSR_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const q = c.req.valid('query') as z.infer<
        typeof ListJurisdictionsQuerySchema
      >;

      try {
        const conditions = [
          q.country
            ? eq(regulatorJurisdictions.countryCode, q.country.toUpperCase())
            : sql`true`,
          q.set
            ? eq(regulatorJurisdictions.regulatorSet, q.set as never)
            : sql`true`,
          q.mandate
            ? eq(regulatorJurisdictions.mandate, q.mandate as never)
            : sql`true`,
        ];
        const rows = await db
          .select()
          .from(regulatorJurisdictions)
          .where(and(...conditions))
          .limit(200);
        return c.json(
          {
            success: true as const,
            data: rows,
            meta: { total: rows.length },
          },
          200,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'list jurisdictions failed';
        moduleLogger.error('regulator dsr /jurisdictions failed', {
          evt: 'regulator_dsr_jurisdictions_list_failed',
          tenantId,
          reason: message,
        });
        const e = jsonError(
          'REGULATOR_JURISDICTIONS_LIST_FAILED',
          message,
          500,
        );
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /jurisdictions/:slug — fetch a single jurisdiction row by slug.
  // -------------------------------------------------------------------------
  app.get(
    '/jurisdictions/:slug',
    zValidator('param', SlugParamSchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId } = auth as { tenantId?: string };
      if (!tenantId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'REGULATOR_DSR_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const { slug } = c.req.valid('param') as { slug: string };

      try {
        const [row] = await db
          .select()
          .from(regulatorJurisdictions)
          .where(eq(regulatorJurisdictions.slug, slug))
          .limit(1);
        if (!row) {
          const err = jsonError(
            'JURISDICTION_NOT_FOUND',
            'Jurisdiction slug not found',
            404,
          );
          return c.json(err.body, err.status);
        }
        return c.json({ success: true as const, data: row }, 200);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'fetch jurisdiction failed';
        moduleLogger.error('regulator dsr /jurisdictions/:slug failed', {
          evt: 'regulator_dsr_jurisdiction_fetch_failed',
          tenantId,
          slug,
          reason: message,
        });
        const e = jsonError(
          'REGULATOR_JURISDICTION_FETCH_FAILED',
          message,
          500,
        );
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /requests — admin captures an inbound DSR.
  //
  // Validates the jurisdiction slug, creates a hash-chain audit row of
  // action `regulator.dsr.received`, and returns the chain id as the
  // canonical request id.
  // -------------------------------------------------------------------------
  app.post(
    '/requests',
    zValidator('json', CreateDsrRequestSchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'REGULATOR_DSR_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const body = c.req.valid('json') as z.infer<
        typeof CreateDsrRequestSchema
      >;

      try {
        const [jurisdiction] = await db
          .select()
          .from(regulatorJurisdictions)
          .where(eq(regulatorJurisdictions.slug, body.jurisdictionSlug))
          .limit(1);
        if (!jurisdiction) {
          const err = jsonError(
            'JURISDICTION_NOT_FOUND',
            `Jurisdiction slug "${body.jurisdictionSlug}" is not in the catalogue`,
            404,
          );
          return c.json(err.body, err.status);
        }

        const requestId = randomUUID();
        const chainId = await appendAuditEntry(db, {
          action: 'regulator.dsr.received',
          tenantId,
          turnId: requestId,
          userId,
          details: {
            requestId,
            jurisdictionSlug: jurisdiction.slug,
            jurisdictionId: jurisdiction.id,
            regulatorSet: jurisdiction.regulatorSet,
            countryCode: jurisdiction.countryCode,
            mandate: jurisdiction.mandate,
            regulatorRef: body.regulatorRef ?? null,
            subjectKind: body.subjectKind,
            subjectRef: body.subjectRef,
            summarySw: body.summarySw ?? null,
            summaryEn: body.summaryEn ?? null,
            scope: body.scope ?? {},
            dueAt: body.dueAt ?? null,
            source: 'regulator-dsr-intake',
          },
        });

        return c.json(
          {
            success: true as const,
            data: {
              id: requestId,
              jurisdictionSlug: jurisdiction.slug,
              regulatorSet: jurisdiction.regulatorSet,
              countryCode: jurisdiction.countryCode,
              subjectKind: body.subjectKind,
              subjectRef: body.subjectRef,
              status: 'received' as const,
              hashChainId: chainId,
              createdAt: new Date().toISOString(),
            },
          },
          201,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'create request failed';
        moduleLogger.error('regulator dsr /requests POST failed', {
          evt: 'regulator_dsr_request_create_failed',
          tenantId,
          reason: message,
        });
        const e = jsonError(
          'REGULATOR_DSR_REQUEST_CREATE_FAILED',
          message,
          500,
        );
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /requests — list this tenant's DSRs by reading audit-chain
  // rows of action `regulator.dsr.received`.
  // -------------------------------------------------------------------------
  app.get('/requests', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'REGULATOR_DSR_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }

    try {
      const result: unknown = await db.execute(
        sql`SELECT id, turn_id, action, payload, created_at
              FROM ai_audit_chain
             WHERE tenant_id = ${tenantId}
               AND action IN ('regulator.dsr.received', 'regulator.dsr.dispatched')
             ORDER BY created_at DESC
             LIMIT 200`,
      );
      const rows =
        (result as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
        (result as ReadonlyArray<Record<string, unknown>>);
      // Fold dispatch rows into their parent requests so the FE shows
      // one row per request with the dispatch state attached.
      const byRequestId = new Map<string, Record<string, unknown>>();
      for (const r of rows) {
        const payload = (r.payload as Record<string, unknown>) ?? {};
        const details =
          (payload.details as Record<string, unknown>) ?? payload;
        const requestId =
          (details.requestId as string | undefined) ??
          (r.turn_id as string | undefined) ??
          '';
        if (!requestId) continue;
        const action = r.action as string;
        if (action === 'regulator.dsr.received') {
          if (!byRequestId.has(requestId)) {
            byRequestId.set(requestId, {
              id: requestId,
              status: 'received',
              jurisdictionSlug: details.jurisdictionSlug,
              regulatorSet: details.regulatorSet,
              countryCode: details.countryCode,
              mandate: details.mandate,
              subjectKind: details.subjectKind,
              subjectRef: details.subjectRef,
              summaryEn: details.summaryEn,
              summarySw: details.summarySw,
              dueAt: details.dueAt,
              createdAt: r.created_at,
              hashChainId: r.id,
            });
          }
        } else if (action === 'regulator.dsr.dispatched') {
          const existing = byRequestId.get(requestId);
          if (existing) {
            existing.status = 'dispatched';
            existing.dispatchedAt = r.created_at;
            existing.exportFormat = details.format;
          }
        }
      }
      const list = Array.from(byRequestId.values()).sort(
        (a, b) =>
          new Date(String(b.createdAt)).getTime() -
          new Date(String(a.createdAt)).getTime(),
      );
      return c.json(
        { success: true as const, data: list, meta: { total: list.length } },
        200,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'list requests failed';
      moduleLogger.error('regulator dsr /requests GET failed', {
        evt: 'regulator_dsr_requests_list_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('REGULATOR_DSR_REQUESTS_LIST_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // GET /requests/:id — fetch a single DSR's audit-chain row.
  // -------------------------------------------------------------------------
  app.get('/requests/:id', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'REGULATOR_DSR_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }
    const id = c.req.param('id');

    try {
      const result: unknown = await db.execute(
        sql`SELECT id, turn_id, action, payload, created_at
              FROM ai_audit_chain
             WHERE tenant_id = ${tenantId}
               AND turn_id = ${id}
             ORDER BY created_at ASC
             LIMIT 50`,
      );
      const rows =
        (result as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
        (result as ReadonlyArray<Record<string, unknown>>);
      if (rows.length === 0) {
        const err = jsonError(
          'DSR_REQUEST_NOT_FOUND',
          'DSR request not found for this tenant',
          404,
        );
        return c.json(err.body, err.status);
      }
      return c.json({ success: true as const, data: rows }, 200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'fetch request failed';
      moduleLogger.error('regulator dsr /requests/:id failed', {
        evt: 'regulator_dsr_request_fetch_failed',
        tenantId,
        id,
        reason: message,
      });
      const e = jsonError('REGULATOR_DSR_REQUEST_FETCH_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // POST /requests/:id/dispatch-export — appends a dispatch audit row
  // and stamps the regulator jurisdiction onto the bundle envelope.
  //
  // The actual export (PII redaction + signed URL) is handled by the
  // existing dsar.router.ts pipeline; this endpoint records the
  // jurisdiction-aware envelope and audits the dispatch decision so the
  // regulator-side audit trail is intact.
  // -------------------------------------------------------------------------
  app.post(
    '/requests/:id/dispatch-export',
    zValidator('json', DispatchExportBodySchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'REGULATOR_DSR_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const id = c.req.param('id');
      const body = c.req.valid('json') as z.infer<
        typeof DispatchExportBodySchema
      >;

      try {
        const result: unknown = await db.execute(
          sql`SELECT id, payload
                FROM ai_audit_chain
               WHERE tenant_id = ${tenantId}
                 AND turn_id = ${id}
                 AND action = 'regulator.dsr.received'
               LIMIT 1`,
        );
        const rows =
          (result as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
          (result as ReadonlyArray<Record<string, unknown>>);
        const headRow = rows[0];
        if (!headRow) {
          const err = jsonError(
            'DSR_REQUEST_NOT_FOUND',
            'DSR request not found for this tenant',
            404,
          );
          return c.json(err.body, err.status);
        }
        const headPayload =
          (headRow.payload as Record<string, unknown>) ?? {};
        const headDetails =
          (headPayload.details as Record<string, unknown>) ?? headPayload;

        const subjectId =
          body.subjectId ??
          (headDetails.subjectRef as string | undefined) ??
          '';
        if (!subjectId) {
          const err = jsonError(
            'DSR_REQUEST_INVALID_SUBJECT',
            'Subject id missing on both request and body',
            400,
          );
          return c.json(err.body, err.status);
        }

        const chainId = await appendAuditEntry(db, {
          action: 'regulator.dsr.dispatched',
          tenantId,
          turnId: id,
          userId,
          details: {
            requestId: id,
            jurisdictionSlug: headDetails.jurisdictionSlug,
            regulatorSet: headDetails.regulatorSet,
            countryCode: headDetails.countryCode,
            subjectId,
            format: body.format,
            dispatchedAt: new Date().toISOString(),
            // Signed-URL minting + actual JSON/PDF bundle still flow
            // through the dsar.router export pipeline; this router only
            // records that the dispatch decision was made.
            via: 'regulator-dsr-dispatch',
          },
        });

        return c.json(
          {
            success: true as const,
            data: {
              id,
              status: 'dispatched' as const,
              jurisdictionSlug: headDetails.jurisdictionSlug,
              format: body.format,
              dispatchedAt: new Date().toISOString(),
              hashChainId: chainId,
              // Pointer to the DSAR export the FE/admin should hit
              // next to actually mint the redacted bundle.
              exportRoute: `/api/v1/dsar/${subjectId}/export`,
            },
          },
          200,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'dispatch failed';
        moduleLogger.error('regulator dsr dispatch failed', {
          evt: 'regulator_dsr_dispatch_failed',
          tenantId,
          id,
          reason: message,
        });
        const e = jsonError('REGULATOR_DSR_DISPATCH_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  return app;
}

export const regulatorDsrRouter = createRegulatorDsrRouter();
