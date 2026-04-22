import { NextResponse } from 'next/server';

/**
 * Platform-staff login.
 *
 * TODO (identity-wiring): the real handler lives in the identity
 * service. This scaffold route returns 503 to keep the login form
 * exercisable end-to-end without minting a synthetic session.
 */
export function POST() {
  return NextResponse.json(
    { error: 'identity-service login not wired' },
    { status: 503 },
  );
}
