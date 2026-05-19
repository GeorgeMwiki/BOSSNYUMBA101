/**
 * PII tokenization tests — 8 PII classes (phone, email, KRA-PIN, NIDA,
 * M-Pesa-acct, NIN, full-name, address).
 */

import { describe, it, expect } from 'vitest';
import {
  deTokenize,
  detectAll,
  tokenizePII,
} from '../pii-tokenization/index.js';

describe('detectAll — 8 PII classes', () => {
  it('detects phone (EA format)', () => {
    const spans = detectAll('Call me at +254712345678 or 0712345678.');
    const phones = spans.filter((s) => s.piiClass === 'phone');
    expect(phones.length).toBeGreaterThanOrEqual(1);
  });

  it('detects email', () => {
    const spans = detectAll('Email me at john@example.com');
    expect(spans.some((s) => s.piiClass === 'email' && s.original === 'john@example.com')).toBe(
      true,
    );
  });

  it('detects KRA PIN', () => {
    const spans = detectAll('My KRA PIN is A123456789B');
    expect(spans.some((s) => s.piiClass === 'kra-pin')).toBe(true);
  });

  it('detects NIDA (Tanzania 20-digit)', () => {
    const spans = detectAll('NIDA: 12345678901234567890');
    expect(spans.some((s) => s.piiClass === 'nida')).toBe(true);
  });

  it('detects M-Pesa account', () => {
    const spans = detectAll('M-Pesa acct: MPESA-1234567890');
    expect(spans.some((s) => s.piiClass === 'mpesa-acct')).toBe(true);
  });

  it('detects NIN (Nigeria)', () => {
    const spans = detectAll('NIN-12345678901');
    expect(spans.some((s) => s.piiClass === 'nin')).toBe(true);
  });

  it('detects full-name with honorific', () => {
    const spans = detectAll('Speak with Mr John Mwangi about the lease.');
    expect(spans.some((s) => s.piiClass === 'full-name')).toBe(true);
  });

  it('detects address (P.O. Box)', () => {
    const spans = detectAll('Send mail to P.O. Box 12345, Nairobi.');
    expect(spans.some((s) => s.piiClass === 'address')).toBe(true);
  });
});

describe('tokenizePII — basic flow', () => {
  it('replaces detected PII with token placeholders', () => {
    const result = tokenizePII('Reach me at john@example.com', {
      sessionSalt: 'salt-1',
    });
    expect(result.tokenized).not.toContain('john@example.com');
    expect(result.tokenized).toMatch(/<EMAIL_x[0-9a-f]{4}>/);
    expect(result.spans.length).toBe(1);
    expect(result.tokenMap.size).toBe(1);
  });

  it('returns a frozen result with the original text safe to reconstruct', () => {
    const result = tokenizePII('phone: +254712345678', { sessionSalt: 's' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.spans)).toBe(true);
    // tokenMap is a Map — readonly via interface, mutable in JS but not
    // mutated by the package.
    expect(result.tokenMap.size).toBe(1);
  });

  it('deterministically maps the same PII to the same token within a session', () => {
    const a = tokenizePII('email john@example.com twice: john@example.com.', {
      sessionSalt: 'session-a',
    });
    // Both occurrences should resolve to the same token.
    const tokens = a.spans.map((s) => s.token);
    expect(tokens[0]).toBe(tokens[1]);
    expect(a.tokenMap.size).toBe(1);
  });

  it('uses different tokens for different session salts', () => {
    const a = tokenizePII('john@example.com', { sessionSalt: 'session-a' });
    const b = tokenizePII('john@example.com', { sessionSalt: 'session-b' });
    expect(a.spans[0]?.token).not.toBe(b.spans[0]?.token);
  });

  it('case-insensitive token determinism (Jane@x.com == jane@x.com)', () => {
    const a = tokenizePII('Jane@x.com', { sessionSalt: 's' });
    const b = tokenizePII('jane@x.com', { sessionSalt: 's' });
    expect(a.spans[0]?.token).toBe(b.spans[0]?.token);
  });
});

