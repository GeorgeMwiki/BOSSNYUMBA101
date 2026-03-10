'use client';

import { useEffect, type ElementType, type ReactElement } from 'react';
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
  useEffect(() => {
    if (!imageFile) {
      return;
    }

    onQualityResult(false, [
      {
        id: 'document-quality',
        label: 'Document Quality',
        status: 'fail',
        message: 'Live document quality analysis is not wired in this build.',
        icon: Eye,
      },
    ]);
  }, [imageFile, onQualityResult]);

  if (!imageFile) {
    return null;
  }

  return (
    <LiveDataRequiredPanel
      title="Document quality analysis unavailable"
      message="Simulated image-quality scoring has been removed. Document validation now requires a live OCR or vision service."
    />
  );
}
