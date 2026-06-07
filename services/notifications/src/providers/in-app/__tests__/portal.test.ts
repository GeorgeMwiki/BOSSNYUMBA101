/**
 * In-app / portal provider — persistence contract.
 *
 * Verifies the terminal fallback provider actually writes a row into the
 * in-app inbox store that the customer / owner / estate portals read, so
 * the "without-fail" chain genuinely lands somewhere visible.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InAppProvider } from '../portal.js';
import {
  createInAppNotificationService,
  type InAppNotificationService,
} from '../../../services/in-app-notification.service.js';
import {
  InMemoryInAppNotificationStore,
  InMemoryConnectionRegistry,
} from '../../../storage/in-memory.js';
import type { TenantId } from '../../../types/index.js';

describe('InAppProvider', () => {
  const tenantId = 'tenant-1' as TenantId;
  let service: InAppNotificationService;
  let provider: InAppProvider;

  beforeEach(() => {
    service = createInAppNotificationService({
      store: new InMemoryInAppNotificationStore(),
      connections: new InMemoryConnectionRegistry(),
    });
    provider = new InAppProvider(service);
  });

  it('is always configured (no per-tenant credentials)', () => {
    expect(provider.isConfigured(tenantId)).toBe(true);
    expect(provider.channel).toBe('in_app');
  });

  it('persists a notification the portal inbox can list', async () => {
    const result = await provider.send({
      tenantId,
      to: 'user-a',
      userId: 'user-a',
      title: 'Rent due',
      body: 'Your rent is due in 5 days',
      data: { category: 'reminder', priority: 'high' },
    });

    expect(result.success).toBe(true);
    expect(result.externalId).toBeDefined();

    const { notifications, total } = await service.listForUser(tenantId, 'user-a');
    expect(total).toBe(1);
    expect(notifications[0]?.title).toBe('Rent due');
    expect(notifications[0]?.message).toBe('Your rent is due in 5 days');
    expect(notifications[0]?.category).toBe('reminder');
    expect(notifications[0]?.priority).toBe('high');
  });

  it('falls back to a default category/priority for unknown values', async () => {
    await provider.send({
      tenantId,
      to: 'user-b',
      userId: 'user-b',
      body: 'Generic message',
      data: { category: 'not-a-real-category', priority: 'nope' },
    });
    const { notifications } = await service.listForUser(tenantId, 'user-b');
    expect(notifications[0]?.category).toBe('system');
    expect(notifications[0]?.priority).toBe('normal');
  });

  it('returns a non-retryable failure when userId is missing', async () => {
    const result = (await provider.send({
      tenantId,
      to: '',
      body: 'no user',
    })) as { success: boolean; errorCode?: string };
    expect(result.success).toBe(false);
    // Non-retryable code so the dispatcher fails fast instead of retrying.
    expect(result.errorCode).toBe('INVALID_RECIPIENT');
  });

  it('reads userId from data.userId when the top-level field is absent', async () => {
    const result = await provider.send({
      tenantId,
      to: 'addr',
      body: 'via data',
      data: { userId: 'user-c' },
    });
    expect(result.success).toBe(true);
    const { total } = await service.listForUser(tenantId, 'user-c');
    expect(total).toBe(1);
  });

  it('surfaces store failures as a (retryable) provider error', async () => {
    const throwingService = {
      async create() {
        throw new Error('inbox store down');
      },
    } as unknown as InAppNotificationService;
    const failing = new InAppProvider(throwingService);
    const result = await failing.send({
      tenantId,
      to: 'user-d',
      userId: 'user-d',
      body: 'will fail',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('inbox store down');
  });
});
