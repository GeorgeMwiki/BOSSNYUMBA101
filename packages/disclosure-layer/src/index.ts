/**
 * @bossnyumba/disclosure-layer — Phase N-D
 *
 * IP-protected disclosure layer for the BOSSNYUMBA Brain.
 *
 * Closes:
 *  - EU AI Act Art. 50 (Aug 2 2026 enforcement)
 *  - GDPR Art. 22 (right to meaningful explanation)
 *  - HUD Fair Housing Act (adverse-action notices)
 *  - Connecticut chatbot disclosure law
 *
 * Source: .research/r-ip-disclosure-capability-explanation-frontier.md
 */

// Tier taxonomy (3-tier matrix; 30 fields)
export * from './tier-taxonomy/index.js';

// Role gate (auth-injected role → tier)
export * from './role-gate/index.js';

// CLOSE-pattern refusal grammar (6 pre-built)
export * from './close-pattern/index.js';

// Canary tokens — system-prompt leakage detection
export * from './canary-tokens/index.js';

// Spotlighting — DATA marking (per-session delimiters)
export * from './spotlighting/index.js';
