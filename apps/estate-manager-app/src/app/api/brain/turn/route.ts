/**
 * POST /api/brain/turn
 *
 * Executes a single Brain turn. On the admin surface, the viewer is the
 * signed-in admin; for Phase 1 we use a placeholder admin context. The
 * api-gateway's real auth middleware will replace this in the next pass.
 *
 * Body:
 *   { threadId?: string, userText: string, forcePersonaId?: string }
 *
 * Response: a shape compatible with the `BrainTurnResponse` in the client.
 */

import { NextResponse } from 'next/server';
import { createBrain } from '@bossnyumba/ai-copilot';

export const dynamic = 'force-dynamic';

// Singleton Brain instance for this Next.js process. In production the
// Orchestrator runs behind the api-gateway with a shared Postgres-backed
// thread store; here we use the in-memory store for dev.
let brainSingleton: ReturnType<typeof createBrain> | null = null;

function brain() {
  if (!brainSingleton) {
    brainSingleton = createBrain({
      anthropic: process.env.ANTHROPIC_API_KEY
        ? { apiKey: process.env.ANTHROPIC_API_KEY }
        : undefined,
      useMockProviders: !process.env.ANTHROPIC_API_KEY,
    });
  }
  return brainSingleton;
}

interface TurnBody {
  threadId?: string;
  userText?: string;
  forcePersonaId?: string;
}

export async function POST(req: Request) {
  let body: TurnBody;
  try {
    body = (await req.json()) as TurnBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.userText || typeof body.userText !== 'string') {
    return NextResponse.json({ error: 'userText_required' }, { status: 400 });
  }

  const { orchestrator } = brain();

  // Phase 1 admin context — replace when api-gateway auth is wired.
  const tenant = {
    tenantId: 'dev-tenant',
    tenantName: 'Development',
    environment: 'development' as const,
  };
  const actor = {
    type: 'user' as const,
    id: 'admin-dev',
    name: 'Admin (dev)',
    roles: ['admin', 'manager'],
  };
  const viewer = {
    userId: actor.id,
    roles: actor.roles,
    teamIds: [],
    isAdmin: true,
    isManagement: true,
  };

  try {
    if (!body.threadId) {
      const result = await orchestrator.startThread({
        tenant,
        actor,
        viewer,
        initialUserText: body.userText,
        forcePersonaId: body.forcePersonaId,
      });
      if (!result.success) {
        const err = (result as { success: false; error: { message: string } }).error;
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
      const turn = result.data.turn;
      return NextResponse.json({
        threadId: result.data.thread.id,
        finalPersonaId: turn.finalPersonaId,
        responseText: turn.responseText,
        handoffs: turn.handoffs,
        toolCalls: turn.toolCalls,
        advisorConsulted: turn.advisorConsulted,
        proposedAction: turn.proposedAction,
        visibilityScope: 'management',
        tokensUsed: turn.tokensUsed,
      });
    }

    const result = await orchestrator.handleTurn({
      threadId: body.threadId,
      tenant,
      actor,
      viewer,
      userText: body.userText,
      forcePersonaId: body.forcePersonaId,
    });
    if (!result.success) {
      const err = (result as { success: false; error: { message: string } }).error;
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({
      threadId: result.data.threadId,
      finalPersonaId: result.data.finalPersonaId,
      responseText: result.data.responseText,
      handoffs: result.data.handoffs,
      toolCalls: result.data.toolCalls,
      advisorConsulted: result.data.advisorConsulted,
      proposedAction: result.data.proposedAction,
      visibilityScope: 'management',
      tokensUsed: result.data.tokensUsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal_error' },
      { status: 500 }
    );
  }
}
