/**
 * Stakeholder preferences — validation + canonical defaults.
 */

import type {
  CadencePeriod,
  DeliveryChannel,
  ReportFormat,
  StakeholderKind,
  StakeholderPreference,
} from '../types.js';

const DEFAULT_BY_KIND: Readonly<
  Record<
    StakeholderKind,
    { cadence: CadencePeriod; delivery: DeliveryChannel; format: ReportFormat }
  >
> = {
  owner: { cadence: 'monthly', delivery: 'email', format: 'pdf' },
  board: { cadence: 'quarterly', delivery: 'portal', format: 'pdf' },
  regulator: { cadence: 'yearly', delivery: 'portal', format: 'xlsx' },
};

export function withDefaults(
  partial: Omit<Partial<StakeholderPreference>, 'kind' | 'stakeholderId'> & {
    readonly stakeholderId: string;
    readonly kind: StakeholderKind;
  },
): StakeholderPreference {
  const d = DEFAULT_BY_KIND[partial.kind];
  return {
    stakeholderId: partial.stakeholderId,
    kind: partial.kind,
    cadence: partial.cadence ?? d.cadence,
    delivery: partial.delivery ?? d.delivery,
    format: partial.format ?? d.format,
  };
}

export function validate(p: StakeholderPreference): void {
  if (!p.stakeholderId) throw new Error('stakeholderId required');
  if (!['owner', 'board', 'regulator'].includes(p.kind)) {
    throw new Error(`bad kind: ${p.kind}`);
  }
  if (!['monthly', 'quarterly', 'yearly'].includes(p.cadence)) {
    throw new Error(`bad cadence: ${p.cadence}`);
  }
  if (!['email', 'portal', 'whatsapp', 'paper'].includes(p.delivery)) {
    throw new Error(`bad delivery: ${p.delivery}`);
  }
  if (!['pdf', 'xlsx', 'csv', 'json'].includes(p.format)) {
    throw new Error(`bad format: ${p.format}`);
  }
}
