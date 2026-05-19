/**
 * Concrete durable flows for BOSSNYUMBA's multi-day MD workflows.
 *
 *   - 60-day lease renewal: 90/60/30/15-day reminders + clause review
 *   - 7-day eviction notice: notice draft + 4-eye + send + grace + escalation
 *   - Monthly KRA filing: data assembly + bulk filing + reconciliation
 *   - 30-day tenant onboarding: invite + verify + lease sign + first rent
 *
 * Each flow is a pure data definition. The engine adapter (Inngest in
 * production, in-memory in tests) executes the steps.
 *
 * Side-effect arguments (sendSMS, sendEmail, draftNotice, etc.) are
 * carried in `args` and called via callbacks the caller provides.
 * That keeps the flow definition deterministic + testable.
 */

import { z } from 'zod';
import type { DurableStep, DurableFlowDefinition } from '../types/index.js';
import { defineDurableFlow } from './define.js';

// ─────────────────────────────────────────────────────────────────────
// Shared callback bundle the flows invoke.
// ─────────────────────────────────────────────────────────────────────

export interface FlowCallbacks {
  readonly sendReminderSMS: (input: { readonly tenantId: string; readonly leaseId: string; readonly daysOut: number }) => Promise<{ readonly messageId: string }>;
  readonly draftLeaseRenewalClause: (input: { readonly leaseId: string }) => Promise<{ readonly draftId: string }>;
  readonly draftEvictionNotice: (input: { readonly leaseId: string; readonly reason: string }) => Promise<{ readonly noticeId: string; readonly bodyMarkdown: string }>;
  readonly sendEvictionNotice: (input: { readonly noticeId: string }) => Promise<{ readonly servedAt: string }>;
  readonly fileKraReturn: (input: { readonly tenantId: string; readonly period: string }) => Promise<{ readonly receiptNumber: string }>;
  readonly inviteTenant: (input: { readonly tenantId: string; readonly leaseId: string }) => Promise<{ readonly inviteId: string }>;
  readonly verifyTenantIdentity: (input: { readonly tenantId: string }) => Promise<{ readonly verifiedAt: string; readonly verified: boolean }>;
  readonly recordFirstPayment: (input: { readonly tenantId: string; readonly leaseId: string }) => Promise<{ readonly paymentId: string; readonly cleared: boolean }>;
}

// ─────────────────────────────────────────────────────────────────────
// 60-day lease renewal flow.
// ─────────────────────────────────────────────────────────────────────

const LeaseRenewalArgs = z.object({
  tenantId: z.string().min(1),
  leaseId: z.string().min(1),
  /** Lease expiry, ISO-8601. */
  expiresAtIso: z.string().min(1),
});
export type LeaseRenewalArgs = z.infer<typeof LeaseRenewalArgs>;

/**
 * `cb` is captured per-build so the same flow can be wired against
 * different callback bundles (e.g. test stubs vs production).
 */
export function buildLeaseRenewalFlow(cb: FlowCallbacks): DurableFlowDefinition<LeaseRenewalArgs> {
  const steps: ReadonlyArray<DurableStep> = [
    {
      name: 't-minus-90-reminder',
      idempotencyKey: 'lease-renewal-90',
      retries: 3,
      run: async (input: unknown) => {
        const args = input as LeaseRenewalArgs;
        const sms = await cb.sendReminderSMS({ tenantId: args.tenantId, leaseId: args.leaseId, daysOut: 90 });
        return { ...args, smsMinus90: sms.messageId };
      },
    },
    {
      name: 't-minus-60-draft-clause',
      idempotencyKey: 'lease-renewal-60-draft',
      retries: 2,
      run: async (input: unknown) => {
        const args = input as LeaseRenewalArgs & { readonly smsMinus90?: string };
        const draft = await cb.draftLeaseRenewalClause({ leaseId: args.leaseId });
        return { ...args, draftClauseId: draft.draftId };
      },
    },
    {
      name: 't-minus-30-reminder',
      idempotencyKey: 'lease-renewal-30',
      retries: 3,
      run: async (input: unknown) => {
        const args = input as LeaseRenewalArgs & { readonly draftClauseId?: string };
        const sms = await cb.sendReminderSMS({ tenantId: args.tenantId, leaseId: args.leaseId, daysOut: 30 });
        return { ...args, smsMinus30: sms.messageId };
      },
    },
    {
      name: 't-minus-15-approval-gate',
      idempotencyKey: 'lease-renewal-15-approval',
      requiresApproval: {
        approverRole: 'estate-manager',
        description: 'Confirm renewal terms before issuing T-15 reminder',
      },
      run: async (input: unknown) => {
        const args = input as LeaseRenewalArgs & { readonly smsMinus30?: string };
        const sms = await cb.sendReminderSMS({ tenantId: args.tenantId, leaseId: args.leaseId, daysOut: 15 });
        return { ...args, smsMinus15: sms.messageId, completed: true };
      },
    },
  ];

  return defineDurableFlow({
    name: 'lease-renewal-60d',
    version: '1.0.0',
    maxRunHours: 65 * 24, // 60d window + 5d slack
    steps,
    argsSchema: LeaseRenewalArgs,
  });
}

// ─────────────────────────────────────────────────────────────────────
// 7-day eviction notice flow.
// ─────────────────────────────────────────────────────────────────────

const EvictionArgs = z.object({
  tenantId: z.string().min(1),
  leaseId: z.string().min(1),
  reason: z.string().min(3),
});
export type EvictionArgs = z.infer<typeof EvictionArgs>;

