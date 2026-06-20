/**
 * flush.ts — offline-sync drain policy tests (blocker #7).
 *
 * The regression these guard: a missing/unmounted gateway route returns 404,
 * and the OLD shouldDrop() dropped on ANY 4xx — silently destroying the staff's
 * offline attendance / incident / shift-report capture while the UI still
 * showed "synced". The fix: drop ONLY on genuine poison (400/401/403/409/413/
 * 422); RETAIN + retry on 404/405/408/429/5xx/network; PARK (retain) once
 * MAX_ATTEMPTS is reached on a non-poison error — never delete it.
 *
 * We drive the REAL queue.ts against an in-memory AsyncStorage so the
 * retain/drop assertions reflect the actual on-disk queue, and inject a stub
 * apiClient that throws the ApiError we want.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import type { ManagerApi } from '../../api/client'

// The injected stub IS a Pick<ManagerApi,'post'> (what flushQueue accepts) AND
// keeps the vitest Mock surface so tests can assert on `.mock.calls`.
type StubClient = Pick<ManagerApi, 'post'> & { post: Mock }

// In-memory AsyncStorage so queue.ts persists/reads against a real store.
const store = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k)
    })
  }
}))

// flush.ts statically imports `managerApi` from ../api/client; the real module
// pulls in Flow-typed React Native transitive deps that vite's SSR transform
// cannot parse (RollupError: Expected 'from', got 'typeof'). Every test injects
// its own client into flushQueue(), so the real managerApi is never exercised —
// mocking it keeps the module graph parseable without changing behaviour.
vi.mock('../../api/client', () => ({
  managerApi: { post: vi.fn(async () => ({})) },
}))

import { ApiError } from '../../api/errors'
import { flushQueue } from '../flush'
import { enqueueWrite, listQueued, clearQueue, type EntityType } from '../queue'

function apiError(status: number): ApiError {
  return new ApiError(`HTTP ${status}`, status, '/api/v1/manager/attendance', null)
}

/** apiClient stub whose post() always rejects with the given error. */
function rejectingClient(error: unknown): StubClient {
  return {
    post: vi.fn(async () => {
      throw error
    }) as unknown as StubClient['post'],
  }
}

/** apiClient stub whose post() resolves (2xx). */
function okClient(): StubClient {
  return {
    post: vi.fn(async () => ({ data: { id: 'srv-1' } })) as unknown as StubClient['post'],
  }
}

beforeEach(async () => {
  store.clear()
  await clearQueue()
})

describe('flushQueue — retain on route-missing / transient', () => {
  it('does NOT drop on 404 (missing gateway route) — retains + records attempt', async () => {
    await enqueueWrite('attendance' as EntityType, { staffId: 's1', at: 'now' })
    const client = rejectingClient(apiError(404))

    const result = await flushQueue(client)

    expect(result.failed).toBe(1)
    expect(result.succeeded).toBe(0)
    // The entry must STILL be in the queue (not dropped).
    const remaining = await listQueued()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.attempts).toBe(1)
    expect(result.remaining).toBe(1)
  })

  it('does NOT drop on 405 / 500 / 503 / network(0)', async () => {
    for (const status of [405, 500, 503, 0]) {
      store.clear()
      await clearQueue()
      await enqueueWrite('incident' as EntityType, { note: 'x' })
      const client = rejectingClient(apiError(status))
      await flushQueue(client)
      const remaining = await listQueued()
      expect(remaining, `status ${status} should retain`).toHaveLength(1)
    }
  })

  it('does NOT drop on 408 / 429 throttling', async () => {
    for (const status of [408, 429]) {
      store.clear()
      await clearQueue()
      await enqueueWrite('shift_report' as EntityType, { hours: 8 })
      await flushQueue(rejectingClient(apiError(status)))
      expect(await listQueued(), `status ${status} should retain`).toHaveLength(1)
    }
  })
})

describe('flushQueue — drop only on genuine poison', () => {
  it('DROPS on 400 / 422 validation poison', async () => {
    for (const status of [400, 422]) {
      store.clear()
      await clearQueue()
      await enqueueWrite('task_ack' as EntityType, { bad: true })
      const result = await flushQueue(rejectingClient(apiError(status)))
      expect(await listQueued(), `status ${status} should drop`).toHaveLength(0)
      expect(result.remaining).toBe(0)
    }
  })

  it('DROPS on 401 / 403 / 409 / 413', async () => {
    for (const status of [401, 403, 409, 413]) {
      store.clear()
      await clearQueue()
      await enqueueWrite('attendance' as EntityType, { x: 1 })
      await flushQueue(rejectingClient(apiError(status)))
      expect(await listQueued(), `status ${status} should drop`).toHaveLength(0)
    }
  })
})

describe('flushQueue — success path + parking', () => {
  it('removes the entry on a 2xx response', async () => {
    await enqueueWrite('attendance' as EntityType, { ok: true })
    const result = await flushQueue(okClient())
    expect(result.succeeded).toBe(1)
    expect(await listQueued()).toHaveLength(0)
  })

  it('stamps the queue entry id as clientId in the POST body (idempotency key)', async () => {
    const entry = await enqueueWrite('attendance' as EntityType, {
      propertyId: 'prop-1',
      checkInAt: '2026-06-14T08:00:00.000Z'
    })
    const client = okClient()
    await flushQueue(client)
    expect(client.post).toHaveBeenCalledTimes(1)
    const [path, sentBody] = client.post.mock.calls[0]!
    expect(path).toBe('attendance')
    expect((sentBody as { clientId: string }).clientId).toBe(entry.id)
    // Scoping field lifted to the envelope; typed fields carried under `body`.
    expect((sentBody as { propertyId: string }).propertyId).toBe('prop-1')
    expect((sentBody as { body: Record<string, unknown> }).body).toMatchObject({
      checkInAt: '2026-06-14T08:00:00.000Z'
    })
  })

  it('PARKS (retains, never deletes) a non-poison entry after MAX_ATTEMPTS', async () => {
    await enqueueWrite('incident' as EntityType, { note: 'stuck' })
    // Drain repeatedly against a persistent 503; the entry must survive every
    // pass and never be deleted, even past the retry budget.
    for (let i = 0; i < 8; i += 1) {
      await flushQueue(rejectingClient(apiError(503)))
    }
    expect(await listQueued()).toHaveLength(1)

    // An AUTOMATIC drain now skips the parked entry (stops draining the
    // battery) but still PRESERVES it on disk.
    const auto = await flushQueue(okClient())
    expect(auto.parked).toBe(1)
    expect(auto.attempted).toBe(0)
    expect(await listQueued()).toHaveLength(1)
  })

  it('recovers a parked entry on a FORCED flush once the route is fixed', async () => {
    await enqueueWrite('incident' as EntityType, { note: 'stuck' })
    for (let i = 0; i < 8; i += 1) {
      await flushQueue(rejectingClient(apiError(404)))
    }
    expect(await listQueued()).toHaveLength(1)
    // Post-deploy: a forced flush re-attempts the parked entry and, on 2xx,
    // clears it — data recovers instead of being stranded forever.
    const forced = await flushQueue(okClient(), { force: true })
    expect(forced.succeeded).toBe(1)
    expect(await listQueued()).toHaveLength(0)
  })
})
