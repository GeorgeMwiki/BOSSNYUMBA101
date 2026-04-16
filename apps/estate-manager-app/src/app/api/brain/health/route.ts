/**
 * GET /api/brain/health
 *
 * Reports Brain readiness — Anthropic reachable, thread store reachable,
 * tool/persona counts. Returns 200 even when degraded so monitors can read
 * the body and decide; surfaces missing-config as 503.
 */

import { NextResponse } from 'next/server';
import { checkBrainHealth, BrainConfigError } from '@bossnyumba/ai-copilot';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    if (err instanceof BrainConfigError) {
      return NextResponse.json(
        { ok: false, code: 'BRAIN_NOT_CONFIGURED', error: err.message },
        { status: 503 }
      );
    }
    const { status, body } = errorToResponse(err);
    return NextResponse.json(body, { status });
  }
  const health = await checkBrainHealth(ctx.brain);
  return NextResponse.json(health);
}
