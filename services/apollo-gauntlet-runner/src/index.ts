/**
 * `@bossnyumba/apollo-gauntlet-runner` — public surface.
 *
 * Scheming-detection gauntlet inspired by Apollo Research 2025
 * (arXiv 2509.15541). Adapted to property-management surfaces.
 */

export * from './types.js';
export { SCENARIOS } from './scenarios/index.js';
export { scoreHeuristic, scoreWithJudge } from './scorers/index.js';
export { runGauntlet, type RunGauntletArgs } from './runner.js';
