/**
 * BossNyumba Primary Persona Router.
 *
 * Deterministic: portal -> persona. No LLM classification. O(1) lookup.
 * The persona adapts internally based on context injection + sub-persona
 * layering (see sub-persona-router).
 */

import {
  PORTAL_PERSONA_MAP,
  type BossnyumbaPersonaId,
  type PortalId,
  type BossnyumbaPersona,
} from './persona-types.js';
import { createManagerChat } from './manager-chat.js';
import { createCoworker } from './coworker.js';
import { createTenantAssistant } from './tenant-assistant.js';
import { createOwnerAdvisor } from './owner-advisor.js';
import { createBossnyumbaStudio } from './bossnyumba-studio.js';
import { createPublicGuide } from './public-guide.js';
import {
  buildEstateManagerModePersona,
  selectEstateMode,
} from './estate-manager-mode-switched.js';
import type { EstateManagerModeId } from './estate-manager-modes.js';

// ============================================================================
// Persona Factory Table
// ============================================================================

const personaFactories: Readonly<Record<BossnyumbaPersonaId, () => BossnyumbaPersona>> = {
  'manager-chat': createManagerChat,
  coworker: createCoworker,
  'tenant-assistant': createTenantAssistant,
  'owner-advisor': createOwnerAdvisor,
  'bossnyumba-studio': createBossnyumbaStudio,
  'public-guide': createPublicGuide,
};

// Cache personas (stateless, safe to reuse).
//
// INVARIANT: every factory above MUST return a persona whose fields capture
// only IDENTITY (id, displayName, portalId, systemPrompt, availableTools,
// communicationStyle) and never close over per-request state — user id,
// session id, tenant id, conversation history, locale-of-the-moment, or any
// other request-scoped data. The cache reuses the SAME object across every
// caller for the lifetime of the worker, so a persona that captured session
// data would leak it into the next caller's prompt — a cross-tenant
// disclosure bug. Per-request context is injected as a separate context block
// by the chat route AFTER the persona's systemPrompt is read, never baked into
// the persona itself.
const personaCache = new Map<BossnyumbaPersonaId, BossnyumbaPersona>();

/**
 * Dev-only runtime assertion that a freshly-built persona carries no
 * user-scoped state. Ported from LitFin's persona-router defence-in-depth
 * guard. The factory invariant documented on `personaCache` is the canonical
 * defence; this is a backstop that surfaces accidental drift in dev BEFORE the
 * persona is cached and starts leaking. Disabled in production via an early
 * return so the hot path stays branch-free.
 *
 * Exported for unit tests; pure and side-effect-free (it only reads the
 * persona and either returns or throws).
 */
export function assertStatelessInDev(persona: BossnyumbaPersona): void {
  if (process.env.NODE_ENV === 'production') return;

  // Whitelist of fields that legitimately live on a `BossnyumbaPersona`.
  // Anything outside this set is suspicious — flag it so the engineer who
  // added it gets a clear failure pointing at this guard.
  const ALLOWED_KEYS: ReadonlySet<string> = new Set([
    'id',
    'displayName',
    'portalId',
    'systemPrompt',
    'availableTools',
    'communicationStyle',
  ]);
  for (const key of Object.keys(persona)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(
        `[persona-router] persona '${persona.id}' carries unexpected field ` +
          `'${key}' — persona factories must return stateless persona objects. ` +
          `See assertStatelessInDev in persona-router.ts.`,
      );
    }
  }

  // Spot-check identity string fields for tokens that look like UUIDs / JWTs /
  // session-id shapes. A factory that bakes a user id, session id, or tenant
  // token into the system prompt would trip this guard.
  const UUID_RE =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  const JWT_RE = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/;
  const SESSION_RE = /\b(?:session|sid|sess)[_-]?id[=:]\s*\S+/i;
  const stringFields: ReadonlyArray<unknown> = [
    persona.id,
    persona.displayName,
    persona.systemPrompt,
  ];
  for (const value of stringFields) {
    if (typeof value !== 'string') continue;
    if (UUID_RE.test(value) || JWT_RE.test(value) || SESSION_RE.test(value)) {
      throw new Error(
        `[persona-router] persona '${persona.id}' contains a request-scoped ` +
          `identifier in its identity surface. Per-request data must be ` +
          `injected as a separate context block, not baked into the persona. ` +
          `See assertStatelessInDev in persona-router.ts.`,
      );
    }
  }
}

