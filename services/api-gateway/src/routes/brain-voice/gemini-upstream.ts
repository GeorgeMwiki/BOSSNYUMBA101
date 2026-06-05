/**
 * Gemini Live duplex upstream for the brain-voice bridge (Gap 7).
 *
 * Self-contained duplex client over the Node global WebSocket implementing the
 * BidiGenerateContent protocol. Extracted from brain-voice.hono.ts to keep
 * each file focused (<800 lines). Also owns the small, shared provider-facing
 * contracts the bridge + transport layers consume.
 *
 * Pure where it can be: `buildGeminiSetupFrame` and `routeGeminiServerFrame`
 * take no sockets and are unit-testable in isolation. `openGeminiUpstream`
 * owns the one piece of real I/O (the WebSocket) behind an injectable
 * `socketFactory` seam for tests.
 *
 * No console.log — Pino only. No mutation — every frame builder returns fresh
 * objects.
 */

import { Buffer } from 'node:buffer';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'brain-voice-upstream',
});

// ───────────────────────────────────────────────────────────────────────────
// Shared provider-facing contracts (consumed by the bridge + transport).
// ───────────────────────────────────────────────────────────────────────────

/** Voice locale — the brain persona enforces single-language purity. */
export type VoiceLocale = 'en' | 'sw';

/** A function-declaration the realtime model may call (OpenAPI-subset schema). */
export interface VoiceFunctionDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** A tool-call the model emitted. */
export interface VoiceToolCall {
  readonly callId?: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/** PCM/Opus chunk pushed up from the caller. */
export interface VoiceAudioChunk {
  readonly bytes: Uint8Array;
  readonly mimeType: 'audio/pcm' | 'audio/opus' | 'audio/wav';
  readonly sampleRate: 8000 | 16000 | 24000 | 48000;
}

/**
 * Events the bridge emits BACK toward the owner's browser. The transport layer
 * (the WS-upgrade adapter) serialises these to the client socket.
 */
export type BridgeOutboundEvent =
  | { readonly kind: 'ready'; readonly sessionId: string; readonly locale: VoiceLocale }
  | { readonly kind: 'audio'; readonly base64: string; readonly sampleRate: number; readonly isFinal: boolean }
  | { readonly kind: 'transcript'; readonly text: string; readonly isFinal: boolean; readonly speaker: 'user' | 'agent' }
  | { readonly kind: 'tool_call'; readonly name: string; readonly status: 'started' | 'ok' | 'error' }
  | { readonly kind: 'error'; readonly code: string; readonly message: string };

/** The minimal duplex upstream the bridge drives. */
export interface DuplexUpstream {
  readonly sessionId: string;
  pushAudio(chunk: VoiceAudioChunk): void;
  speakText(text: string): void;
  respondToToolCall(args: { callId?: string; name: string; output: Record<string, unknown> }): void;
  close(): void;
}

/** Minimal upstream WebSocket shape (matches the Node global `WebSocket`). */
interface UpstreamSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(event: string, listener: (evt: unknown) => void): void;
}

// ───────────────────────────────────────────────────────────────────────────
// Gemini Live upstream.
// ───────────────────────────────────────────────────────────────────────────

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-preview-native-audio';
const GEMINI_LIVE_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export interface UpstreamCallbacks {
  readonly onAudio: (base64: string, sampleRate: number, isFinal: boolean) => void;
  readonly onTranscript: (text: string, isFinal: boolean, speaker: 'user' | 'agent') => void;
  readonly onToolCall: (call: VoiceToolCall) => void;
  readonly onError: (code: string, message: string) => void;
  readonly onClose: () => void;
}

export interface OpenGeminiUpstreamArgs {
  readonly systemInstruction: string;
  readonly tools: ReadonlyArray<VoiceFunctionDeclaration>;
  readonly locale: VoiceLocale;
  readonly tenantId: string;
  readonly voiceName?: string;
  readonly callbacks: UpstreamCallbacks;
  /** Injectable for tests — defaults to the Node global WebSocket. */
  readonly socketFactory?: (url: string) => UpstreamSocket;
}

/**
 * Open a Gemini Live duplex session and wire its events to the callbacks.
 * Returns a `DuplexUpstream` the bridge drives. Throws when GEMINI_API_KEY is
 * absent (the caller surfaces `provider_unavailable` to the client).
 */
