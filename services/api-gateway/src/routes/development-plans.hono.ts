// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (hono-dev/hono#3891). Same pragma as the other
// .hono routers in this directory (cooperatives.hono.ts, cases.hono.ts).
/**
 * /api/v1/development-plans (migration 0310) — Gap-4 (d).
 *
 * Property DEVELOPMENT pro-forma surface. BN's real-estate retarget of
 * LitFin's loan business-plan generator: a property owner / developer asks
 * Mr. Mwikila to "draft a development plan for the Mikocheni site", reviews
 * the generated sections (staffing-plan / tenant-demand / unit-mix / ...),
 * and tweaks financial assumptions (rent per unit, construction cost,
 * occupancy ramp, exit cap rate).
 *
 * Routes (all tenant-scoped via JWT + RLS; owner/admin role only for
 * writes):
 *   POST  /plans                      create a draft plan + seed default
 *                                     sections
 *   GET   /plans                      list plans for the tenant
 *   GET   /plans/:id                  fetch one plan
 *   GET   /plans/:id/sections         list a plan's sections
 *   POST  /plans/:id/sections         upsert a section (generate / edit)
 *   POST  /plans/:id/assumptions      set a financial assumption
 *
 * The chat-as-OS brain reads / writes via the `development.plan.*` brain
 * tools (development-plan-tools.ts), which loopback-dispatch to these routes
 * so the SAME auth + RLS + observability guards apply as a browser request.
 *
 * Honest-degrade (CLAUDE.md hard rule): when the database client is not
 * configured the route returns 503 DATABASE_UNAVAILABLE rather than
 * fabricating a row.
 *
 * Multi-currency (CLAUDE.md hard rule): the plan carries a currencyCode;
 * monetary financial assumptions live inside the assumptions JSONB. No
 * jurisdiction currency is hard-coded.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import {
  DEVELOPMENT_PLAN_SECTION_KEYS,
  DEVELOPMENT_ASSUMPTION_KEYS,
} from '@bossnyumba/database';

// ── role gate (owner / admin only for writes; mirrors other routers) ───────
const WRITE_ROLES = new Set([
  'OWNER',
  'TENANT_ADMIN',
  'SUPER_ADMIN',
  'ADMIN',
]);

const MAX_LIST_LIMIT = 200;

/**
 * Default section set seeded when a plan is created. Retargeted from
 * LitFin's business-plan sections. EN + SW titles side-by-side so the
 * locale toggle is absolute (CLAUDE.md hard rule).
 */
const DEFAULT_SECTIONS: ReadonlyArray<{
  key: (typeof DEVELOPMENT_PLAN_SECTION_KEYS)[number];
  titleEn: string;
  titleSw: string;
}> = [
  { key: 'cover-page', titleEn: 'Cover Page', titleSw: 'Ukurasa wa Jalada' },
  {
    key: 'executive-summary',
    titleEn: 'Executive Summary',
    titleSw: 'Muhtasari wa Utendaji',
  },
  {
    key: 'location-market',
    titleEn: 'Location & Market',
    titleSw: 'Eneo na Soko',
  },
  {
    key: 'tenant-demand',
    titleEn: 'Tenant Demand',
    titleSw: 'Mahitaji ya Wapangaji',
  },
  { key: 'unit-mix', titleEn: 'Unit Mix', titleSw: 'Mchanganyiko wa Vipande' },
  {
    key: 'staffing-plan',
    titleEn: 'Staffing Plan',
    titleSw: 'Mpango wa Wafanyakazi',
  },
  {
    key: 'use-of-funds',
    titleEn: 'Use of Funds',
    titleSw: 'Matumizi ya Fedha',
  },
  {
    key: 'financial-overview',
    titleEn: 'Financial Overview',
    titleSw: 'Muhtasari wa Kifedha',
  },
  {
    key: 'risk-mitigation',
    titleEn: 'Risk Mitigation',
    titleSw: 'Kupunguza Hatari',
  },
  {
    key: 'swot-analysis',
    titleEn: 'SWOT Analysis',
    titleSw: 'Uchambuzi wa SWOT',
  },
];

const CreatePlanSchema = z.object({
  title: z.string().min(1).max(200),
  propertyId: z.string().uuid().optional(),
  currencyCode: z.string().length(3).optional(),
  assumptions: z.record(z.number().finite()).optional(),
});

