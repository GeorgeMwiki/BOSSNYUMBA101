import { managerApi, type ManagerApi } from '../api/client'
import { ApiError } from '../api/errors'
import { endpointFor } from './endpoints'
import {
  listQueued,
  recordAttempt,
  removeFromQueue,
  type QueuedWrite
} from './queue'

export interface FlushResult {
  attempted: number
  succeeded: number
  failed: number
  remaining: number
  skipped: boolean
  /** Entries skipped this drain because they are parked (attempts exhausted). */
  parked: number
}

export interface FlushOptions {
  /**
   * When true, parked entries (attempts >= MAX_ATTEMPTS) are re-attempted and
   * their attempt counter is reset on the way in. Use for a USER-INITIATED
   * retry (pull-to-refresh) or after a deploy that fixed a missing route — so
   * data stranded by a transient/route-missing failure RECOVERS rather than
   * sitting parked forever. Automatic background drains pass `force: false`
   * (the default) so a permanently-failing entry stops draining the battery
   * while STILL being preserved on disk (never deleted).
   */
  force?: boolean
}

const MAX_ATTEMPTS = 5

// HTTP statuses that mean the PAYLOAD is genuinely poisoned — a request body
// the server understood and rejected. Only these justify dropping a queued
// offline capture (re-sending it would loop forever on the same rejection).
//   400 Bad Request          — malformed / schema-invalid body
//   401 Unauthorized         — credential problem; re-auth, not retry-with-payload
//   403 Forbidden            — caller not allowed; payload will never be accepted
//   409 Conflict             — idempotent server already has it (treat as resolved)
//   413 Payload Too Large    — body itself is too big; resending won't help
//   422 Unprocessable Entity — semantic validation failure
const POISON_STATUSES = new Set([400, 401, 403, 409, 413, 422])

/**
 * Decide whether a failed flush attempt should DROP the queued payload (vs.
 * retain + retry).
 *
 * CRITICAL (blocker #7): a missing/unmounted gateway route returns 404, a wrong
 * HTTP verb returns 405, and a server fault returns 5xx. None of those mean the
 * captured field data is bad — they are deploy/config/transient errors. The
 * previous implementation dropped on ANY 4xx except 408/429, so a 404 (the exact
 * symptom when the /api/v1/manager/<path> routes did not exist) silently
 * destroyed the staff's offline attendance / incident / shift-report capture
 * while the UI still showed an optimistic "synced". We now drop ONLY on a
 * genuine poison status; everything else is retained so the entry survives a
 * deploy and flushes once the route is live (bounded by MAX_ATTEMPTS so a truly
 * stuck entry still ages out instead of looping forever).
 */
function shouldDrop(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    // Non-HTTP error (thrown stub, unexpected shape) — retain + retry.
    return false
  }
  if (error.status === 0) {
    // Network error (offline / DNS / TLS) — transient; retain + retry.
    return false
  }
  // 404 route-missing, 405 method-not-allowed, 408/429 throttling, and all 5xx
  // server faults are NOT the payload's fault — retain + retry. Only a genuine
  // validation/auth/conflict poison status drops.
  return POISON_STATUSES.has(error.status)
}

/**
 * Compose the request body sent to the gateway for a queued capture.
 *
 * The gateway's field-capture route validates a strict envelope:
 *   { clientId, propertyId?, unitId?, capturedAt?, body? }
 * The offline queue stores an arbitrary `payload`. We:
 *   - stamp `clientId` = the queue entry id (the server idempotency key);
 *   - lift the optional scoping/time fields (propertyId / unitId / capturedAt)
 *     out of the payload when present so the server can index by them;
 *   - carry the remaining typed fields under `body` so a flat payload never
 *     collides with the envelope keys.
 *
 * Immutable: builds a new object; the stored entry/payload is never mutated.
 */
