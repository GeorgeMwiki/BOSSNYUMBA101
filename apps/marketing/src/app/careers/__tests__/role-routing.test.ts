/**
 * Careers role routing — no-404 detector (Wave D).
 *
 * The index linked to a slug derived inline from the role title but there
 * was no `[slug]` route, so every "Apply" link 404'd. The fix stores an
 * explicit `slug` on each role and adds a `[slug]` route reading from the
 * SAME `ROLES` source. These tests guarantee every role resolves, slugs
 * are unique and URL-safe, and the apply path is the careers inbox.
 */

import { describe, expect, it } from 'vitest';
import { ROLES, CAREERS_INBOX, getRoleBySlug } from '../roles';
import { generateStaticParams } from '../[slug]/page';

describe('careers [slug] routing (Wave D)', () => {
  it('every listed role resolves to a real role with responsibilities', () => {
    for (const role of ROLES) {
      const resolved = getRoleBySlug(role.slug);
      expect(resolved, `slug ${role.slug} should resolve`).toBeDefined();
      expect(resolved?.responsibilities.length ?? 0).toBeGreaterThan(0);
      expect(resolved?.requirements.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('slugs are unique and URL-safe', () => {
    const slugs = ROLES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('generateStaticParams pre-renders one param per listed role', () => {
    const params = generateStaticParams();
    expect(params.map((p) => p.slug).sort()).toEqual(
      ROLES.map((r) => r.slug).sort(),
    );
  });

  it('exposes a real apply target (careers inbox)', () => {
    expect(CAREERS_INBOX).toMatch(/@bossnyumba\.com$/);
  });
});
