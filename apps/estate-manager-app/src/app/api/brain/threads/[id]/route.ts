/**
 * GET /api/brain/threads/:id
 *
 * Returns a single thread + its visibility-filtered events.
 */

import { NextResponse } from 'next/server';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctxParams: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body } = errorToResponse(err);
    return NextResponse.json(body, { status });
  }
  const { brain, tenant, viewer } = ctx;
  const { id } = await ctxParams.params;
  const thread = await brain.threads.getThread(id);
  if (!thread || thread.tenantId !== tenant.tenantId) {
    return NextResponse.json({ error: 'thread_not_found' }, { status: 404 });
  }
  const events = await brain.threads.readAs(id, viewer);
  return NextResponse.json({ thread, events });
}
