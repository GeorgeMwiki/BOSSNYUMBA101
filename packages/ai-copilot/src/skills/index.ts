/**
 * Skills — progressive-disclosure capability modules loaded per persona.
 *
 * A "skill" is a narrowly-scoped ToolHandler that performs a specific
 * domain operation (reconcile M-Pesa, draft a KRA summary, extract a lease,
 * etc.). Personas declare which skills they can call via `allowedTools`.
 *
 * This module is the entrypoint for registering the default skill bundle on
 * the ToolDispatcher.
 */

export * from './kenya/index.js';

import { KENYA_SKILL_TOOLS } from './kenya/index.js';
import { ToolDispatcher } from '../orchestrator/tool-dispatcher.js';

/**
 * Register all default skills on a ToolDispatcher.
 */
export function registerDefaultSkills(dispatcher: ToolDispatcher): void {
  for (const tool of KENYA_SKILL_TOOLS) {
    dispatcher.register(tool);
  }
}
