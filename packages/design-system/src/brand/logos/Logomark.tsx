import * as React from 'react';
import { BossNyumbaMark } from '../BossNyumbaMark';

/**
 * Logomark — backward-compatible adapter over the canonical
 * `BossNyumbaMark` (the doorway-B glyph).
 *
 * Kept as a stable named export because ~20 consumers import
 * `{ Logomark }` from `@bossnyumba/design-system`. The two historical
 * fidelity modes map onto the new tone system:
 *
 *   - variant="premium" (default) → tone 'full'    (burnished-gold gradient,
 *                                                    bloom, specular — hero/app icon)
 *   - variant="flat"              → tone 'current'  (single `currentColor`
 *                                                    fill, so a `text-signal-500`
 *                                                    className keeps tinting it —
 *                                                    favicon, print, nav chrome)
 *
 * For new code prefer `BossNyumbaLogo` / `BossNyumbaMark` directly,
 * which expose the full variant + tone matrix.
 */

export type LogomarkVariant = 'flat' | 'premium';

export interface LogomarkProps extends React.SVGProps<SVGSVGElement> {
  readonly size?: number | string;
  readonly title?: string;
  readonly variant?: LogomarkVariant;
  /** Renders the rounded dark backdrop tile (square app-icon framing). */
  readonly withBackdrop?: boolean;
  /** Mark "lit" pulse. Defaults on for the premium (gradient) variant;
   *  pass false to freeze it. Honours prefers-reduced-motion. */
  readonly pulse?: boolean;
}

export const Logomark = React.forwardRef<SVGSVGElement, LogomarkProps>(
  function Logomark(
    { size = 24, title = 'BossNyumba', variant = 'premium', withBackdrop = false, ...rest },
    ref,
  ) {
    return (
      <BossNyumbaMark
        ref={ref}
        size={size}
        title={title}
        tone={variant === 'flat' ? 'current' : 'full'}
        withBackdrop={withBackdrop}
        {...rest}
      />
    );
  },
);
