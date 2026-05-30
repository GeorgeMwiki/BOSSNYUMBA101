/**
 * @bossnyumba/continuous-learning — the more data gathered, the better the
 * questions, insights, and templates. Verbatim port of LitFin's
 * src/core/continuous-learning, domain-neutralised for real-estate.
 */

export {
  LearningLoopService,
  type LearningEvent,
  type FieldExtraction,
  type ApplicationLearningState,
  type PrioritizedQuestion,
  type LearnerProfile,
} from "./learning-loop-service";

import { LearningLoopService } from "./learning-loop-service";

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export function onNewExtraction(
  contextId: string,
  fieldPath: string,
  value: unknown,
  confidence: number,
  source: "conversation" | "document" | "form" = "conversation",
) {
  return LearningLoopService.onNewExtraction(contextId, {
    fieldPath,
    value,
    confidence,
    source,
  });
}

export function getNextBestQuestions(
  contextId: string,
  currentStep: string,
  missingFields: string[],
) {
  return LearningLoopService.getNextBestQuestion(contextId, {
    currentStep,
    missingFields,
  });
}

export function onStepComplete(contextId: string, stepId: string) {
  return LearningLoopService.onStepComplete(contextId, stepId);
}
