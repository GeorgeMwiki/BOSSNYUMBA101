import { describe, expect, it } from 'vitest';
import { synthesizeDocxFromText } from './docx-fallback-synthesizer';

describe('synthesizeDocxFromText', () => {
  it('produces a non-empty buffer with .docx magic bytes (PK\\x03\\x04)', () => {
    const buf = synthesizeDocxFromText('Hello {{name}}', { name: 'Salome' });
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
  });

  it('substitutes nested placeholders', () => {
    const buf = synthesizeDocxFromText(
      'Tenant: {{tenant.name}} — Unit: {{unit.code}}',
      { tenant: { name: 'Alpha Ltd' }, unit: { code: 'A-12' } }
    );
    const text = buf.toString('binary');
    expect(text).toContain('Alpha Ltd');
    expect(text).toContain('A-12');
  });

  it('leaves unknown placeholders literal', () => {
    const buf = synthesizeDocxFromText('Hello {{missing}}', {});
    const text = buf.toString('binary');
    expect(text).toContain('{{missing}}');
  });

  it('escapes XML-special characters', () => {
    const buf = synthesizeDocxFromText('<b>{{x}}</b>', { x: '< & >' });
    const text = buf.toString('binary');
    expect(text).toContain('&lt;b&gt;');
  });
});
