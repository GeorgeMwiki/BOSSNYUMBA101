/**
 * Persona statelessness leak-guard tests.
 *
 * Locks in the LitFin-ported `assertStatelessInDev` backstop: cached personas
 * MUST carry only identity fields and never a request-scoped identifier, so a
 * shared cached object can never leak one caller's session/tenant/user data
 * into the next caller's prompt.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  assertStatelessInDev,
  getAllPrimaryPersonae,
  type BossnyumbaPersona,
} from '../personas/index.js';

function basePersona(
  overrides: Partial<BossnyumbaPersona> = {},
): BossnyumbaPersona {
  return {
    id: 'public-guide',
    displayName: 'BossNyumba',
    portalId: 'marketing',
    systemPrompt: 'You are BossNyumba. You help with property questions.',
    availableTools: Object.freeze(['skill.core.advise']),
    communicationStyle: Object.freeze({
      defaultTone: 'friendly',
      verbosity: 'moderate',
      formality: 'moderate',
      usesEmoji: false,
      supportsSwahili: true,
    }),
    ...overrides,
  };
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('persona leak guard — assertStatelessInDev', () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('passes every real primary persona (no false positives)', () => {
    process.env.NODE_ENV = 'test';
    for (const persona of getAllPrimaryPersonae()) {
      expect(() => assertStatelessInDev(persona)).not.toThrow();
    }
  });

  it('throws when a persona carries an unexpected (request-scoped) field', () => {
    process.env.NODE_ENV = 'test';
    const leaky = {
      ...basePersona(),
      tenantId: 'tenant-123', // not part of the identity surface
    } as unknown as BossnyumbaPersona;
    expect(() => assertStatelessInDev(leaky)).toThrow(/unexpected field 'tenantId'/);
  });

  it('throws when a UUID is baked into the system prompt', () => {
    process.env.NODE_ENV = 'test';
    const leaky = basePersona({
      systemPrompt:
        'You are assisting user 123e4567-e89b-12d3-a456-426614174000 right now.',
    });
    expect(() => assertStatelessInDev(leaky)).toThrow(/request-scoped identifier/);
  });

  it('throws when a JWT is baked into the system prompt', () => {
    process.env.NODE_ENV = 'test';
    const leaky = basePersona({
      systemPrompt:
        'session token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123 attached.',
    });
    expect(() => assertStatelessInDev(leaky)).toThrow(/request-scoped identifier/);
  });

  it('throws when a session-id token is baked into the display name', () => {
    process.env.NODE_ENV = 'test';
    const leaky = basePersona({ displayName: 'Guide session_id=abc123xyz' });
    expect(() => assertStatelessInDev(leaky)).toThrow(/request-scoped identifier/);
  });

  it('is a no-op in production (hot path stays branch-free)', () => {
    process.env.NODE_ENV = 'production';
    const leaky = {
      ...basePersona(),
      tenantId: 'tenant-123',
      systemPrompt: 'user 123e4567-e89b-12d3-a456-426614174000',
    } as unknown as BossnyumbaPersona;
    // Even a blatantly leaky persona is not validated in production — the
    // factory invariant is the canonical defence; this guard is a dev backstop.
    expect(() => assertStatelessInDev(leaky)).not.toThrow();
  });
});
