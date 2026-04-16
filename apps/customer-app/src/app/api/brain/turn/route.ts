/**
 * POST /api/brain/turn — customer-app tenant assistant route.
 *
 * Fixed forcePersonaId: 'tenant-assistant'. The tenant cannot pick another
 * persona from this surface.
 */

import { NextResponse } from 'next/server';
import {
  createBrain,
  PostgresThreadStoreBackend,
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
} from '@bossnyumba/ai-copilot';
import {
  createDatabaseClient,
  BrainThreadRepository,
} from '@bossnyumba/database';

export const dynamic = 'force-dynamic';

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

let brainCache: ReturnType<typeof createBrain> | null = null;
function brain(tenantId: string) {
  if (brainCache) return brainCache;
  const e = env();
  const db = createDatabaseClient(e.DATABASE_URL);
  const repo = new BrainThreadRepository(db);
  const backend = new PostgresThreadStoreBackend(repo, () => tenantId);
  brainCache = createBrain({
    anthropic: {
      apiKey: e.ANTHROPIC_API_KEY,
      baseUrl: e.ANTHROPIC_BASE_URL,
      defaultModel: e.ANTHROPIC_MODEL_DEFAULT,
    },
    threadStoreBackend: backend,
  });
  return brainCache;
}

interface TurnBody {
  threadId?: string;
  userText?: string;
}

export async function POST(req: Request) {
  let body: TurnBody;
  try {
    body = (await req.json()) as TurnBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.userText) {
    return NextResponse.json({ error: 'userText_required' }, { status: 400 });
  }

  let principal;
  try {
    const token = extractBearer(req.headers.get('authorization'));
    if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
    principal = await verifySupabaseJwt(token, {
      jwtSecret: env().SUPABASE_JWT_SECRET,
      defaultEnvironment: 'production',
    });
  } catch (err) {
    if (err instanceof SupabaseAuthError) {
      return NextResponse.json(
        { error: err.message, code: 'AUTH' },
        { status: err.status }
      );
    }
    if (err instanceof BrainConfigError) {
      return NextResponse.json(
        { error: err.message, code: 'BRAIN_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'auth_failed' },
      { status: 500 }
    );
  }

  const ctx = principalToBrainContexts(principal);
  const b = brain(ctx.tenant.tenantId);

  try {
    const turn = body.threadId
      ? await b.orchestrator.handleTurn({
          threadId: body.threadId,
          tenant: ctx.tenant,
          actor: ctx.actor,
          viewer: ctx.viewer,
          userText: body.userText,
          forcePersonaId: 'tenant-assistant',
        })
      : await b.orchestrator.startThread({
          tenant: ctx.tenant,
          actor: ctx.actor,
          viewer: ctx.viewer,
          initialUserText: body.userText,
          forcePersonaId: 'tenant-assistant',
        });

    if (!turn.success) {
      const err = (turn as { success: false; error: { message: string } }).error;
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if ('thread' in turn.data) {
      return NextResponse.json({
        threadId: turn.data.thread.id,
        finalPersonaId: turn.data.turn.finalPersonaId,
        responseText: turn.data.turn.responseText,
        proposedAction: turn.data.turn.proposedAction,
        advisorConsulted: turn.data.turn.advisorConsulted,
      });
    }
    return NextResponse.json({
      threadId: turn.data.threadId,
      finalPersonaId: turn.data.finalPersonaId,
      responseText: turn.data.responseText,
      proposedAction: turn.data.proposedAction,
      advisorConsulted: turn.data.advisorConsulted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal_error' },
      { status: 500 }
    );
  }
}
