/**
 * Risk scanner — cockpit publisher.
 *
 * Thin wrapper around `scanRisks` that publishes a `risk.changed`
 * cockpit event for each NEW or escalated risk after a scan. The
 * publisher does not track risk history itself (out of scope for the
 * scanner); callers that want delta-only semantics pass an optional
 * `prevSeverityById` map.
 *
 * Fire-and-forget: bus errors are swallowed so a downstream problem
 * never blocks the scan return path.
 */

import { publishCockpitEvent } from '../cockpit-events/index.js';
import { scanRisks, type RiskScannerDeps } from './scanner.js';
import type { Risk, ScanRisksOptions, RiskSeverity } from './types.js';

export interface ScanAndPublishRisksOptions extends ScanRisksOptions {
  /**
   * Map of (riskId -> previous severity) so the publisher can compute
   * a delta vs the prior scan. When absent every detected risk fires
   * a cockpit event with previousSeverity=null (caller treats as new).
   */
  readonly prevSeverityById?: ReadonlyMap<string, RiskSeverity>;
}

export async function scanAndPublishRisks(
  tenantId: string,
  deps: RiskScannerDeps,
  options?: ScanAndPublishRisksOptions,
): Promise<ReadonlyArray<Risk>> {
  const risks = await scanRisks(tenantId, deps, options);
  const prev = options?.prevSeverityById;
  for (const risk of risks) {
    const prevSeverity = prev?.get(risk.id) ?? null;
    if (prevSeverity === risk.severity) continue;
    try {
      publishCockpitEvent({
        kind: 'risk.changed',
        tenantId,
        emittedAt: new Date().toISOString(),
        riskId: risk.id,
        severity: risk.severity,
        previousSeverity: prevSeverity,
      });
    } catch {
      // Best-effort — bus errors must not break the scan path.
    }
  }
  return risks;
}
