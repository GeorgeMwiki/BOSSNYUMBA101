/**
 * GET /api/brain/threads
 *
 * Returns a list of Brain threads visible to the calling principal. Admins
 * and managers see all threads in the tenant; regular users see only the
 * threads they initiated. Production-only: Supabase JWT required.
 */

import { NextResponse } from 'next/server';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body } = errorToResponse(err);
    return NextResponse.json(body, { status });
  }
  const { brain, tenant, viewer } = ctx;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const list = await brain.threads.listThreads(tenant.tenantId, {
    userId: viewer.isManagement ? undefined : viewer.userId,
    limit,
  });
  return NextResponse.json({ threads: list });
}
