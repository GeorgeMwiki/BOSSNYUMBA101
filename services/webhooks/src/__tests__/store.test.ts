/**
 * Unit tests for InMemoryWebhookStore.
 *
 * Focus: the public contract exercised by webhook-service.ts — ID generation,
 * URL validation, events non-empty, tenant filtering, soft inactivity semantics
 * and unsubscribe idempotency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWebhookStore } from '../store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('InMemoryWebhookStore', () => {
  let store: InMemoryWebhookStore;

  beforeEach(() => {
    store = new InMemoryWebhookStore();
  });

  it('subscribe assigns a UUID id and sets active=true', async () => {
    const sub = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
    });
    expect(sub.id).toMatch(UUID_RE);
    expect(sub.active).toBe(true);
    expect(sub.createdAt).toEqual(expect.any(String));
    expect(sub.url).toBe('https://example.com/hook');
    expect(sub.tenantId).toBe('t1');
  });

  it('subscribe rejects non-http(s) URL', async () => {
    await expect(
      store.subscribe({
        url: 'ftp://example.com/hook',
        events: ['payment.created'],
        tenantId: 't1',
      })
    ).rejects.toThrow(/http\(s\)/);
  });

  it('subscribe rejects invalid URL strings', async () => {
    await expect(
      store.subscribe({
        url: 'not a url',
        events: ['payment.created'],
        tenantId: 't1',
      })
    ).rejects.toThrow(/http\(s\)/);
  });

  it('subscribe rejects empty events array', async () => {
    await expect(
      store.subscribe({
        url: 'https://example.com/hook',
        events: [],
        tenantId: 't1',
      })
    ).rejects.toThrow(/event type/i);
  });

  it('getSubscriptions filters by tenantId', async () => {
    await store.subscribe({
      url: 'https://a.example.com',
      events: ['payment.created'],
      tenantId: 'tenant-a',
    });
    await store.subscribe({
      url: 'https://b.example.com',
      events: ['payment.created'],
      tenantId: 'tenant-b',
    });

    const forA = await store.getSubscriptions('tenant-a');
    expect(forA).toHaveLength(1);
    expect(forA[0]!.tenantId).toBe('tenant-a');

    const all = await store.getSubscriptions();
    expect(all).toHaveLength(2);
  });

  it('getSubscriptions excludes inactive subscriptions', async () => {
    const s = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
    });
    await store.unsubscribe(s.id);

    const list = await store.getSubscriptions('t1');
    expect(list).toHaveLength(0);

    const all = await store.getSubscriptions();
    expect(all).toHaveLength(0);
  });

  it('unsubscribe returns true for a known id and false for unknown', async () => {
    const s = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
    });
    await expect(store.unsubscribe(s.id)).resolves.toBe(true);
    await expect(store.unsubscribe('does-not-exist')).resolves.toBe(false);
  });

  it('unsubscribe is idempotent — second call returns false', async () => {
    const s = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
    });
    await expect(store.unsubscribe(s.id)).resolves.toBe(true);
    await expect(store.unsubscribe(s.id)).resolves.toBe(false);
  });

  it('findById returns the subscription or null', async () => {
    const s = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
    });
    await expect(store.findById(s.id)).resolves.toMatchObject({ id: s.id });
    await expect(store.findById('missing')).resolves.toBeNull();
  });

  it('subscribe persists an optional secret', async () => {
    const s = await store.subscribe({
      url: 'https://example.com/hook',
      events: ['payment.created'],
      tenantId: 't1',
      secret: 'shh',
    });
    expect(s.secret).toBe('shh');
  });
});
