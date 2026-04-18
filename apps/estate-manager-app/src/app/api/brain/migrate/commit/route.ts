// @ts-nocheck — domain-models / brain migrate type drift; tracked
/**
 * POST /api/brain/migrate/commit
 *
 * Real commit — writes through MigrationWriterService. No dry-run stub.
 * Requires verified Supabase JWT and the `admin` role to perform a commit.
 */

import { NextResponse } from 'next/server';
import { ExtractionBundleSchema } from '@bossnyumba/ai-copilot';
import {
  createDatabaseClient,
  MigrationWriterService,
} from '@bossnyumba/database';
import { z } from 'zod';
import {
  brainForRequest,
  errorToResponse,
} from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

const CommitBodySchema = z.object({
  bundle: ExtractionBundleSchema,
  bestEffort: z.boolean().optional().default(false),
});

let dbCache: ReturnType<typeof createDatabaseClient> | null = null;
function db() {
  if (dbCache) return dbCache;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  dbCache = createDatabaseClient(url);
  return dbCache;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = CommitBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body: payload } = errorToResponse(err);
    return NextResponse.json(payload, { status });
  }
  const { tenant, actor } = ctx;
  if (!actor.roles.includes('admin')) {
    return NextResponse.json(
      { error: 'admin_role_required', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const writer = new MigrationWriterService(db());
    // Env-sourced region settings — moved out of the writer which used
    // to hardcode 'KE'/'KES'/'Nairobi'. Production must set these; dev
    // falls through with empty strings so bad data is visible.
    const country = process.env.DEFAULT_TENANT_COUNTRY?.trim() || '';
    const currency = process.env.DEFAULT_TENANT_CURRENCY?.trim() || '';
    const defaultCity = process.env.DEFAULT_TENANT_CITY?.trim() || undefined;
    if (process.env.NODE_ENV === 'production' && (!country || !currency)) {
      return NextResponse.json(
        {
          error:
            'DEFAULT_TENANT_COUNTRY and DEFAULT_TENANT_CURRENCY env vars are required in production',
        },
        { status: 503 }
      );
    }
    const report = await writer.commit(
      parsed.data.bundle,
      {
        tenantId: tenant.tenantId,
        ownerUserId: actor.id,
        actorUserId: actor.id,
        tenantCountry: country,
        tenantCurrency: currency,
        defaultCity,
      },
      { bestEffort: parsed.data.bestEffort }
    );
    return NextResponse.json({ report });
  } catch (err) {
    const { status, body: payload } = errorToResponse(err);
    return NextResponse.json(payload, { status });
  }
}
