/**
 * `bossnyumba decisions ls / show` — decision journal.
 */

import { requireSession } from './_session.js';
import type { BossNyumbaLogger } from '../logger.js';

export async function decisionsLsCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>('/api/v1/decisions');
  opts.logger.json(res);
}

export async function decisionsShowCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly id: string;
}): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>(
    `/api/v1/decisions/${encodeURIComponent(opts.id)}`,
  );
  opts.logger.json(res);
}
