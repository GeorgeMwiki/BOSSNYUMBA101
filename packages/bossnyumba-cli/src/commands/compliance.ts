/**
 * `bossnyumba compliance check` — surface the compliance summary.
 */

import { requireSession } from './_session.js';
import type { BossNyumbaLogger } from '../logger.js';

export async function complianceCheckCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>('/api/v1/compliance/status');
  opts.logger.json(res);
}
