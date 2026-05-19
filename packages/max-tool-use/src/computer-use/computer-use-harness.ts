/**
 * Computer Use harness (`computer_20251124`).
 *
 *   runComputerUseSession({task, allowed_domains, allowed_actions}): Result
 *
 * Scoped to specific domains via the allowlist, with Anthropic's built-in
 * prompt-injection classifier engaged. Always runs in SUBAGENT (K-C
 * isolation) — parent MD never sees the screenshot stream.
 *
 * Closes L2 #5.
 */

import type {
  ComputerUseAction,
  ComputerUseRequest,
  ComputerUseResult,
  TenantContext,
} from '../types.js';
import {
  DomainPolicyViolationError,
  isDomainAllowed,
  normalizeAllowedDomains,
} from './domain-allowlist.js';

export interface ComputerUseHarnessDeps {
  /** Optional SDK call — when undefined, the harness simulates against a mocked DOM. */
  readonly anthropicComputerUseRun?: (
    req: ComputerUseRequest,
  ) => Promise<ComputerUseResult>;
  /** Simulated portal scenarios for tests. */
  readonly mockedDomLookup?: (
    url: string,
  ) => Promise<{
    readonly elements: ReadonlyArray<string>;
    readonly classifierFlags?: ReadonlyArray<string>;
  }>;
  readonly clock?: () => number;
}

export interface ComputerUseSessionInput extends ComputerUseRequest {
  readonly startUrl: string;
  readonly scriptedActions: ReadonlyArray<{
    readonly action: ComputerUseAction;
    readonly target?: string;
  }>;
}

const PROMPT_INJECTION_KEYWORDS: ReadonlyArray<string> = [
  'ignore previous instructions',
  'system override',
  'reveal your system prompt',
];

export function createComputerUseHarness(deps: ComputerUseHarnessDeps = {}) {
  return {
    async runComputerUseSession(
      input: ComputerUseSessionInput,
    ): Promise<ComputerUseResult> {
      // 1. Enforce subagent isolation invariant
      if (input.subagentIsolation === false) {
        throw new Error(
          'Computer Use must run in a subagent context — parent MD cannot see screenshots',
        );
      }

      // 2. Validate domain allowlist
      const allowed = normalizeAllowedDomains(input.allowedDomains);
      if (!isDomainAllowed(input.startUrl, allowed)) {
        throw new DomainPolicyViolationError(input.startUrl, allowed);
      }

      // 3. If external SDK injected, delegate
      if (deps.anthropicComputerUseRun) {
        return deps.anthropicComputerUseRun(input);
      }

      // 4. Simulated execution
      const lookup =
        deps.mockedDomLookup ??
        (async (): Promise<{
          elements: ReadonlyArray<string>;
          classifierFlags?: ReadonlyArray<string>;
        }> => ({ elements: [] }));
      const dom = await lookup(input.startUrl);
      const classifierFlags = [
        ...(dom.classifierFlags ?? []),
        ...scanForInjection(input.task),
      ];
      const interventionTriggered = classifierFlags.length > 0;

      const actionsTaken = input.scriptedActions.map((a) => {
        const allowedAction = input.allowedActions.includes(a.action);
        return {
          action: a.action,
          ...(a.target !== undefined ? { target: a.target } : {}),
          ok: allowedAction && !interventionTriggered,
        };
      });

      const outcome: ComputerUseResult['outcome'] = interventionTriggered
        ? 'classifier_intervention'
        : actionsTaken.every((a) => a.ok)
          ? 'completed'
          : 'rejected';

      return {
        task: input.task,
        actionsTaken,
        outcome,
        classifierFlags,
      };
    },
  };
}

function scanForInjection(text: string): ReadonlyArray<string> {
  const lower = text.toLowerCase();
  return PROMPT_INJECTION_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Type-guard to ensure tenant context is supplied (auditing requirement). */
export function assertTenantContext(ctx: TenantContext | undefined): asserts ctx is TenantContext {
  if (!ctx || !ctx.tenantId || !ctx.correlationId) {
    throw new Error('Computer Use requires a tenant context with correlationId');
  }
}
