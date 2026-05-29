/**
 * Local read-only mirror of the Mr. Mwikila canonical persona identity.
 *
 * SOURCE OF TRUTH: `packages/agent-platform/src/canonical-display.ts`
 * (owned by brain agent #227).
 *
 * Why mirror instead of importing?
 *   - Adding `@bossnyumba/agent-platform` as a workspace dep mid-port
 *     creates lockfile churn and merge collisions with five sibling
 *     agents in flight.
 *   - The constant is tiny (3 strings) and changes rarely. We accept
 *     the dual-source risk in exchange for marketing-build isolation.
 *
 * If the canonical persona ever changes, update both places and call
 * it out in `Docs/PORT/BOSSNYUMBA_PORT_COORDINATION.md` §2.
 */
export const MR_MWIKILA_CANONICAL_DISPLAY = {
  name: 'Mr. Mwikila',
  title: "Boss Nyumba's AI Property Operations Manager",
  name_full:
    "Mr. Mwikila — Boss Nyumba's AI Property Operations Manager",
} as const;

export type MrMwikilaCanonicalDisplay = typeof MR_MWIKILA_CANONICAL_DISPLAY;
