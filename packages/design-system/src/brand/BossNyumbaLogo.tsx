import * as React from 'react';
import { BossNyumbaMark } from './BossNyumbaMark';
import { resolveTone, type BossNyumbaLogoTone } from './tone';

/**
 * BossNyumbaLogo — the canonical BossNyumba brand mark + wordmark
 * system, the real-estate sibling of `BorjieLogo`.
 *
 * Motif: a custom-drawn capital "B" whose lower bowl is pierced by an
 * arched doorway — a letter B that is also an open home. See
 * `BossNyumbaMark` for the glyph construction.
 *
 * Variants:
 *   - 'mark'              mark only (default)
 *   - 'wordmark'          "BossNyumba" wordmark only
 *   - 'lockup-horizontal' mark left of wordmark
 *   - 'lockup-stacked'    mark above wordmark, centred
 *
 * Tones:
 *   - 'full'       burnished-gold gradient (hero, app icons; default)
 *   - 'knockout'   white-on-transparent (over photo / ads)
 *   - 'mono-gold'  single signal-gold (#E5B26B)
 *   - 'mono-navy'  single warm ink (#17100A)
 *   - 'mono-cream' single warm off-white (#F5EBD8)
 *   - 'current'    defers to `currentColor`
 *
 * The wordmark sets "BossNyumba" as one bonded compound in Fraunces
 * display, with a warm-gold mid-dot at the Boss|Nyumba seam so readers
 * parse two syllables but see one brand. Honours "head of the house".
 *
 * Deterministic: no Math.random, no Date, no env reads.
 */

export type BossNyumbaLogoVariant =
  | 'mark'
  | 'wordmark'
  | 'lockup-horizontal'
  | 'lockup-stacked';

export type { BossNyumbaLogoTone };

export interface BossNyumbaLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Which composition to render. Default 'mark'. */
  readonly variant?: BossNyumbaLogoVariant;
  /** Outer mark size in CSS px. Default 32. The wordmark scales off
   *  this value so one prop sizes the whole lockup. */
  readonly size?: number;
  /** Colour scheme. Default 'full'. */
  readonly tone?: BossNyumbaLogoTone;
  /** Override displayed wordmark text. Defaults to 'BossNyumba'. */
  readonly label?: string;
  /** Accessible title — falls back to the canonical brand name. */
  readonly title?: string;
}

/**
 * Wordmark "BossNyumba" — Fraunces display medium with the canonical
 * warm-gold mid-dot at the Boss|Nyumba seam. Renders in the tone's own
 * colour rather than inheriting, so 'knockout' over a dark photo stays
 * correct without relying on a parent `color` cascade.
 */
function BossNyumbaWordmarkText({
  size,
  tone,
  label,
}: {
  readonly size: number;
  readonly tone: BossNyumbaLogoTone;
  readonly label: string;
}): JSX.Element {
  const palette = resolveTone(tone);
  const fontPx = Math.round(size * 0.62);
  const trimmed = label.trim();
  const match = trimmed.match(/^([A-Z][a-z]+)([A-Z][a-z]+)$/);
  const dotSize = Math.max(2, Math.round(fontPx * 0.1));

  return (
    <span
      style={{
        fontFamily: "'Fraunces', 'GT Alpina', 'Source Serif 4', Georgia, serif",
        fontWeight: 600,
        fontSize: `${fontPx}px`,
        letterSpacing: '-0.018em',
        lineHeight: 1,
        color: palette.wordmarkColor,
        display: 'inline-flex',
        alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}
    >
      {match ? (
        <>
          <span>{match[1]}</span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor:
                tone === 'full' || tone === 'mono-cream' ? '#E5B26B' : palette.wordmarkColor,
              margin: `0 ${Math.max(1, Math.round(fontPx * 0.04))}px`,
              transform: `translateY(-${Math.max(1, Math.round(fontPx * 0.12))}px)`,
            }}
          />
          <span>{match[2]}</span>
        </>
      ) : (
        trimmed
      )}
    </span>
  );
}

/**
 * Public component. Switches between mark-only, wordmark-only, and
 * mark+wordmark lockups while honouring the same size/tone props.
 */
export function BossNyumbaLogo({
  variant = 'mark',
  size = 32,
  tone = 'full',
  label = 'BossNyumba',
  title = 'BossNyumba',
  style,
  ...rest
}: BossNyumbaLogoProps): JSX.Element {
  if (variant === 'wordmark') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} aria-label={title} {...rest}>
        <BossNyumbaWordmarkText size={size} tone={tone} label={label} />
      </span>
    );
  }

  if (variant === 'lockup-stacked') {
    return (
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.round(size * 0.3),
          ...style,
        }}
        aria-label={title}
        {...rest}
      >
        <BossNyumbaMark size={Math.round(size * 1.35)} tone={tone} title={title} aria-hidden="true" />
        <BossNyumbaWordmarkText size={size} tone={tone} label={label} />
      </span>
    );
  }

  if (variant === 'lockup-horizontal') {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), ...style }}
        aria-label={title}
        {...rest}
      >
        <BossNyumbaMark size={size} tone={tone} title={title} aria-hidden="true" />
        <BossNyumbaWordmarkText size={size} tone={tone} label={label} />
      </span>
    );
  }

  // mark
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        ...style,
      }}
      aria-label={title}
      {...rest}
    >
      <BossNyumbaMark size={size} tone={tone} title={title} />
    </span>
  );
}

export default BossNyumbaLogo;
