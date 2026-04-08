/**
 * Tests for the ChatPage <-> api-client wiring.
 *
 * We don't render React here (the repo's default vitest config runs in
 * a Node environment with no DOM). Instead we exercise the `chat`
 * service that ChatPage calls, plus the small helpers that shape the
 * data flowing into the component, by stubbing the global singleton
 * returned by `getApiClient`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Resolve the package by relative path (the monorepo alias isn't wired
// into the default vitest include). The api-client package is at
// <repo>/packages/api-client/src/index.ts, and this test lives at
// apps/customer-app/src/pages/__tests__/ — five levels up to the repo.
const CLIENT_MODULE = '../../../../../packages/api-client/src/client';
const CHAT_MODULE = '../../../../../packages/api-client/src/services/chat';

type Handler = (path: string, params?: unknown) => Promise<unknown>;

interface FakeClient {
  get: Handler;
  post: Handler;
  put: Handler;
  patch: Handler;
  delete: Handler;
  getAccessToken: () => string | undefined;
}

const clientState: { current: FakeClient | null } = { current: null };

vi.mock(CLIENT_MODULE, async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/api-client/src/client')
  >(CLIENT_MODULE);
  return {
    ...actual,
    getApiClient: () => {
      if (!clientState.current) {
        throw new Error('fake client not initialised');
      }
      return clientState.current as unknown as ReturnType<typeof actual.getApiClient>;
    },
  };
});

// Import after mocking the client module.
import { chat } from '../../../../../packages/api-client/src/services/chat';

function installFakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const base: FakeClient = {
    get: vi.fn(async () => ({ success: true, data: [] })),
    post: vi.fn(async () => ({ success: true, data: null })),
    put: vi.fn(async () => ({ success: true, data: null })),
    patch: vi.fn(async () => ({ success: true, data: null })),
    delete: vi.fn(async () => ({ success: true, data: null })),
    getAccessToken: () => 'test-token',
    ...overrides,
  };
  clientState.current = base;
  return base;
}

describe('ChatPage api-client wiring', () => {
  beforeEach(() => {
    installFakeClient();
  });

  describe('listMessages', () => {
    it('requests the last 50 messages for the active thread', async () => {
      const fake = installFakeClient({
        get: vi.fn(async () => ({
          success: true,
          data: [
            {
              id: 'm1',
              tenantId: 't1',
              conversationId: 'thread-123',
              senderId: 'user-1',
              senderType: 'customer',
              content: 'Hello',
              status: 'SENT',
              createdAt: '2026-04-08T12:00:00.000Z',
            },
          ],
        })),
      });

      const res = await chat.listMessages({ threadId: 'thread-123', limit: 50 });

      expect(fake.get).toHaveBeenCalledTimes(1);
      const [path, params] = (fake.get as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(path).toBe('/messaging/conversations/thread-123/messages');
      expect(params).toMatchObject({ pageSize: 50 });
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0]?.content).toBe('Hello');
    });

    it('surfaces api errors from the client', async () => {
      installFakeClient({
        get: vi.fn(async () => {
          throw new Error('boom');
        }),
      });
      await expect(
        chat.listMessages({ threadId: 'thread-123', limit: 50 })
      ).rejects.toThrow('boom');
    });
  });

  describe('sendMessage', () => {
    it('posts the body to the correct thread endpoint', async () => {
      const fake = installFakeClient({
        post: vi.fn(async () => ({
          success: true,
          data: {
            id: 'm2',
            tenantId: 't1',
            conversationId: 'thread-123',
            senderId: 'user-1',
            senderType: 'customer',
            content: 'Hey there',
            status: 'SENT',
            createdAt: '2026-04-08T12:05:00.000Z',
          },
        })),
      });

      const res = await chat.sendMessage({
        threadId: 'thread-123',
        body: 'Hey there',
      });

      expect(fake.post).toHaveBeenCalledTimes(1);
      const [path, body] = (fake.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(path).toBe('/messaging/conversations/thread-123/messages');
      expect(body).toMatchObject({ content: 'Hey there' });
      expect(res.data?.id).toBe('m2');
    });

    it('propagates errors so the form can surface them', async () => {
      installFakeClient({
        post: vi.fn(async () => {
          throw new Error('rate limited');
        }),
      });
      await expect(
        chat.sendMessage({ threadId: 'thread-123', body: 'hi' })
      ).rejects.toThrow('rate limited');
    });
  });

  describe('client-side validation guard', () => {
    // Mirrors the guard inside ChatPage.handleSend: trims, rejects empty.
    function guardBody(raw: string): { ok: boolean; error?: string } {
      const body = raw.trim();
      if (!body) return { ok: false, error: 'Message cannot be empty' };
      return { ok: true };
    }

    it('rejects an empty draft', () => {
      expect(guardBody('')).toEqual({
        ok: false,
        error: 'Message cannot be empty',
      });
    });

    it('rejects a whitespace-only draft', () => {
      expect(guardBody('   \n\t')).toEqual({
        ok: false,
        error: 'Message cannot be empty',
      });
    });

    it('accepts a non-empty draft', () => {
      expect(guardBody('hi')).toEqual({ ok: true });
    });
  });
});

// Silence unused-import warnings when referring to the CHAT_MODULE constant.
void CHAT_MODULE;
