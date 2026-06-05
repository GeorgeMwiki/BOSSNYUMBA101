// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (hono-dev/hono#3891). Same pragma as the other
// .hono routers in this directory (cases.hono.ts, arrears.hono.ts,
// cooperatives/cooperatives.hono.ts).
/**
 * /api/v1/courses (migration 0309).
 *
 * AI course-generation for the coworker create-course flow. An employee picks
 * a domain, describes a scenario, optionally attaches documents, and the brain
 * (or the deterministic ESTATE_CONCEPTS sequencer) generates a 5-to-8 lesson
 * course.
 *
 * Routes (all tenant-scoped via JWT + RLS, owner-scoped to the signed-in
 * employee on top of RLS — no IDOR across coworkers):
 *   POST  /generate        kick off generation; returns a placeholder id (202)
 *   GET   /                 list my courses, newest first
 *   GET   /:id             my course + lessons (the poller hits this)
 *
 * Ported from LitFin's /api/borrower/learning/generate-course +
 * /api/borrower/learning/courses, retargeted financial-literacy → estate
 * management and tenant-scoped.
 *
 * SECURITY
 *   - authMiddleware: the actor is ALWAYS auth.userId; no user-id input.
 *   - assertTierPolicy(coworkerTrainingPolicy, 'courses.generate') before the
 *     write (self-service mutation gate).
 *   - per-(tenant,user) in-memory rate limit — LLM generation is expensive.
 *   - zod-validated body.
 *
 * HONEST-DEGRADE: when the api-gateway `llmRouter` is wired, the model produces
 * the course; otherwise the deterministic sequencer builds a real course from
 * the concept catalog. The `generatedVia` marker is persisted + returned so the
 * UI is transparent. Content is NEVER silently fabricated.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import { assertTierPolicy } from '@bossnyumba/central-intelligence';
import {
  createCourseService,
  findCourseDomain,
  courseDomainLabel,
  COURSE_LANGUAGES,
  COURSE_DIFFICULTIES,
  type CoursesRepo,
  type LLMPort,
} from '../services/courses/index.js';

// ---------------------------------------------------------------------------
// Tier policy — coworker self-service training surface.
// ---------------------------------------------------------------------------
// A minimal RolePolicy granting the coworker the right to generate + read
// their own courses. Non-high-risk (no money / sovereign prefix), so a literal
// allow-list is sufficient. Mirrors how training endpoints are reachable by any
// authenticated tenant member.
const COURSE_POLICY = {
  role: 'coworker',
  description: 'Coworker self-service course generation + reading.',
  rules: [
    {
      id: 'courses.generate',
      action: 'courses.generate',
      principle: 'self-service-learning',
      verdict: 'allow',
    },
    {
      id: 'courses.read',
      action: 'courses.read',
      principle: 'self-service-learning',
      verdict: 'allow',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Rate limiting — LLM generation is expensive. Per-(tenant,user), in-memory.
// (Matches the in-memory limiter used elsewhere in the gateway; swap for the
// Redis limiter when multi-instance.)
// ---------------------------------------------------------------------------
const GENERATE_WINDOW_MS = 60_000;
const GENERATE_MAX = 5;
const rlStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let entry = rlStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + GENERATE_WINDOW_MS };
    rlStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > GENERATE_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

// Periodic cleanup so the map does not grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rlStore) {
    if (now > v.resetAt) rlStore.delete(k);
  }
}, GENERATE_WINDOW_MS).unref?.();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DocumentSchema = z.object({
  documentId: z.string().min(1).max(200),
  documentName: z.string().max(300).optional().default(''),
  documentType: z.string().max(200).optional().default(''),
  summary: z.string().max(4_000).optional().default(''),
  extractedData: z.record(z.string(), z.unknown()).optional().default({}),
});

const GenerateSchema = z.object({
  domain: z.string().min(1).max(200),
  scenarioDescription: z.string().min(10).max(4_000),
  documents: z.array(DocumentSchema).max(10).optional().default([]),
  language: z.enum(COURSE_LANGUAGES).optional().default('en'),
  difficulty: z.enum(COURSE_DIFFICULTIES).optional().default('beginner'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' },
    },
    503,
  );
}

function toSummary(row: Record<string, unknown>) {
  const curriculum = (row.ai_generated_curriculum ?? {}) as Record<string, unknown>;
  const generationError =
    typeof row.generation_error === 'string' && row.generation_error.length > 0
      ? (row.generation_error as string)
      : undefined;
  const summary: Record<string, unknown> = {
    id: row.id as string,
    domain: (row.domain as string) ?? '',
    scenarioDescription: (row.scenario_description as string) ?? '',
    status: (row.status as string) ?? 'draft',
    difficulty: (row.difficulty as string) ?? 'beginner',
    language: (row.language as string) ?? 'en',
    title: typeof curriculum.title === 'string' ? (curriculum.title as string) : '',
    summary: typeof curriculum.summary === 'string' ? (curriculum.summary as string) : '',
    lessonCount: (row.lesson_count as number) ?? 0,
    generatedVia: (row.generated_via as string) ?? 'deterministic',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  };
  if (generationError) summary.generationError = generationError;
  return summary;
}

function toLessonRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    lessonNumber: (row.lesson_number as number) ?? 0,
    lessonTitle: (row.lesson_title as string) ?? '',
    status: (row.status as string) ?? 'not_started',
    quizScore: (row.quiz_score as number | null) ?? null,
    content: (row.lesson_content ?? {}) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// SQL-backed repo over the shared drizzle client. Every query is scoped to
// (tenant_id, created_by_user_id) — defence in depth on top of RLS.
// ---------------------------------------------------------------------------

function makeRepo(db, tenantId: string): CoursesRepo {
  return {
    async createPlaceholder(args) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const documentIds = JSON.stringify(args.documents.map((d) => d.documentId));
      await db.execute(sql`
        INSERT INTO courses (
          id, tenant_id, created_by_user_id, domain, scenario_description,
          status, difficulty, language, ai_generated_curriculum, lesson_count,
          document_ids, created_at, updated_at
        ) VALUES (
          ${id}, ${tenantId}, ${args.userId}, ${args.domain}, ${args.scenarioDescription},
          'draft', ${args.difficulty}, ${args.language}, '{}'::jsonb, 0,
          ${documentIds}::jsonb, ${now}, ${now}
        )
      `);
      // Document grounding rows — non-fatal if they fail (course still usable).
      for (const d of args.documents) {
        try {
          await db.execute(sql`
            INSERT INTO course_documents (
              id, tenant_id, course_id, created_by_user_id, document_id,
              document_name, document_type, extracted_data, created_at, updated_at
            ) VALUES (
              ${randomUUID()}, ${tenantId}, ${id}, ${args.userId}, ${d.documentId},
              ${d.documentName}, ${d.documentType}, ${JSON.stringify(d.extractedData)}::jsonb,
              ${now}, ${now}
            )
          `);
        } catch {
          // best-effort document attach.
        }
      }
      return id;
    },

    async finalize(args) {
      const now = new Date().toISOString();
      // Insert normalised lesson rows (unique (course_id, lesson_number) guards
      // a double background run).
      for (let index = 0; index < args.course.lessons.length; index++) {
        const lesson = args.course.lessons[index];
        await db.execute(sql`
          INSERT INTO course_lessons (
            id, tenant_id, course_id, created_by_user_id, lesson_number,
            lesson_title, lesson_content, status, created_at, updated_at
          ) VALUES (
            ${randomUUID()}, ${tenantId}, ${args.courseId}, ${args.userId}, ${index + 1},
            ${lesson.title}, ${JSON.stringify(lesson)}::jsonb, 'not_started', ${now}, ${now}
          )
          ON CONFLICT (course_id, lesson_number) DO NOTHING
        `);
      }
      await db.execute(sql`
        UPDATE courses
           SET status = 'in_progress',
               ai_generated_curriculum = ${JSON.stringify(args.course)}::jsonb,
               lesson_count = ${args.course.lessons.length},
               generated_via = ${args.generatedVia},
               generation_error = NULL,
               updated_at = ${now}
         WHERE id = ${args.courseId}
           AND tenant_id = ${tenantId}
           AND created_by_user_id = ${args.userId}
      `);
    },

    async markFailed(t, userId, courseId, message) {
      const now = new Date().toISOString();
      const safe = (message || 'Course generation failed').slice(0, 500);
      await db.execute(sql`
        UPDATE courses
           SET status = 'draft',
               lesson_count = 0,
               generation_error = ${safe},
               updated_at = ${now}
         WHERE id = ${courseId}
           AND tenant_id = ${t}
           AND created_by_user_id = ${userId}
      `);
    },

    async list(t, userId) {
      const raw = await db.execute(sql`
        SELECT id, domain, scenario_description, status, difficulty, language,
               ai_generated_curriculum, lesson_count, generated_via,
               generation_error, created_at, updated_at
          FROM courses
         WHERE tenant_id = ${t} AND created_by_user_id = ${userId}
         ORDER BY created_at DESC
      `);
      return rowsOf(raw).map(toSummary);
    },

    async get(t, userId, courseId) {
      const courseRaw = await db.execute(sql`
        SELECT id, domain, scenario_description, status, difficulty, language,
               ai_generated_curriculum, lesson_count, generated_via,
               generation_error, created_at, updated_at
          FROM courses
         WHERE id = ${courseId} AND tenant_id = ${t} AND created_by_user_id = ${userId}
         LIMIT 1
      `);
      const courseRows = rowsOf(courseRaw);
      if (courseRows.length === 0) return null;
      const lessonsRaw = await db.execute(sql`
        SELECT id, lesson_number, lesson_title, lesson_content, status, quiz_score
          FROM course_lessons
         WHERE course_id = ${courseId} AND tenant_id = ${t} AND created_by_user_id = ${userId}
         ORDER BY lesson_number ASC
      `);
      const lessons = rowsOf(lessonsRaw).map(toLessonRow);
      return { ...toSummary(courseRows[0]), lessons };
    },
  };
}

// ---------------------------------------------------------------------------
// LLM adapter — build an LLMPort from the gateway's llmRouter, or null.
// On ANY failure the adapter returns '' so the generator honest-degrades to
// the deterministic sequencer rather than throwing.
// ---------------------------------------------------------------------------

function makeLlmPort(c, tenantId: string): LLMPort | null {
  const services = c.get('services') ?? {};
  const router = services.llmRouter;
  if (!router) return null;
  return {
    async complete(prompt: string): Promise<string> {
      try {
        const result = await router.complete({
          context: { tenantId },
          hints: { taskType: 'reasoning', costBudget: 'premium' },
          request: {
            prompt: {
              promptId: 'course-generation',
              version: '1',
              systemPrompt: '',
              userPrompt: prompt,
              modelConfig: { modelId: '', maxTokens: 16_000, temperature: 0.4 },
              guardrails: {},
            },
          },
        });
        if (result && result.success && result.data && typeof result.data.content === 'string') {
          return result.data.content;
        }
        return '';
      } catch {
        return '';
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.post(
  '/generate',
  zValidator('json', GenerateSchema),
  withSecurityEvents(
    { action: 'courses.generate', resource: 'course', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return unavailable(c);

      // Tier gate — self-service mutation.
      const policy = assertTierPolicy(COURSE_POLICY, 'courses.generate');
      if (!policy.ok) {
        return c.json(
          { success: false, error: { code: 'TIER_POLICY_DENIED', message: policy.reason } },
          403,
        );
      }

      // Rate gate — LLM generation is expensive.
      const rl = checkRateLimit(`${auth.tenantId}:${auth.userId}`);
      if (!rl.allowed) {
        return c.json(
          {
            success: false,
            error: { code: 'RATE_LIMIT', message: 'Too many course generations. Try again shortly.' },
          },
          429,
          { 'Retry-After': String(rl.retryAfter) },
        );
      }

      const body = c.req.valid('json');
      if (!findCourseDomain(body.domain)) {
        return c.json(
          { success: false, error: { code: 'UNKNOWN_DOMAIN', message: `unknown domain '${body.domain}'` } },
          422,
        );
      }

      try {
        const repo = makeRepo(db, auth.tenantId);
        const service = createCourseService({
          repo,
          llm: makeLlmPort(c, auth.tenantId),
        });
        const documents = body.documents.map((d) => ({
          documentId: d.documentId,
          documentName: d.documentName,
          documentType: d.documentType,
          summary: d.summary,
          extractedData: d.extractedData,
        }));
        const result = await service.kickoffGeneration({
          tenantId: auth.tenantId,
          userId: auth.userId,
          domain: body.domain,
          scenarioDescription: body.scenarioDescription,
          difficulty: body.difficulty,
          language: body.language,
          documents,
        });
        return c.json(
          {
            success: true,
            data: {
              id: result.courseId,
              courseId: result.courseId,
              status: result.status,
              domainLabel: courseDomainLabel(body.domain, body.language),
            },
          },
          202,
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: 'GENERATE_FAILED',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to start course generation. Please try again.',
            },
          },
          500,
        );
      }
    },
  ),
);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);
  const policy = assertTierPolicy(COURSE_POLICY, 'courses.read');
  if (!policy.ok) {
    return c.json({ success: false, error: { code: 'TIER_POLICY_DENIED', message: policy.reason } }, 403);
  }
  try {
    const repo = makeRepo(db, auth.tenantId);
    const data = await repo.list(auth.tenantId, auth.userId);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: { code: 'LIST_FAILED', message: error instanceof Error ? error.message : 'Failed to load courses' },
      },
      500,
    );
  }
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) return unavailable(c);
  const policy = assertTierPolicy(COURSE_POLICY, 'courses.read');
  if (!policy.ok) {
    return c.json({ success: false, error: { code: 'TIER_POLICY_DENIED', message: policy.reason } }, 403);
  }
  try {
    const repo = makeRepo(db, auth.tenantId);
    const course = await repo.get(auth.tenantId, auth.userId, c.req.param('id'));
    if (!course) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
    }
    return c.json({ success: true, data: course });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: { code: 'GET_FAILED', message: error instanceof Error ? error.message : 'Failed to load course' },
      },
      500,
    );
  }
});

export const coursesRouter = app;
export default app;
