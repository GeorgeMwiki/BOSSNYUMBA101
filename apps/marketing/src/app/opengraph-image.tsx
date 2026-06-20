import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og-card';

/**
 * App-router Open Graph image. Next.js auto-wires this file as the
 * site-wide `og:image` (1200×630) — no manifest or layout change
 * needed. The `metadataBase` set in `layout.tsx` makes the emitted URL
 * absolute, so the `openGraph` card declared there now resolves to a
 * real asset instead of a dangling reference.
 */

export const alt = 'BossNyumba — AI-native real estate operating system';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return renderOgCard();
}
