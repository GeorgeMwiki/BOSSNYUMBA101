/**
 * POST /api/brain/migrate/extract
 *
 * Runs skill.migration.extract + skill.migration.diff against the supplied
 * sheets. Returns the bundle + diff in a single response — the client shows
 * the review panel without a second round trip.
 */

import { NextResponse } from 'next/server';
import {
  migrationExtract,
  MigrationExtractParamsSchema,
  migrationDiff,
} from '@bossnyumba/ai-copilot';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = MigrationExtractParamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }
  const bundle = migrationExtract(parsed.data);
  const diff = migrationDiff({ bundle });
  return NextResponse.json({ bundle, diff });
}
