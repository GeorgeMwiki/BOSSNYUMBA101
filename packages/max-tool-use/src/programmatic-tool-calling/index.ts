/**
 * Programmatic Tool Calling — public surface.
 *
 * `runPTCSession({task, tools, model})` configures the Anthropic SDK with
 *   tools: [code_execution_20260120, ...domain_tools]
 *
 * The model emits Python that calls our domain MCP servers — each Python
 * sub-call is one of OUR tools. Intermediate results stay in the sandbox.
 * Only the synthesized final answer enters the Claude context.
 *
 * Closes L2 #1.
 */

export { createPtcDriver, type PtcDriverDeps } from './ptc-driver.js';
export { emitPtcProgram, countToolImports } from './python-emitter.js';

import { createPtcDriver } from './ptc-driver.js';
import type { McResult, PtcRequest, PtcResult } from '../types.js';

/** Convenience top-level export — instantiates default driver. */
export async function runPTCSession(
  req: PtcRequest,
): Promise<McResult<PtcResult>> {
  return createPtcDriver().runPTCSession(req);
}
