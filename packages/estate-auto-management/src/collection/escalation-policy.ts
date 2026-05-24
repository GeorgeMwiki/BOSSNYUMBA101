/**
 * Cure-aware escalation policy.
 *
 * Days from due → stage. Cure-rate-aware: tenants who paid in
 * full in ≥ 3 of last 6 months and owe ≤ 1 month are kept at
 * `soft-reminder` regardless of age (institutional DSCR-protecting
 * heuristic).
 */

import type {
  CommsChannel,
  EscalationStep,
  PaymentHistorySummary,
} from '../types.js';

export interface EscalationPolicyOptions {
  /** Override the default cure threshold. */
  readonly cureFullPaymentsRequired?: number;
  readonly cureMaxOutstandingMonths?: number;
}

const DEFAULT_STEPS: ReadonlyArray<EscalationStep> = [
  {
    atDayFromDue: 0,
    stage: 'soft-reminder',
    channels: ['whatsapp', 'sms'],
    message: 'Friendly reminder: today is your rent due date.',
  },
  {
    atDayFromDue: 7,
    stage: 'soft-reminder',
    channels: ['whatsapp', 'sms'],
    message: 'You have an outstanding balance from 7 days ago.',
  },
  {
    atDayFromDue: 14,
    stage: 'firm-reminder',
    channels: ['voice', 'sms'],
    message: 'Your account is 14 days past due. Please contact us.',
  },
  {
    atDayFromDue: 30,
    stage: 'notice-to-cure',
    channels: ['email', 'whatsapp'],
    message: '30-day notice to cure issued. Please settle within 14 days.',
  },
  {
    atDayFromDue: 60,
    stage: 'eviction-prep',
    channels: ['email'],
    message: 'Account 60 days past due. Eviction filing prep initiated.',
  },
];

export function escalationPlan(
  history: PaymentHistorySummary,
  options: EscalationPolicyOptions = {},
): EscalationStep[] {
  const cureFull = options.cureFullPaymentsRequired ?? 3;
  const cureMax = options.cureMaxOutstandingMonths ?? 1;
  const isCureCohort =
    history.fullPayCountLast6m >= cureFull &&
    history.currentBalanceMonths <= cureMax;

  if (isCureCohort) {
    return DEFAULT_STEPS.filter((s) => s.stage === 'soft-reminder').map((s) => ({ ...s }));
  }
  return DEFAULT_STEPS.map((s) => ({ ...s }));
}

/**
 * Filter steps to those due today (relative to dueDate offset).
 * `currentDayFromDue` may be 0+ days; we surface every step whose
 * `atDayFromDue` is exactly today.
 */
export function stepsDueToday(
  plan: ReadonlyArray<EscalationStep>,
  currentDayFromDue: number,
): EscalationStep[] {
  return plan.filter((s) => s.atDayFromDue === currentDayFromDue);
}

/** Union of channels actually used by the plan. */
export function planChannels(plan: ReadonlyArray<EscalationStep>): CommsChannel[] {
  const set = new Set<CommsChannel>();
  for (const s of plan) for (const c of s.channels) set.add(c);
  return [...set];
}
