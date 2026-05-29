/**
 * Boot-time validation tests for the canonical capability registry.
 *
 * Tests verify:
 *   - Every entry parses against `CapabilityEntrySchema`.
 *   - `related[]` foreign keys all resolve.
 *   - No internal-mechanic leakage tokens appear in PUBLIC entries.
 *   - Bilingual sw + en strings are non-empty and meaningfully distinct.
 *   - The disclosure filter respects PUBLIC vs INTERNAL.
 */

import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_REGISTRY,
  CAPABILITY_COUNT,
  CAPABILITY_TOPIC,
  CapabilityEntrySchema,
  exampleReasoningTrace,
  getCapabilityById,
  isDisclosable,
  listCapabilitiesByTopic,
  listCapabilitiesByVisibility,
  listDisclosableCapabilities,
  reasoningHint,
} from '../index.js';

describe('CAPABILITY_REGISTRY — boot integrity', () => {
  it('has at least 30 entries (real-estate scope)', () => {
    expect(CAPABILITY_COUNT).toBeGreaterThanOrEqual(30);
  });

  it('every entry parses against the schema', () => {
    for (const entry of CAPABILITY_REGISTRY) {
      expect(() => CapabilityEntrySchema.parse(entry)).not.toThrow();
    }
  });

  it('every `related` foreign key resolves to a known id', () => {
    const ids = new Set(CAPABILITY_REGISTRY.map((entry) => entry.id));
    for (const entry of CAPABILITY_REGISTRY) {
      for (const ref of entry.related) {
        expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it('every entry has unique id', () => {
    const ids = CAPABILITY_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty bilingual sw + en strings', () => {
    for (const entry of CAPABILITY_REGISTRY) {
      expect(entry.public_name.en.length).toBeGreaterThan(0);
      expect(entry.public_name.sw.length).toBeGreaterThan(0);
      expect(entry.public_description.en.length).toBeGreaterThan(0);
      expect(entry.public_description.sw.length).toBeGreaterThan(0);
      expect(entry.example_response_pattern.en.length).toBeGreaterThan(0);
      expect(entry.example_response_pattern.sw.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a known topic', () => {
    const valid = new Set<string>(CAPABILITY_TOPIC);
    for (const entry of CAPABILITY_REGISTRY) {
      expect(valid.has(entry.topic)).toBe(true);
    }
  });
});

describe('CAPABILITY_REGISTRY — disclosure discipline', () => {
  /**
   * Internal-mechanic leakage tokens — if any PUBLIC entry mentions
   * these in user-facing fields, the disclosure rule is broken. Add
   * to this list as new internal vocabulary appears.
   */
  /**
   * Word-boundary tokens — match as standalone words / dotted ids /
   * branded model names. Avoids false positives where the literal
   * substring appears inside a real-estate noun (e.g. "misses rent"
   * → "sse"; "lease" → "se").
   */
  const LEAKAGE_TOKENS = [
    /\bkernel\b/i,
    /\bagent count\b/i,
    /\btool id\b/i,
    /\bnpm package\b/i,
    /\bservice name\b/i,
    /\bdatabase migration\b/i,
    /\bprompt template\b/i,
    /\bsystem prompt\b/i,
    /\bdatabase table\b/i,
    /\bpgvector\b/i,
    /\bdrizzle\b/i,
    /\bredis\b/i,
    /\bsse stream\b/i,
    /\bmcp server\b/i,
    /\blats\b/i,
    /\banthropic\b/i,
    /\bopenai\b/i,
    /\bclaude-\w/i,
    /\bgpt-\w/i,
    /\bsonnet\b/i,
    /\bhaiku\b/i,
    /\bopus\b/i,
  ];

  function containsLeakage(text: string): string | undefined {
    for (const regex of LEAKAGE_TOKENS) {
      const m = regex.exec(text);
      if (m) return m[0];
    }
    return undefined;
  }

  it('no PUBLIC entry leaks internal mechanics in description or example', () => {
    for (const entry of CAPABILITY_REGISTRY) {
      if (entry.visibility !== 'PUBLIC') continue;
      const violations: Array<{ field: string; token: string }> = [];
      const checks: Array<{ field: string; value: string }> = [
        { field: 'user_outcome', value: entry.user_outcome },
        { field: 'public_description.en', value: entry.public_description.en },
        { field: 'public_description.sw', value: entry.public_description.sw },
        {
          field: 'example_response_pattern.en',
          value: entry.example_response_pattern.en,
        },
        {
          field: 'example_response_pattern.sw',
          value: entry.example_response_pattern.sw,
        },
      ];
      for (const { field, value } of checks) {
        const leak = containsLeakage(value);
        if (leak) violations.push({ field, token: leak });
      }
      expect(
        violations,
        `entry ${entry.id} leaks internal tokens: ${JSON.stringify(violations)}`,
      ).toEqual([]);
    }
  });

  it('listDisclosableCapabilities returns only PUBLIC + EXPERIMENTAL', () => {
    const disclosable = listDisclosableCapabilities();
    for (const entry of disclosable) {
      expect(isDisclosable(entry)).toBe(true);
      expect(['PUBLIC', 'EXPERIMENTAL']).toContain(entry.visibility);
    }
  });
});

describe('CAPABILITY_REGISTRY — accessors', () => {
  it('getCapabilityById resolves a known id', () => {
    const entry = getCapabilityById('mwikila.draft.lease');
    expect(entry).toBeDefined();
    expect(entry?.topic).toBe('drafting');
  });

  it('getCapabilityById returns undefined for an unknown id', () => {
    expect(getCapabilityById('mwikila.unknown.thing')).toBeUndefined();
  });

  it('listCapabilitiesByTopic filters', () => {
    const drafting = listCapabilitiesByTopic('drafting');
    expect(drafting.length).toBeGreaterThan(0);
    for (const entry of drafting) {
      expect(entry.topic).toBe('drafting');
    }
  });

  it('listCapabilitiesByVisibility filters', () => {
    const publicEntries = listCapabilitiesByVisibility('PUBLIC');
    expect(publicEntries.length).toBeGreaterThan(0);
    for (const entry of publicEntries) {
      expect(entry.visibility).toBe('PUBLIC');
    }
  });

  it('reasoningHint and exampleReasoningTrace are semantic aliases', () => {
    const entry = getCapabilityById('mwikila.draft.lease');
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(reasoningHint(entry)).toBe(entry.public_description);
    expect(exampleReasoningTrace(entry)).toBe(entry.example_response_pattern);
  });
});

describe('CAPABILITY_REGISTRY — RT-1 guideline-not-script contract', () => {
  /**
   * Variation contract — different topics should NEVER share verbatim
   * example_response_pattern strings. If two entries return the same
   * canned text, the model is being trained to retrieve, not reason.
   */
  it('example_response_pattern strings are unique across entries', () => {
    const seenEn = new Set<string>();
    const seenSw = new Set<string>();
    for (const entry of CAPABILITY_REGISTRY) {
      expect(seenEn.has(entry.example_response_pattern.en)).toBe(false);
      expect(seenSw.has(entry.example_response_pattern.sw)).toBe(false);
      seenEn.add(entry.example_response_pattern.en);
      seenSw.add(entry.example_response_pattern.sw);
    }
  });
});