export function buildEvictionFlow(cb: FlowCallbacks): DurableFlowDefinition<EvictionArgs> {
  const steps: ReadonlyArray<DurableStep> = [
    {
      name: 'draft-notice',
      idempotencyKey: 'eviction-draft',
      retries: 2,
      run: async (input: unknown) => {
        const args = input as EvictionArgs;
        const notice = await cb.draftEvictionNotice({ leaseId: args.leaseId, reason: args.reason });
        return { ...args, noticeId: notice.noticeId, body: notice.bodyMarkdown };
      },
    },
    {
      name: 'four-eye-approval',
      idempotencyKey: 'eviction-4eye',
      requiresApproval: {
        approverRole: 'legal-counsel',
        description: 'Legal review of eviction notice before service',
      },
      run: async (input: unknown) => input,
    },
    {
      name: 'serve-notice',
      idempotencyKey: 'eviction-serve',
      retries: 1, // serving is critical — bail fast if it fails
      run: async (input: unknown) => {
        const args = input as EvictionArgs & { readonly noticeId: string };
        const served = await cb.sendEvictionNotice({ noticeId: args.noticeId });
        return { ...args, servedAt: served.servedAt };
      },
    },
    {
      name: 'grace-period-watch',
      idempotencyKey: 'eviction-grace',
      timeoutMs: 7 * 24 * 60 * 60 * 1000,
      run: async (input: unknown, ctx) => {
        // Durable sleep — engine adapter honours this across crashes.
        await ctx.sleep(7 * 24 * 60 * 60 * 1000);
        return input;
      },
    },
  ];

  return defineDurableFlow({
    name: 'eviction-7d',
    version: '1.0.0',
    maxRunHours: 10 * 24,
    steps,
    argsSchema: EvictionArgs,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Monthly KRA filing flow.
// ─────────────────────────────────────────────────────────────────────

const KraArgs = z.object({
  tenantId: z.string().min(1),
  /** Period in YYYY-MM. */
  period: z.string().regex(/^\d{4}-\d{2}$/u, 'period must be YYYY-MM'),
});
export type KraArgs = z.infer<typeof KraArgs>;

export function buildKraFilingFlow(cb: FlowCallbacks): DurableFlowDefinition<KraArgs> {
  const steps: ReadonlyArray<DurableStep> = [
    {
      name: 'assemble-data',
      idempotencyKey: 'kra-assemble',
      retries: 3,
      run: async (input: unknown) => {
        // In production this calls the rent-roll service; for the flow
        // shape we pass-through.
        return input;
      },
    },
    {
      name: 'file-return',
      idempotencyKey: 'kra-file',
      retries: 2,
      requiresApproval: {
        approverRole: 'finance-controller',
        description: 'Approve KRA TOT/MRI return before submission',
      },
      run: async (input: unknown) => {
        const args = input as KraArgs;
        const filing = await cb.fileKraReturn({ tenantId: args.tenantId, period: args.period });
        return { ...args, receiptNumber: filing.receiptNumber };
      },
    },
    {
      name: 'reconcile',
      idempotencyKey: 'kra-reconcile',
      retries: 5,
      run: async (input: unknown) => input,
    },
  ];

  return defineDurableFlow({
    name: 'kra-monthly-filing',
    version: '1.0.0',
    maxRunHours: 48,
    steps,
    argsSchema: KraArgs,
  });
}

// ─────────────────────────────────────────────────────────────────────
// 30-day tenant onboarding flow.
// ─────────────────────────────────────────────────────────────────────

const OnboardingArgs = z.object({
  tenantId: z.string().min(1),
  leaseId: z.string().min(1),
});
export type OnboardingArgs = z.infer<typeof OnboardingArgs>;

export function buildOnboardingFlow(cb: FlowCallbacks): DurableFlowDefinition<OnboardingArgs> {
  const steps: ReadonlyArray<DurableStep> = [
    {
      name: 'send-invite',
      idempotencyKey: 'onboarding-invite',
      retries: 3,
      run: async (input: unknown) => {
        const args = input as OnboardingArgs;
        const invite = await cb.inviteTenant({ tenantId: args.tenantId, leaseId: args.leaseId });
        return { ...args, inviteId: invite.inviteId };
      },
    },
    {
      name: 'verify-identity',
      idempotencyKey: 'onboarding-verify',
      retries: 2,
      run: async (input: unknown) => {
        const args = input as OnboardingArgs & { readonly inviteId?: string };
        const v = await cb.verifyTenantIdentity({ tenantId: args.tenantId });
        if (!v.verified) {
          throw new Error('verify_identity_failed');
        }
        return { ...args, verifiedAt: v.verifiedAt };
      },
    },
    {
      name: 'sign-lease',
      idempotencyKey: 'onboarding-sign',
      requiresApproval: {
        approverRole: 'estate-manager',
        description: 'Counter-sign the lease after tenant signature',
      },
      run: async (input: unknown) => input,
    },
    {
      name: 'first-rent',
      idempotencyKey: 'onboarding-rent',
      retries: 3,
      run: async (input: unknown) => {
        const args = input as OnboardingArgs;
        const payment = await cb.recordFirstPayment({ tenantId: args.tenantId, leaseId: args.leaseId });
        if (!payment.cleared) {
          throw new Error('first_payment_not_cleared');
        }
        return { ...args, firstPaymentId: payment.paymentId };
      },
    },
  ];

  return defineDurableFlow({
    name: 'tenant-onboarding-30d',
    version: '1.0.0',
    maxRunHours: 45 * 24,
    steps,
    argsSchema: OnboardingArgs,
  });
}
