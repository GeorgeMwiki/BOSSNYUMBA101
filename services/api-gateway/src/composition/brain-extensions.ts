/**
 * Brain extensions — module-scoped hooks used to plumb composition-root
 * services into brain-building routers that were originally written with
 * a closed factory signature.
 *
 * The brain factory in `ai-chat.router.ts` + `brain.hono.ts` is constructed
 * lazily on first request and does not take a service-registry argument.
 * Rather than retrofit each router's signature (which would ripple through
 * the entire test suite), we publish a small module-scoped setter here.
 *
 * Boot (`services/api-gateway/src/index.ts`) calls `setBrainExtraSkills()`
 * once after `buildServices()` with the org-awareness query service tool,
 * then `appendBossNyumbaPersonaSkills()` (== `appendBrainExtraSkills()`)
 * with the four persona-aware catalogs (PT-A owner / PT-B manager /
 * PT-C staff / PT-D tenant) once the LoopbackHttpClient + audit-sink
 * have been bound onto the gate.
 *
 * The routers call `getBrainExtraSkills()` when they construct per-tenant
 * Brains and pass the array into `createBrain({ extraSkills })`.
 *
 * Tenant isolation is preserved because every tool handler resolves
 * `context.tenant.tenantId` on every invocation.
 *
 * Mirrors Borjie's `appendBrainExtraSkills` + `registerPersonaToolHandlers`
 * pattern (see `Borjie/services/api-gateway/src/composition/brain-
 * extensions.ts`) — the only semantic difference is that BossNyumba names
 * the persona-skills appender `appendBossNyumbaPersonaSkills` for clarity
 * at the call site (the brand surfaces "Mr. Mwikila" not "Borjie brain").
 */

import type { ToolHandler } from '@bossnyumba/ai-copilot';
import {
  buildPersonaToolHandlers,
  type PersonaToolGate,
} from './brain-tools';

let extraSkills: readonly ToolHandler[] = [];

/**
 * Set the extra skills injected into every Brain created by the
 * gateway routers. Idempotent — safe to call multiple times (test
 * fixtures, hot reload).
 */
export function setBrainExtraSkills(skills: readonly ToolHandler[]): void {
  extraSkills = skills;
}

/**
 * Read the currently-registered extra skills. Returns an empty array
 * if `setBrainExtraSkills` was never called (degraded mode).
 */
export function getBrainExtraSkills(): readonly ToolHandler[] {
  return extraSkills;
}

/**
 * Append a list of skills to the existing extras. Used by composition
 * roots that wire several batches (org-awareness, persona-aware catalog,
 * future drafter / docs / draft tools) without each step having to know
 * about the others.
 *
 * Immutable concat — never mutates the previously-frozen array.
 */
export function appendBrainExtraSkills(
  skills: readonly ToolHandler[],
): void {
  extraSkills = Object.freeze([...extraSkills, ...skills]);
}

/**
 * BossNyumba-branded alias for `appendBrainExtraSkills`. The call site
 * in `services/api-gateway/src/index.ts` reads:
 *
 *   appendBossNyumbaPersonaSkills(personaHandlers);
 *
 * which makes the intent obvious — these are the Mr. Mwikila / Nyumba
 * Mind persona-aware skills (PT-A owner, PT-B manager, PT-C staff,
 * PT-D tenant) being attached to every per-tenant Brain.
 */
export function appendBossNyumbaPersonaSkills(
  skills: readonly ToolHandler[],
): void {
  appendBrainExtraSkills(skills);
}

/**
 * Register the persona-aware brain tool catalog onto the extras list.
 * Returns the list of registered handlers so the caller can log / count
 * them.
 *
 * Kill-switch fail-closed: when the gate reports `killSwitchOpen` we
 * REPLACE the extras list with an empty frozen array — every persona-
 * aware tool drops out in the same call so the brain has nothing to
 * propose for the duration of the boot.
 *
 * Mode:
 *   - 'append' (default): adds to whatever extras are already wired
 *   - 'replace': blows away the prior extras list and starts fresh
 */
export function registerPersonaToolHandlers(args: {
  readonly gate: PersonaToolGate;
  readonly mode?: 'append' | 'replace';
  readonly onDuplicate?: (toolId: string) => void;
}): readonly ToolHandler[] {
  const handlers = buildPersonaToolHandlers(args.gate, {
    ...(args.onDuplicate !== undefined && { onDuplicate: args.onDuplicate }),
  });
  if (args.gate.killSwitchOpen) {
    // Fail-closed: empty the extras when the kill-switch is open.
    extraSkills = Object.freeze([]);
    return Object.freeze([]);
  }
  if (args.mode === 'replace') {
    setBrainExtraSkills(handlers);
  } else {
    appendBrainExtraSkills(handlers);
  }
  return handlers;
}

// Re-export the gate / sink / client surfaces so the composition root
// in `index.ts` can construct them without reaching into the brain-tools
// subtree directly.
export type {
  PersonaToolGate,
  PersonaToolAuditSink,
  PersonaToolHttpClient,
} from './brain-tools';
