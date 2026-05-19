/**
 * permission-callback — public surface.
 */

export type {
  CanUseToolContext,
  CanUseToolFn,
  NewPermissionRule,
  PermissionRuleQuery,
  PermissionRuleStorePort,
  PermissionDecision,
  PermissionUpdate,
  PermissionScope,
} from './types.js';

export {
  createCanUseTool,
  persistPermissionUpdate,
  type CanUseToolDeps,
} from './can-use-tool.js';

export { evaluatePredicate } from './predicate.js';
export {
  InMemoryPermissionRuleStore,
  type InMemoryPermissionRuleStoreOptions,
} from './in-memory-store.js';
