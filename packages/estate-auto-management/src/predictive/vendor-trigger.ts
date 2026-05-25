/**
 * Vendor dispatch trigger.
 *
 * Pure function: given a FailureForecast + the institutional
 * dispatch threshold, returns either `null` (no action) or a
 * fully-populated VendorDispatchTrigger ready to hand to a
 * WorkOrderPort.
 */

import type { FailureForecast, VendorDispatchTrigger } from '../types.js';

export interface TriggerPolicy {
  /** P(failure within 30 days) above which we open a work order. */
  readonly dispatchAtProb30d: number;
  /** Map verdict to SLA hours. */
  readonly slaHoursByVerdict?: Readonly<Record<FailureForecast['verdict'], number>>;
}

const DEFAULT_SLA: Readonly<Record<FailureForecast['verdict'], number>> = {
  healthy: 168,
  monitor: 72,
  service: 24,
  urgent: 4,
};

export function maybeTriggerDispatch(
  forecast: FailureForecast,
  policy: TriggerPolicy,
  now: Date = new Date(),
): VendorDispatchTrigger | null {
  if (forecast.probabilityWithin.d30 < policy.dispatchAtProb30d) return null;
  const sla = (policy.slaHoursByVerdict ?? DEFAULT_SLA)[forecast.verdict];
  return {
    assetId: forecast.assetId,
    family: forecast.family,
    priority: priorityFromVerdict(forecast.verdict),
    slaHours: sla,
    dispatchedAt: now.toISOString(),
    reason: `P(fail<=30d)=${forecast.probabilityWithin.d30.toFixed(3)} >= ${policy.dispatchAtProb30d}`,
  };
}

function priorityFromVerdict(v: FailureForecast['verdict']): VendorDispatchTrigger['priority'] {
  switch (v) {
    case 'urgent':
      return 'critical';
    case 'service':
      return 'high';
    case 'monitor':
      return 'med';
    case 'healthy':
      return 'low';
  }
}
