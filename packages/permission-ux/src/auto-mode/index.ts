/**
 * auto-mode — public surface.
 *
 * Re-exports the classifier entry-point + caching infrastructure +
 * boundary detector + the canonical prompt structure.
 */

export type {
  ClassifierInput,
  ClassifierVerdict,
  ClassifierPort,
  VerdictCachePort,
} from './types.js';

export {
  classifyAction,
  verdictToAction,
  type AutoModeAction,
  type ClassifyActionDeps,
} from './classifier.js';

export { deriveCacheKey } from './cache-key.js';
export { InMemoryVerdictCache, type InMemoryVerdictCacheOptions } from './in-memory-cache.js';
export { CLASSIFIER_SYSTEM_PROMPT, buildClassifierPrompt } from './prompt.js';
export { ClassifierVerdictSchema } from './verdict-schema.js';

export {
  advanceBoundaryState,
  resetBoundaryState,
  INITIAL_BOUNDARY_STATE,
  type BoundaryDetectorState,
  type BoundaryDetectorOptions,
} from './boundary-detector.js';
