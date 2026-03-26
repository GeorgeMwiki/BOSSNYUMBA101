'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number;
}

export function VoiceRecorder({
  onRecordingComplete,
  maxDuration = 120,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob, duration);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= maxDuration) {
            stopRecording();
            return d + 1;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  }, [maxDuration, onRecordingComplete, duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-gray-800 rounded-xl">
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-medium">{formatTime(duration)}</span>
          <span className="text-gray-400 text-xs">/ {formatTime(maxDuration)}</span>
        </div>
      )}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-4 rounded-full transition-colors ${
          isRecording
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-violet-600 hover:bg-violet-700'
        }`}
      >
        {isRecording ? (
          <Square className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </button>
      <p className="text-gray-400 text-xs">
        {isRecording ? 'Tap to stop recording' : 'Tap to record a voice note'}
      </p>
    </div>
  );
}
