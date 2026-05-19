/**
 * ask-user-question — public surface.
 */

export {
  AskUserQuestionInputSchema,
  AnswerEnvelopeSchema,
  QuestionSchema,
  QuestionOptionSchema,
  AnswerEntrySchema,
  PreviewFormatSchema,
  type AskUserQuestionInput,
  type Question,
  type QuestionOption,
  type AnswerEntry,
  type AnswerEnvelope,
} from './schema.js';

export { marshalAnswer, type MarshalResult, type MarshalError } from './marshal.js';

export {
  ASK_USER_QUESTION_TOOL_NAME,
  ASK_USER_QUESTION_TIER,
  ASK_USER_QUESTION_TOOL_SPEC,
  type AskUserQuestionToolInput,
} from './tool-spec.js';