function buildCaptureBody(entry: QueuedWrite): Record<string, unknown> {
  const payload =
    entry.payload && typeof entry.payload === 'object'
      ? (entry.payload as Record<string, unknown>)
      : { value: entry.payload }
  const { propertyId, unitId, capturedAt, body, ...rest } = payload
  const typedBody =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : rest
  return {
    clientId: entry.id,
    ...(propertyId !== undefined ? { propertyId } : {}),
    ...(unitId !== undefined ? { unitId } : {}),
    ...(capturedAt !== undefined ? { capturedAt } : {}),
    body: typedBody
  }
}

/**
 * Drain the queue once. For each entry: POST to
 * `${API_BASE_URL}/api/v1/manager/<endpoint>`, where `<endpoint>` is derived
 * from the entity type via `endpointFor`. On 2xx the entry is treated as
 * synced and removed from local storage.
 *
 * Drop / retain policy (blocker #7 — never silently destroy field data):
 *   - POISON (genuine 4xx: 400/401/403/409/413/422) → DROP. Re-sending would
 *     loop forever on the same rejection; the payload itself is the problem.
 *   - ROUTE-MISSING / TRANSIENT (404/405/408/429/5xx/network) → RETAIN + retry.
 *     A missing or unmounted gateway route, a server fault, or being offline is
 *     a deploy/config/transient error, NOT bad data. The previous code dropped
 *     on 404, silently losing offline captures while showing "synced".
 *   - EXHAUSTED (attempts reach MAX_ATTEMPTS on a non-poison error) → PARK, do
 *     NOT delete. The attempt counter stops climbing (recordAttempt caps it),
 *     `isFlushable` returns false so future drains skip it, but the payload is
 *     PRESERVED on disk so it can flush once the route is fixed / connectivity
 *     returns. Only poison is ever deleted.
 *
 * Accepts an optional `apiClient` so tests can inject a stub. Defaults to
 * the real operator-surface client wrapper.
 */
export async function flushQueue(
  apiClient: Pick<ManagerApi, 'post'> = managerApi,
  options: FlushOptions = {}
): Promise<FlushResult> {
  const force = options.force === true
  const queued = await listQueued()
  let succeeded = 0
  let failed = 0
  let parked = 0
  let attempted = 0
  for (const entry of queued) {
    // Skip entries that have exhausted their retry budget on a non-poison
    // error — they are PARKED (retained on disk), not re-attempted on an
    // automatic drain. A FORCED flush (user retry / post-deploy) ignores the
    // park and re-attempts them so stranded data recovers.
    if (!force && !isFlushable(entry)) {
      parked += 1
      continue
    }
    attempted += 1
    const path = endpointFor(entry.entityType)
    try {
      // Send the offline-queue entry id as the body's `clientId` so the gateway
      // can make the write IDEMPOTENT (UNIQUE(tenant_id, client_id)). Without
      // this the server has no stable key to dedupe an at-least-once re-POST.
      // The entry id is stamped under `clientId`; the typed capture fields are
      // carried under `body` so a flat payload can never collide with the
      // envelope keys the gateway validates.
      const requestBody = buildCaptureBody(entry)
      await apiClient.post(path, requestBody)
      await removeFromQueue(entry.id)
      succeeded += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (shouldDrop(error)) {
        // Genuine poison — the only case where we delete the payload.
        console.error(
          `Dropping poisoned queued ${entry.entityType} ${entry.id}: ${message}`
        )
        await removeFromQueue(entry.id)
        continue
      }
      // Route-missing / transient — RETAIN. Record the attempt so a
      // permanently-stuck entry parks (stops auto-draining) but is never
      // destroyed. A forced flush still re-attempts it next time.
      await recordAttempt(entry.id, message)
    }
  }
  const remaining = (await listQueued()).length
  return {
    attempted,
    succeeded,
    failed,
    remaining,
    skipped: false,
    parked
  }
}

export function isFlushable(entry: QueuedWrite): boolean {
  return entry.attempts < MAX_ATTEMPTS
}
