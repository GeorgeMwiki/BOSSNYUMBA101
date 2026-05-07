/**
 * Agency layer — the brain's "acts in full control" kernel slice.
 *
 *   goals/            persistent objectives + plan decomposer
 *   action-tools/     typed write-tool registry + 5 stubs
 *   executor/         autonomous executor + audit + autonomy policy
 *   initiative/       wake-loop + default triggers
 *
 * The kernel namespace re-exports this module under `agency` so callers
 * can write `import { agency } from '@bossnyumba/central-intelligence'`
 * and reach every public type without deep imports.
 */
export * from './goals/index.js';
export * from './action-tools/index.js';
export * from './executor/index.js';
export * from './initiative/index.js';
