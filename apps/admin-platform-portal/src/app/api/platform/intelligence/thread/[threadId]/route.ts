import { NextResponse } from 'next/server';

/**
 * Read a single platform-scope intelligence thread (messages + artifacts).
 *
 * TODO (intelligence-wiring): proxy to the API gateway's
 * GET /api/v1/intelligence/thread/:id with scope=platform enforcement.
 * Until wired, respond 503 so the UI renders the degraded state.
 */
export function GET() {
  return NextResponse.json(
    { error: 'intelligence-service not wired for platform scope' },
    { status: 503 },
  );
}
