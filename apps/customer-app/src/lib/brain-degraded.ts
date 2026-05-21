/**
 * brain-degraded — defensive extractor for the kernel's `degraded`
 * marker that rides along on every `BrainDecision`.
 *
 * The `/api/brain/turn` route copies the field straight from the
 * kernel decision, but the route handler does not declare it on its
 * response type yet (the api-sdk's JarvisDecision interface is also
 * pending the addition). This helper does the structural parse so
 * the assistant page can render a `DegradedBanner` without any
 * downstream type changes.
 */

import type { DegradedMarker } from '@bossnyumba/chat-ui';

export function extractBrainDegraded(payload: unknown): DegradedMarker | null {
  if (payload === null || typeof payload !== 'object') return null;
  const candidate = (payload as { degraded?: unknown }).degraded;
  if (candidate === null || typeof candidate !== 'object') return null;
  const c = candidate as {
    readonly reason?: unknown;
    readonly affected_capabilities?: unknown;
    readonly since?: unknown;
  };
  if (typeof c.reason !== 'string') return null;
  if (!Array.isArray(c.affected_capabilities)) return null;
  if (
    !c.affected_capabilities.every(
      (entry): entry is string => typeof entry === 'string',
    )
  ) {
    return null;
  }
  return {
    reason: c.reason,
    affected_capabilities: c.affected_capabilities,
    ...(typeof c.since === 'string' ? { since: c.since } : {}),
  };
}
