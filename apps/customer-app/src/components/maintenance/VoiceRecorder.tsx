'use client';

import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number;
}

export function VoiceRecorder({
  onRecordingComplete: _onRecordingComplete,
  maxDuration = 120,
}: VoiceRecorderProps) {
  return (
    <LiveDataRequiredPanel
      title="Voice capture unavailable"
      message={`Simulated recording and transcription have been removed. Voice maintenance intake now requires a live recording and speech-to-text pipeline. Maximum configured duration remains ${maxDuration} seconds.`}
    />
  );
}
