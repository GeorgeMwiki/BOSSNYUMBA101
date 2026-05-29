/**
 * Brain-tool provenance injector — real-estate edition.
 *
 * Every WRITE brain tool wraps its POST body with this helper. The
 * downstream HTTP route reads `body.provenance` and forwards it to its
 * insert call. Centralising the wrap ensures:
 *
 *   1. Exactly one place to evolve the provenance envelope shape.
 *   2. Tool authors cannot forget the `via: 'chat'` marker.
 *   3. Every persona-tool WRITE is round-trippable through the same
 *      schema as the `buildFormProvenance` path the UI uses.
 *
 * The helper is intentionally self-contained — it does not depend on
 * the broader provenance service. When that service lands (mirroring
 * Borjie's `services/provenance.ts`) the shape here is a strict subset
 * and can be replaced in-place without touching any catalog file.
 *
 * Ported from Borjie's `brain-tools/provenance-injector.ts` —
 * retailored:
 *   - field names unchanged (round-tripping with admin-portal form path)
 *   - immutable concat per coding-style.md (never mutate caller body)
 *   - bilingual labels live on the tool descriptor, not the envelope
 */

import type { PersonaToolHandlerContext } from './types.js';

const VIA_VALUES = [
  'chat',
  'form',
  'agent_apply',
  'api',
  'legacy',
  'unknown',
] as const;

export type ProvenanceVia = (typeof VIA_VALUES)[number];

/**
 * Canonical provenance envelope. Shape-stable with the form path's
 * builder so the JSONB column round-trips through one schema.
 */
export interface Provenance {
  readonly via: ProvenanceVia;
  readonly actorId: string | null;
  readonly sessionId: string | null;
  readonly turnId: string | null;
  readonly requestedAt: string;
}

type Clock = () => string;
const defaultClock: Clock = (): string => new Date().toISOString();

/**
 * Wrap a POST body with `via: 'chat'` provenance derived from the
 * tool's handler context.
 *
 * Returns a NEW object — never mutates the caller's body (immutability
 * is a hard rule in `coding-style.md`).
 */
export function withChatProvenance<TBody extends Record<string, unknown>>(
  body: TBody,
  ctx: Pick<
    PersonaToolHandlerContext,
    'actorId' | 'chatSessionId' | 'chatTurnId'
  >,
  options?: { readonly now?: Clock },
): TBody & { readonly provenance: Provenance } {
  const now = options?.now ?? defaultClock;
  const provenance: Provenance = Object.freeze({
    via: 'chat',
    actorId: ctx.actorId ?? null,
    sessionId: ctx.chatSessionId ?? null,
    turnId: ctx.chatTurnId ?? null,
    requestedAt: now(),
  });
  return Object.freeze({ ...body, provenance }) as TBody & {
    readonly provenance: Provenance;
  };
}

/**
 * Validate that a parsed JSON value has the canonical provenance shape.
 * Returns the typed object on success or `null` on failure — callers
 * use `null` to deny.
 */
export function parseProvenance(value: unknown): Provenance | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.via !== 'string') return null;
  if (!(VIA_VALUES as ReadonlyArray<string>).includes(v.via)) return null;
  if (v.actorId !== null && typeof v.actorId !== 'string') return null;
  if (
    v.sessionId !== undefined &&
    v.sessionId !== null &&
    typeof v.sessionId !== 'string'
  ) {
    return null;
  }
  if (
    v.turnId !== undefined &&
    v.turnId !== null &&
    typeof v.turnId !== 'string'
  ) {
    return null;
  }
  if (typeof v.requestedAt !== 'string') return null;
  return Object.freeze({
    via: v.via as ProvenanceVia,
    actorId: v.actorId as string | null,
    sessionId: (v.sessionId as string | null | undefined) ?? null,
    turnId: (v.turnId as string | null | undefined) ?? null,
    requestedAt: v.requestedAt,
  });
}
