/**
 * Zod schema for the classifier's JSON response. The caller's
 * `ClassifierPort` should `parse(...)` the LLM raw string through this
 * before passing to `classifyAction`.
 */

import { z } from 'zod';

export const ClassifierVerdictSchema = z
  .object({
    verdict: z.enum(['safe', 'borderline', 'unsafe']),
    reason: z.string().min(1).max(500),
    recommendPlanMode: z.boolean(),
  })
  .strict();
