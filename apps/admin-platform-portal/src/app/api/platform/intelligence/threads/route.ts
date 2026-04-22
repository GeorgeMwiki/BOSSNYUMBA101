import { NextResponse } from 'next/server';

/**
 * List of platform-scope intelligence threads (Industry conversations).
 *
 * TODO (intelligence-wiring): proxy to the API gateway's
 * GET /api/v1/intelligence/threads?scope=platform with the staff's
 * session token. Until that is wired, respond 503 so the UI renders
 * an honest degraded state — never mock conversations.
 */
export function GET() {
  return NextResponse.json(
    { error: 'intelligence-service not wired for platform scope' },
    { status: 503 },
  );
}
