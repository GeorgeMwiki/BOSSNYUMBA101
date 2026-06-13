/**
 * /api/v1/owner/tabs - server-side tab persistence (Wave OWNER-OS).
 *
 * Closes commit a935776e's deliberate localStorage-only deferral. The
 * owner-portal `useOwnerTabs` hook persisted state to localStorage only,
 * which broke the universal-bar promise ("real superpowers, no mock
 * fallbacks") for any landlord switching between phone and laptop.
 *
 * This surface keeps localStorage as the fast hydration cache while the
 * server is the source of truth. Every mutation (spawn / augment /
 * focus / close) is mirrored here. On focus / app foreground the FE
 * replays GET / to pick up cross-device mutations.
 *
 * Routes:
 *   GET    /       load this user's full tab state (or default)
 *   PUT    /       legacy replace-all (kept for FE clients that already
 *                  call PUT). Same semantics as POST /sync.
 *   POST   /       idempotent upsert of a SINGLE tab entry; bumps the
 *                  active tab unless `setActive=false`.
 *   PATCH  /:id    partial update of a single tab (rename, augment
 *                  context, set pendingUpdates badge count).
 *   DELETE /:id    close (remove) a tab; pinned tabs refused with 409.
 *   POST   /sync   bulk replace state - used after a local-only burst
 *                  of mutations is committed in one shot, or as the
 *                  "force-push my local state" path.
 *
 * Auth: Supabase JWT via authMiddleware. Tenant scope bound via
 *       databaseMiddleware (app.current_tenant_id GUC for RLS).
 *
 * Real-estate entity vocabulary the FE pins into `context`:
 *   - lease            { leaseId, propertyId }
 *   - unit             { unitId, propertyId }
 *   - maintenance_case { caseId, propertyId }
 *   - tenant           { tenantId, propertyId }
 *   - property         { propertyId }
 *
 * The jsonb `state` document is opaque to the gateway. The FE owns the
 * shape. We cap the document at 64 KB to keep accidental blobs out of
 * the table.
 *
 * Companion files:
 *   - packages/database/src/migrations/0300_owner_tabs.sql
 *   - packages/database/src/schemas/owner-tabs.schema.ts
 *   - apps/owner-portal/src/state/useOwnerTabs.ts (FE wiring)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';

import { ownerTabs } from '@bossnyumba/database';
import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('owner-tabs');

const MAX_STATE_BYTES = 64 * 1024;

interface PersistedTab {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly pinned?: boolean;
  readonly augmentedAt?: string;
  readonly pendingUpdates?: number;
}

interface PersistedState {
  readonly tabs: ReadonlyArray<PersistedTab>;
  readonly activeTabId: string | null;
}

const DEFAULT_STATE: PersistedState = Object.freeze({
  tabs: [],
  activeTabId: null,
});

const tabEntrySchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  context: z.record(z.string(), z.unknown()).optional(),
  pinned: z.boolean().optional(),
  augmentedAt: z.string().datetime().optional(),
  pendingUpdates: z.number().int().nonnegative().max(999).optional(),
});

const upsertTabSchema = z.object({
  tab: tabEntrySchema,
  /** When true, the upserted tab becomes the active tab. Defaults true. */
  setActive: z.boolean().optional().default(true),
});

const patchTabSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  augmentedAt: z.string().datetime().optional(),
  pendingUpdates: z.number().int().nonnegative().max(999).optional(),
});

const stateSchema = z
  .object({
    tabs: z.array(tabEntrySchema).max(50),
    activeTabId: z.string().min(1).max(200).nullable(),
  })
  .refine(
    (s) => JSON.stringify(s).length <= MAX_STATE_BYTES,
    `state must be <=${MAX_STATE_BYTES} bytes when JSON-stringified`,
  );

const syncSchema = z.object({
  state: stateSchema,
});

