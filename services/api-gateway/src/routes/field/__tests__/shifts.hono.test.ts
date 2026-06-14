/**
 * field/shifts router tests — GET /api/v1/field/shifts/today.
 *
 * Backs apps/staff-mobile/src/home/worker/useTodayShift.ts. These tests pin
 * the wire contract + the security/honesty invariants the route MUST hold:
 *
 *   SECURITY
 *     - anonymous callers → 401 (authMiddleware).
 *     - non-staff role (RESIDENT) → 403 (requireRole gate).
 *     - the worker only ever resolves THEIR OWN shift: userId is the JWT
 *       subject, never client input (anti-IDOR by construction).
 *
 *   HONESTY (NO FABRICATION)
 *     - no shift scheduled today → 200 `null` (NOT a fabricated 06:00–18:00
 *       shift, NOT a 404). The hook maps `null` to the honest empty surface.
 *     - a real shift → 200 TodayShift with shiftDate/shiftKind/siteName/
 *       startISO/endISO/nextBreakISO/tasks[], tasks resolved live.
 *
 * Strategy mirrors unit-components.test.ts: exercise the router WITHOUT a live
 * Postgres by pre-injecting a fake drizzle handle whose `.select().from(table)`
 * chain returns canned rows per table. `databaseMiddleware` honours the pre-
 * injected `db` and skips the tenant transaction. A real HS256 JWT is minted
 * so the production authMiddleware + requireRole run unmodified.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { staffShifts, maintenanceTasks } from '@bossnyumba/database';
import { fieldShiftsRouter } from '../shifts.hono';

const TENANT = 'tnt_shift_test';
const WORKER = 'usr_shift_worker';

function bearer(role: UserRole, userId: string = WORKER): string {
  return `Bearer ${generateToken({
    userId,
    tenantId: TENANT,
    role,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

/**
 * Fake drizzle handle. `.select(...)` returns a chain whose `.from(table)`
 * remembers which table is being read; every subsequent chain method returns
 * the same thenable so `await chain.orderBy(...)` / `await chain.limit(...)`
 * both resolve to the canned rows for that table.
 */
function makeFakeDb(opts: {
  readonly shiftRows: ReadonlyArray<Record<string, unknown>>;
  readonly taskRows: ReadonlyArray<Record<string, unknown>>;
}) {
  return {
    // databaseMiddleware binds the RLS tenant GUC via `set_config(...)` on a
    // non-tx-capable handle (our stub has no `.transaction`), so it calls
    // `db.execute(...)` once before the handler. A no-op keeps that path
    // green without a live Postgres.
    execute: async () => ({ rows: [] }),
    select: () => ({
      from: (table: unknown) => {
        const rows =
          table === staffShifts
            ? opts.shiftRows
            : table === maintenanceTasks
              ? opts.taskRows
              : [];
        const chain: Record<string, unknown> = {};
        const passthrough = () => chain;
        chain.where = passthrough;
        chain.orderBy = passthrough;
        chain.limit = passthrough;
        // Thenable: `await chain` (after any chain calls) yields the rows.
        chain.then = (resolve: (v: unknown) => unknown) => resolve(rows);
        return chain;
      },
    }),
  };
}

function mount(db: unknown): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    // Pre-inject the fake db so databaseMiddleware is a no-op (no live PG).
    c.set('db', db as never);
    await next();
  });
  app.route('/field/shifts', fieldShiftsRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('GET /field/shifts/today — security gates', () => {
  it('rejects anonymous callers (401)', async () => {
    const res = await mount(makeFakeDb({ shiftRows: [], taskRows: [] })).request(
      '/field/shifts/today',
    );
    expect(res.status).toBe(401);
  });

  it('rejects a non-staff role — RESIDENT (403)', async () => {
    const res = await mount(makeFakeDb({ shiftRows: [], taskRows: [] })).request(
      '/field/shifts/today',
      { headers: { Authorization: bearer(UserRole.RESIDENT) } },
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /field/shifts/today — honesty (no fabrication)', () => {
  it('returns 200 null when the worker has no shift today', async () => {
    const res = await mount(
      makeFakeDb({ shiftRows: [], taskRows: [] }),
    ).request('/field/shifts/today', {
      headers: { Authorization: bearer(UserRole.MAINTENANCE_STAFF) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it('returns the TodayShift contract with live tasks for a real shift', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today}T06:00:00.000Z`;
    const end = `${today}T18:00:00.000Z`;
    const brk = `${today}T12:00:00.000Z`;

    const res = await mount(
      makeFakeDb({
        shiftRows: [
          {
            shiftDate: today,
            shiftKind: 'day',
            siteName: 'Mwenge Towers',
            startsAt: start,
            endsAt: end,
            nextBreakAt: brk,
          },
        ],
        taskRows: [
          {
            id: 'mt-1',
            titleEn: 'Fix lobby light',
            titleSw: 'Tengeneza taa ya ukumbi',
            buildingId: 'bld-7',
          },
          {
            id: 'mt-2',
            titleEn: null,
            titleSw: 'Kagua bomba',
            buildingId: null,
          },
        ],
      }),
    ).request('/field/shifts/today', {
      headers: { Authorization: bearer(UserRole.MAINTENANCE_STAFF) },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shiftDate).toBe(today);
    expect(body.shiftKind).toBe('day');
    expect(body.siteName).toBe('Mwenge Towers');
    expect(body.startISO).toBe(start);
    expect(body.endISO).toBe(end);
    expect(body.nextBreakISO).toBe(brk);
    expect(body.tasks).toHaveLength(2);
    // Bilingual: titleEn falls back to titleSw when EN is absent.
    expect(body.tasks[0]).toMatchObject({
      id: 'mt-1',
      titleEn: 'Fix lobby light',
      titleSw: 'Tengeneza taa ya ukumbi',
      location: 'bld-7',
    });
    expect(body.tasks[1]).toMatchObject({
      id: 'mt-2',
      titleEn: 'Kagua bomba',
      titleSw: 'Kagua bomba',
      location: null,
    });
  });

  it('returns 200 null with nextBreakISO null when a shift has no break', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await mount(
      makeFakeDb({
        shiftRows: [
          {
            shiftDate: today,
            shiftKind: 'night',
            siteName: 'Kariakoo Plaza',
            startsAt: `${today}T18:00:00.000Z`,
            endsAt: `${today}T23:59:00.000Z`,
            nextBreakAt: null,
          },
        ],
        taskRows: [],
      }),
    ).request('/field/shifts/today', {
      headers: { Authorization: bearer(UserRole.PROPERTY_MANAGER) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shiftKind).toBe('night');
    expect(body.nextBreakISO).toBeNull();
    expect(body.tasks).toEqual([]);
  });
});
