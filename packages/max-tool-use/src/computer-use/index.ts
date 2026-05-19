/**
 * Computer Use — public surface.
 *
 *   runComputerUseSession({task, allowed_domains, allowed_actions}): Result
 *
 * Domain-scoped via allowlist; ZDR-eligible; built-in prompt-injection
 * classifier on. Always runs in SUBAGENT context (K-C isolation).
 *
 * Closes L2 #5.
 */

export {
  createComputerUseHarness,
  type ComputerUseHarnessDeps,
  type ComputerUseSessionInput,
} from './computer-use-harness.js';

export {
  BUILT_IN_DOMAIN_GROUPS,
  DomainPolicyViolationError,
  isDomainAllowed,
  normalizeAllowedDomains,
} from './domain-allowlist.js';

import { createComputerUseHarness } from './computer-use-harness.js';
import type { ComputerUseResult } from '../types.js';
import type { ComputerUseSessionInput } from './computer-use-harness.js';

export async function runComputerUseSession(
  input: ComputerUseSessionInput,
): Promise<ComputerUseResult> {
  return createComputerUseHarness().runComputerUseSession(input);
}
