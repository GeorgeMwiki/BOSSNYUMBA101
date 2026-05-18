/**
 * Tool registry — barrel-exports the NGGIS MCP tools.
 */

import { verifyTitleDeedTool } from './verify_title_deed.js';
import { searchPropertyTool } from './search_property.js';
import type { NggisTool } from '../types.js';

export { verifyTitleDeedTool, searchPropertyTool };

export const NGGIS_TOOLS: ReadonlyArray<NggisTool<unknown>> = Object.freeze([
  verifyTitleDeedTool,
  searchPropertyTool,
]);

export function findNggisTool(name: string): NggisTool<unknown> | undefined {
  return NGGIS_TOOLS.find((tool) => tool.name === name);
}
