/**
 * Tests for `extractBrainDegraded` — the defensive parser that turns
 * an arbitrary `/api/brain/turn` response into a `DegradedMarker` or
 * `null`. The contract must be robust against route-handler drift
 * because the api-sdk does not declare the field on its response type
 * yet.
 */

import { describe, expect, it } from 'vitest';
import { extractBrainDegraded } from '../brain-degraded';

describe('extractBrainDegraded', () => {
  it('returns null when payload is null', () => {
    expect(extractBrainDegraded(null)).toBeNull();
  });

  it('returns null when payload is a primitive', () => {
    expect(extractBrainDegraded(42)).toBeNull();
    expect(extractBrainDegraded('boom')).toBeNull();
  });

  it('returns null when degraded is missing', () => {
    expect(
      extractBrainDegraded({ threadId: 't', responseText: 'hi' }),
    ).toBeNull();
  });

  it('returns null when degraded is null', () => {
    expect(extractBrainDegraded({ degraded: null })).toBeNull();
  });

  it('returns null when degraded.reason is missing', () => {
    expect(
      extractBrainDegraded({
        degraded: { affected_capabilities: ['x'] },
      }),
    ).toBeNull();
  });

  it('returns null when affected_capabilities is not an array', () => {
    expect(
      extractBrainDegraded({
        degraded: {
          reason: 'r',
          affected_capabilities: 'sensor:primary',
        },
      }),
    ).toBeNull();
  });

  it('returns null when an entry in affected_capabilities is non-string', () => {
    expect(
      extractBrainDegraded({
        degraded: {
          reason: 'r',
          affected_capabilities: ['x', 9],
        },
      }),
    ).toBeNull();
  });

  it('returns a well-formed marker when the shape is correct', () => {
    const out = extractBrainDegraded({
      threadId: 't',
      responseText: 'hi',
      degraded: {
        reason: 'sensor primary down',
        affected_capabilities: ['sensor:primary', 'nida-port'],
      },
    });
    expect(out).toEqual({
      reason: 'sensor primary down',
      affected_capabilities: ['sensor:primary', 'nida-port'],
    });
  });

  it('preserves the since timestamp when provided', () => {
    const out = extractBrainDegraded({
      degraded: {
        reason: 'r',
        affected_capabilities: ['x'],
        since: '2026-05-21T10:00:00Z',
      },
    });
    expect(out?.since).toBe('2026-05-21T10:00:00Z');
  });

  it('drops a non-string since field instead of failing the whole parse', () => {
    const out = extractBrainDegraded({
      degraded: {
        reason: 'r',
        affected_capabilities: ['x'],
        since: 1234567890,
      },
    });
    expect(out).not.toBeNull();
    expect(out?.since).toBeUndefined();
  });

  it('accepts empty affected_capabilities array', () => {
    const out = extractBrainDegraded({
      degraded: {
        reason: 'tool refused',
        affected_capabilities: [],
      },
    });
    expect(out).toEqual({
      reason: 'tool refused',
      affected_capabilities: [],
    });
  });
});
