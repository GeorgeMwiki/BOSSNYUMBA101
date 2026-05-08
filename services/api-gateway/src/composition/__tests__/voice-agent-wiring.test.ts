/**
 * Voice-agent wiring tests — verify the composition module:
 *   1. returns null when the database client is null
 *   2. returns a wiring with `.agent` when the database is present
 *   3. round-trips a real `agent.turn(...)` call against a fake DB
 *      (inline transcript bypasses STT, no TTS configured ⇒ degraded)
 *   4. emits the degraded-mode VOICE_BRAIN_NOT_CONFIGURED model tag
 *      and a localized polite reply when the brain stub fires
 *   5. resolves customerId to null when no resolver port is wired
 *   6. uses the heuristic language detector — never hard-codes `en`
 *
 * The fake DatabaseClient mimics the surface that `createVoiceTurnsService`
 * touches (`db.insert(table).values(...)` and the chained `select` for
 * `countBySession`). It is deliberately minimal — we are not testing the
 * Drizzle adapter here; that is covered by
 * `packages/database/src/services/voice-turns.service.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVoiceAgentWiring } from '../voice-agent-wiring';

// ---------------------------------------------------------------------------
// Fake DatabaseClient — supports the two call shapes the wiring exercises:
// `insert(table).values(...)` from the storage adapter's insert path, and
// `select(...).from(...).where(...)` for countBySession (returns 0 rows
// initially, then we increment the count manually after each insert).
// ---------------------------------------------------------------------------

interface FakeDbHandle {
  client: unknown;
  readonly inserted: ReadonlyArray<Record<string, unknown>>;
}

function createFakeDb(): FakeDbHandle {
  const inserted: Record<string, unknown>[] = [];
  let count = 0;

  const client = {
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        inserted.push(v);
        count += 1;
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ value: count }]),
      }),
    }),
  };

  return {
    client,
    get inserted() {
      return inserted;
    },
  };
}

describe('createVoiceAgentWiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns null when db is null', () => {
    const wiring = createVoiceAgentWiring({ db: null });
    expect(wiring).toBeNull();
  });

  it('returns wiring with .agent when db is present', () => {
    const fake = createFakeDb();
    const wiring = createVoiceAgentWiring({
      db: fake.client as never,
    });
    expect(wiring).not.toBeNull();
    expect(wiring?.agent).toBeDefined();
    expect(typeof wiring?.agent.turn).toBe('function');
  });

  it('agent.turn() round-trips an English transcript and persists a row', async () => {
    const fake = createFakeDb();
    const wiring = createVoiceAgentWiring({
      db: fake.client as never,
    });
    expect(wiring).not.toBeNull();

    const result = await wiring!.agent.turn({
      tenantId: 't1',
      sessionId: 's1',
      transcript: 'Hello, can you help me with my rent?',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.sessionId).toBe('s1');
    expect(result.data.detectedLanguage).toBe('en');
    expect(result.data.degradedMode).toBe(true);
    expect(result.data.responseText.length).toBeGreaterThan(0);
    expect(fake.inserted).toHaveLength(1);
    const row = fake.inserted[0]!;
    expect(row.tenantId).toBe('t1');
    expect(row.sessionId).toBe('s1');
    expect(row.modelVersion).toBe('VOICE_BRAIN_NOT_CONFIGURED');
  });

  it('brain stub responds in Swahili when transcript carries Swahili cues', async () => {
    const fake = createFakeDb();
    const wiring = createVoiceAgentWiring({
      db: fake.client as never,
    });

    const result = await wiring!.agent.turn({
      tenantId: 't1',
      sessionId: 's2',
      transcript: 'Habari, ninahitaji msaada na nyumba yangu',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.detectedLanguage).toBe('sw');
    // Swahili degraded-mode reply should contain a Swahili-specific token.
    expect(result.data.responseText.toLowerCase()).toContain('asante');
    expect(result.data.modelVersion).toBe('VOICE_BRAIN_NOT_CONFIGURED');
  });

  it('resolves customerId to null when no resolver is wired', async () => {
    const fake = createFakeDb();
    const wiring = createVoiceAgentWiring({
      db: fake.client as never,
    });

    const result = await wiring!.agent.turn({
      tenantId: 't1',
      sessionId: 's3',
      transcript: 'Bonjour, j’ai une question',
      callerPhone: '+255700000000',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.customerId).toBeNull();
    expect(result.data.detectedLanguage).toBe('fr');
  });

  it('passes a logger warning through the brain stub when configured', async () => {
    const fake = createFakeDb();
    const warn = vi.fn();
    const wiring = createVoiceAgentWiring({
      db: fake.client as never,
      logger: { warn },
    });

    const result = await wiring!.agent.turn({
      tenantId: 't1',
      sessionId: 's4',
      transcript: 'Hola, necesito ayuda',
    });

    expect(result.success).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    const [meta, msg] = warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(meta.tenantId).toBe('t1');
    expect(meta.sessionId).toBe('s4');
    expect(meta.languageCode).toBe('es');
    expect(msg).toContain('VOICE_BRAIN_NOT_CONFIGURED');
  });
});
