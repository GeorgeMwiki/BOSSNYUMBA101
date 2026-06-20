import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og-card';

/**
 * App-router Twitter card image. Next.js auto-wires this file as the
 * `twitter:image` (1200×630), pairing with the `summary_large_image`
 * card declared in `layout.tsx`. Shares the exact same renderer as the
 * Open Graph image so the two cards never drift.
 */

export const alt = 'BossNyumba — AI-native real estate operating system';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function TwitterImage() {
  return renderOgCard();
}