describe('tokenizePII — empty / no-PII input', () => {
  it('returns empty result for empty input', () => {
    const r = tokenizePII('', { sessionSalt: 's' });
    expect(r.tokenized).toBe('');
    expect(r.tokenMap.size).toBe(0);
    expect(r.spans.length).toBe(0);
  });

  it('returns input unchanged when no PII present', () => {
    const r = tokenizePII('please add unit 12B to plot 7', { sessionSalt: 's' });
    expect(r.tokenized).toBe('please add unit 12B to plot 7');
    expect(r.tokenMap.size).toBe(0);
  });
});

describe('tokenizePII — overlapping detection precedence', () => {
  it('KRA PIN wins over phone for ambiguous overlap', () => {
    // Pure-digit clusters should fall to phone/NIDA; alpha-digit-alpha
    // forms only fire KRA PIN.
    const r = tokenizePII('A123456789B', { sessionSalt: 's' });
    expect(r.spans.some((s) => s.piiClass === 'kra-pin')).toBe(true);
    expect(r.spans.some((s) => s.piiClass === 'phone')).toBe(false);
  });

  it('NIDA wins over phone for 20-digit input', () => {
    const r = tokenizePII('12345678901234567890', { sessionSalt: 's' });
    expect(r.spans.some((s) => s.piiClass === 'nida')).toBe(true);
  });
});

describe('deTokenize — reverse operation', () => {
  it('restores original PII for known tokens', () => {
    const t = tokenizePII('john@example.com', { sessionSalt: 's' });
    const token = t.spans[0]?.token ?? '';
    const action = `send email to ${token}`;
    const out = deTokenize(action, t.tokenMap);
    expect(out.text).toBe('send email to john@example.com');
    expect(out.invented.length).toBe(0);
    expect(out.resolvedTokens.length).toBe(1);
  });

  it('surfaces invented tokens (model hallucinated them)', () => {
    const t = tokenizePII('john@example.com', { sessionSalt: 's' });
    const out = deTokenize('email to <EMAIL_xabcd>', t.tokenMap);
    // <EMAIL_xabcd> is invented (not in the real tokenMap).
    expect(out.invented).toContain('<EMAIL_xabcd>');
    expect(out.text).toContain('<EMAIL_xabcd>');
  });

  it('handles empty input', () => {
    const out = deTokenize('', new Map());
    expect(out.text).toBe('');
    expect(out.invented.length).toBe(0);
  });

  it('handles input with no tokens', () => {
    const out = deTokenize('no tokens here at all', new Map());
    expect(out.text).toBe('no tokens here at all');
    expect(out.invented.length).toBe(0);
  });
});

describe('tokenizePII — token format', () => {
  it('uses <CLASS_xXXXX> format for each class', () => {
    const r = tokenizePII(
      'phone +254712345678, email a@b.com, KRA A123456789B',
      { sessionSalt: 's' },
    );
    const formats = r.spans.map((s) => s.token);
    expect(formats.some((t) => /<PHONE_x[0-9a-f]{4}>/.test(t))).toBe(true);
    expect(formats.some((t) => /<EMAIL_x[0-9a-f]{4}>/.test(t))).toBe(true);
    expect(formats.some((t) => /<KRA_PIN_x[0-9a-f]{4}>/.test(t))).toBe(true);
  });
});

describe('tokenizePII + deTokenize — round-trip safety', () => {
  it('round-trip recovers the original text exactly', () => {
    const original = 'Email john@example.com or call +254712345678';
    const t = tokenizePII(original, { sessionSalt: 'roundtrip-salt' });
    const recovered = deTokenize(t.tokenized, t.tokenMap);
    expect(recovered.text).toBe(original);
  });

  it('LLM that leaks the token but not the value: de-tokenizing the leak ' +
    'is still gated by the wire-side adapter — invented tokens NOT in map ' +
    'are surfaced for refusal', () => {
    const t = tokenizePII('email a@b.com', { sessionSalt: 's' });
    // Model "leaks" a token — but it's a real one this time. Adapter
    // should NOT refuse, but observability log should fire.
    const realToken = t.spans[0]?.token;
    expect(realToken).toBeTruthy();
    const out = deTokenize(`leaked: ${realToken}`, t.tokenMap);
    expect(out.resolvedTokens.length).toBe(1);
    expect(out.text).toBe('leaked: a@b.com');
  });
});
