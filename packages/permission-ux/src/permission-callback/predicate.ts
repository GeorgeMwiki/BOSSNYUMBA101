/**
 * Predicate evaluation — a `PermissionUpdate` may carry a narrow
 * predicate (dot-path -> value) that the substrate uses to decide
 * whether the rule applies to the current call.
 *
 * Examples of predicates:
 *
 *   { "args.tenantId": "11111..." }     // applies only for one tenant
 *   { "args.contact.channel": "sms" }   // applies only to SMS sends
 *   { "args.amountUsdCents": { "lte": 1000 } }  // <= $10
 *
 * The supported operator set is intentionally tiny:
 *
 *   - Plain value           -> strict equality (===)
 *   - { "eq": v }           -> equality
 *   - { "neq": v }          -> not-equal
 *   - { "in": [...] }       -> set membership
 *   - { "lte": n }          -> numeric <=
 *   - { "gte": n }          -> numeric >=
 *   - { "prefix": "s" }     -> string prefix match
 *
 * Anything more complex than this belongs in code, not a rule.
 */

interface OperatorObject {
  readonly eq?: unknown;
  readonly neq?: unknown;
  readonly in?: ReadonlyArray<unknown>;
  readonly lte?: number;
  readonly gte?: number;
  readonly prefix?: string;
}

const OPERATOR_KEYS: ReadonlySet<string> = new Set([
  'eq',
  'neq',
  'in',
  'lte',
  'gte',
  'prefix',
]);

/**
 * True if the predicate matches the given args. Tolerates absent
 * predicate (returns true) and undefined args (returns false unless
 * predicate is also empty).
 */
export function evaluatePredicate(
  predicate: Readonly<Record<string, unknown>> | null | undefined,
  scope: { readonly args: Readonly<Record<string, unknown>> },
): boolean {
  if (!predicate) return true;
  const keys = Object.keys(predicate);
  if (keys.length === 0) return true;

  for (const k of keys) {
    const expected = predicate[k];
    const actual = readPath({ args: scope.args }, k);
    if (!matches(actual, expected)) return false;
  }
  return true;
}

function readPath(root: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cursor: unknown = root;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function matches(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) {
    return actual === expected;
  }
  if (typeof expected !== 'object' || Array.isArray(expected)) {
    return strictEqual(actual, expected);
  }
  // Operator object
  const op = expected as OperatorObject & Record<string, unknown>;
  const opKeys = Object.keys(op);
  // Mixed operator + non-operator keys are rejected as malformed.
  for (const k of opKeys) {
    if (!OPERATOR_KEYS.has(k)) {
      // Plain object literal: treat as deep equality
      return strictEqual(actual, expected);
    }
  }
  if ('eq' in op && !strictEqual(actual, op.eq)) return false;
  if ('neq' in op && strictEqual(actual, op.neq)) return false;
  if ('in' in op) {
    const list = op.in ?? [];
    let found = false;
    for (const v of list) {
      if (strictEqual(actual, v)) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  if ('lte' in op) {
    if (typeof actual !== 'number' || typeof op.lte !== 'number') return false;
    if (!(actual <= op.lte)) return false;
  }
  if ('gte' in op) {
    if (typeof actual !== 'number' || typeof op.gte !== 'number') return false;
    if (!(actual >= op.gte)) return false;
  }
  if ('prefix' in op) {
    if (typeof actual !== 'string' || typeof op.prefix !== 'string') return false;
    if (!actual.startsWith(op.prefix)) return false;
  }
  return true;
}

function strictEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!strictEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).sort();
  const bk = Object.keys(bo).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    const key = ak[i] as string;
    if (!strictEqual(ao[key], bo[key])) return false;
  }
  return true;
}
