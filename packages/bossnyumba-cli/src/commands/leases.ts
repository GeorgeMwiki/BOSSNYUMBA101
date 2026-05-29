/**
 * `bossnyumba leases ls / new / lock / show` — document leases.
 */

import { randomUUID } from 'node:crypto';
import { requireSession } from './_session.js';
import type { BossNyumbaLogger } from '../logger.js';

interface LeaseListItem {
  readonly id: string;
  readonly title?: string;
  readonly classification?: string;
  readonly updatedAt?: string;
  readonly [key: string]: unknown;
}

export async function leasesLsCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<{ success: boolean; data: readonly LeaseListItem[] }>(
    '/api/v1/owner/leases',
  );
  emitTabular(opts.logger, res?.data ?? [], ['id', 'title', 'classification', 'updatedAt']);
}

export async function leasesNewCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly template?: string;
  readonly intent?: string;
}): Promise<void> {
  const session = requireSession(opts.logger);
  if (!opts.intent && !opts.template) {
    opts.logger.error('Provide --intent "<text>" or --template <name>');
    process.exitCode = 1;
    return;
  }
  const body = opts.intent
    ? { intent: opts.intent }
    : { templateSlug: opts.template };
  const res = await session.http.request<{ success: boolean; data?: unknown }>(
    '/api/v1/owner/leases/free-form',
    {
      method: 'POST',
      body,
      idempotencyKey: randomUUID(),
    },
  );
  opts.logger.json(res);
}

export async function leasesLockCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly id: string;
  readonly reason?: string;
}): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<{ success: boolean }>(
    `/api/v1/owner/leases/${encodeURIComponent(opts.id)}/lock`,
    {
      method: 'POST',
      body: { reason: opts.reason ?? 'finalized' },
      idempotencyKey: randomUUID(),
    },
  );
  if (opts.logger.opts.json) opts.logger.json(res);
  else opts.logger.success(`Locked lease ${opts.id}.`);
}

export async function leasesShowCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly id: string;
}): Promise<void> {
  const session = requireSession(opts.logger);
  const res = await session.http.request<unknown>(
    `/api/v1/owner/leases/${encodeURIComponent(opts.id)}`,
  );
  opts.logger.json(res);
}

function emitTabular<T extends Record<string, unknown>>(
  logger: BossNyumbaLogger,
  rows: readonly T[],
  cols: readonly string[],
): void {
  if (logger.opts.json) {
    logger.json(rows);
    return;
  }
  if (rows.length === 0) {
    logger.info('(no rows)');
    return;
  }
  logger.raw(cols.join('\t'));
  for (const row of rows) {
    logger.raw(cols.map((c) => formatCell(row[c])).join('\t'));
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