const ListQuerySchema = z.object({
  status: z.enum(['draft', 'generating', 'ready', 'archived']).optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIST_LIMIT).default(100),
});

const UpsertSectionSchema = z.object({
  sectionKey: z.enum(DEVELOPMENT_PLAN_SECTION_KEYS),
  titleEn: z.string().min(1).max(200).optional(),
  titleSw: z.string().min(1).max(200).optional(),
  bodyEn: z.string().max(20000).optional(),
  bodySw: z.string().max(20000).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  status: z.enum(['pending', 'generating', 'ready']).optional(),
});

const SetAssumptionSchema = z.object({
  assumptionKey: z.enum(DEVELOPMENT_ASSUMPTION_KEYS),
  value: z.number().finite(),
});

function auditHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function provenance(actorId: string): string {
  return JSON.stringify({
    via: 'api',
    actorId,
    sessionId: null,
    turnId: null,
    requestedAt: new Date().toISOString(),
  });
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as Record<string, unknown>[];
  }
  return [];
}

function unavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database client is not initialized',
      },
    },
    503,
  );
}

function forbidden(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'owner / admin role required',
      },
    },
    403,
  );
}

function notFound(c) {
  return c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: 'development plan not found' },
    },
    404,
  );
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// ---------------------------------------------------------------------------
// POST /plans — create a draft plan + seed default sections
// ---------------------------------------------------------------------------

