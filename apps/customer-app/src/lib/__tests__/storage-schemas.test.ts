/**
 * Regression tests for round-3 finding C-6 (CRITICAL): unsafe
 * deserialization of `customer_user` (and friends) out of
 * `localStorage`. Any transient XSS could plant attacker-controlled
 * state that the AuthProvider would mount verbatim.
 *
 * The validator MUST:
 *   - reject malformed JSON
 *   - reject objects missing required keys
 *   - reject objects with unknown keys (prototype-pollution defence)
 *   - reject prototype-pollution keys (__proto__, constructor)
 *   - accept valid customer user shapes
 */

import { describe, expect, it } from 'vitest';
import { parseStoredCustomerUser } from '../storage-schemas';

describe('parseStoredCustomerUser', () => {
  it('returns null for null/empty input', () => {
    expect(parseStoredCustomerUser(null)).toBeNull();
    expect(parseStoredCustomerUser('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseStoredCustomerUser('{not-json')).toBeNull();
    expect(parseStoredCustomerUser('undefined')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseStoredCustomerUser(JSON.stringify({}))).toBeNull();
    expect(
      parseStoredCustomerUser(JSON.stringify({ id: 'me' })),
    ).toBeNull();
  });

  it('does not propagate prototype pollution', () => {
    // JSON.parse strips `__proto__` keys silently, so an attacker
    // cannot poison the prototype via this path even before Zod
    // validation. Belt-and-braces: assert the returned object's
    // prototype is the plain Object.prototype and that the bogus
    // `isAdmin` flag never leaks through.
    const raw = JSON.stringify({
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
    });
    // Inject a literal `__proto__` key into the JSON text so JSON.parse
    // sees it. Most engines still strip it on the parse, but if a
    // future engine surfaces it as an own property Zod's strict()
    // would reject the unknown key.
    const poisoned = raw.replace(
      '"lastName":"B"',
      '"lastName":"B","__proto__":{"isAdmin":true}',
    );
    const parsed = parseStoredCustomerUser(poisoned);
    // Either Zod rejected the unknown key (parsed === null), OR the
    // pollution silently failed to attach. Both outcomes are safe.
    if (parsed) {
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
      expect((parsed as { isAdmin?: unknown }).isAdmin).toBeUndefined();
      // The bogus key did not leak as an own property.
      expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    }
  });

  it('rejects unknown top-level keys', () => {
    const payload = {
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
      bonusAdminFlag: true,
    };
    expect(parseStoredCustomerUser(JSON.stringify(payload))).toBeNull();
  });

  it('rejects an attacker-controlled activeOrgId of the wrong type', () => {
    const payload = {
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
      activeOrgId: 12345, // not a string
    };
    expect(parseStoredCustomerUser(JSON.stringify(payload))).toBeNull();
  });

  it('rejects a malformed membership', () => {
    const payload = {
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
      memberships: [
        { id: '1', organizationId: 'victim-org', status: 'TOTALLY_FAKE' },
      ],
    };
    expect(parseStoredCustomerUser(JSON.stringify(payload))).toBeNull();
  });

  it('accepts a valid customer user (no orgs)', () => {
    const payload = {
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
    };
    expect(parseStoredCustomerUser(JSON.stringify(payload))).toEqual(payload);
  });

  it('accepts a valid customer user with active org + memberships', () => {
    const payload = {
      id: 'me',
      phone: '+255700000000',
      firstName: 'A',
      lastName: 'B',
      activeOrgId: 'org-1',
      memberships: [
        { id: 'm-1', organizationId: 'org-1', status: 'ACTIVE' as const },
      ],
    };
    expect(parseStoredCustomerUser(JSON.stringify(payload))).toEqual(payload);
  });

  it('rejects the documented C-6 exploit payload', () => {
    // From .audit/round3-frontend-apps-bug-sweep.md:
    //   localStorage.setItem('customer_user', JSON.stringify({
    //     id: 'me',
    //     activeOrgId: 'victim-org',
    //     memberships: [{ organizationId: 'victim-org', status: 'ACTIVE' }],
    //   }))
    // The exploit omits `phone`, `firstName`, `lastName` and provides
    // a membership missing the `id` field — strict() rejects it.
    const exploit = {
      id: 'me',
      activeOrgId: 'victim-org',
      memberships: [{ organizationId: 'victim-org', status: 'ACTIVE' }],
    };
    expect(parseStoredCustomerUser(JSON.stringify(exploit))).toBeNull();
  });
});
