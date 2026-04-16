/**
 * GET /api/brain/review-queue
 *
 * Returns all PROPOSED_ACTION turns that emitted a `review_requested` event
 * but do not yet have a matching `review_decision` event. Visibility-
 * filtered to whatever the calling principal can see; admin/manager get
 * the management-scope queue.
 *
 * Production-only: Supabase JWT required.
 */

import { NextResponse } from 'next/server';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

interface ReviewQueueItem {
  threadId: string;
  threadTitle: string;
  personaId: string;
  copilotRequestId: string;
  riskLevel: string;
  requestedAt: string;
  /** Most recent persona message text in the thread (the proposed action). */
  preview?: string;
}

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await brainForRequest(req);
  } catch (err) {
    const { status, body } = errorToResponse(err);
    return NextResponse.json(body, { status });
  }
  const { brain, tenant, viewer } = ctx;

  const threads = await brain.threads.listThreads(tenant.tenantId, {
    status: 'open',
    limit: 200,
  });

  const items: ReviewQueueItem[] = [];
  for (const t of threads) {
    const events = await brain.threads.readAs(t.id, viewer);
    // Index decisions by copilotRequestId so we can subtract them.
    const decided = new Set<string>();
    for (const e of events) {
      if (e.kind === 'review_decision') {
        const id = (e as { copilotRequestId?: string }).copilotRequestId;
        if (id) decided.add(id);
      }
    }
    for (const e of events) {
      if (e.kind !== 'review_requested') continue;
      const reqId = (e as { copilotRequestId: string }).copilotRequestId;
      if (decided.has(reqId)) continue;
      // Look back to find the persona message that emitted this proposal.
      const preview = events
        .filter((x) => x.kind === 'persona_message' && x.createdAt <= e.createdAt)
        .pop() as { text?: string } | undefined;
      items.push({
        threadId: t.id,
        threadTitle: t.title,
        personaId: (e as { personaId: string }).personaId,
        copilotRequestId: reqId,
        riskLevel: (e as { riskLevel: string }).riskLevel,
        requestedAt: e.createdAt,
        preview: preview?.text?.slice(0, 280),
      });
    }
  }

  // Newest first.
  items.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return NextResponse.json({ items, count: items.length });
}
