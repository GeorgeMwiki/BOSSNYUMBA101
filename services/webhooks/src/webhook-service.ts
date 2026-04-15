/**
 * Webhook subscription management and event triggering with retry
 */

import { v4 as uuidv4 } from 'uuid';
import type { WebhookEvent, WebhookEventType, WebhookSubscription } from './types.js';
import { deliver } from './delivery.js';
import { Logger as ObsLogger } from '@bossnyumba/observability';
import { rbacEngine, type User as AuthzUser } from '@bossnyumba/authz-policy';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const subscriptions = new Map<string, WebhookSubscription>();

export const webhooksLogger = new ObsLogger({
  service: {
    name: 'webhooks',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});
webhooksLogger.info('Observability initialized for webhooks service', {
  env: process.env.NODE_ENV || 'development',
});

let inMemoryWarningLogged = false;
function warnIfInMemory(): void {
  if (inMemoryWarningLogged) return;
  inMemoryWarningLogged = true;
  if (process.env.NODE_ENV === 'production') {
    webhooksLogger.warn(
      'Using in-memory subscription store. Subscriptions will NOT survive restarts. Set WEBHOOKS_STORE=database to enable persistence (not yet implemented).'
    );
  }
}

/**
 * Subscribe with an authz check. Callers that already have an auth context
 * (api-gateway handlers) should prefer this over the raw subscribe() helper.
 */
export function subscribeWithAuthz(
  user: AuthzUser,
  url: string,
  events: WebhookEventType[],
  tenantId: string,
  secret?: string
): WebhookSubscription {
  const decision = rbacEngine.checkPermission(user, 'create', 'webhook', { tenantId });
  if (!decision.allowed) {
    webhooksLogger.warn('Webhook subscribe denied by rbac', {
      userId: user.id,
      tenantId,
      reason: decision.reason,
    });
    throw new Error(decision.reason ?? 'Forbidden: cannot create webhook subscription');
  }
  return subscribe(url, events, tenantId, secret);
}

function isValidUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function subscribe(
  url: string,
  events: WebhookEventType[],
  tenantId: string,
  secret?: string
): WebhookSubscription {
  if (!isValidUrl(url)) {
    throw new Error('Webhook URL must be a valid http(s) URL');
  }
  if (!events.length) {
    throw new Error('At least one webhook event type is required');
  }
  warnIfInMemory();
  const sub: WebhookSubscription = {
    id: uuidv4(),
    url,
    events,
    tenantId,
    active: true,
    createdAt: new Date().toISOString(),
    ...(secret !== undefined && { secret }),
  };
  subscriptions.set(sub.id, sub);
  return sub;
}

export function unsubscribe(id: string): boolean {
  return subscriptions.delete(id);
}

export function getSubscriptions(tenantId?: string): WebhookSubscription[] {
  const list = Array.from(subscriptions.values()).filter((s) => s.active);
  return tenantId ? list.filter((s) => s.tenantId === tenantId) : list;
}

export async function trigger(
  event: WebhookEvent,
  retries = MAX_RETRIES
): Promise<{ delivered: number; failed: number }> {
  const subs = getSubscriptions(event.tenantId).filter((s) =>
    s.events.includes(event.type)
  );

  let delivered = 0;
  let failed = 0;

  for (const sub of subs) {
    let lastError: string | undefined;
    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with jitter: base * 2^(attempt-1) + random 0-250ms
        const backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(backoff);
      }
      const result = await deliver(sub.url, event, sub.secret);
      if (result.success) {
        delivered++;
        lastError = undefined;
        break;
      }
      lastError = result.error;
    }
    if (lastError) failed++;
  }

  webhooksLogger.info('Webhook event dispatched', {
    eventType: event.type,
    tenantId: event.tenantId,
    delivered,
    failed,
    subscriptionCount: subs.length,
  });

  return { delivered, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
