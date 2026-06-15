import React, { useMemo } from 'react';
import { encodeQr, qrMatrixToSvgPath } from '../lib/qr';

interface QrCodeProps {
  /** The payload to encode — e.g. an `otpauth://` enrollment URI. */
  value: string;
  /** Rendered pixel size of the square. Defaults to 200. */
  size?: number;
  className?: string;
}

/**
 * Client-side QR renderer. Encodes `value` into a QR matrix locally (no
 * external QR-image service, so a TOTP secret never leaves the browser) and
 * draws it as crisp inline SVG. A quiet zone of 4 modules is included per the
 * spec so authenticator apps reliably detect the symbol.
 */
export function QrCode({ value, size = 200, className }: QrCodeProps) {
  const rendered = useMemo(() => {
    try {
      const matrix = encodeQr(value);
      return qrMatrixToSvgPath(matrix);
    } catch {
      return null;
    }
  }, [value]);

  if (!rendered) {
    return (
      <div
        role="img"
        aria-label="QR code unavailable"
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }

  const quiet = 4;
  const view = rendered.size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label="Two-factor authentication enrollment QR code"
      width={size}
      height={size}
      viewBox={`0 0 ${view} ${view}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={0} y={0} width={view} height={view} fill="#ffffff" />
      <path d={rendered.path} transform={`translate(${quiet} ${quiet})`} fill="#000000" />
    </svg>
  );
}
