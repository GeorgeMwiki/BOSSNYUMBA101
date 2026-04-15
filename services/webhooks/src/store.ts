/**
 * Webhook subscription storage backends.
 *
 * Two implementations live here:
 *   - InMemoryWebhookStore : process-local Map (fine for tests and local dev).
 *   - DatabaseWebhookStore : Postgres-backed via @bossnyumba/database.
 *
 * The module-level `Map` that used to live in webhook-service.ts is now
 * encapsulated inside InMemoryWebhookStore so multiple stores don't
 * silently share state (important for tests and for the dual-mode boot
 * in webhook-service.ts).
 *
 * Shape constraint: http(s) URL validation is done here (and in the
 * service layer) rather than at the DB level so callers get clean errors.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger as ObsLogger } from '@bossnyumba/observability';
import type { WebhookSubscription, WebhookEventType } from './types.js';

// Local logger — we avoid importing webhooksLogger from webhook-service.ts
// to prevent a circular module dependency (webhook-service.ts imports
// createWebhookStore from this file at module load time).
const storeLogger = new ObsLogger({
  service: {
    name: 'webhooks',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment:
      (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

/** Input accepted by WebhookStore.subscribe — id/active/createdAt are assigned by the store. */
export type SubscribeInput = Omit<WebhookSubscription, 'id' | 'active' | 'createdAt'> & {
  id?: string;
};

export interface WebhookStore {
  subscribe(sub: SubscribeInput): Promise<WebhookSubscription>;
  unsubscribe(id: string): Promise<boolean>;
  getSubscriptions(tenantId?: string): Promise<WebhookSubscription[]>;
  findById(id: string): Promise<WebhookSubscription | null>;
}

export function isValidWebhookUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertValidSubscribeInput(sub: SubscribeInput): void {
  if (!isValidWebhookUrl(sub.url)) {
    throw new Error('Webhook URL must be a valid http(s) URL');
  }
  if (!sub.events || sub.events.length === 0) {
    throw new Error('At least one webhook event type is required');
  }
  if (!sub.tenantId) {
    throw new Error('tenantId is required for webhook subscriptions');
  }
}

// ---------------------------------------------------------------------------
// InMemoryWebhookStore
// ---------------------------------------------------------------------------

export class InMemoryWebhookStore implements WebhookStore {
  private readonly subs = new Map<string, WebhookSubscription>();

  async subscribe(input: SubscribeInput): Promise<WebhookSubscription> {
    assertValidSubscribeInput(input);
    const sub: WebhookSubscription = {
      id: input.id ?? uuidv4(),
      url: input.url,
      events: input.events,
      tenantId: input.tenantId,
      active: true,
      createdAt: new Date().toISOString(),
      ...(input.secret !== undefined && { secret: input.secret }),
    };
    this.subs.set(sub.id, sub);
    return sub;
  }

  async unsubscribe(id: string): Promise<boolean> {
    return this.subs.delete(id);
  }

  async getSubscriptions(tenantId?: string): Promise<WebhookSubscription[]> {
    const list = Array.from(this.subs.values()).filter((s) => s.active);
    return tenantId ? list.filter((s) => s.tenantId === tenantId) : list;
  }

  async findById(id: string): Promise<WebhookSubscription | null> {
    return this.subs.get(id) ?? null;
  }
}

// ---------------------------------------------------------------------------
// DatabaseWebhookStore
// ---------------------------------------------------------------------------

// Row shape returned by the underlying postgres-js driver. We use the driver
// directly (rather than Drizzle query builder) here to keep this module free
// of a compile-time dependency on the generated schema type graph — the
// Drizzle schema registration in packages/database is still authoritative
// for migrations and other repos that want typed access.
interface WebhookSubscriptionRow {
  id: string;
  tenant_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string | null;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

function rowToSubscription(row: WebhookSubscriptionRow): WebhookSubscription {
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    tenantId: row.tenant_id,
    active: row.active,
    createdAt,
    ...(row.secret !== null && row.secret !== undefined && { secret: row.secret }),
  };
}

/**
 * Postgres-backed webhook store.
 *
 * Uses a lazily-initialized postgres-js client. A single shared connection
 * pool is created on first use; on boot-time failure the process exits with
 * code 1 because running a webhook service with no persistence in production
 * is worse than failing fast and waking an operator.
 */
