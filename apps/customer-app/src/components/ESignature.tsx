'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PenLine, RotateCcw, Check, X } from 'lucide-react';

interface ESignatureProps {
  /** Called when signature is saved - returns base64 PNG data URL */
  onSave: (signatureDataUrl: string) => void;
  /** Called when signature is cleared */
  onClear?: () => void;
  /** Canvas width (default: 350) */
  width?: number;
  /** Canvas height (default: 150) */
  height?: number;
  /** Pen color */
  penColor?: string;
  /** Pen width */
  penWidth?: number;
  /** Whether to show as modal or inline */
  mode?: 'inline' | 'modal';
  /** For modal mode: controls visibility */
  isOpen?: boolean;
  /** For modal mode: close handler */
  onClose?: () => void;
  /** Title shown in modal mode */
  title?: string;
  /** Existing signature to display (base64 data URL) */
  existingSignature?: string | null;
  /** Disable interaction */
  disabled?: boolean;
}

export function ESignature({
  onSave,
  onClear,
  width = 350,
  height = 150,
  penColor = '#1e293b',
  penWidth = 2,
  mode = 'inline',
  isOpen = false,
  onClose,
  title = 'Draw Your Signature',
  existingSignature = null,
  disabled = false,
}: ESignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(
    existingSignature
  );

  // Initialize canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw guide line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, canvas.height - 30);
      ctx.lineTo(canvas.width - 20, canvas.height - 30);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reset pen style
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
    }
  }, [penColor, penWidth]);

  useEffect(() => {
    if (mode === 'inline' || isOpen) {
      // Small delay to ensure canvas is mounted
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [mode, isOpen, initCanvas]);

  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.nativeEvent.offsetX) * scaleX,
      y: (e.nativeEvent.offsetY) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && coords) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && coords) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      setHasDrawn(true);
    }
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    initCanvas();
    setHasDrawn(false);
    setSavedSignature(null);
    onClear?.();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      const dataUrl = canvas.toDataURL('image/png');
      setSavedSignature(dataUrl);
      onSave(dataUrl);
      if (mode === 'modal') {
        onClose?.();
      }
    }
  };

  const isCanvasBlank = (): boolean => {
    return !hasDrawn;
  };

  // ----- Render: Saved signature preview -----
  if (savedSignature && mode === 'inline') {
    return (
      <div className="space-y-2">
        <div className="border-2 border-success-200 rounded-lg overflow-hidden bg-success-50 p-2 relative">
          <img
            src={savedSignature}
            alt="Signature"
            className="w-full h-auto"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="badge-success text-xs flex items-center gap-1">
              <Check className="w-3 h-3" />
              Signed
            </span>
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clearSignature}
            className="btn-secondary text-sm w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Re-sign
          </button>
        )}
      </div>
    );
  }

  // ----- Render: Canvas drawing pad -----
  const canvasContent = (
    <div className="space-y-3">
      <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-xs text-gray-500 text-center">
        Sign using your finger or mouse in the box above
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={clearSignature}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
          disabled={!hasDrawn}
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={!hasDrawn}
        >
          <Check className="w-4 h-4" />
          Apply Signature
        </button>
      </div>
    </div>
  );

  // ----- Modal mode -----
  if (mode === 'modal') {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
        <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PenLine className="w-5 h-5 text-primary-600" />
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {canvasContent}
        </div>
        <style jsx>{`
          @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // ----- Inline mode -----
  return canvasContent;
}
