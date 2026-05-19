/**
 * `ConversationStore` — surface-agnostic conversation backbone.
 *
 * Each conversation is tenant-isolated. Turns are appended in arrival
 * order and ALWAYS retrievable via `listTurns(conversationId)`
 * regardless of which surface they came from — that's what makes
 * "start on Web, continue on WhatsApp, finish on SMS" work.
 *
 * Production uses J1's `conversation` entity; this in-memory store is
 * the contract.
 */

import type { ConversationTurn, SurfaceConsent, SurfaceKind } from './types.js';

export interface ConversationStore {
  appendTurn(turn: ConversationTurn): ConversationStore;
  listTurns(conversationId: string): ReadonlyArray<ConversationTurn>;
  /** Surfaces seen on this conversation, in first-seen order. */
  surfacesSeen(conversationId: string): ReadonlyArray<SurfaceKind>;
  /** A consolidated view across surfaces — sorted by createdAtIso. */
  unifiedTranscript(conversationId: string): ReadonlyArray<ConversationTurn>;

  // Consent
  setConsent(consent: SurfaceConsent): ConversationStore;
  consentFor(principalId: string): SurfaceConsent | undefined;
}

interface InternalState {
  readonly turns: ReadonlyArray<ConversationTurn>;
  readonly consents: ReadonlyArray<SurfaceConsent>;
}

export function createConversationStore(
  initial: { readonly turns?: ReadonlyArray<ConversationTurn>; readonly consents?: ReadonlyArray<SurfaceConsent> } = {},
): ConversationStore {
  return build({
    turns: initial.turns ?? [],
    consents: initial.consents ?? [],
  });
}

function build(state: InternalState): ConversationStore {
  function appendTurn(turn: ConversationTurn): ConversationStore {
    return build({ ...state, turns: [...state.turns, turn] });
  }
  function listTurns(conversationId: string): ReadonlyArray<ConversationTurn> {
    return state.turns.filter((t) => t.conversationId === conversationId);
  }
  function surfacesSeen(conversationId: string): ReadonlyArray<SurfaceKind> {
    const order: SurfaceKind[] = [];
    const seen = new Set<SurfaceKind>();
    for (const t of state.turns) {
      if (t.conversationId !== conversationId) continue;
      if (!seen.has(t.surface)) {
        seen.add(t.surface);
        order.push(t.surface);
      }
    }
    return order;
  }
  function unifiedTranscript(conversationId: string): ReadonlyArray<ConversationTurn> {
    return [...listTurns(conversationId)].sort((a, b) =>
      a.createdAtIso < b.createdAtIso ? -1 : a.createdAtIso > b.createdAtIso ? 1 : 0,
    );
  }
  function setConsent(consent: SurfaceConsent): ConversationStore {
    const others = state.consents.filter((c) => c.principalId !== consent.principalId);
    return build({ ...state, consents: [...others, consent] });
  }
  function consentFor(principalId: string): SurfaceConsent | undefined {
    return state.consents.find((c) => c.principalId === principalId);
  }
  return { appendTurn, listTurns, surfacesSeen, unifiedTranscript, setConsent, consentFor };
}

/**
 * Pick the highest-priority surface the principal has consented to.
 * Lower `priority` number wins. Disabled surfaces are skipped. Returns
 * `undefined` if no surfaces are enabled.
 */
export function pickProactiveSurface(consent: SurfaceConsent | undefined): SurfaceKind | undefined {
  if (!consent) return undefined;
  const enabled = consent.preferences.filter((p) => p.enabled);
  if (enabled.length === 0) return undefined;
  const sorted = [...enabled].sort((a, b) => a.priority - b.priority);
  return sorted[0]?.surface;
}
