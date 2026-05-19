/**
 * In-memory permission-rule store — reference adapter. Production
 * wires the same `PermissionRuleStorePort` to J1's entity-store
 * (the canonical persistent store).
 *
 * Filters rules by scope at query time:
 *
 *   - `session` rules    -> matched only when `sessionId` equals.
 *   - `tenant` rules     -> matched when `tenantId` equals.
 *   - `forever` rules    -> matched when `userId` equals.
 */

import type {
  NewPermissionRule,
  PermissionRuleQuery,
  PermissionRuleStorePort,
} from './types.js';
import type { PermissionRuleEntity } from '../types.js';

export interface InMemoryPermissionRuleStoreOptions {
  readonly now?: () => Date;
  readonly newId?: () => string;
}

let _counter = 0;
function defaultId(): string {
  _counter += 1;
  return `pr_${Date.now()}_${_counter.toString(36)}`;
}

export class InMemoryPermissionRuleStore implements PermissionRuleStorePort {
  private readonly rules: PermissionRuleEntity[] = [];
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(opts: InMemoryPermissionRuleStoreOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? defaultId;
  }

  async put(rule: NewPermissionRule): Promise<PermissionRuleEntity> {
    const entity: PermissionRuleEntity = Object.freeze({
      id: this.newId(),
      type: 'permission_rule',
      scope: rule.scope,
      tenantId: rule.tenantId,
      userId: rule.userId,
      sessionId: rule.sessionId,
      toolName: rule.toolName,
      predicate: rule.predicate,
      verdict: rule.verdict,
      reason: rule.reason,
      createdAt: this.now().toISOString(),
    });
    this.rules.push(entity);
    return entity;
  }

  async list(query: PermissionRuleQuery): Promise<ReadonlyArray<PermissionRuleEntity>> {
    return this.rules.filter((r) => matchesScope(r, query));
  }

  /** Diagnostic. */
  count(): number {
    return this.rules.length;
  }
}

function matchesScope(rule: PermissionRuleEntity, query: PermissionRuleQuery): boolean {
  if (rule.toolName !== query.toolName) return false;
  switch (rule.scope) {
    case 'session':
      return rule.sessionId === query.sessionId;
    case 'tenant':
      return rule.tenantId === query.tenantId;
    case 'forever':
      return rule.userId === query.userId;
  }
}