// Legacy PUT body — pre-Wave OWNER-OS clients sent a free-form record.
const putLegacySchema = z.object({
  state: z
    .record(z.string(), z.unknown())
    .refine(
      (s) => JSON.stringify(s).length <= MAX_STATE_BYTES,
      `state must be <=${MAX_STATE_BYTES} bytes when JSON-stringified`,
    ),
});

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

function dbUnavailable(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'OWNER_TABS_DB_UNAVAILABLE',
        message: 'Database not configured',
      },
    },
    503,
  );
}

function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function readState(raw: unknown): PersistedState {
  if (!isObjectRecord(raw)) return { ...DEFAULT_STATE };
  const tabsRaw = (raw as Record<string, unknown>).tabs;
  const activeRaw = (raw as Record<string, unknown>).activeTabId;
  const tabs = Array.isArray(tabsRaw)
    ? (tabsRaw.filter(isObjectRecord) as unknown as ReadonlyArray<PersistedTab>)
    : [];
  const activeTabId =
    typeof activeRaw === 'string' && activeRaw.length > 0 ? activeRaw : null;
  return { tabs, activeTabId };
}

function mergeContext(
  prev: Readonly<Record<string, unknown>> | undefined,
  next: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (!prev && !next) return undefined;
  if (!prev) return { ...next } as Record<string, unknown>;
  if (!next) return { ...prev } as Record<string, unknown>;
  return { ...prev, ...next };
}

async function loadState(
  db: any,
  tenantId: string,
  userId: string,
): Promise<{ state: PersistedState; updatedAt: Date | null }> {
  const [row] = await db
    .select()
    .from(ownerTabs)
    .where(
      and(eq(ownerTabs.tenantId, tenantId), eq(ownerTabs.userId, userId)),
    )
    .limit(1);
  if (!row) return { state: { ...DEFAULT_STATE }, updatedAt: null };
  return { state: readState(row.state), updatedAt: row.updatedAt };
}

async function writeState(
  db: any,
  tenantId: string,
  userId: string,
  state: PersistedState | Record<string, unknown>,
): Promise<Date> {
  const now = new Date();
  await db.execute(
    sql`
      INSERT INTO owner_tabs (tenant_id, user_id, state, updated_at)
      VALUES (${tenantId}, ${userId}, ${JSON.stringify(state)}::jsonb, ${now})
      ON CONFLICT (tenant_id, user_id)
      DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
    `,
  );
  return now;
}

// ─── GET / — load current state ─────────────────────────────────────
app.get('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const { state, updatedAt } = await loadState(db, auth.tenantId, auth.userId);
  return c.json({
    success: true,
    data: {
      state,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      hydratedFromDefault: updatedAt === null,
    },
  });
});

// ─── PUT / — legacy bulk replace (pre-Wave OWNER-OS clients) ──────────
app.put('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const raw = await c.req.json().catch(() => null);
  const parsed = putLegacySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tabs payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    parsed.data.state,
  );
  moduleLogger.info('owner-tabs: legacy PUT state saved', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    bytes: JSON.stringify(parsed.data.state).length,
  });
  return c.json({
    success: true,
    data: { state: parsed.data.state, updatedAt },
  });
});

