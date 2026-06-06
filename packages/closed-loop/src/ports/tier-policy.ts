/**
 * Closed-Loop tier-policy port.
 *
 * This package was ported from LitFin's `src/core/closed-loop/runtime.ts`,
 * which imported `@/core/governance/tier-policy` — a host module that was
 * never ported into the BossNyumba monorepo. Rather than re-create that
 * matrix, the runtime takes its tier check through this small port so the
 * package stays self-contained and the real policy gate can be injected by
 * whoever mounts a loop.
 *
 * ── Default behaviour ──────────────────────────────────────────────────
 * The shipped default, {@link allowAllTierPolicy}, accepts every action.
 * This is deliberate and safe ONLY because the package is currently parked
 * (0 importers) and never reaches a side effect in production. The default
 * exists so the runtime, registry, and tests compile and run without a
 * brain dependency.
 *
 * ── Wiring the real gate ───────────────────────────────────────────────
 * BossNyumba's real tier-policy check lives in
 * `packages/central-intelligence/src/policy-gate/assertions.ts` and is
 * re-exported from the package root as
 * `@bossnyumba/central-intelligence` → `assertTierPolicy`.
 *
 * Its signature is:
 *
 *   assertTierPolicy(policy: RolePolicy, action: string) => TierAssertionResult
 *
 * where `RolePolicy = { role: MdRole; rules: PolicyRule[] }`. That gate
 * needs a *populated role + rule set*, not the bare tier string this loop
 * runtime carries on `scope.tier`. A mounting caller therefore wires it by
 * passing a {@link TierPolicy} adapter to `runTick({ tierPolicy })` that
 * maps the loop's `tier` to the caller's real `RolePolicy` and delegates:
 *
 *   import { assertTierPolicy } from "@bossnyumba/central-intelligence";
 *
 *   const tierPolicy: TierPolicy = (tier, action) => {
 *     const policy = resolveRolePolicy(tier); // caller-owned mapping
 *     return assertTierPolicy(policy, action); // superset of TierPolicyDecision
 *   };
 *
 * The mapping is intentionally NOT defined here: this package has no role
 * registry and inventing a `tier -> RolePolicy` table would fabricate
 * policy. Keeping the seam injectable lets the brain own that table while
 * this primitive stays dependency-free.
 *
 * @module @bossnyumba/closed-loop/ports/tier-policy
 */

/** A tier-policy action the runtime asserts before invoking `act()`. */
export type TierAction = string;

/**
 * Result of a tier-policy check.
 *
 * This is a structural subset of central-intelligence's
 * `TierAssertionResult`, so that gate's return value satisfies this type
 * directly — a caller can return `assertTierPolicy(policy, action)` from a
 * {@link TierPolicy} adapter with no re-shaping.
 */
export interface TierPolicyDecision {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * The injectable port the runtime calls before `act()`. Implementations
 * decide whether `tier` may perform `action`. MUST NOT throw; a denial is
 * expressed as `{ ok: false }` so the runtime can end the tick with a
 * `sla-breach` outcome and no side effects.
 */
export type TierPolicy = (
  tier: string,
  action: TierAction,
) => TierPolicyDecision;

/**
 * Default port: allow every action.
 *
 * Safe only because the package is parked and never executes a side effect
 * in production. Replace via `runTick({ tierPolicy })` with an adapter onto
 * `@bossnyumba/central-intelligence`'s `assertTierPolicy` before mounting a
 * loop that performs real actions (see the module docblock for the wiring
 * recipe).
 */
export const allowAllTierPolicy: TierPolicy = () => ({ ok: true });
