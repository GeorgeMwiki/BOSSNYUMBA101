import { ImageResponse } from 'next/og';
import { getLocale } from './locale';
import { BRAND } from '@bossnyumba/design-system';

/**
 * Shared 1200×630 social-card renderer for the marketing site's
 * `opengraph-image` and `twitter-image` metadata routes.
 *
 * Built with `ImageResponse` (Satori) — which renders a constrained
 * flexbox/SVG subset, NOT the live React DOM — so we re-draw the
 * doorway-B mark as a static inline SVG rather than importing the
 * animated `<BossNyumbaMark>` component (it relies on `useId`, inline
 * `<style>` keyframes and `prefers-reduced-motion`, none of which
 * Satori supports). Colours and type come from the canonical `BRAND`
 * tokens so the card never drifts from the runtime brand.
 *
 * Locale follows the visitor: the card text renders in the active
 * `bossnyumba_locale` (single language per surface — never mixed), the
 * same absolute sw/en toggle the document metadata already honours.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

const { ink, paper, signal } = BRAND.colors;

/**
 * The doorway-B glyph re-drawn on the canonical 64×64 grid, scaled to
 * 240px for the card. Paths are copied verbatim from `BossNyumbaMark`
 * (spine, upper bowl, threshold seam, lower bowl with the arched
 * doorway cut out as an even-odd hole). Flat fills — no gradients or
 * animation — so it stays crisp and deterministic under Satori.
 */
function DoorwayBMark({ px }: { readonly px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Spine of the B */}
      <rect x="14" y="12" width="8" height="40" rx="2" fill={signal} />
      {/* Upper bowl */}
      <path d="M22 14 H38 a8 8 0 0 1 8 8 v3 a8 8 0 0 1 -8 8 H22 z" fill={signal} />
      {/* Threshold seam — floor line between the bowls */}
      <rect x="22" y="32" width="20" height="1.2" fill={paper} opacity="0.9" />
      {/* Lower bowl with the arched doorway cut out (even-odd hole shows the card behind it) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 35 H40 a10 10 0 0 1 10 10 a10 10 0 0 1 -10 10 H22 Z M31.6 55 V49 a3.9 3.9 0 0 1 7.8 0 V55 Z"
        fill={signal}
      />
    </svg>
  );
}

/**
 * Render the shared social card as an `ImageResponse`. Both metadata
 * routes delegate here so the OG and Twitter cards stay byte-identical.
 */
export async function renderOgCard(): Promise<ImageResponse> {
  const locale = await getLocale();
  const sw = locale === 'sw';

  const eyebrow = sw ? 'Mfumo wa uendeshaji wa mali wenye AI ya asili' : 'AI-native real estate operating system';
  const tagline = sw ? 'Kichwa cha nyumba, kimeimarishwa.' : BRAND.tagline;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '88px',
          backgroundColor: ink,
          backgroundImage: `radial-gradient(1100px 520px at 78% -8%, ${signal}26, transparent 60%)`,
          fontFamily: 'serif',
        }}
      >
        {/* Lockup: doorway-B mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <DoorwayBMark px={132} />
          <div
            style={{
              fontSize: '88px',
              fontWeight: 700,
              color: paper,
              letterSpacing: '-0.02em',
            }}
          >
            {BRAND.name}
          </div>
        </div>

        {/* Eyebrow + tagline block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: '30px',
              fontWeight: 600,
              color: signal,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontFamily: 'sans-serif',
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: '62px',
              fontWeight: 700,
              color: paper,
              lineHeight: 1.08,
              maxWidth: '900px',
            }}
          >
            {tagline}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
