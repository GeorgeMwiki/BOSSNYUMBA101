/**
 * Provenance contract tests.
 *
 * Every attribute in the entity store MUST carry a `source` envelope.
 * These tests pin the validator behaviour exhaustively.
 */

import { describe, it, expect } from 'vitest';
import {
  InvalidProvenanceError,
  summariseProvenance,
  validateProvenance,
  type ProvenanceSource,
} from '../types/provenance.js';

describe('validateProvenance / shape', () => {
  it('accepts a chat-origin envelope', () => {
    const s: ProvenanceSource = {
      conversationId: 'conv_1',
      messageId: 'msg_1',
      llmInferredSchemaVersion: 1,
      timestamp: '2026-05-19T10:00:00Z',
    };
    expect(validateProvenance(s)).toBe(s);
  });

  it('accepts a manual envelope', () => {
    const s: ProvenanceSource = { manual: true, timestamp: '2026-05-19T10:00:00Z' };
    expect(validateProvenance(s)).toBe(s);
  });

  it('accepts a file-import envelope', () => {
    const s: ProvenanceSource = {
      fileHash: 'sha256:abcd',
      rowIdx: 3,
      timestamp: '2026-05-19T10:00:00Z',
    };
    expect(validateProvenance(s)).toBe(s);
  });

  it('accepts an llm-research envelope', () => {
    const s: ProvenanceSource = {
      llmResearch: true,
      timestamp: '2026-05-19T10:00:00Z',
    };
    expect(validateProvenance(s)).toBe(s);
  });

  it('accepts ISO-8601 with milliseconds + Z', () => {
    expect(() =>
      validateProvenance({ manual: true, timestamp: '2026-05-19T10:00:00.123Z' }),
    ).not.toThrow();
  });

  it('accepts ISO-8601 with explicit timezone offset', () => {
    expect(() =>
      validateProvenance({ manual: true, timestamp: '2026-05-19T10:00:00+03:00' }),
    ).not.toThrow();
  });
});

describe('validateProvenance / rejection', () => {
  it('rejects missing timestamp', () => {
    expect(() =>
      validateProvenance({ manual: true } as ProvenanceSource),
    ).toThrow(InvalidProvenanceError);
  });

  it('rejects non-ISO timestamp', () => {
    expect(() =>
      validateProvenance({ manual: true, timestamp: '2026/05/19 10:00' } as ProvenanceSource),
    ).toThrow(/timestamp must be ISO-8601/);
  });

  it('rejects envelope with no origin signal', () => {
    expect(() =>
      validateProvenance({ timestamp: '2026-05-19T10:00:00Z' } as ProvenanceSource),
    ).toThrow(/at least one origin signal/);
  });

  it('rejects timestamp that is a number', () => {
    expect(() =>
      validateProvenance({
        manual: true,
        timestamp: 1716120000000,
      } as unknown as ProvenanceSource),
    ).toThrow(InvalidProvenanceError);
  });

  it('rejects manual + conversationId combo on a new envelope', () => {
    expect(() =>
      validateProvenance({
        manual: true,
        conversationId: 'conv_1',
        timestamp: '2026-05-19T10:00:00Z',
      }),
    ).toThrow(/manual envelope cannot also carry conversationId/);
  });

  it('rejects an undefined input', () => {
    expect(() =>
      validateProvenance(undefined as unknown as ProvenanceSource),
    ).toThrow(InvalidProvenanceError);
  });

  it('rejects a null input', () => {
    expect(() =>
      validateProvenance(null as unknown as ProvenanceSource),
    ).toThrow(InvalidProvenanceError);
  });
});

describe('summariseProvenance', () => {
  it('summarises manual', () => {
    expect(summariseProvenance({ manual: true, timestamp: '2026-05-19T10:00:00Z' })).toBe(
      'manual',
    );
  });

  it('summarises llm-research', () => {
    expect(
      summariseProvenance({ llmResearch: true, timestamp: '2026-05-19T10:00:00Z' }),
    ).toBe('llm-research');
  });

  it('summarises file with row index', () => {
    expect(
      summariseProvenance({
        fileHash: 'sha256:abcd1234',
        rowIdx: 7,
        timestamp: '2026-05-19T10:00:00Z',
      }),
    ).toBe('file:sha256:a#7');
  });

  it('summarises chat with conversationId', () => {
    expect(
      summariseProvenance({
        conversationId: 'conv_abcd1234',
        timestamp: '2026-05-19T10:00:00Z',
      }),
    ).toBe('chat:conv_abc');
  });

  it('falls back to unknown for empty envelope', () => {
    expect(summariseProvenance({ timestamp: '2026-05-19T10:00:00Z' })).toBe('unknown');
  });
});
