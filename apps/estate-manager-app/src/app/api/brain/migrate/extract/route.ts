/**
 * POST /api/brain/migrate/extract
 *
 * Parses uploaded sheets/text into a draft bundle and computes a diff against
 * the current tenant's existing rows. Requires Supabase JWT auth.
 */

import { NextResponse } from 'next/server';
import {
  migrationExtract,
  MigrationExtractParamsSchema,
  migrationDiff,
} from '@bossnyumba/ai-copilot';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body: payload } = errorToResponse(err);
    return NextResponse.json(payload, { status });
  }
  // No further role gate — extract is read-only and used by both admins and
  // onboarding consultants. Commit is admin-only (see /commit).

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = MigrationExtractParamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const bundle = migrationExtract(parsed.data);
  // Diff against existing tenant rows requires repo access — Phase A leaves
  // the existing-state lookup as an empty diff baseline so the UI gets a
  // "would add N" preview. The committer applies real dedup at write time.
  const diff = migrationDiff({
    bundle,
    existing: {
      propertyNames: [],
      unitLabelsByProperty: {},
      tenantNames: [],
      employeeCodes: [],
      departmentCodes: [],
      teamCodes: [],
    },
  });
  // tenant id is pulled from ctx so the committer (next call) can use it.
  return NextResponse.json({
    bundle,
    diff,
    tenantId: ctx.tenant.tenantId,
  });
}
