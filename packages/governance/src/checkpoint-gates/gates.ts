/**
 * Checkpoint gate evaluation.
 *
 * Pipeline (cheap-deny-first):
 *   1. Look up the per-tenant config for the action class.
 *   2. If alwaysAsk → request-approval.
 *   3. If autoBelow set and batch size below it → auto-approve.
 *   4. If askThreshold set and batch size at-or-above → request-approval.
 *   5. Else → auto-approve.
 *
 * Four-eye: if `fourEye=true` and a candidate approver is the same person
 * as the initiator, the gate denies. The brain must surface a different
 * approver.
 *
 * Runs BEFORE the constitution check — gate denial is cheaper than an LLM
 * critique.
 */

import type {
  ActionClass,
  CheckpointGateConfig,
  GateRequest,
  GateSettingsStore,
  GateVerdict,
  TenantGateSettings,
} from './types.js';

/**
 * The platform-default config. Conservative — owner can loosen, never
 * tighten below these (managed-settings can pin tighter; never weaker).
 */
export const DEFAULT_GATE_CONFIG: Readonly<Record<ActionClass, CheckpointGateConfig>> = {
  'send-external-comm': {
    actionClass: 'send-external-comm',
    alwaysAsk: true,
    fourEye: false,
  },
  'charge-payment': {
    actionClass: 'charge-payment',
    alwaysAsk: true,
    fourEye: true,
  },
  'public-content': {
    actionClass: 'public-content',
    alwaysAsk: true,
    fourEye: false,
  },
  'legal-document': {
    actionClass: 'legal-document',
    alwaysAsk: true,
    fourEye: true,
  },
  'bulk-mutation': {
    actionClass: 'bulk-mutation',
    alwaysAsk: false,
    askThreshold: 10,
    autoBelow: 10,
    fourEye: false,
  },
  'cross-tenant-read': {
    actionClass: 'cross-tenant-read',
    alwaysAsk: true,
    fourEye: true,
  },
};

/**
 * Build initial settings for a new tenant — every action class wired to
 * the platform default.
 */
export const initialTenantGateSettings = (tenantId: string): TenantGateSettings => ({
  tenantId,
  gates: { ...DEFAULT_GATE_CONFIG },
});

/**
 * Evaluate a single gate request against the tenant's settings.
 * Pure function — no I/O. Tests use it directly.
 */
export const evaluateGate = (args: {
  readonly request: GateRequest;
  readonly settings: TenantGateSettings;
}): GateVerdict => {
  const config = args.settings.gates[args.request.actionClass];
  if (config === undefined) {
    // Defensive: unknown action class — request approval. Fail closed.
    return {
      outcome: 'request-approval',
      actionClass: args.request.actionClass,
      fourEye: true,
      reason: `No gate config for action class "${args.request.actionClass}" — failing closed to request-approval.`,
    };
  }

  // Four-eye self-approval check — runs before anything else when the
  // brain has already proposed an approver.
  if (
    config.fourEye === true &&
    args.request.proposedApproverUserId !== undefined &&
    args.request.initiatorUserId !== undefined &&
    args.request.proposedApproverUserId === args.request.initiatorUserId
  ) {
    return {
      outcome: 'deny',
      actionClass: args.request.actionClass,
      reason: `Four-eye gate violated — proposed approver equals the initiator. A distinct human must approve.`,
    };
  }

  if (config.alwaysAsk) {
    return {
      outcome: 'request-approval',
      actionClass: args.request.actionClass,
      fourEye: config.fourEye ?? false,
      reason: `alwaysAsk policy: every action of class "${args.request.actionClass}" requires explicit approval.`,
    };
  }

  const batchSize = args.request.batchSize ?? 1;

  if (config.autoBelow !== undefined && batchSize < config.autoBelow) {
    return {
      outcome: 'auto-approve',
      actionClass: args.request.actionClass,
      reason: `Batch size ${batchSize} below autoBelow threshold ${config.autoBelow}.`,
    };
  }

  if (config.askThreshold !== undefined && batchSize >= config.askThreshold) {
    return {
      outcome: 'request-approval',
      actionClass: args.request.actionClass,
      fourEye: config.fourEye ?? false,
      reason: `Batch size ${batchSize} meets askThreshold ${config.askThreshold}.`,
    };
  }

  return {
    outcome: 'auto-approve',
    actionClass: args.request.actionClass,
    reason: `Gate config permits auto-approval for batch size ${batchSize}.`,
  };
};

/**
 * Convenience: evaluate against the store. Loads settings, then runs the
 * pure evaluator.
 */
export const evaluateGateForTenant = async (args: {
  readonly store: GateSettingsStore;
  readonly request: GateRequest;
}): Promise<GateVerdict> => {
  const settings = await args.store.loadSettings(args.request.tenantId);
  return evaluateGate({ request: args.request, settings });
};

/**
 * Merge an owner-supplied partial gate config onto the current settings.
 * Immutable — returns a new TenantGateSettings.
 */
export const updateGateConfig = (args: {
  readonly settings: TenantGateSettings;
  readonly updated: CheckpointGateConfig;
}): TenantGateSettings => {
  return {
    tenantId: args.settings.tenantId,
    gates: {
      ...args.settings.gates,
      [args.updated.actionClass]: args.updated,
    },
  };
};
