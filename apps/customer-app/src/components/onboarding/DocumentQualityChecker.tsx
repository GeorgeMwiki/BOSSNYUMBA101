'use client';

import { useEffect, type ElementType, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export interface QualityCheck {
  id: string;
  label: string;
  status: 'checking' | 'pass' | 'warning' | 'fail';
  message?: string;
  icon: ElementType;
}

interface DocumentQualityCheckerProps {
  imageFile: File | null;
  onQualityResult: (passes: boolean, checks: QualityCheck[]) => void;
}

export function DocumentQualityChecker({
  imageFile,
  onQualityResult,
}: DocumentQualityCheckerProps): ReactElement | null {
  const t = useTranslations('screenUnavailable');
  const tP89 = useTranslations('p89.docQuality');
  useEffect(() => {
    if (!imageFile) {
      return;
    }

    onQualityResult(false, [
      {
        id: 'document-quality',
        label: tP89('label'),
        status: 'fail',
        message: 'Live document quality analysis is not wired in this build.',
        icon: Eye,
      },
    ]);
  }, [imageFile, onQualityResult, tP89]);

  if (!imageFile) {
    return null;
  }

  return (
    <LiveDataRequiredPanel
      title={t('qualityAnalysisTitle')}
      message="Simulated image-quality scoring has been removed. Document validation now requires a live OCR or vision service."
    />
  );
}
