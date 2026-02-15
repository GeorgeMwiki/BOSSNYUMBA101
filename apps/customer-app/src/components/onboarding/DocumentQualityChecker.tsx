'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sun,
  Focus,
  Maximize,
  Eye,
  RefreshCw,
} from 'lucide-react';

export interface QualityCheck {
  id: string;
  label: string;
  status: 'checking' | 'pass' | 'warning' | 'fail';
  message?: string;
  icon: React.ElementType;
}

interface DocumentQualityCheckerProps {
  imageFile: File | null;
  onQualityResult: (passes: boolean, checks: QualityCheck[]) => void;
}

export function DocumentQualityChecker({
  imageFile,
  onQualityResult,
}: DocumentQualityCheckerProps) {
  const [checks, setChecks] = useState<QualityCheck[]>([
    { id: 'brightness', label: 'Brightness', status: 'checking', icon: Sun },
    { id: 'focus', label: 'Image Clarity', status: 'checking', icon: Focus },
    { id: 'size', label: 'Document Size', status: 'checking', icon: Maximize },
    { id: 'readability', label: 'Text Readable', status: 'checking', icon: Eye },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallScore, setOverallScore] = useState<number | null>(null);

  useEffect(() => {
    if (!imageFile) return;

    const analyzeImage = async () => {
      setIsAnalyzing(true);
      setChecks((prev) =>
        prev.map((c) => ({ ...c, status: 'checking' as const }))
      );

      // Create image element to analyze
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const reader = new FileReader();
      reader.onload = async (e) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);

          // Simulate quality checks with realistic delays
          const results: QualityCheck[] = [];

          // Check 1: Image size/resolution
          await new Promise((r) => setTimeout(r, 500));
          const sizeCheck: QualityCheck = {
            id: 'size',
            label: 'Document Size',
            icon: Maximize,
            status: img.width >= 800 && img.height >= 600 ? 'pass' : 'warning',
            message:
              img.width >= 800 && img.height >= 600
                ? 'Good resolution'
                : 'Low resolution - try moving closer',
          };
          results.push(sizeCheck);
          setChecks((prev) =>
            prev.map((c) => (c.id === 'size' ? sizeCheck : c))
          );

          // Check 2: Brightness analysis
          await new Promise((r) => setTimeout(r, 400));
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          let brightness = 0;
          if (imageData) {
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
            brightness = brightness / (data.length / 4);
          }

          const brightnessCheck: QualityCheck = {
            id: 'brightness',
            label: 'Brightness',
            icon: Sun,
            status:
              brightness > 50 && brightness < 220
                ? 'pass'
                : brightness <= 50
                ? 'fail'
                : 'warning',
            message:
              brightness > 50 && brightness < 220
                ? 'Good lighting'
                : brightness <= 50
                ? 'Image too dark - add more light'
                : 'Image too bright - reduce glare',
          };
          results.push(brightnessCheck);
          setChecks((prev) =>
            prev.map((c) => (c.id === 'brightness' ? brightnessCheck : c))
          );

          // Check 3: Focus/Blur detection (simulated)
          await new Promise((r) => setTimeout(r, 600));
          // In production, would use edge detection or ML
          const focusScore = Math.random() * 0.4 + 0.6; // 60-100% for demo
          const focusCheck: QualityCheck = {
            id: 'focus',
            label: 'Image Clarity',
            icon: Focus,
            status: focusScore > 0.7 ? 'pass' : focusScore > 0.5 ? 'warning' : 'fail',
            message:
              focusScore > 0.7
                ? 'Sharp and clear'
                : focusScore > 0.5
                ? 'Slightly blurry - hold steady'
                : 'Too blurry - retake photo',
          };
          results.push(focusCheck);
          setChecks((prev) =>
            prev.map((c) => (c.id === 'focus' ? focusCheck : c))
          );

          // Check 4: Text readability (simulated)
          await new Promise((r) => setTimeout(r, 500));
          const readabilityScore = Math.random() * 0.3 + 0.7; // 70-100% for demo
          const readabilityCheck: QualityCheck = {
            id: 'readability',
            label: 'Text Readable',
            icon: Eye,
            status:
              readabilityScore > 0.8
                ? 'pass'
                : readabilityScore > 0.6
                ? 'warning'
                : 'fail',
            message:
              readabilityScore > 0.8
                ? 'All text is readable'
                : readabilityScore > 0.6
                ? 'Some text may be unclear'
                : 'Text not readable - retake',
          };
          results.push(readabilityCheck);
          setChecks((prev) =>
            prev.map((c) => (c.id === 'readability' ? readabilityCheck : c))
          );

          // Calculate overall score
          const passCount = results.filter((r) => r.status === 'pass').length;
          const warningCount = results.filter((r) => r.status === 'warning').length;
          const failCount = results.filter((r) => r.status === 'fail').length;

          const score = Math.round(
            ((passCount * 100 + warningCount * 60) / results.length)
          );
          setOverallScore(score);

          // Determine if quality passes
          const passes = failCount === 0 && warningCount <= 1;
          onQualityResult(passes, results);
          setIsAnalyzing(false);
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(imageFile);
    };

    analyzeImage();
  }, [imageFile, onQualityResult]);

  const getStatusIcon = (status: QualityCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-success-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-danger-600" />;
      default:
        return (
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        );
    }
  };

  const getStatusColor = (status: QualityCheck['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-success-50 border-success-200';
      case 'warning':
        return 'bg-warning-50 border-warning-200';
      case 'fail':
        return 'bg-danger-50 border-danger-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getOverallColor = () => {
    if (overallScore === null) return 'text-gray-400';
    if (overallScore >= 80) return 'text-success-600';
    if (overallScore >= 60) return 'text-warning-600';
    return 'text-danger-600';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Quality Check</h4>
        {overallScore !== null && (
          <div className={`text-sm font-semibold ${getOverallColor()}`}>
            {overallScore}% Quality Score
          </div>
        )}
      </div>

      <div className="space-y-2">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div
              key={check.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getStatusColor(
                check.status
              )}`}
            >
              <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{check.label}</div>
                {check.message && (
                  <div className="text-xs text-gray-500">{check.message}</div>
                )}
              </div>
              {getStatusIcon(check.status)}
            </div>
          );
        })}
      </div>

      {isAnalyzing && (
        <p className="text-xs text-gray-500 text-center">
          Analyzing document quality...
        </p>
      )}
    </div>
  );
}
