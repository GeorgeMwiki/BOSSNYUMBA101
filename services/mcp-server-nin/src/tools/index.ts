/**
 * Tool registry — barrel-exports the NIN MCP tools.
 * Scaffold ships one tool (`verify_nin`); Phase F adds enrolment +
 * status-check tools as the NIMC NIVS adapter matures.
 */

import { verifyNinTool } from './verify_nin.js';
import type { NinTool } from '../types.js';

export { verifyNinTool };

export const NIN_TOOLS: ReadonlyArray<NinTool<unknown>> = Object.freeze([
  verifyNinTool,
]);

export function findNinTool(name: string): NinTool<unknown> | undefined {
  return NIN_TOOLS.find((tool) => tool.name === name);
}