// ─── POST / — idempotent upsert of a single tab entry ─────────────────
app.post('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const raw = await c.req.json().catch(() => null);
  const parsed = upsertTabSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid tab payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const { tab, setActive } = parsed.data;
  const { state } = await loadState(db, auth.tenantId, auth.userId);

  // exactOptional-friendly tab projection from the zod output (which
  // includes `?: undefined` keys) into the narrower PersistedTab shape.
  function projectTab(input: z.infer<typeof tabEntrySchema>): PersistedTab {
    const out: { -readonly [K in keyof PersistedTab]: PersistedTab[K] } = {
      id: input.id,
      kind: input.kind,
      title: input.title,
    };
    if (input.context !== undefined) out.context = input.context;
    if (input.pinned !== undefined) out.pinned = input.pinned;
    if (input.augmentedAt !== undefined) out.augmentedAt = input.augmentedAt;
    if (input.pendingUpdates !== undefined) {
      out.pendingUpdates = input.pendingUpdates;
    }
    return out;
  }
  const projected = projectTab(tab);

  const existingIndex = state.tabs.findIndex((t) => t.id === tab.id);
  const mergedContext = mergeContext(
    state.tabs[existingIndex]?.context,
    projected.context,
  );
  const mergedBase: { -readonly [K in keyof PersistedTab]: PersistedTab[K] } =
    existingIndex >= 0
      ? { ...state.tabs[existingIndex], ...projected }
      : { ...projected };
  if (mergedContext !== undefined) mergedBase.context = mergedContext;
  const merged: PersistedTab = mergedBase;
  const nextTabs =
    existingIndex >= 0
      ? state.tabs.map((t, i) => (i === existingIndex ? merged : t))
      : [...state.tabs, merged];
  const nextState: PersistedState = {
    tabs: nextTabs,
    activeTabId: setActive ? tab.id : state.activeTabId,
  };

  if (JSON.stringify(nextState).length > MAX_STATE_BYTES) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_STATE_TOO_LARGE',
          message: `state would exceed ${MAX_STATE_BYTES} bytes`,
        },
      },
      413,
    );
  }

  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: tab upserted', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabId: tab.id,
    kind: tab.kind,
    isNew: existingIndex < 0,
  });
  return c.json({
    success: true,
    data: {
      tab: merged,
      isNew: existingIndex < 0,
      state: nextState,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

// ─── PATCH /:id — partial update of a single tab ──────────────────────
app.patch('/:id', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const id = c.req.param('id');
  if (!id) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing tab id' },
      },
      400,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = patchTabSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid patch payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const { state } = await loadState(db, auth.tenantId, auth.userId);
  const existingIndex = state.tabs.findIndex((t) => t.id === id);
  if (existingIndex < 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_NOT_FOUND',
          message: 'Tab not found in current state',
        },
      },
      404,
    );
  }
  const prev = state.tabs[existingIndex];
  const next: PersistedTab = {
    ...prev,
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.augmentedAt !== undefined && {
      augmentedAt: parsed.data.augmentedAt,
    }),
    ...(parsed.data.pendingUpdates !== undefined && {
      pendingUpdates: parsed.data.pendingUpdates,
    }),
    ...(parsed.data.context !== undefined && {
      context: mergeContext(prev?.context, parsed.data.context),
    }),
  };
  const nextTabs = state.tabs.map((t, i) => (i === existingIndex ? next : t));
  const nextState: PersistedState = { ...state, tabs: nextTabs };
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: tab patched', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabId: id,
  });
  return c.json({
    success: true,
    data: {
      tab: next,
      state: nextState,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

// ─── DELETE /:id — close (remove) a tab; pinned tabs cannot be closed ─
app.delete('/:id', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const id = c.req.param('id');
  if (!id) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing tab id' },
      },
      400,
    );
  }
  const { state } = await loadState(db, auth.tenantId, auth.userId);
  const existing = state.tabs.find((t) => t.id === id);
  if (!existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_NOT_FOUND',
          message: 'Tab not found in current state',
        },
      },
      404,
    );
  }
  if (existing.pinned) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_PINNED',
          message: 'Pinned tabs cannot be closed',
        },
      },
      409,
    );
  }
  const nextTabs = state.tabs.filter((t) => t.id !== id);
  const nextActive =
    state.activeTabId === id ? nextTabs[0]?.id ?? null : state.activeTabId;
  const nextState: PersistedState = {
    tabs: nextTabs,
    activeTabId: nextActive,
  };
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: tab closed', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabId: id,
  });
  return c.json({
    success: true,
    data: {
      closedTabId: id,
      state: nextState,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

// ─── POST /sync — bulk replace state (client-burst commit) ────────────
app.post('/sync', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const raw = await c.req.json().catch(() => null);
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sync payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  // exactOptional-friendly projection — drop `?: undefined` keys.
  function projectTabForSync(
    input: z.infer<typeof tabEntrySchema>,
  ): PersistedTab {
    const out: { -readonly [K in keyof PersistedTab]: PersistedTab[K] } = {
      id: input.id,
      kind: input.kind,
      title: input.title,
    };
    if (input.context !== undefined) out.context = input.context;
    if (input.pinned !== undefined) out.pinned = input.pinned;
    if (input.augmentedAt !== undefined) out.augmentedAt = input.augmentedAt;
    if (input.pendingUpdates !== undefined) {
      out.pendingUpdates = input.pendingUpdates;
    }
    return out;
  }
  const nextState: PersistedState = {
    tabs: parsed.data.state.tabs.map(projectTabForSync),
    activeTabId: parsed.data.state.activeTabId,
  };
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: bulk sync applied', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabCount: nextState.tabs.length,
  });
  return c.json({
    success: true,
    data: { state: nextState, updatedAt: updatedAt.toISOString() },
  });
});

