'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { Check, RotateCcw } from 'lucide-react';

/**
 * SignaturePad — reusable canvas-based signature affordance.
 *
 * Wraps an HTMLCanvasElement with mouse + touch drawing handlers and
 * exposes Clear and Done buttons. Calls `onDone` with a base64 PNG data
 * URL. Keyboard users can clear via Backspace/Delete and confirm via
 * Enter/Space while the canvas has focus — see ARIA-aria-label.
 *
 * The `eSignature` component in this app is more opinionated (modal,
 * existing-signature preview, i18n labels). SignaturePad is the bare
 * primitive intended for embedding in inspection step, lease signing,
 * and ad-hoc capture flows where the parent owns layout/labels.
 */
export interface SignaturePadProps {
  onDone: (dataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
  className?: string;
  /** ARIA label for the canvas — defaults to a sensible English string. */
  ariaLabel?: string;
  /** Optional test id base; defaults to `signature-pad`. */
  testId?: string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

export function SignaturePad({
  onDone,
  onClear,
  width = 400,
  height = 180,
  penColor = '#0f172a',
  penWidth = 2.5,
  className,
  ariaLabel = 'Signature drawing area. Use mouse or touch to draw your signature.',
  testId = 'signature-pad',
}: SignaturePadProps): JSX.Element {
  const t = useTranslations('p89.signaturePad');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle baseline guide
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 28);
    ctx.lineTo(canvas.width - 20, canvas.height - 28);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [penColor, penWidth]);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  const getPoint = (
    evt: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in evt) {
      const touch = evt.touches[0] ?? evt.changedTouches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  };

  const startStroke = (
    evt: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>
  ) => {
    evt.preventDefault();
    const p = getPoint(evt);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const continueStroke = (
    evt: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    evt.preventDefault();
    const p = getPoint(evt);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const endStroke = (
    evt?: ReactMouseEvent<HTMLCanvasElement> | ReactTouchEvent<HTMLCanvasElement>
  ) => {
    evt?.preventDefault?.();
    setIsDrawing(false);
  };

  const handleClear = useCallback(() => {
    resetCanvas();
    setHasInk(false);
    onClear?.();
  }, [resetCanvas, onClear]);

  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onDone(dataUrl);
    } catch (err) {
      // toDataURL can throw on tainted canvases; surface a sensible error
      console.error('SignaturePad export failed', err);
    }
  }, [hasInk, onDone]);

  const handleKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleClear();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && hasInk) {
      e.preventDefault();
      handleDone();
    }
  };

  return (
    <div
      className={`space-y-3 ${className ?? ''}`}
      data-testid={testId}
      role="group"
      aria-label={t('padAria')}
    >
      <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white focus-within:border-primary-500 transition-colors">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          data-testid={`${testId}-canvas`}
          className="w-full h-auto touch-none cursor-crosshair outline-none"
          onMouseDown={startStroke}
          onMouseMove={continueStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={startStroke}
          onTouchMove={continueStroke}
          onTouchEnd={endStroke}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p className="text-xs text-gray-500 text-center">
        Draw your signature in the box above using your finger or mouse.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasInk}
          data-testid={`${testId}-clear`}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('clearAria')}
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleDone}
          disabled={!hasInk}
          data-testid={`${testId}-done`}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('confirmAria')}
        >
          <Check className="w-4 h-4" />
          Done
        </button>
      </div>
    </div>
  );
}

export default SignaturePad;
