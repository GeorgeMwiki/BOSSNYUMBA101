/**
 * @bossnyumba/agent-orchestrator — public barrel.
 *
 * Stable surface for application code. Sub-paths
 * (`./single-agent`, `./multi-agent`, etc.) expose the per-subsystem
 * APIs when you need only one slice.
 */

export * from './types.js';
export * as singleAgent from './single-agent/index.js';
