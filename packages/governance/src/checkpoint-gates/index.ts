/**
 * @bossnyumba/governance/checkpoint-gates
 *
 * Human-checkpoint gates per action class. Runs as a pre-tool-use hook
 * BEFORE the constitution check — gate denial is cheaper than an LLM
 * self-critique pass.
 */

export {
  DEFAULT_GATE_CONFIG,
  initialTenantGateSettings,
  evaluateGate,
  evaluateGateForTenant,
  updateGateConfig,
} from './gates.js';

export type {
  ActionClass,
  CheckpointGateConfig,
  GateRequest,
  GateSettingsStore,
  GateVerdict,
  TenantGateSettings,
} from './types.js';
