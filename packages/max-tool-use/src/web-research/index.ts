/**
 * Composed Web Research — public surface.
 *
 * Code execution is FREE when paired with web_search / web_fetch.
 *
 * Closes L2 #6.
 */

export {
  createWebResearcher,
  type WebResearchDeps,
} from './composed-research.js';

import { createWebResearcher } from './composed-research.js';
import type {
  ComposedResearchRequest,
  ComposedResearchResult,
} from '../types.js';

export async function composedResearch(
  req: ComposedResearchRequest,
): Promise<ComposedResearchResult> {
  return createWebResearcher().composedResearch(req);
}
