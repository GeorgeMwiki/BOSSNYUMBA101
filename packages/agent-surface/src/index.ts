/**
 * `@bossnyumba/agent-surface` — Phase K-F.
 *
 * Four modules closing R2 audit gaps:
 *
 *   - matrix/     Hebbia-style grid (R2 #5)
 *   - retrieval/  Permission-aware retrieval (R2 #6)
 *   - budget/     Budget + Time Boxes UX (R2 #9)
 *   - surface/    Multi-surface session continuity (R2 #10)
 *
 * Subpath imports are preferred:
 *
 *   import { runMatrix } from '@bossnyumba/agent-surface/matrix';
 *   import { retrieve }  from '@bossnyumba/agent-surface/retrieval';
 *   import { createBudgetMonitor } from '@bossnyumba/agent-surface/budget';
 *   import { WebSurface }  from '@bossnyumba/agent-surface/surface';
 *
 * The barrel re-exports types and constructors for callers that don't
 * want to use subpath imports.
 */

export * from './types.js';
export * as matrix from './matrix/index.js';
export * as retrieval from './retrieval/index.js';
export * as budget from './budget/index.js';
export * as surface from './surface/index.js';
