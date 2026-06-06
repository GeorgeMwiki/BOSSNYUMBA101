/**
 * Tests for the KI-013 Migration Wizard copilot wiring.
 *
 * The factory gates on an Anthropic key/client: no key → null (router keeps
 * its 501); injected client → a working `run(...)` port that returns a
 * Zod-validated wizard turn. The stub client implements the minimal
 * `AnthropicClient` surface (`sdk.messages.create`) that `generateStructured`
 * drives, so no network is required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AnthropicClient } from '@bossnyumba/ai-copilot';
import { createMigrationWizardCopilotPort } from '../migration-wizard-wiring.js';

function stubClient(jsonPayload: unknown): AnthropicClient {
  return {
    defaultModel: 'claude-sonnet-4-6',
    sdk: {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: JSON.stringify(jsonPayload) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      },
    },
  };
}

describe('createMigrationWizardCopilotPort', () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  });

  it('returns null when no API key or client is available', () => {
    const port = createMigrationWizardCopilotPort({});
    expect(port).toBeNull();
  });

  it('returns a working port when a client is injected', async () => {
    const port = createMigrationWizardCopilotPort({
      client: stubClient({
        narrative: 'Parsed 3 properties, 12 units. Diff looks clean.',
        proposedAction: { kind: 'commit', runId: 'run_1', risk: 'HIGH' },
        confidence: 0.82,
      }),
    });
    expect(port).not.toBeNull();

    const turn = await port!.run({
      tenantId: 'tn_1',
      actorId: 'usr_1',
      runId: 'run_1',
      message: 'Looks good, commit it.',
    });
    expect(turn.narrative).toContain('Parsed 3 properties');
    expect(turn.proposedAction).toEqual({
      kind: 'commit',
      runId: 'run_1',
      risk: 'HIGH',
    });
    expect(turn.confidence).toBeCloseTo(0.82);
  });

  it('parses a revise proposal', async () => {
    const port = createMigrationWizardCopilotPort({
      client: stubClient({
        narrative: 'Row 4 has an ambiguous unit number — please correct.',
        proposedAction: { kind: 'revise', notes: 'fix unit 4' },
      }),
    });
    const turn = await port!.run({
      tenantId: 'tn_1',
      actorId: 'usr_1',
      runId: 'run_1',
      message: 'what about unit 4?',
    });
    expect(turn.proposedAction.kind).toBe('revise');
    // confidence defaults to 0.7 when the model omits it.
    expect(turn.confidence).toBe(0.7);
  });

  it('rejects a malformed turn (missing proposedAction)', async () => {
    const port = createMigrationWizardCopilotPort({
      client: stubClient({ narrative: 'no action here' }),
    });
    await expect(
      port!.run({ tenantId: 't', actorId: 'a', runId: 'r', message: 'hi' }),
    ).rejects.toThrow();
  });
});
