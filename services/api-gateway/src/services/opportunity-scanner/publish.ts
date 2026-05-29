/**
 * Opportunity scanner — cockpit publisher.
 *
 * Thin wrapper around `scanOpportunities` that publishes the
 * `opportunity.scan_completed` cockpit event after each scan so the
 * owner cockpit pulse tile + the badge counter update in real time.
 *
 * Pure-input-pure-output but with a side effect: call this from any
 * scheduled scanner or per-conversational-turn trigger to keep the
 * UI in sync without an extra round-trip.
 */

import { publishCockpitEvent } from '../cockpit-events/index.js';
import { scanOpportunities, type ScanOptions } from './scanner.js';
import type { Opportunity, ScanState } from './types.js';

/**
 * Run the scanner and publish a cockpit event with the count + top
 * expected value (in the primary currency surfaced by the rules).
 * The published event is fire-and-forget; failures are swallowed so a
 * downstream bus problem never blocks the scan return value.
 */
export function scanAndPublishOpportunities(
  tenantId: string,
  state: ScanState,
  options?: ScanOptions,
): ReadonlyArray<Opportunity> {
  const opportunities = scanOpportunities(state, options);
  try {
    publishCockpitEvent({
      kind: 'opportunity.scan_completed',
      tenantId,
      emittedAt: new Date().toISOString(),
      opportunityCount: opportunities.length,
      topExpectedValue: opportunities.reduce(
        (acc, o) => Math.max(acc, o.expectedValue ?? 0),
        0,
      ),
      currencyCode: state.primaryCurrencyCode ?? 'TZS',
    });
  } catch {
    // Best-effort — bus problems must never break the scan path.
  }
  return opportunities;
}
