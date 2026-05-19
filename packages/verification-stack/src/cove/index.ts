/**
 * CoVe module — public API.
 */

export {
  chainOfVerification,
  type CoveDeps,
} from './chain-of-verification.js';
export { extractClaims } from './claim-extractor.js';
export { generateVerificationQuestions } from './question-generator.js';
export {
  llmAnswerer,
  evidenceAnswerer,
  chainAnswerers,
  type AnswererPort,
  type IndependentAnswer,
  type LlmAnswererArgs,
  type EvidenceAnswererArgs,
} from './independent-answerer.js';
