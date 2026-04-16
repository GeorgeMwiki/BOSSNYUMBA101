/**
 * POST /api/brain/review
 *
 * Records an admin's decision on a pending PROPOSED_ACTION. Writes a
 * `review_decision` event to the thread and returns the updated state.
 *
 * Production-only: Supabase JWT required, admin/manager role required.
 *
 * Body: { threadId, copilotRequestId, decision: 'approved'|'rejected', notes? }
 */

import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

const ReviewBodySchema = z.object({
  threadId: z.string().min(1),
  copilotRequestId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(2_000).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ReviewBodySchema.safeParse(body);
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
  const { brain, viewer, actor } = ctx;

  if (!viewer.isManagement) {
    return NextResponse.json(
      { error: 'review_requires_manager_or_admin', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  const thread = await brain.threads.getThread(parsed.data.threadId);
  if (!thread || thread.tenantId !== ctx.tenant.tenantId) {
    return NextResponse.json({ error: 'thread_not_found' }, { status: 404 });
  }

  // Append the decision event — the orchestrator inspects this on the next
  // turn so an approved action can be picked up and executed.
  await brain.threads.append({
    id: uuid(),
    threadId: thread.id,
    kind: 'review_decision',
    createdAt: new Date().toISOString(),
    visibility: {
      scope: 'management',
      authorActorId: actor.id,
      initiatingUserId: actor.id,
      teamId: thread.teamId,
      rationale: 'admin_review',
    },
    actorId: actor.id,
    copilotRequestId: parsed.data.copilotRequestId as never,
    decision: parsed.data.decision,
    reviewerId: actor.id,
    feedback: parsed.data.notes,
  } as never);

  return NextResponse.json({
    ok: true,
    decision: parsed.data.decision,
    reviewerId: actor.id,
    reviewedAt: new Date().toISOString(),
  });
}
