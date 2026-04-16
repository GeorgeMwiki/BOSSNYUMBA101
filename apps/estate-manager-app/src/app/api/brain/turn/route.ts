/**
 * POST /api/brain/turn
 *
 * Production-only. Requires:
 *  - `Authorization: Bearer <supabase-access-token>` (verified)
 *  - All Brain env vars set (ANTHROPIC_API_KEY, SUPABASE_*, DATABASE_URL)
 *
 * No dev fallbacks. No mock providers. Missing auth → 401. Missing env → 503.
 */

import { NextResponse } from 'next/server';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

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

  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body: payload } = errorToResponse(err);
    return NextResponse.json(payload, { status });
  }
  const { brain, tenant, actor, viewer } = ctx;

  try {
    if (!body.threadId) {
      const result = await brain.orchestrator.startThread({
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
        tokensUsed: turn.tokensUsed,
      });
    }

    const result = await brain.orchestrator.handleTurn({
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
      tokensUsed: result.data.tokensUsed,
    });
  } catch (err) {
    const { status, body: payload } = errorToResponse(err);
    return NextResponse.json(payload, { status });
  }
}