export class DatabaseWebhookStore implements WebhookStore {
  private sqlPromise: Promise<PostgresSql> | null = null;

  constructor(private readonly connectionString: string) {}

  private async sql(): Promise<PostgresSql> {
    if (!this.sqlPromise) {
      this.sqlPromise = (async () => {
        try {
          const postgres = (await import('postgres')).default;
          const client = postgres(this.connectionString, {
            max: 10,
            idle_timeout: 30,
            connect_timeout: 10,
          });
          // Probe the connection; fail-closed on boot if the DB is unreachable.
          await client`SELECT 1`;
          storeLogger.info('DatabaseWebhookStore connected', {
            store: 'database',
          });
          return client as unknown as PostgresSql;
        } catch (err) {
          storeLogger.error(
            'DatabaseWebhookStore failed to connect; exiting (WEBHOOKS_STORE=database requires a reachable DB)',
            { error: err instanceof Error ? err.message : String(err) }
          );
          // A webhook service with WEBHOOKS_STORE=database but no DB is a
          // silent data-loss hazard. Exit and let the orchestrator restart.
          process.exit(1);
        }
      })();
    }
    return this.sqlPromise;
  }

  async subscribe(input: SubscribeInput): Promise<WebhookSubscription> {
    assertValidSubscribeInput(input);
    const sql = await this.sql();
    const id = input.id ?? uuidv4();
    const rows = (await sql`
      INSERT INTO webhook_subscriptions (id, tenant_id, url, events, secret, active)
      VALUES (${id}, ${input.tenantId}, ${input.url}, ${sql.json(input.events)}, ${
        input.secret ?? null
      }, true)
      RETURNING id, tenant_id, url, events, secret, active, created_at, updated_at
    `) as unknown as WebhookSubscriptionRow[];
    return rowToSubscription(rows[0]);
  }

  async unsubscribe(id: string): Promise<boolean> {
    const sql = await this.sql();
    // Soft-delete by flipping active=false; keeps the row for audit/history
    // and preserves the stable id for already-in-flight deliveries.
    const rows = (await sql`
      UPDATE webhook_subscriptions
      SET active = false, updated_at = now()
      WHERE id = ${id} AND active = true
      RETURNING id
    `) as unknown as Array<{ id: string }>;
    return rows.length > 0;
  }

  async getSubscriptions(tenantId?: string): Promise<WebhookSubscription[]> {
    const sql = await this.sql();
    const rows = tenantId
      ? ((await sql`
          SELECT id, tenant_id, url, events, secret, active, created_at, updated_at
          FROM webhook_subscriptions
          WHERE active = true AND tenant_id = ${tenantId}
        `) as unknown as WebhookSubscriptionRow[])
      : ((await sql`
          SELECT id, tenant_id, url, events, secret, active, created_at, updated_at
          FROM webhook_subscriptions
          WHERE active = true
        `) as unknown as WebhookSubscriptionRow[]);
    return rows.map(rowToSubscription);
  }

  async findById(id: string): Promise<WebhookSubscription | null> {
    const sql = await this.sql();
    const rows = (await sql`
      SELECT id, tenant_id, url, events, secret, active, created_at, updated_at
      FROM webhook_subscriptions
      WHERE id = ${id}
      LIMIT 1
    `) as unknown as WebhookSubscriptionRow[];
    return rows.length > 0 ? rowToSubscription(rows[0]) : null;
  }
}

// Minimal structural type for the postgres-js tagged-template client. Keeps
// `services/webhooks` free of a hard TS dependency on the postgres package
// shape (it's a transitive dep via @bossnyumba/database).
interface PostgresSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  json(value: unknown): unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a WebhookStore based on WEBHOOKS_STORE.
 *   'database' -> DatabaseWebhookStore (requires DATABASE_URL).
 *   anything else / unset -> InMemoryWebhookStore.
 */
export function createWebhookStore(): WebhookStore {
  const mode = process.env.WEBHOOKS_STORE;
  if (mode === 'database') {
    const connectionString =
      process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.PG_CONNECTION_STRING;
    if (!connectionString) {
      storeLogger.error(
        'WEBHOOKS_STORE=database but no DATABASE_URL/POSTGRES_URL is set; exiting'
      );
      process.exit(1);
    }
    return new DatabaseWebhookStore(connectionString);
  }
  return new InMemoryWebhookStore();
}
