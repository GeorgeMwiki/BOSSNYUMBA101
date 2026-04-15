/**
 * Global teardown for BOSSNYUMBA E2E tests.
 *
 * Reads the state file written by global-setup and, when an API seed was
 * performed, asks the backend to purge the transient tenant/users. In UI-only
 * mode (no API endpoint), this is a no-op.
 */

import { request, type FullConfig } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export default async function globalTeardown(config: FullConfig): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const STATE_FILE = resolve(config.rootDir, '.playwright', 'e2e-state.json');

  let raw: string;
  try {
    raw = await readFile(STATE_FILE, 'utf-8');
  } catch {
    return;
  }

  const state = JSON.parse(raw) as { tenantId?: string; seedAvailable?: boolean };
  if (!apiBase || !state.seedAvailable || !state.tenantId) {
    await rm(STATE_FILE, { force: true });
    return;
  }

  const seedToken = process.env.E2E_SEED_TOKEN || '';
  const headers: Record<string, string> = seedToken
    ? { Authorization: `Bearer ${seedToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const ctx = await request.newContext({ baseURL: apiBase, ignoreHTTPSErrors: true });
  try {
    const res = await ctx.delete(`/api/e2e/seed/${state.tenantId}`, { headers });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(`[e2e:global-teardown] Cleanup responded ${res.status()}`);
    }
  } finally {
    await ctx.dispose();
    await rm(STATE_FILE, { force: true });
  }
}
