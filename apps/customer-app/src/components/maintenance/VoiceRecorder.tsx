'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number; // in seconds
}

export function VoiceRecorder({ onRecordingComplete, maxDuration = 120 }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        
        // Simulate transcription
        simulateTranscription();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const simulateTranscription = async () => {
    setTranscribing(true);
    // Simulate API call for transcription
    await new Promise((r) => setTimeout(r, 2000));
    setTranscription(
      'This is a simulated transcription of your voice message. In production, this would use speech-to-text API for Swahili/English.'
    );
    setTranscribing(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setTranscription(null);
  };

  const confirmRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If we have a recording, show the playback UI
  if (audioBlob && audioUrl) {
    return (
      <div className="space-y-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />

        {/* Playback Controls */}
        <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-xl">
          <button
            onClick={togglePlayback}
            className="w-12 h-12 bg-primary-500 text-white rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Waveform placeholder */}
          <div className="flex-1 h-10 flex items-center gap-0.5">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-primary-300 rounded-full"
                style={{
                  height: `${Math.random() * 100}%`,
                  minHeight: '20%',
                }}
              />
            ))}
          </div>

          <span className="text-sm font-mono text-gray-600">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Transcription */}
        {transcribing && (
          <div className="p-4 bg-primary-50 rounded-xl">
            <div className="flex items-center gap-2 text-primary-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Transcribing...</span>
            </div>
          </div>
        )}

        {transcription && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-xs text-gray-500 mb-1">Transcription</div>
            <p className="text-sm text-gray-700">{transcription}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={discardRecording}
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Discard
          </button>
          <button
            onClick={confirmRecording}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Use Recording
          </button>
        </div>
      </div>
    );
  }

  // Recording UI
  return (
    <div className="text-center space-y-4">
      {/* Recording Circle */}
      <div className="relative inline-flex">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-danger-500 hover:bg-danger-600 scale-110 animate-pulse'
              : 'bg-primary-500 hover:bg-primary-600'
          }`}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>

        {/* Duration ring */}
        {isRecording && (
          <svg className="absolute inset-0 w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="4"
            />
            <circle
              cx="48"
              cy="48"
              r="46"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray={289}
              strokeDashoffset={289 - (duration / maxDuration) * 289}
              className="transition-all duration-1000"
            />
          </svg>
        )}
      </div>

      {/* Status Text */}
      <div>
        {isRecording ? (
          <div className="space-y-1">
            <p className="text-lg font-semibold text-danger-600">
              Recording... {formatDuration(duration)}
            </p>
            <p className="text-sm text-gray-500">
              Tap to stop ({formatDuration(maxDuration - duration)} remaining)
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium text-gray-900">Tap to record</p>
            <p className="text-sm text-gray-500">
              Describe your issue in Swahili or English
            </p>
          </div>
        )}
      </div>

      {/* Tips */}
      {!isRecording && (
        <div className="text-left p-4 bg-gray-50 rounded-xl text-sm text-gray-600">
          <p className="font-medium mb-2">Tips for a good recording:</p>
          <ul className="space-y-1 text-xs">
            <li>• Speak clearly and at normal pace</li>
            <li>• Describe what&apos;s wrong and where it&apos;s located</li>
            <li>• Mention when the issue started</li>
            <li>• Include any relevant details</li>
          </ul>
        </div>
      )}
    </div>
  );
}
