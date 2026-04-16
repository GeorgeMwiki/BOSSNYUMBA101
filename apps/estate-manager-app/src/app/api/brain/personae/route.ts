/**
 * GET /api/brain/personae
 *
 * Auth-gated list of persona templates. Returns 401 without a verified
 * Supabase JWT.
 */

import { NextResponse } from 'next/server';
import { DEFAULT_PERSONAE } from '@bossnyumba/ai-copilot';
import { brainForRequest, errorToResponse } from '@/lib/brain-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await brainForRequest(req);
  } catch (err) {
    const { status, body } = errorToResponse(err);
    return NextResponse.json(body, { status });
  }
  const personae = DEFAULT_PERSONAE.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    missionStatement: p.missionStatement,
    kind: p.kind,
  }));
  return NextResponse.json({ personae });
}
