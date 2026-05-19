/**
 * Programmatic Tool Calling — Python emitter.
 *
 * In real PTC, the Claude model writes the Python program that runs inside
 * `code_execution_20260120`. For unit-test determinism we synthesize a
 * representative program from the task + tool surface. Real driver passes
 * this through Anthropic SDK when an API key is present, otherwise uses
 * the deterministic emitter.
 *
 * Output: Python program that imports each tool as a function in
 * `bossnyumba_tools` and orchestrates them via asyncio.gather().
 */

import type { DomainToolDefinition } from '../types.js';

const STANDARD_HEADER = `# Programmatic Tool Calling — Claude-emitted Python
# Runs inside code_execution_20260120 sandbox.
# Each tool call is dispatched OUT to the BOSSNYUMBA MCP servers.
# Intermediate results never enter the model context window.
import asyncio
from bossnyumba_tools import (`;

export function emitPtcProgram(
  task: string,
  tools: ReadonlyArray<string | DomainToolDefinition>,
): string {
  const toolNames = tools.map((t) => (typeof t === 'string' ? t : t.name));
  if (toolNames.length === 0) {
    throw new Error('PTC requires at least one domain tool');
  }
  const imports = toolNames.map((n) => `    ${snakeCase(n)},`).join('\n');
  const orchestrator = renderOrchestrator(task, toolNames);
  return `${STANDARD_HEADER}\n${imports}\n)\n\n${orchestrator}\n`;
}

function snakeCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
}

function renderOrchestrator(task: string, toolNames: ReadonlyArray<string>): string {
  const escapedTask = task.replace(/"""/g, '\\"\\"\\"');
  const calls = toolNames
    .map((n, i) => `        ${snakeCase(n)}(step=${i}),`)
    .join('\n');
  return `async def main():
    """${escapedTask}"""
    # Fan-out — parallel programmatic tool calls
    results = await asyncio.gather(
${calls}
    )
    # Filter / synthesize in-sandbox — never enters context
    synthesized = {
        "task": ${JSON.stringify(escapedTask)},
        "tool_count": ${toolNames.length},
        "results": results,
    }
    return synthesized

if __name__ == "__main__":
    asyncio.run(main())`;
}

export function countToolImports(program: string): number {
  const block = program.match(/from bossnyumba_tools import \(([\s\S]+?)\)/);
  if (!block) return 0;
  return block[1]!
    .split('\n')
    .filter((l) => l.trim().endsWith(','))
    .length;
}
