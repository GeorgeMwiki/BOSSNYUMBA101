/**
 * `bossnyumba properties sites / workers` — surface property + maintenance roll-ups.
 */

import { requireSession } from './_session.js';
import type { BossNyumbaLogger } from '../logger.js';

export async function propertiesSitesCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>('/api/v1/properties/sites');
  opts.logger.json(res);
}

export async function propertiesWorkersCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>('/api/v1/maintenance/workforce');
  opts.logger.json(res);
}
