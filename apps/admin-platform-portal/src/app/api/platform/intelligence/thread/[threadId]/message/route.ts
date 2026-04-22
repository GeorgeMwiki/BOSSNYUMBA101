import { NextResponse } from 'next/server';

/**
 * Post a message to a platform-scope intelligence thread. Streams SSE back.
 *
 * TODO (intelligence-wiring): proxy to
 * POST /api/v1/intelligence/thread/:id/message with scope=platform
 * and pipe the upstream ReadableStream back to the client unchanged.
 * Until wired, respond 503 so the UI renders the offline banner.
 */
export function POST() {
  return NextResponse.json(
    { error: 'intelligence-service not wired for platform scope' },
    { status: 503 },
  );
}
