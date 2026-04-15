/**
 * Smoke tests for the notifications HTTP server.
 *
 * Goal: exercise the auth middleware and route plumbing without touching any
 * real provider, Redis or database. Everything the server reads from ./index.js
 * is replaced with vi.fn() stubs.
 *
 * We boot the express app on an ephemeral port per-test and talk to it with
 * the global fetch (no supertest dependency required).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// -- Mocked upstream library surface used by server.ts -----------------------
const inAppNotificationService = {
  listForUser: vi.fn(),
  getById: vi.fn(),
  markAsRead: vi.fn(),
};
const notificationService = { sendNotification: vi.fn() };
const preferencesService = {
  getUserPreferences: vi.fn(),
  updatePreferences: vi.fn(),
};
const serviceLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../index.js', () => ({
  serviceLogger,
  inAppNotificationService,
  notificationService,
  preferencesService,
  startNotificationConsumer: vi.fn(),
  stopNotificationConsumer: vi.fn(),
}));

import { buildApp } from '../server.js';

const ORIGINAL_ENV = { ...process.env };

async function listen(app: ReturnType<typeof buildApp>): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo | null;
      if (!addr || typeof addr === 'string') {
        reject(new Error('could not determine test server address'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

let active: Server | null = null;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.INTERNAL_API_KEY;
  inAppNotificationService.listForUser.mockReset();
  inAppNotificationService.getById.mockReset();
  inAppNotificationService.markAsRead.mockReset();
  notificationService.sendNotification.mockReset();
  preferencesService.getUserPreferences.mockReset();
  preferencesService.updatePreferences.mockReset();
});

afterEach(async () => {
  if (active) {
    await close(active);
    active = null;
  }
  process.env = { ...ORIGINAL_ENV };
});

describe('notifications HTTP server', () => {
  it('GET /health returns 200 with the expected shape (pre-auth)', async () => {
    process.env.INTERNAL_API_KEY = 'whatever'; // health must bypass auth
    const { server, url } = await listen(buildApp());
    active = server;

    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('notifications');
    expect(typeof body.timestamp).toBe('string');
  });

  it('rejects unknown internal tokens when INTERNAL_API_KEY is set', async () => {
    process.env.INTERNAL_API_KEY = 'expected-key';
    const { server, url } = await listen(buildApp());
    active = server;

    const res = await fetch(`${url}/notifications?userId=u1&tenantId=t1`, {
      headers: { 'x-internal-token': 'wrong-key' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    // The downstream library should NEVER have been called on an unauth request.
    expect(inAppNotificationService.listForUser).not.toHaveBeenCalled();
  });

  it('accepts a matching X-Internal-Token and proxies to the in-app service', async () => {
    process.env.INTERNAL_API_KEY = 'expected-key';
    inAppNotificationService.listForUser.mockResolvedValue({
      notifications: [{ id: 'n1', title: 'hi', message: 'there' }],
      total: 1,
    });

    const { server, url } = await listen(buildApp());
    active = server;

    const res = await fetch(`${url}/notifications?userId=u1&tenantId=t1`, {
      headers: { 'x-internal-token': 'expected-key' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ id: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };
    expect(body.success).toBe(true);
    expect(body.data[0]!.id).toBe('n1');
    expect(body.pagination.total).toBe(1);
    expect(inAppNotificationService.listForUser).toHaveBeenCalledTimes(1);
  });

  it('GET /notifications without userId returns 400 VALIDATION_ERROR', async () => {
    // No INTERNAL_API_KEY → auth is skipped, so we exercise the validator.
    const { server, url } = await listen(buildApp());
    active = server;

    const res = await fetch(`${url}/notifications?tenantId=t1`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(inAppNotificationService.listForUser).not.toHaveBeenCalled();
  });

  it('returns 404 NOT_FOUND envelope for unknown routes', async () => {
    const { server, url } = await listen(buildApp());
    active = server;

    const res = await fetch(`${url}/no-such-route`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
