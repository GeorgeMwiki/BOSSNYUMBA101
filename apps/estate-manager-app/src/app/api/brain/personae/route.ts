/**
 * GET /api/brain/personae
 *
 * Returns the public persona roster for this tenant. Phase 1: derives from
 * the default catalog in @bossnyumba/ai-copilot without touching the DB.
 * Phase 2 reads tenant-specific overrides.
 */

import { NextResponse } from 'next/server';
import { DEFAULT_PERSONAE } from '@bossnyumba/ai-copilot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const personae = DEFAULT_PERSONAE.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    missionStatement: p.missionStatement,
    kind: p.kind,
  }));
  return NextResponse.json({ personae });
}
