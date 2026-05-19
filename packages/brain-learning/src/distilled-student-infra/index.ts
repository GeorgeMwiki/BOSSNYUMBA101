/**
 * Module 8 — distilled-student-infra
 *
 * IStudentModelClient drop-in contract + 3 adapters (Ollama, vLLM,
 * Bedrock Haiku). Resolver routes to the student when a checkpoint is
 * loaded; falls back to N-C cost-cascade Haiku otherwise.
 */

export {
  OllamaClient,
  VLLMClient,
  BedrockHaikuClient,
  type IStudentModelClient,
  type StudentInvokeInput,
  type StudentInvokeOutput,
} from './student-client.js';

export {
  resolveStudentClient,
  type StudentResolutionInput,
  type NcCostCascadeFallback,
} from './resolver.js';
