/**
 * Multi-Agent Debate module — public API.
 */

export {
  runDebate,
  debateRequired,
  DEBATE_REQUIRED_ACTIONS,
  type DebateDeps,
  type DebateInput,
} from './debate.js';
export {
  llmPersona,
  heuristicPersona,
  type PersonaPort,
  type PersonaInput,
  type LlmPersonaArgs,
} from './persona-port.js';
export {
  PERSONA_CONFIGS,
  configFor,
  type PersonaConfig,
} from './personas.js';
