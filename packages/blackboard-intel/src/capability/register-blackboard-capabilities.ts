/**
 * Register blackboard capabilities — BLACKBOARD-INTEL.
 *
 * Each blackboard KS kind (`junior`, `connector`, `tool`) becomes an
 * atomic capability in `@bossnyumba/capability-catalogue`. Once
 * registered, every post emitted by that KS is observable as a
 * capability invocation and flows through the post-measurer +
 * lifecycle decider.
 *
 * The registry is depended on via the structural
 * `CapabilityRegistryPort` from `../types.ts` so we never import the
 * concrete `@bossnyumba/capability-catalogue` package — keeps the build
 * order independent.
 *
 * @module @bossnyumba/blackboard-intel/capability/register-blackboard-capabilities
 */

import {
  BLACKBOARD_CAPABILITY_KINDS,
  type BlackboardCapabilityAuthor,
  type BlackboardCapabilityKind,
  type CapabilityRegistryPort,
} from '../types.js';

/**
 * Result row — capability id + name + kind.
 */
export interface RegisteredBlackboardCapability {
  readonly capabilityId: string;
  readonly name: string;
  readonly kind: BlackboardCapabilityKind;
}

const CAPABILITY_VERSION = '1.0.0';
const CAPABILITY_OWNER = 'mr-mwikila';

/**
 * Build the canonical capability name for a KS kind.
 */
export function capabilityNameFor(kind: BlackboardCapabilityKind): string {
  return `blackboard.post.${kind}`;
}

/**
 * Register the three KS-kind capabilities for a tenant. Idempotent on
 * (tenantId, name, version): re-running returns the same IDs.
 *
 * The capabilities are created in `lifecycleState` `shadow` (per the
 * `@bossnyumba/capability-catalogue` SEED convention) — the meta-
 * learning conductor promotes to `live` once enough invocations
 * accumulate.
 */
export async function registerBlackboardCapabilities(
  tenantId: string,
  registry: CapabilityRegistryPort,
): Promise<ReadonlyArray<RegisteredBlackboardCapability>> {
  const out: RegisteredBlackboardCapability[] = [];
  for (const kind of BLACKBOARD_CAPABILITY_KINDS) {
    const name = capabilityNameFor(kind);
    const existing = await registry.lookup(tenantId, name, CAPABILITY_VERSION);
    if (existing !== null) {
      out.push(
        Object.freeze({
          capabilityId: existing,
          name,
          kind,
        }),
      );
      continue;
    }
    const author: BlackboardCapabilityAuthor = Object.freeze({
      tenantId,
      name,
      version: CAPABILITY_VERSION,
      kind: 'atomic',
      owner: CAPABILITY_OWNER,
      dependencies: Object.freeze([]),
      contract: Object.freeze({
        costClass: 'free',
        latencyBudgetMs: 2_000,
      }),
      provenanceClass: 'seed',
    });
    const capabilityId = await registry.register(author);
    out.push(Object.freeze({ capabilityId, name, kind }));
  }
  return Object.freeze([...out]);
}

/**
 * Reverse-lookup: given a `BlackboardCapabilityKind`, fetch the
 * tenant's capability id (or null if not registered).
 */
export async function lookupBlackboardCapabilityId(
  tenantId: string,
  kind: BlackboardCapabilityKind,
  registry: CapabilityRegistryPort,
): Promise<string | null> {
  return registry.lookup(tenantId, capabilityNameFor(kind), CAPABILITY_VERSION);
}

/**
 * In-memory `CapabilityRegistryPort` shipped with the package — the
 * production wiring plugs `@bossnyumba/capability-catalogue`'s
 * `createInMemoryCapabilityRegistry`. Useful for tests that exercise
 * registration without standing up the catalogue package.
 */
export function createInMemoryCapabilityRegistryPort(deps: {
  readonly uuid: () => string;
}): CapabilityRegistryPort {
  const byKey: Map<string, string> = new Map();
  const key = (tenantId: string, name: string, version: string): string =>
    `${tenantId}${name}${version}`;
  return {
    async register(author) {
      const k = key(author.tenantId, author.name, author.version);
      const existing = byKey.get(k);
      if (existing !== undefined) return existing;
      const id = deps.uuid();
      byKey.set(k, id);
      return id;
    },
    async lookup(tenantId, name, version) {
      const k = key(tenantId, name, version);
      return byKey.get(k) ?? null;
    },
  };
}
