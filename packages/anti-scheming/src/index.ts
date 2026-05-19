/**
 * @bossnyumba/anti-scheming — Phase N-F barrel.
 *
 * Defense-in-depth substrate against sleeper agents (Hubinger 2024),
 * reward-hacking generalisation (Anthropic 2025), and in-context
 * scheming (Apollo Research 2024-2025).
 */

// Module 1 — Immutable Golden Eval
export * as goldenEval from './immutable-golden-eval/index.js';

// Module 2 — External Nightly Auditor
export * as nightlyAuditor from './external-nightly-auditor/index.js';

// Module 3 — Specification Self-Correction
export * as specCorrection from './specification-self-correction/index.js';

// Module 4 — Adversarial Probe Injection
export * as probeInjection from './adversarial-probe-injection/index.js';

// Module 5 — Sleeper-Defection Probe
export * as sleeperProbe from './sleeper-defection-probe/index.js';

// Module 7 — Evaluator Isolation Gate
export * as evaluatorIsolation from './evaluator-isolation-gate/index.js';

// Module 9 — Monthly Red-Team Rotation
export * as redTeamRotation from './monthly-red-team-rotation/index.js';

// Module 10 — Anti-Scheming Dashboard
export * as dashboard from './anti-scheming-dashboard/index.js';
