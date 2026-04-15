/**
 * POST /api/brain/migrate/commit
 *
 * Commits a reviewed migration bundle. Phase 1: calls skill.migration.commit
 * (dry-run). Phase 2 swaps in a MigrationWriterService backed by the HR +
 * property + tenant repositories, behind an admin-approval gate.
 */

import { NextResponse } from 'next/server';
import { ExtractionBundleSchema } from '@bossnyumba/ai-copilot';
import { migrationCommitTool } from '@bossnyumba/ai-copilot';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const schema = (await import('zod')).z.object({
    bundle: ExtractionBundleSchema,
    write: (await import('zod')).z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }
  const result = await migrationCommitTool.execute(parsed.data, {
    tenant: {
      tenantId: 'dev-tenant',
      tenantName: 'Development',
      environment: 'development',
    },
    actor: { type: 'user', id: 'admin-dev', roles: ['admin'] },
    persona: {
      id: 'migration-wizard',
      kind: 'utility',
      displayName: 'Migration Wizard',
      missionStatement: '',
      systemPrompt: '',
      allowedTools: ['skill.migration.commit'],
      visibilityBudget: 'management',
      defaultVisibility: 'management',
      modelTier: 'standard',
      advisorEnabled: false,
      advisorHardCategories: [],
      minReviewRiskLevel: 'HIGH',
    },
    threadId: 'migration-wizard-ephemeral',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result: result.data });
}