app.post(
  '/plans',
  zValidator('json', CreatePlanSchema),
  withSecurityEvents(
    {
      action: 'development_plan.create',
      resource: 'development_plan',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      if (!WRITE_ROLES.has(String(auth.role))) return forbidden(c);
      const body = c.req.valid('json');

      const currencyCode = (body.currencyCode ?? 'TZS').toUpperCase();
      const assumptions = body.assumptions ?? {};
      const id = randomUUID();
      const prov = provenance(auth.userId);
      const hash = auditHash({ id, tenantId: auth.tenantId, title: body.title });

      await db.execute(sql`
        INSERT INTO development_plans (
          id, tenant_id, title, property_id, status, currency_code,
          assumptions, provenance, audit_hash_id, created_by
        ) VALUES (
          ${id}, ${auth.tenantId}::uuid, ${body.title},
          ${body.propertyId ?? null}, 'draft', ${currencyCode},
          ${JSON.stringify(assumptions)}::jsonb, ${prov}::jsonb, ${hash},
          ${auth.userId}::uuid
        )
      `);

      // Seed default sections (idempotent — UPSERT on (plan_id, section_key)).
      let order = 0;
      for (const section of DEFAULT_SECTIONS) {
        const sectionId = randomUUID();
        await db.execute(sql`
          INSERT INTO development_plan_sections (
            id, tenant_id, plan_id, section_key, title_en, title_sw,
            sort_order, status, provenance
          ) VALUES (
            ${sectionId}, ${auth.tenantId}::uuid, ${id}::uuid,
            ${section.key}, ${section.titleEn}, ${section.titleSw},
            ${order}, 'pending', ${prov}::jsonb
          )
          ON CONFLICT (plan_id, section_key) DO NOTHING
        `);
        order += 1;
      }

      const fetched = await db.execute(sql`
        SELECT * FROM development_plans
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      return c.json({ success: true, data: rowsOf(fetched)[0] }, 201);
    },
  ),
);

// ---------------------------------------------------------------------------
// GET /plans — list
// ---------------------------------------------------------------------------

app.get('/plans', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);

  const parsed = ListQuerySchema.safeParse({
    status: c.req.query('status'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      },
      400,
    );
  }
  const { status, limit } = parsed.data;
  const whereStatus = status ? sql`AND status = ${status}` : sql``;
  const fetched = await db.execute(sql`
    SELECT * FROM development_plans
     WHERE tenant_id = ${auth.tenantId}::uuid
     ${whereStatus}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `);
  return c.json({ success: true, data: rowsOf(fetched) });
});

// ---------------------------------------------------------------------------
// GET /plans/:id — fetch one
// ---------------------------------------------------------------------------

app.get('/plans/:id', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);
  const id = c.req.param('id');
  const fetched = await db.execute(sql`
    SELECT * FROM development_plans
     WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
     LIMIT 1
  `);
  const row = rowsOf(fetched)[0];
  if (!row) return notFound(c);
  return c.json({ success: true, data: row });
});

// ---------------------------------------------------------------------------
// GET /plans/:id/sections — list a plan's sections
// ---------------------------------------------------------------------------

app.get('/plans/:id/sections', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);
  const id = c.req.param('id');
  const planRows = await db.execute(sql`
    SELECT id FROM development_plans
     WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
     LIMIT 1
  `);
  if (!rowsOf(planRows)[0]) return notFound(c);
  const fetched = await db.execute(sql`
    SELECT * FROM development_plan_sections
     WHERE plan_id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
     ORDER BY sort_order ASC
  `);
  return c.json({ success: true, data: rowsOf(fetched) });
});

// ---------------------------------------------------------------------------
// POST /plans/:id/sections — upsert a section (generate / edit)
// ---------------------------------------------------------------------------

app.post(
  '/plans/:id/sections',
  zValidator('json', UpsertSectionSchema),
  withSecurityEvents(
    {
      action: 'development_plan.section.upsert',
      resource: 'development_plan_section',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      if (!WRITE_ROLES.has(String(auth.role))) return forbidden(c);
      const id = c.req.param('id');
      const body = c.req.valid('json');

      const planRows = await db.execute(sql`
        SELECT id FROM development_plans
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         LIMIT 1
      `);
      if (!rowsOf(planRows)[0]) return notFound(c);

      const sectionId = randomUUID();
      const prov = provenance(auth.userId);
      const titleEn = body.titleEn ?? body.sectionKey;
      const titleSw = body.titleSw ?? body.sectionKey;
      const bodyEn = body.bodyEn ?? '';
      const bodySw = body.bodySw ?? '';
      const sortOrder = body.sortOrder ?? 0;
      const status = body.status ?? 'ready';

      await db.execute(sql`
        INSERT INTO development_plan_sections (
          id, tenant_id, plan_id, section_key, title_en, title_sw,
          body_en, body_sw, sort_order, status, provenance
        ) VALUES (
          ${sectionId}, ${auth.tenantId}::uuid, ${id}::uuid,
          ${body.sectionKey}, ${titleEn}, ${titleSw},
          ${bodyEn}, ${bodySw}, ${sortOrder}, ${status}, ${prov}::jsonb
        )
        ON CONFLICT (plan_id, section_key) DO UPDATE SET
          title_en   = EXCLUDED.title_en,
          title_sw   = EXCLUDED.title_sw,
          body_en    = EXCLUDED.body_en,
          body_sw    = EXCLUDED.body_sw,
          sort_order = EXCLUDED.sort_order,
          status     = EXCLUDED.status,
          updated_at = now()
      `);

      const fetched = await db.execute(sql`
        SELECT * FROM development_plan_sections
         WHERE plan_id = ${id}::uuid
           AND tenant_id = ${auth.tenantId}::uuid
           AND section_key = ${body.sectionKey}
         LIMIT 1
      `);
      return c.json({ success: true, data: rowsOf(fetched)[0] }, 200);
    },
  ),
);

// ---------------------------------------------------------------------------
// POST /plans/:id/assumptions — set a financial assumption
// ---------------------------------------------------------------------------

app.post(
  '/plans/:id/assumptions',
  zValidator('json', SetAssumptionSchema),
  withSecurityEvents(
    {
      action: 'development_plan.assumption.set',
      resource: 'development_plan',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);
      if (!WRITE_ROLES.has(String(auth.role))) return forbidden(c);
      const id = c.req.param('id');
      const body = c.req.valid('json');

      // jsonb_set merges the single key without clobbering siblings. The
      // path is a parameterized single-element text[] (assumptionKey is
      // zod-enum-constrained, but parameterizing keeps it injection-proof);
      // the value is cast through to_jsonb so it lands as a JSON number.
      const updated = await db.execute(sql`
        UPDATE development_plans
           SET assumptions = jsonb_set(
                 assumptions,
                 ARRAY[${body.assumptionKey}]::text[],
                 to_jsonb(${body.value}::numeric),
                 true
               ),
               updated_at = now()
         WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
         RETURNING id, assumptions
      `);
      const row = rowsOf(updated)[0];
      if (!row) return notFound(c);
      return c.json({ success: true, data: row });
    },
  ),
);

export default app;
