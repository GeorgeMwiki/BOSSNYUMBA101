import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { PLATFORM_SESSION_COOKIE, type PlatformStaff } from '@/lib/session';

/**
 * Return the current staff session or 401.
 *
 * TODO (identity-wiring): the scaffold reads the session cookie and,
 * when present, returns a placeholder `PlatformStaff` payload. The real
 * implementation should POST the cookie to
 * `services/identity-service` (endpoint `/sessions/verify`) and return
 * the decoded claim. If the identity service is offline the route
 * should respond 503 so the UI renders a degraded state — never a
 * synthetic staff identity.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;

  if (!session || session.length === 0) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // TODO: replace with identity-service call. Until the service is
  // wired, the route returns 503 so the UI renders a degraded state
  // instead of a mock identity.
  const identityWired = process.env.BOSSNYUMBA_IDENTITY_WIRED === 'true';
  if (!identityWired) {
    return NextResponse.json(
      { error: 'identity-service not wired' },
      { status: 503 },
    );
  }

  // When identity is wired, the verified claim replaces this stub.
  const staff: PlatformStaff = {
    id: 'pending-identity-wiring',
    name: 'pending-identity-wiring',
    roles: [],
  };
  return NextResponse.json({ staff });
}
