/**
 * Boss Nyumba — Brand barrel.
 *
 * Canonical logo + wordmark components + brand tokens exposed as TS
 * constants so non-CSS consumers (emails, PDFs, slide decks) can use
 * the exact same values as the runtime UI.
 */

// Canonical brand system — the doorway-B glyph + wordmark lockups.
export { BossNyumbaLogo, default as BossNyumbaLogoDefault } from './BossNyumbaLogo';
export type {
  BossNyumbaLogoProps,
  BossNyumbaLogoVariant,
  BossNyumbaLogoTone,
} from './BossNyumbaLogo';
export { BossNyumbaMark } from './BossNyumbaMark';
export type { BossNyumbaMarkProps } from './BossNyumbaMark';
export { resolveTone } from './tone';

// Backward-compatible adapters (kept for existing `Logomark`/`Wordmark`
// consumers; both now render the doorway-B glyph under the hood).
export { Logomark } from './logos/Logomark';
export type { LogomarkProps, LogomarkVariant } from './logos/Logomark';
export {
  Wordmark,
  WordmarkStacked,
  WordmarkOnly,
} from './logos/Wordmark';
export type { WordmarkProps, WordmarkSize } from './logos/Wordmark';

/** Brand constants used outside CSS (server-side PDFs, emails, OG images). */
export const BRAND = {
  name: 'BossNyumba',
  nameCompound: 'BossNyumba',
  meaningSw: 'head of the house',
  meaningEn: 'the master of the estate',
  tagline: 'The head of the house, amplified.',
  longTagline:
    'BossNyumba is the autonomous operating system for property portfolios. A brain that runs your estate on your authority.',
  shortTagline: 'Your estate brain.',

  colors: {
    // Deep ink near-black, light-mode text + dark-mode background
    ink:        '#1E140C',
    paper:      '#FBF7EE',
    // Warm amber — the one signal color
    signal:     '#E5B26B',
    signalDeep: '#B8873E',
    // Operator-mode background (a warm-shifted near-black)
    midnight:   '#17100A',
    // Warm off-white for dark-mode text
    bone:       '#F5EBD8',
  },

  typography: {
    display:  "'Fraunces', 'GT Alpina', 'Source Serif 4', Georgia, serif",
    sans:     "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono:     "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
  },
} as const;

export type BrandTokens = typeof BRAND;
