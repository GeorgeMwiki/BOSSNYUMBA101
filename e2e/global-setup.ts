/**
 * Global setup for BOSSNYUMBA E2E tests.
 *
 * Responsibilities:
 *   - Provision a test tenant/org and seed users via the API if the backend
 *     exposes an E2E seed endpoint. When the endpoint is unavailable (for
 *     example, during pure UI smoke runs), we log a notice and continue
 *     gracefully so the suite stays runnable in local/offline mode.
 *   - Persist identifiers under ./.playwright/e2e-state.json so global
 *     teardown can delete them, keeping the environment clean between runs.
 *
 * The suite also respects E2E_TEST_* environment variables for pre-seeded
 * users (see e2e/fixtures/test-data.ts), so this setup is additive and idempotent.
 */

import { request, type FullConfig } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function stateFile(config: FullConfig): string {
  return resolve(config.rootDir, '.playwright', 'e2e-state.json');
}

interface E2EState {
  tenantId?: string;
  userIds: string[];
  createdAt: string;
  seedAvailable: boolean;
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const state: E2EState = {
    userIds: [],
    createdAt: new Date().toISOString(),
    seedAvailable: false,
  };

  const STATE_FILE = stateFile(config);
  await mkdir(resolve(STATE_FILE, '..'), { recursive: true });

  if (!apiBase) {
    // eslint-disable-next-line no-console
    console.log('[e2e:global-setup] No API_URL configured; running in UI-only mode.');
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    return;
  }

  const ctx = await request.newContext({ baseURL: apiBase, ignoreHTTPSErrors: true });
  try {
    const seedToken = process.env.E2E_SEED_TOKEN || '';
    const headers: Record<string, string> = seedToken
      ? { Authorization: `Bearer ${seedToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };

    // Probe for a seed endpoint; skip silently if not available.
    const probe = await ctx.get('/api/e2e/health', { headers }).catch(() => null);
    if (!probe || !probe.ok()) {
      // eslint-disable-next-line no-console
      console.log('[e2e:global-setup] /api/e2e/health not available; skipping API seed.');
      await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
      return;
    }

    const res = await ctx.post('/api/e2e/seed', {
      headers,
      data: {
        tenantName: `E2E Tenant ${Date.now()}`,
        users: [
          { role: 'super_admin', email: process.env.E2E_TEST_ADMIN_EMAIL },
          { role: 'owner', email: process.env.E2E_TEST_OWNER_EMAIL },
          { role: 'manager', email: process.env.E2E_TEST_MANAGER_EMAIL },
          { role: 'customer', phone: process.env.E2E_TEST_CUSTOMER_PHONE },
        ].filter((u) => u.email || u.phone),
      },
    });

    if (res.ok()) {
      const body = await res.json().catch(() => ({}));
      state.tenantId = body.tenantId;
      state.userIds = Array.isArray(body.userIds) ? body.userIds : [];
      state.seedAvailable = true;
      // eslint-disable-next-line no-console
      console.log(`[e2e:global-setup] Seeded tenant ${state.tenantId} with ${state.userIds.length} users.`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[e2e:global-setup] Seed endpoint returned ${res.status()}; continuing without seed.`);
    }
  } finally {
    await ctx.dispose();
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  }
}
