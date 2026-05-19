/**
 * Self-Consistency module — public API.
 */

export {
  consistentCompute,
  type ConsistentComputeDeps,
} from './self-consistency.js';
export {
  llmSampler,
  functionSampler,
  type SamplerPort,
  type LlmSamplerArgs,
  type NumericPromptInput,
} from './sampler.js';
