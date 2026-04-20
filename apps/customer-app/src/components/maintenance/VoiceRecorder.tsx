'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number;
}

export function VoiceRecorder({
  onRecordingComplete: _onRecordingComplete,
  maxDuration = 120,
}: VoiceRecorderProps) {
  const t = useTranslations('screenUnavailable');
  return (
    <LiveDataRequiredPanel
      title={t('voiceTitle')}
      message={t('voiceMessage', { duration: maxDuration })}
    />
  );
}