export function openGeminiUpstream(args: OpenGeminiUpstreamArgs): DuplexUpstream {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured — cannot open realtime upstream');
  }
  const model = process.env.GEMINI_VOICE_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  const sessionId = `gemini-live:${args.tenantId}:${args.locale}:${Date.now()}`;
  const factory = args.socketFactory ?? defaultUpstreamSocketFactory;
  const ws = factory(`${GEMINI_LIVE_BASE_URL}?key=${apiKey}`);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify(buildGeminiSetupFrame(model, args)));
  });
  ws.addEventListener('message', (evt: unknown) => {
    const frame = safeParseFrame((evt as { data?: unknown }).data);
    if (!frame) return;
    routeGeminiServerFrame(frame, sessionId, args.callbacks);
  });
  ws.addEventListener('error', (evt: unknown) => {
    const message = (evt as { message?: string }).message ?? 'unknown';
    args.callbacks.onError('upstream_websocket_error', `gemini-live: ${message}`);
  });
  ws.addEventListener('close', () => args.callbacks.onClose());

  return {
    sessionId,
    pushAudio(chunk: VoiceAudioChunk): void {
      if (ws.readyState !== 1) return;
      const base64 = Buffer.from(chunk.bytes).toString('base64');
      ws.send(
        JSON.stringify({
          realtimeInput: { mediaChunks: [{ mimeType: chunk.mimeType, data: base64 }] },
        }),
      );
    },
    speakText(text: string): void {
      if (ws.readyState !== 1) return;
      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          },
        }),
      );
    },
    respondToToolCall(toolArgs): void {
      if (ws.readyState !== 1) return;
      const fnResponse: Record<string, unknown> = {
        name: toolArgs.name,
        response: toolArgs.output,
      };
      if (toolArgs.callId !== undefined) fnResponse.id = toolArgs.callId;
      ws.send(JSON.stringify({ toolResponse: { functionResponses: [fnResponse] } }));
    },
    close(): void {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    },
  };
}

/** Build the Gemini Live `setup` frame (persona + tools + audio config). */
export function buildGeminiSetupFrame(
  model: string,
  args: Pick<OpenGeminiUpstreamArgs, 'systemInstruction' | 'tools' | 'voiceName'>,
): Record<string, unknown> {
  const setup: Record<string, unknown> = {
    model: `models/${model}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: args.voiceName ?? 'Aoede' },
        },
      },
    },
    systemInstruction: { parts: [{ text: args.systemInstruction }] },
  };
  if (args.tools.length > 0) {
    setup.tools = [{ functionDeclarations: args.tools.map((t) => ({ ...t })) }];
  }
  return { setup };
}

/** Narrow Gemini Live server-frame shape we consume. */
interface GeminiServerFrame {
  readonly serverContent?: {
    readonly modelTurn?: {
      readonly parts?: ReadonlyArray<{
        readonly inlineData?: { readonly mimeType?: string; readonly data?: string };
        readonly text?: string;
      }>;
    };
    readonly inputTranscription?: { readonly text?: string; readonly finished?: boolean };
    readonly outputTranscription?: { readonly text?: string; readonly finished?: boolean };
    readonly turnComplete?: boolean;
  };
  readonly toolCall?: {
    readonly functionCalls?: ReadonlyArray<{
      readonly id?: string;
      readonly name?: string;
      readonly args?: Record<string, unknown>;
    }>;
  };
  readonly error?: { readonly code?: number; readonly message?: string };
}

/**
 * Route one Gemini Live server frame to the bridge callbacks. Pure dispatch —
 * no socket I/O — so it is unit-testable in isolation.
 */
export function routeGeminiServerFrame(
  frame: GeminiServerFrame,
  _sessionId: string,
  cb: UpstreamCallbacks,
): void {
  if (frame.error) {
    cb.onError('upstream_error', `gemini-live: ${frame.error.message ?? 'error'}`);
    return;
  }
  for (const call of frame.toolCall?.functionCalls ?? []) {
    if (!call?.name) continue;
    const toolCall: VoiceToolCall = {
      name: call.name,
      args: (call.args ?? {}) as Record<string, unknown>,
    };
    cb.onToolCall(
      typeof call.id === 'string' ? { ...toolCall, callId: call.id } : toolCall,
    );
  }
  const sc = frame.serverContent;
  if (!sc) return;
  if (sc.inputTranscription?.text) {
    cb.onTranscript(sc.inputTranscription.text, sc.inputTranscription.finished === true, 'user');
  }
  if (sc.outputTranscription?.text) {
    cb.onTranscript(sc.outputTranscription.text, sc.outputTranscription.finished === true, 'agent');
  }
  for (const part of sc.modelTurn?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) cb.onAudio(data, 24000, false);
  }
  if (sc.turnComplete === true) cb.onAudio('', 24000, true);
}

function safeParseFrame(data: unknown): GeminiServerFrame | null {
  try {
    if (typeof data === 'string') return JSON.parse(data) as GeminiServerFrame;
    if (data instanceof Buffer) return JSON.parse(data.toString('utf8')) as GeminiServerFrame;
    if (data instanceof Uint8Array) return JSON.parse(Buffer.from(data).toString('utf8')) as GeminiServerFrame;
    return null;
  } catch {
    return null;
  }
}

function defaultUpstreamSocketFactory(url: string): UpstreamSocket {
  // Node ≥ 22 ships a global WebSocket (undici). Typed loosely because the
  // lib/types matrix varies; call sites narrow inside their own handlers.
  const WS = (globalThis as { WebSocket?: new (url: string) => unknown }).WebSocket;
  if (!WS) {
    logger.error('brain-voice-upstream: global WebSocket unavailable');
    throw new Error('global WebSocket unavailable; upgrade to Node >= 22 or inject a socketFactory');
  }
  return new WS(url) as UpstreamSocket;
}
