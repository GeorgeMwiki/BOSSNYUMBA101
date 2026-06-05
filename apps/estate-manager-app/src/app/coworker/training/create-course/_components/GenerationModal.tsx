'use client';

/**
 * GenerationModal — overlay shown while the brain (or the deterministic
 * sequencer) generates the course. Cycles descriptive stages so the wait feels
 * intentional; surfaces a clean error with a retry affordance. Single-language
 * per render. Respects prefers-reduced-motion (the spinner is the only motion).
 *
 * Ported from LitFin's AIGenerationModal, retargeted to BN's design system.
 */

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const STAGE_INTERVAL_MS = 2_600;
const STAGE_KEYS = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4'] as const;

interface GenerationModalProps {
  readonly isGenerating: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
}

export function GenerationModal({
  isGenerating,
  error,
  onRetry,
  onCancel,
}: GenerationModalProps): JSX.Element | null {
  const t = useTranslations('createCourse');
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isGenerating || error) return;
    const id = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, STAGE_KEYS.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isGenerating, error]);

  if (!isGenerating && !error) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {error ? (
          <div className="space-y-4 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-danger-600" />
            <div>
              <h3 id="generation-modal-title" className="text-base font-semibold text-gray-900">
                {t('generationErrorTitle')}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{error}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
              >
                {t('retry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="relative mx-auto h-12 w-12">
              <Sparkles className="h-12 w-12 text-sky-300" />
              <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-sky-500" />
            </div>
            <h3 id="generation-modal-title" className="text-base font-semibold text-gray-900">
              {t('generationTitle')}
            </h3>
            <p className="min-h-[2.5rem] text-sm text-gray-600">
              {t(STAGE_KEYS[stageIndex])}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