/**
 * Resolve the primary persona for a given portal.
 */
export function resolvePersona(portalId: PortalId): BossnyumbaPersona {
  const personaId = PORTAL_PERSONA_MAP[portalId];
  if (!personaId) {
    throw new Error(`resolvePersona: unknown portal "${portalId}"`);
  }
  const cached = personaCache.get(personaId);
  if (cached) return cached;
  const factory = personaFactories[personaId];
  const persona = factory();
  assertStatelessInDev(persona);
  personaCache.set(personaId, persona);
  return persona;
}

/**
 * Resolve a primary persona by its id directly (useful for tests and the
 * orchestrator's forcePersonaId path).
 */
export function resolvePersonaById(personaId: BossnyumbaPersonaId): BossnyumbaPersona {
  const factory = personaFactories[personaId];
  if (!factory) {
    throw new Error(`resolvePersonaById: unknown persona "${personaId}"`);
  }
  const cached = personaCache.get(personaId);
  if (cached) return cached;
  const persona = factory();
  assertStatelessInDev(persona);
  personaCache.set(personaId, persona);
  return persona;
}

/**
 * Return all registered primary persona ids.
 */
export function getRegisteredPersonas(): ReadonlyArray<BossnyumbaPersonaId> {
  return Object.keys(personaFactories) as BossnyumbaPersonaId[];
}

/**
 * Return all primary personae as immutable array.
 */
export function getAllPrimaryPersonae(): ReadonlyArray<BossnyumbaPersona> {
  return getRegisteredPersonas().map((id) => resolvePersonaById(id));
}

// ============================================================================
// Mode-switched Master Brain (Gap 5)
// ============================================================================
//
// The admin-portal master persona (`manager-chat`, "Mr. Mwikila") is FLAT —
// one identity, one tool-belt. The estate-manager mode layer (Build /
// Operations / Finance / Growth / Compliance) gives that master brain the
// same mode-switched shape Borjie's mining-CEO persona has: one Mr. Mwikila
// inhabiting ONE mode per turn, each with its own mandate + specialised
// prompt + narrow tool allow-list. The composed persona keeps `id:
// 'manager-chat'` so the orchestrator + stateless guard accept it unchanged.
//
// This is the resolution seam the brain route calls to pick a mode from the
// owner's message and build the mode-shaped Mr. Mwikila for the turn. The
// persona modules stay pure value; the routing lives here, exactly where
// `manager-chat` is otherwise resolved.

/**
 * Resolve the master estate-manager persona for a free-text owner/admin
 * message, selecting the estate mode deterministically. The persona is NOT
 * cached because its prompt + tools vary by mode; building it is a pure,
 * cheap concatenation over the (cached) base manager-chat identity.
 */
export function resolveEstateManagerWithMode(text: string): {
  readonly mode: EstateManagerModeId;
  readonly persona: BossnyumbaPersona;
} {
  const mode = selectEstateMode(text);
  return { mode, persona: buildEstateManagerModePersona(mode) };
}

/**
 * Resolve the master estate-manager persona for an explicit mode id (e.g. a
 * UI mode selector). Throws on an unknown mode id so a typo surfaces loudly.
 */
export function resolveEstateManagerForMode(
  mode: EstateManagerModeId,
): BossnyumbaPersona {
  return buildEstateManagerModePersona(mode);
}
