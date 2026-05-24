/**
 * Multi-channel router — chooses preferred + fallback order for
 * a tenant. Pure: emits a route decision; the orchestrator does
 * the actual send via injected `NotifyPort`.
 */

import type { ChannelRouteDecision, TenantReachability } from '../types.js';
import { reachabilityScores } from './reachability-scorer.js';

export interface RouteOptions {
  /** Floor a channel must clear to be considered reachable. */
  readonly minScore?: number;
}

export function routeChannels(
  t: TenantReachability,
  o: RouteOptions = {},
): ChannelRouteDecision {
  const min = o.minScore ?? 0.2;
  const scored = reachabilityScores(t);
  const reachable = scored.filter((s) => s.score >= min);
  const ordered = reachable.length > 0 ? reachable : scored;
  return {
    tenantId: t.tenantId,
    preferred: ordered[0].channel,
    fallbacks: ordered.slice(1).map((s) => s.channel),
    scores: scored,
  };
}
