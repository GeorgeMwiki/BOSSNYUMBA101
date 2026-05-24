/**
 * project-classifier tests — covers NLP heuristics + hint merging.
 */

import { describe, expect, it } from 'vitest';
import { classifyProject } from '../project-typer/project-classifier.js';

describe('classifyProject — keyword extraction', () => {
  it('recognises a railway between two East African cities', () => {
    const profile = classifyProject({
      description: "we're building a railway from Dar es Salaam to Dodoma",
    });
    expect(profile.projectTypes).toContain('infrastructure-rail');
    expect(profile.jurisdictions).toContain('TZ');
    expect(profile.signals).toContain('linear-corridor');
    expect(profile.confidence).toBeGreaterThan(0.5);
  });

  it('recognises a Nairobi office tower', () => {
    const profile = classifyProject({
      description: 'A 24-storey office tower in Nairobi CBD',
    });
    expect(profile.projectTypes).toContain('commercial-office');
    expect(profile.jurisdictions).toContain('KE');
    expect(profile.biomes).toContain('urban');
  });

  it('recognises a Mombasa port project', () => {
    const profile = classifyProject({
      description: 'Container terminal expansion at Mombasa port',
    });
    expect(profile.projectTypes).toContain('infrastructure-port');
    expect(profile.jurisdictions).toContain('KE');
  });

  it('recognises a Lake Victoria resort', () => {
    const profile = classifyProject({
      description: 'Luxury safari lodge on the coast of Tanzania near Selous national park',
    });
    expect(profile.projectTypes).toContain('hospitality');
    expect(profile.jurisdictions).toContain('TZ');
    expect(profile.signals).toContain('critical-habitat-near');
    expect(profile.biomes).toContain('coastal');
  });

  it('recognises agriculture with regen signals', () => {
    const profile = classifyProject({
      description: 'A coffee plantation in the Ugandan highlands with agroforestry buffers',
    });
    expect(profile.projectTypes).toContain('agriculture');
    expect(profile.jurisdictions).toContain('UG');
    expect(profile.biomes).toContain('highland');
  });

  it('falls back to OTHER jurisdiction when none detected', () => {
    const profile = classifyProject({
      description: 'A grain warehouse',
    });
    expect(profile.jurisdictions).toContain('OTHER');
  });

  it('detects mining with critical habitat near', () => {
    const profile = classifyProject({
      description: 'A copper open-pit mine adjacent to a national park in Tanzania',
    });
    expect(profile.projectTypes).toContain('mining');
    expect(profile.signals).toContain('critical-habitat-near');
  });

  it('detects highway corridor', () => {
    const profile = classifyProject({
      description: 'A toll expressway from Kampala to Jinja',
    });
    expect(profile.projectTypes).toContain('infrastructure-highway');
    expect(profile.jurisdictions).toContain('UG');
    expect(profile.signals).toContain('linear-corridor');
  });

  it('detects telecom data centre', () => {
    const profile = classifyProject({
      description: 'A new tier-3 data centre in Lagos',
    });
    expect(profile.projectTypes).toContain('telecom');
    expect(profile.jurisdictions).toContain('NG');
  });

  it('detects energy solar farm with high insolation hint', () => {
    const profile = classifyProject({
      description: 'A 200 MW solar farm in the arid plateau of northern Kenya',
    });
    expect(profile.projectTypes).toContain('energy');
    expect(profile.biomes).toContain('arid');
  });
});

describe('classifyProject — hints', () => {
  it('honours caller-provided projectTypes hint', () => {
    const profile = classifyProject({
      description: 'A new facility',
      hints: { projectTypes: ['water'] },
    });
    expect(profile.projectTypes).toContain('water');
  });

  it('honours caller-provided lengthKm', () => {
    const profile = classifyProject({
      description: 'railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    expect(profile.lengthKm).toBe(450);
  });

  it('honours caller-provided areaHa', () => {
    const profile = classifyProject({
      description: 'office tower in Nairobi',
      hints: { areaHa: 0.3 },
    });
    expect(profile.areaHa).toBe(0.3);
  });

  it('honours caller-provided capexUsdMillions', () => {
    const profile = classifyProject({
      description: 'office tower in Nairobi',
      hints: { capexUsdMillions: 120 },
    });
    expect(profile.capexUsdMillions).toBe(120);
  });

  it('merges hints with derived signals', () => {
    const profile = classifyProject({
      description: 'A new factory in Mombasa',
      hints: { signals: ['high-insolation'] },
    });
    expect(profile.signals).toContain('high-insolation');
    expect(profile.projectTypes).toContain('industrial');
  });
});

describe('classifyProject — rationale', () => {
  it('emits a non-empty rationale string', () => {
    const profile = classifyProject({
      description: 'A railway from Dar es Salaam to Dodoma',
    });
    expect(profile.rationale.length).toBeGreaterThan(0);
    expect(profile.rationale.toLowerCase()).toContain('infrastructure-rail');
  });

  it('falls back gracefully on minimal input', () => {
    const profile = classifyProject({
      description: 'project',
    });
    expect(profile.projectTypes).toEqual([]);
    expect(profile.confidence).toBeLessThan(0.5);
  });

  it('rejects empty descriptions at schema layer', () => {
    expect(() => classifyProject({ description: '' })).toThrow();
  });
});
