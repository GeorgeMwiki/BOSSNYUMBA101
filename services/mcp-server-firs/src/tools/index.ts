/**
 * Tool registry — barrel-exports the 3 FIRS MCP tools.
 */

import { fileVatReturnTool } from './file_vat_return.js';
import { verifyTinTool } from './verify_tin.js';
import { getPaymentStatusTool } from './get_payment_status.js';
import type { FirsTool } from '../types.js';

export { fileVatReturnTool, verifyTinTool, getPaymentStatusTool };

export const FIRS_TOOLS: ReadonlyArray<FirsTool<unknown>> = Object.freeze([
  fileVatReturnTool,
  verifyTinTool,
  getPaymentStatusTool,
]);

export function findFirsTool(name: string): FirsTool<unknown> | undefined {
  return FIRS_TOOLS.find((tool) => tool.name === name);
}