// ─── POST /:id/close — chat-tool alias for DELETE /:id ────────────────
// The minimal HTTP client surface on the brain-tool gate exposes
// get/post only. This POST alias lets `bossnyumba.owner.tabs.close`
// drive the same close logic without the dispatcher needing a DELETE
// verb. Same auth + RLS + audit guards fire.
app.post('/:id/close', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const id = c.req.param('id');
  if (!id) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing tab id' },
      },
      400,
    );
  }
  const { state } = await loadState(db, auth.tenantId, auth.userId);
  const existing = state.tabs.find((t) => t.id === id);
  if (!existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_NOT_FOUND',
          message: 'Tab not found in current state',
        },
      },
      404,
    );
  }
  if (existing.pinned) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_PINNED',
          message: 'Pinned tabs cannot be closed',
        },
      },
      409,
    );
  }
  const nextTabs = state.tabs.filter((t) => t.id !== id);
  const nextActive =
    state.activeTabId === id ? nextTabs[0]?.id ?? null : state.activeTabId;
  const nextState: PersistedState = {
    tabs: nextTabs,
    activeTabId: nextActive,
  };
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: tab closed via chat tool', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabId: id,
  });
  return c.json({
    success: true,
    data: {
      closedTabId: id,
      state: nextState,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

// ─── POST /:id/update — chat-tool alias for PATCH /:id ────────────────
app.post('/:id/update', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const id = c.req.param('id');
  if (!id) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing tab id' },
      },
      400,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = patchTabSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid patch payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const { state } = await loadState(db, auth.tenantId, auth.userId);
  const existingIndex = state.tabs.findIndex((t) => t.id === id);
  if (existingIndex < 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OWNER_TABS_NOT_FOUND',
          message: 'Tab not found in current state',
        },
      },
      404,
    );
  }
  const prev = state.tabs[existingIndex];
  const next: PersistedTab = {
    ...prev,
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.augmentedAt !== undefined && {
      augmentedAt: parsed.data.augmentedAt,
    }),
    ...(parsed.data.pendingUpdates !== undefined && {
      pendingUpdates: parsed.data.pendingUpdates,
    }),
    ...(parsed.data.context !== undefined && {
      context: mergeContext(prev?.context, parsed.data.context),
    }),
  };
  const nextTabs = state.tabs.map((t, i) => (i === existingIndex ? next : t));
  const nextState: PersistedState = { ...state, tabs: nextTabs };
  const updatedAt = await writeState(
    db,
    auth.tenantId,
    auth.userId,
    nextState,
  );
  moduleLogger.info('owner-tabs: tab patched via chat tool', {
    tenantId: auth.tenantId,
    userId: auth.userId,
    tabId: id,
  });
  return c.json({
    success: true,
    data: {
      tab: next,
      state: nextState,
      updatedAt: updatedAt.toISOString(),
    },
  });
});

export const ownerTabsRouter = app;
export default ownerTabsRouter;
