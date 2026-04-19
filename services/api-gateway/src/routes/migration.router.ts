// @ts-nocheck
/**
 * /api/v1/brain/migration — Migration Wizard routes.
 *
 *   POST /upload              — accept a file, create MigrationRun, stage
 *                               bundle via skill.migration.extract
 *   POST /:runId/commit       — execute the approved run (amplified commit)
 *   POST /:runId/ask          — forward a chat turn to the copilot
 *
 * Transport only — business logic lives in MigrationService and the
 * ai-copilot skills. Auth enforcement follows the same pattern as
 * brain.hono.ts (verified Supabase JWT, tenant claim required).
 */

import { Hono } from 'hono';
import {
  migrationExtract,
  MigrationExtractParamsSchema,
  ProgressiveIntelligence,
} from '@bossnyumba/ai-copilot';
import {
  MigrationService,
  PostgresMigrationRepository,
} from '@bossnyumba/domain-services';
import { parseUpload } from '@bossnyumba/ai-copilot/services/migration/parsers/parse-upload';

// Singleton per-process accumulator — session scoping handled per-run.
// In production, swap for a persistent repository backed by
// `progressive_context_snapshots` (migration 0042).
const progressiveAccumulator =
  ProgressiveIntelligence.createContextAccumulator();
const progressiveAutoGen =
  ProgressiveIntelligence.createAutoGenerationService(progressiveAccumulator);

type Bindings = Record<string, never>;
type Variables = {
  tenantId: string;
  actorId: string;
};

export function createMigrationRouter(deps: {
  getService: (tenantId: string) => MigrationService;
  authMiddleware?: (c: any, next: () => Promise<void>) => Promise<Response | void>;
}) {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  if (deps.authMiddleware) {
    app.use('*', deps.authMiddleware);
  }

  // ----------------------- POST /upload -----------------------
  app.post('/upload', async (c) => {
    const tenantId = c.get('tenantId');
    const actorId = c.get('actorId');
    if (!tenantId || !actorId) return c.json({ error: 'unauthenticated' }, 401);

    const form = await c.req.formData();
    const file = form.get('file') as File | null;
    if (!file) return c.json({ error: 'missing file' }, 400);

    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseUpload(buf, file.type, { filename: file.name });

    const extractParams = MigrationExtractParamsSchema.parse({
      sheets: parsed.sheets,
      plainText: parsed.plainText,
    });
    const bundle = migrationExtract(extractParams);

    const service = deps.getService(tenantId);
    const run = await service['repo']
      // @ts-expect-error reaching into repo for createRun is intentional
      .createRun({
        tenantId,
        createdBy: actorId,
        uploadFilename: file.name,
        uploadMimeType: file.type,
        uploadSizeBytes: buf.byteLength,
      });

    // @ts-expect-error same rationale
    await service['repo'].updateStatus(run.id, tenantId, 'extracted', {
      bundle,
      extractionSummary: {
        properties: bundle.properties.length,
        units: bundle.units.length,
        tenants: bundle.tenants.length,
        employees: bundle.employees.length,
        departments: bundle.departments.length,
        teams: bundle.teams.length,
      },
    });

    // Progressive-intelligence preview: feed the extracted bundle rows into
    // the accumulator so the UI can render a "what we understood" pane
    // that fills in as the operator chats.
    let progressivePreview: unknown = null;
    try {
      const rows = [
        ...bundle.tenants.map((t: Record<string, unknown>, idx: number) => ({
          rowIndex: idx,
          data: t,
        })),
        ...bundle.units.map((u: Record<string, unknown>, idx: number) => ({
          rowIndex: bundle.tenants.length + idx,
          data: u,
        })),
      ];
      progressivePreview = await progressiveAutoGen.buildPreview({
        tenantId,
        sessionId: `migration-${run.id}`,
        sourceSystem: 'lpms-upload',
        sourceFile: file.name,
        rows,
      });
    } catch {
      progressivePreview = null;
    }

    return c.json({
      runId: run.id,
      bundle,
      warnings: parsed.warnings,
      progressivePreview,
    });
  });

  // ----------------------- POST /:runId/commit -----------------------
  app.post('/:runId/commit', async (c) => {
    const tenantId = c.get('tenantId');
    const actorId = c.get('actorId');
    if (!tenantId || !actorId) return c.json({ error: 'unauthenticated' }, 401);

    const runId = c.req.param('runId');
    const service = deps.getService(tenantId);
    const result = await service.commit({ tenantId, runId, actorId });

    if (!result.ok) {
      return c.json(
        { ok: false, error: result.error },
        result.error.code === 'RUN_NOT_FOUND' ? 404 : 409
      );
    }
    return c.json({
      ok: true,
      runId,
      counts: result.counts,
      skipped: result.skipped,
    });
  });

  // ----------------------- POST /:runId/ask -----------------------
  // Copilot turn: the client posts the admin's chat message; we forward
  // it to the MigrationWizardCopilot (wired via the BrainRegistry in
  // brain.hono.ts). The handler here is a thin proxy.
  app.post('/:runId/ask', async (c) => {
    const tenantId = c.get('tenantId');
    const actorId = c.get('actorId');
    if (!tenantId || !actorId) return c.json({ error: 'unauthenticated' }, 401);

    const runId = c.req.param('runId');
    const body = (await c.req.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!body.message) return c.json({ error: 'missing message' }, 400);

    // TODO: wire to MigrationWizardCopilot via the shared BrainRegistry
    //   const copilot = registry.getMigrationWizard(tenantId);
    //   const out = await copilot.run({ tenantId, actorId, runId, ... });
    //   return c.json(out);
    return c.json({
      runId,
      ack: true,
      note: 'copilot proxy scaffolded — wire to BrainRegistry in Phase 2',
    });
  });

  return app;
}
