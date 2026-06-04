/**
 * BossNyumba brand — logo tone resolver.
 *
 * Single source of truth for the colour tokens a tone implies, shared
 * by the mark SVG (`BossNyumbaMark`) and the wordmark text
 * (`BossNyumbaLogo`) so the glyph fill and the wordmark colour stay in
 * lock-step across every tone.
 *
 * Tones mirror the sibling Borjie system one-for-one, plus a BN-only
 * `current` tone that defers to `currentColor` — this is what lets the
 * backward-compatible `Logomark variant="flat"` keep responding to a
 * `text-signal-500` (or any `text-*`) className on its consumers.
 */

export type BossNyumbaLogoTone =
  | 'full'
  | 'knockout'
  | 'mono-gold'
  | 'mono-navy'
  | 'mono-cream'
  | 'current';

export interface ResolvedTone {
  /** When true the mark paints with the burnished-gold gradient set;
   *  otherwise every band is a single flat colour. */
  readonly useGradient: boolean;
  readonly spine: string;
  readonly upperBand: string;
  readonly midSeam: string;
  readonly lowerBand: string;
  readonly highlight: string;
  /** Colour the "BossNyumba" wordmark text adopts for this tone. */
  readonly wordmarkColor: string;
}

function flat(color: string, wordmarkColor: string = color): ResolvedTone {
  return {
    useGradient: false,
    spine: color,
    upperBand: color,
    midSeam: color,
    lowerBand: color,
    highlight: color,
    wordmarkColor,
  };
}

/**
 * Resolve the concrete fill tokens for a tone. Gradient tones return
 * sentinel band values that the mark overrides with its own
 * instance-salted `url(#…)` ids; only `useGradient`, `midSeam` and
 * `wordmarkColor` are consumed verbatim in that case.
 */
export function resolveTone(tone: BossNyumbaLogoTone): ResolvedTone {
  switch (tone) {
    case 'knockout':
      return flat('#FFFFFF');
    case 'mono-gold':
      return flat('#E5B26B');
    case 'mono-navy':
      return flat('#17100A');
    case 'mono-cream':
      return flat('#F5EBD8');
    case 'current':
      return flat('currentColor');
    case 'full':
    default:
      return {
        useGradient: true,
        spine: 'url(#bn-spine)',
        upperBand: 'url(#bn-upper)',
        midSeam: '#E5B26B',
        lowerBand: 'url(#bn-lower)',
        highlight: 'url(#bn-hi)',
        wordmarkColor: '#F5EBD8',
      };
  }
}
