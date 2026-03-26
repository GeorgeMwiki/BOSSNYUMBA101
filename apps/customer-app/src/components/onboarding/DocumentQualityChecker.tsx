'use client';

import { useEffect, type ElementType, type ReactElement } from 'react';
import { Eye, CheckCircle, AlertTriangle, FileImage } from 'lucide-react';

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
    if (!imageFile) return;

    const checks: QualityCheck[] = [];

    // Check file size (> 50KB is good, > 10MB is too large)
    const fileSizeKB = imageFile.size / 1024;
    if (fileSizeKB < 50) {
      checks.push({
        id: 'file-size',
        label: 'File Size',
        status: 'fail',
        message: 'File is too small. Please upload a clearer image.',
        icon: AlertTriangle,
      });
    } else if (fileSizeKB > 10240) {
      checks.push({
        id: 'file-size',
        label: 'File Size',
        status: 'warning',
        message: 'File is very large. It may take longer to upload.',
        icon: AlertTriangle,
      });
    } else {
      checks.push({
        id: 'file-size',
        label: 'File Size',
        status: 'pass',
        message: `${fileSizeKB < 1024 ? `${Math.round(fileSizeKB)} KB` : `${(fileSizeKB / 1024).toFixed(1)} MB`}`,
        icon: CheckCircle,
      });
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (validTypes.includes(imageFile.type)) {
      checks.push({
        id: 'file-type',
        label: 'File Format',
        status: 'pass',
        message: imageFile.type.split('/')[1].toUpperCase(),
        icon: FileImage,
      });
    } else {
      checks.push({
        id: 'file-type',
        label: 'File Format',
        status: 'fail',
        message: 'Unsupported format. Please use JPEG, PNG, WebP, or PDF.',
        icon: AlertTriangle,
      });
    }

    // Check image dimensions if it's an image
    if (imageFile.type.startsWith('image/')) {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      img.onload = () => {
        if (img.width < 300 || img.height < 300) {
          checks.push({
            id: 'resolution',
            label: 'Resolution',
            status: 'warning',
            message: `${img.width}×${img.height}px — may be too small to read clearly.`,
            icon: Eye,
          });
        } else {
          checks.push({
            id: 'resolution',
            label: 'Resolution',
            status: 'pass',
            message: `${img.width}×${img.height}px`,
            icon: Eye,
          });
        }
        URL.revokeObjectURL(url);
        const passes = checks.every((c) => c.status !== 'fail');
        onQualityResult(passes, checks);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        checks.push({
          id: 'resolution',
          label: 'Resolution',
          status: 'warning',
          message: 'Could not verify image dimensions.',
          icon: Eye,
        });
        const passes = checks.every((c) => c.status !== 'fail');
        onQualityResult(passes, checks);
      };
      img.src = url;
    } else {
      // PDF or non-image — skip resolution check
      const passes = checks.every((c) => c.status !== 'fail');
      onQualityResult(passes, checks);
    }
  }, [imageFile, onQualityResult]);

  if (!imageFile) return null;

  return null; // Results are communicated via onQualityResult callback
}
