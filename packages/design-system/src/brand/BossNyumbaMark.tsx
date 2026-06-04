import * as React from 'react';
import { resolveTone, type BossNyumbaLogoTone } from './tone';

/**
 * BossNyumbaMark — the canonical BossNyumba glyph: a custom-drawn
 * capital "B" whose lower bowl is pierced by an arched doorway.
 *
 * Reads as a letter B at a glance, a home / open doorway on second look
 * — the real-estate counterpart to the sibling Borjie mark (whose lower
 * bowl carries mining strata instead). The doorway is a true negative
 * space (even-odd cutout) so it shows the surface behind it: lit cream
 * on light, a dark threshold on dark — a welcoming entrance either way.
 *
 * Construction grid is 64×64 with every anchor on whole or half units,
 * so the silhouette stays crisp from a 16px favicon to a billboard.
 *
 * Layering (back → front):
 *   1. Optional rounded dark backdrop tile (for transparent surfaces)
 *   2. Soft warm-gold ambient bloom (gradient tone only)
 *   3. Spine of the B — vertical bar
 *   4. Upper bowl
 *   5. Threshold seam — the floor line dividing the two bowls
 *   6. Lower bowl with the arched doorway cut out (even-odd)
 *   7. Top-edge specular + warm doorway arch (gradient tone only)
 *
 * Deterministic: no Math.random, no Date, no env reads — server and
 * client renders are byte-identical. Gradient ids are `useId`-salted so
 * any number of marks can share a page without id collisions.
 */

export interface BossNyumbaMarkProps extends React.SVGProps<SVGSVGElement> {
  readonly size?: number | string;
  readonly tone?: BossNyumbaLogoTone;
  readonly title?: string;
  /** Renders the rounded dark backdrop tile (square app-icon framing). */
  readonly withBackdrop?: boolean;
  /**
   * When true (the default for the gradient `full` tone) the warm bloom
   * slowly breathes — the "lit", alive-at-rest brand pulse. Self-contained
   * via an inline `<style>`, so it animates anywhere the SVG renders with
   * no external CSS, and is disabled under `prefers-reduced-motion`. Pass
   * `false` for a fully static mark.
   */
  readonly pulse?: boolean;
}

export const BossNyumbaMark = React.forwardRef<SVGSVGElement, BossNyumbaMarkProps>(
  function BossNyumbaMark(
    { size = 32, tone = 'full', title = 'BossNyumba', withBackdrop = false, pulse, ...rest },
    ref,
  ) {
    const uid = React.useId().replace(/:/g, '');
    const palette = resolveTone(tone);

    // The "lit" pulse rides on the warm bloom, so it only exists for the
    // gradient tone. Default-on there; any consumer can opt out. Salted
    // class + keyframes so multiple marks never clash, and a
    // reduced-motion guard pins it to a calm static glow when requested.
    const shouldPulse = (pulse ?? true) && palette.useGradient;
    const litClass = `bn-lit-${uid}`;
    const litCss =
      `@keyframes ${litClass}{0%,100%{opacity:.42}50%{opacity:1}}` +
      `.${litClass}{animation:${litClass} 3.4s ease-in-out infinite}` +
      `@media(prefers-reduced-motion:reduce){.${litClass}{animation:none;opacity:.85}}`;

    const spineId = `bn-spine-${uid}`;
    const upperId = `bn-upper-${uid}`;
    const lowerId = `bn-lower-${uid}`;
    const hiId = `bn-hi-${uid}`;
    const bloomId = `bn-bloom-${uid}`;
    const backdropId = `bn-backdrop-${uid}`;

    const spine = palette.useGradient ? `url(#${spineId})` : palette.spine;
    const upper = palette.useGradient ? `url(#${upperId})` : palette.upperBand;
    const lower = palette.useGradient ? `url(#${lowerId})` : palette.lowerBand;
    const highlight = palette.useGradient ? `url(#${hiId})` : palette.highlight;
    const seam = palette.midSeam;

    // Lower bowl + arched doorway as one even-odd path → the doorway is
    // a real hole, so the mark works on any background without a fill
    // that has to match the surface.
    const lowerBowlWithDoor =
      'M22 35 H40 a10 10 0 0 1 10 10 a10 10 0 0 1 -10 10 H22 Z ' +
      'M31.6 55 V49 a3.9 3.9 0 0 1 7.8 0 V55 Z';

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
        {...rest}
      >
        <title>{title}</title>
        {shouldPulse ? <style dangerouslySetInnerHTML={{ __html: litCss }} /> : null}

        {palette.useGradient ? (
          <defs>
            <linearGradient id={spineId} x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE2B4" />
              <stop offset="40%" stopColor="#F2C27E" />
              <stop offset="100%" stopColor="#A26A2A" />
            </linearGradient>
            <linearGradient id={upperId} x1="32" y1="14" x2="32" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF1CF" />
              <stop offset="100%" stopColor="#E5B26B" />
            </linearGradient>
            <linearGradient id={lowerId} x1="32" y1="34" x2="32" y2="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F2C27E" />
              <stop offset="100%" stopColor="#7A4F1E" />
            </linearGradient>
            <linearGradient id={hiId} x1="32" y1="10" x2="32" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF8E6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FFF8E6" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={bloomId} cx="32" cy="30" r="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F7CC85" stopOpacity="0.42" />
              <stop offset="60%" stopColor="#E5B26B" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#E5B26B" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={backdropId} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1F160E" />
              <stop offset="100%" stopColor="#0E0906" />
            </linearGradient>
          </defs>
        ) : null}

        {withBackdrop ? (
          <>
            <rect
              width="64"
              height="64"
              rx="12"
              fill={palette.useGradient ? `url(#${backdropId})` : '#17100A'}
            />
            <rect width="64" height="64" rx="12" fill="none" stroke="#2A1E10" strokeWidth="0.5" />
          </>
        ) : null}

        {palette.useGradient ? (
          <circle
            cx="32"
            cy="30"
            r="19"
            fill={`url(#${bloomId})`}
            className={shouldPulse ? litClass : undefined}
          />
        ) : null}

        {/* Spine of the B */}
        <rect x="14" y="12" width="8" height="40" rx="2" fill={spine} />

        {/* Upper bowl */}
        <path d="M22 14 H38 a8 8 0 0 1 8 8 v3 a8 8 0 0 1 -8 8 H22 z" fill={upper} />

        {/* Threshold seam — floor line between the bowls */}
        <rect x="22" y="32" width="20" height="1.2" fill={seam} opacity="0.9" />

        {/* Lower bowl with the arched doorway cut out */}
        <path fillRule="evenodd" clipRule="evenodd" d={lowerBowlWithDoor} fill={lower} />

        {/* Top-edge specular on the spine — the "lit" sheen */}
        {palette.useGradient ? (
          <rect x="14.4" y="12.4" width="7.2" height="6" rx="1.6" fill={highlight} />
        ) : null}

        {/* Warm hairline tracing the doorway arch — a welcoming glow,
            gradient tone only. */}
        {palette.useGradient ? (
          <path
            d="M31.6 55 V49 a3.9 3.9 0 0 1 7.8 0 V55"
            fill="none"
            stroke="#FFE2B4"
            strokeWidth="0.5"
            opacity="0.4"
          />
        ) : null}
      </svg>
    );
  },
);
