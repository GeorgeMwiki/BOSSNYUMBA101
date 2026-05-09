/**
 * Shared "degraded skeleton" helper for owner-scoped routes that the
 * owner-portal calls but whose backing services are not yet wired.
 *
 * Wave-2 commit 0ee27a0 converted ten owner-portal pages to render a
 * `MissingBackendNotice` component, each declaring a precise endpoint
 * the gateway is expected to expose. Wave-4 D6 scaffolds those routes
 * so the front-end stops 404'ing while the underlying services are
 * still being designed.
 *
 * Contract:
 *   - HTTP 200 with `{ success: true, data: [], meta: {...} }`
 *   - `X-Backend-Status: degraded` header (so observability dashboards
 *     and operators can detect the gap without parsing the body).
 *   - `meta.degradedReason: 'not_implemented'` (machine-readable signal).
 *   - `meta.concreteNextStep: <string>` describing the DB tables /
 *     services that need to be wired before the endpoint goes live.
 *   - `meta.tenantId` so logs/queries can confirm tenant-isolation was
 *     enforced even when the response body is empty.
 *
 * Immutability: every helper here returns a brand-new object per call;
 * no shared shape is mutated.
 */

import type { Context } from 'hono';

export const DEGRADED_HEADER = 'X-Backend-Status';
export const DEGRADED_VALUE = 'degraded';
export const DEGRADED_REASON = 'not_implemented';

export type DegradedListPayload = {
  success: true;
  data: ReadonlyArray<unknown>;
  meta: {
    degradedReason: typeof DEGRADED_REASON;
    concreteNextStep: string;
    tenantId: string;
  };
};

export type DegradedObjectPayload<T extends Record<string, unknown>> = {
  success: true;
  data: T & {
    meta: {
      degradedReason: typeof DEGRADED_REASON;
      concreteNextStep: string;
      tenantId: string;
    };
  };
};

/**
 * Build an empty list-shaped degraded payload.
 *
 * @param tenantId          tenant the call was scoped to (must come from
 *                          the auth context, never from the body).
 * @param concreteNextStep  one-line description of the work that needs to
 *                          land before this endpoint can serve real data.
 */
export function buildDegradedList(
  tenantId: string,
  concreteNextStep: string,
): DegradedListPayload {
  return {
    success: true,
    data: [],
    meta: {
      degradedReason: DEGRADED_REASON,
      concreteNextStep,
      tenantId,
    },
  };
}

/**
 * Build a degraded payload for endpoints that return a single object
 * (e.g. `/billing/subscription`). The supplied `data` shape is preserved
 * and a `meta` block is merged in. Caller owns the empty-state defaults.
 */
export function buildDegradedObject<T extends Record<string, unknown>>(
  tenantId: string,
  concreteNextStep: string,
  data: T,
): DegradedObjectPayload<T> {
  return {
    success: true,
    data: {
      ...data,
      meta: {
        degradedReason: DEGRADED_REASON,
        concreteNextStep,
        tenantId,
      },
    },
  };
}

/**
 * Set the `X-Backend-Status: degraded` header on a Hono response.
 * Centralised so we never typo the header name.
 */
export function markDegraded(c: Context): void {
  c.header(DEGRADED_HEADER, DEGRADED_VALUE);
}
