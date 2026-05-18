/**
 * Tool registry — barrel-exports the 3 OPay MCP tools.
 */

import { initiatePaymentTool } from './initiate_payment.js';
import { verifyPaymentTool } from './verify_payment.js';
import { cashflowLookupTool } from './cashflow_lookup.js';
import type { OpayTool } from '../types.js';

export { initiatePaymentTool, verifyPaymentTool, cashflowLookupTool };

export const OPAY_TOOLS: ReadonlyArray<OpayTool<unknown>> = Object.freeze([
  initiatePaymentTool,
  verifyPaymentTool,
  cashflowLookupTool,
]);

export function findOpayTool(name: string): OpayTool<unknown> | undefined {
  return OPAY_TOOLS.find((tool) => tool.name === name);
}
