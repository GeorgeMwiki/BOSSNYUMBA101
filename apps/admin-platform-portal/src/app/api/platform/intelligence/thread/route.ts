import { NextResponse } from 'next/server';

/**
 * Create a new platform-scope intelligence thread.
 *
 * TODO (intelligence-wiring): proxy to the API gateway's
 * POST /api/v1/intelligence/thread with `{ scope: 'platform',
 * persona: 'industry-observer' }` and forward the Set-Cookie /
 * bearer from the staff session. Until wired, respond 503.
 */
export function POST() {
  return NextResponse.json(
    { error: 'intelligence-service not wired for platform scope' },
    { status: 503 },
  );
}
