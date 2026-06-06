/**
 * SSRF regression — the enterprise `WorkflowEngine` (HTTP_REQUEST action) and
 * `WebhookManager` (delivery) dispatch to OPERATOR-SUPPLIED URLs. Before the
 * fix they called the global `fetch` with no egress guard, so a workflow or a
 * registered webhook endpoint could be pointed at cloud metadata
 * (169.254.169.254) or loopback to reach internal services.
 *
 * Both now route the URL through this package's own `assertUrlSafe` BEFORE the
 * fetch. These tests prove:
 *   - an internal-IP destination is REJECTED, and
 *   - the underlying `fetch` is NEVER invoked for it.
 *
 * Literal internal IPs are caught by the synchronous host string-gate (no DNS,
 * no network), so the tests are deterministic and offline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WorkflowEngine,
  ActionType,
  TriggerType,
  WorkflowStatus,
} from '../custom-workflows.js';
import {
  WebhookManager,
  WebhookEventCategory,
  DeliveryStatus,
  type WebhookEndpoint,
  type WebhookDelivery,
} from '../webhooks.js';

const METADATA_URL = 'http://169.254.169.254/latest/meta-data/iam/';
// Default port 80 so the internal-IP host gate (not the port gate) is the
// check that fires — keeps the assertion precise about WHY it was rejected.
const LOOPBACK_URL = 'http://127.0.0.1/internal';
const PUBLIC_URL = 'https://hooks.example.com/inbound';

describe('SSRF guard — WorkflowEngine HTTP_REQUEST action', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // Any invocation is a guard failure — make it loud.
    fetchSpy = vi.fn(async () => {
      throw new Error('fetch must not be called for an internal-IP destination');
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('refuses to fetch a cloud-metadata URL and never calls fetch', async () => {
    const engine = new WorkflowEngine();
    const wf = engine.createWorkflow({
      tenantId: 'tnt-1',
      name: 'exfil-attempt',
      description: 'points an HTTP action at the metadata service',
      status: WorkflowStatus.ACTIVE,
      trigger: { id: 'trg-1', type: TriggerType.MANUAL, config: {} },
      actions: [
        {
          id: 'act-1',
          name: 'call-metadata',
          type: ActionType.HTTP_REQUEST,
          config: { url: METADATA_URL, method: 'GET' },
        },
      ],
      startActionId: 'act-1',
      createdBy: 'tester',
    });

    const execution = await engine.triggerWorkflow(wf.id, {});
    expect(execution).not.toBeNull();
    const result = execution!.actionResults.find((r) => r.actionId === 'act-1');
    expect(result).toBeDefined();
    // Handler caught the SSRF throw → statusCode 0 + denial error, no fetch.
    expect(result!.output?.statusCode).toBe(0);
    expect(String(result!.output?.error)).toContain('denied-internal-ip');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SSRF guard — WebhookManager delivery', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => {
      throw new Error('fetch must not be called for an internal-IP destination');
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  function makeDelivery(endpointId: string): WebhookDelivery {
    const now = new Date().toISOString();
    return {
      id: 'dlv-1',
      endpointId,
      eventId: 'evt-1',
      event: {
        id: 'evt-1',
        tenantId: 'tnt-1',
        type: 'payment.completed',
        category: WebhookEventCategory.PROPERTY,
        timestamp: now,
        data: { amount: 1000 },
      },
      status: DeliveryStatus.PENDING,
      attempts: [],
      createdAt: now,
    };
  }

  function registerEndpoint(mgr: WebhookManager, url: string): string {
    const now = new Date().toISOString();
    const endpoint: WebhookEndpoint = {
      id: 'ep-1',
      tenantId: 'tnt-1',
      url,
      secret: 'whsec_test',
      events: ['payment.completed'],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    mgr.registerEndpoint(endpoint);
    return endpoint.id;
  }

  it('refuses to deliver to a loopback endpoint and never calls fetch', async () => {
    // maxAttempts: 1 so the rejection terminates as a single failed attempt.
    const mgr = new WebhookManager({
      maxAttempts: 1,
      initialDelayMs: 1,
      maxDelayMs: 1,
      backoffMultiplier: 1,
    });
    const epId = registerEndpoint(mgr, LOOPBACK_URL);
    const delivery = makeDelivery(epId);

    const result = await mgr.attemptDelivery(delivery);

    // Delivery did not succeed; fetch was never reached.
    expect(result.status).not.toBe(DeliveryStatus.DELIVERED);
    const lastAttempt = result.attempts[result.attempts.length - 1];
    expect(String(lastAttempt?.errorMessage)).toContain('denied-internal-ip');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still allows a public endpoint through the guard (fetch IS reached)', async () => {
    // Prove the guard is not blanket-blocking: a public URL passes the gate
    // and the (stubbed) fetch is invoked exactly once.
    const reached = vi.fn(async () => new Response('ok', { status: 200 }));
    globalThis.fetch = reached as unknown as typeof fetch;

    const mgr = new WebhookManager({
      maxAttempts: 1,
      initialDelayMs: 1,
      maxDelayMs: 1,
      backoffMultiplier: 1,
    });
    const epId = registerEndpoint(mgr, PUBLIC_URL);
    const delivery = makeDelivery(epId);

    const result = await mgr.attemptDelivery(delivery);

    expect(reached).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(DeliveryStatus.DELIVERED);
  });
});
