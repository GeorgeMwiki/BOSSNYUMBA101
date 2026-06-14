/**
 * Blog post routing — no-404 detector (Wave D).
 *
 * The index linked to `/blog/${slug}` but there was no `[slug]` route, so
 * every post link 404'd. The fix adds a `[slug]` route that reads from
 * the SAME `POSTS` source the index lists. These tests guarantee that
 * every slug the index can link to resolves to a real post with body
 * content, and that `generateStaticParams` covers them all.
 */

import { describe, expect, it } from 'vitest';
import { POSTS, getPostBySlug } from '../posts';
import { generateStaticParams } from '../[slug]/page';

describe('blog [slug] routing (Wave D)', () => {
  it('every listed post resolves to real, non-empty body content', () => {
    for (const post of POSTS) {
      const resolved = getPostBySlug(post.slug);
      expect(resolved, `slug ${post.slug} should resolve`).toBeDefined();
      expect(resolved?.body.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('generateStaticParams pre-renders one param per listed post', () => {
    const params = generateStaticParams();
    const slugs = params.map((p) => p.slug).sort();
    const expected = POSTS.map((p) => p.slug).sort();
    expect(slugs).toEqual(expected);
  });

  it('an unknown slug does not resolve (route will 404)', () => {
    expect(getPostBySlug('this-post-does-not-exist')).toBeUndefined();
  });
});
