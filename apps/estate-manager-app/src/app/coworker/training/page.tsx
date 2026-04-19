'use client';

/**
 * Coworker — Training Mode
 *
 * Same chat-ui pedagogical shell as the other portals, scoped to the
 * signed-in estate-manager coworker. Persona stays 'coworker'; the API
 * route appends the verified employee id server-side.
 *
 * Mount point: /coworker/training
 */
import { useCallback, useMemo, useState } from 'react';
import {
  AdaptiveRenderer,
  Blackboard,
  TeachingModeLayout,
  QuizLockdownOverlay,
  ReviewModeSummary,
  DiscussionModeLayout,
  ClassroomChatAdapter,
  detectModeFromResponse,
  generateBlocks,
  INITIAL_CHAT_MODE_STATE,
  type AdaptiveMessageMetadata,
  type ChatMode,
  type ChatModeState,
  type TeachingModeData,
  type QuizLockdownData,
  type ReviewModeData,
  type DiscussionModeData,
  type ClassroomModeData,
} from '@bossnyumba/chat-ui';

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly metadata?: AdaptiveMessageMetadata;
}

export default function CoworkerTrainingPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [modeState, setModeState] = useState<ChatModeState>(INITIAL_CHAT_MODE_STATE);
  const [loading, setLoading] = useState(false);

  const classroom: ClassroomModeData = useMemo(
    () => ({
      sessionId: 'solo',
      sessionCode: 'SOLO',
      participants: [],
      currentPhase: 'training',
      isRecording: false,
      moderatorIsObserver: false,
      maxParticipants: 1,
    }),
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setLoading(true);
      try {
        const response = await fetch('/api/v1/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: 'coworker', forcePersonaId: 'coworker', message: text }),
        });
        const data = (await response.json()) as {
          readonly text?: string;
          readonly toolCalls?: readonly string[];
          readonly metadata?: AdaptiveMessageMetadata;
        };
        const assistantText = data.text ?? '';
        const toolCalls = data.toolCalls ?? [];
        const detection = detectModeFromResponse({
          responseText: assistantText,
          toolCalls,
          currentMode: modeState.mode,
          isGroupSession: false,
          sessionMessageCount: nextMessages.length,
        });
        const generatedBlocks =
          !data.metadata?.uiBlocks || data.metadata.uiBlocks.length === 0
            ? generateBlocks({ responseText: assistantText, toolCalls })
            : data.metadata.uiBlocks;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
          metadata: { ...(data.metadata ?? {}), uiBlocks: generatedBlocks },
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setModeState((prev) => applyMode(prev, detection.suggestedMode, detection.reason));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('CoworkerTraining error', error);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, modeState.mode],
  );

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );

  const chat = (
    <div>
      {modeState.mode === 'teaching' && modeState.teachingData && (
        <TeachingModeLayout data={modeState.teachingData} language="en" />
      )}
      {modeState.mode === 'review' && modeState.reviewData && (
        <ReviewModeSummary data={modeState.reviewData} language="en" />
      )}
      {modeState.mode === 'discussion' && modeState.discussionData && (
        <DiscussionModeLayout data={modeState.discussionData} language="en" />
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m) => (
          <li
            key={m.id}
            style={{ background: m.role === 'user' ? '#dbeafe' : '#fff', padding: 12, borderRadius: 12 }}
          >
            <div style={{ fontSize: 11, color: '#64748b' }}>{m.role}</div>
            <div style={{ fontSize: 14, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{m.text}</div>
            {m.metadata && (
              <AdaptiveRenderer metadata={m.metadata} language="en" onSendMessage={sendMessage} />
            )}
          </li>
        ))}
      </ul>
      {modeState.mode === 'quiz' && modeState.quizData && (
        <QuizLockdownOverlay
          data={modeState.quizData}
          language="en"
          onAnswer={() => undefined}
          onTimeUp={() => setModeState((prev) => applyMode(prev, 'teaching', 'time up'))}
          onModeRevert={(m) => setModeState((prev) => applyMode(prev, m, 'quiz answered'))}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about tenancy risk, arrears, maintenance workflows …"
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none' }}
        >
          Send
        </button>
      </form>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Coworker — Training</h1>
        {modeState.mode === 'classroom' ? (
          <ClassroomChatAdapter data={classroom} mode={modeState.mode} language="en">
            {chat}
          </ClassroomChatAdapter>
        ) : (
          chat
        )}
      </div>
      <aside>
        <Blackboard language="en" conceptTitle={modeState.teachingData?.conceptName}>
          {lastAssistant?.metadata?.uiBlocks && lastAssistant.metadata.uiBlocks.length > 0 && (
            <AdaptiveRenderer metadata={lastAssistant.metadata} language="en" />
          )}
        </Blackboard>
      </aside>
    </div>
  );
}

function applyMode(prev: ChatModeState, mode: ChatMode, reason: string): ChatModeState {
  if (prev.mode === mode) return prev;
  const transition = {
    from: prev.mode,
    to: mode,
    reason,
    triggeredBy: 'ai' as const,
    timestamp: new Date().toISOString(),
  };
  const defaults = defaultDataFor(mode);
  return {
    ...prev,
    mode,
    transitionHistory: [...prev.transitionHistory, transition],
    teachingData: mode === 'teaching' ? prev.teachingData ?? defaults.teachingData ?? null : prev.teachingData,
    quizData: mode === 'quiz' ? prev.quizData ?? defaults.quizData ?? null : prev.quizData,
    reviewData: mode === 'review' ? prev.reviewData ?? defaults.reviewData ?? null : prev.reviewData,
    discussionData: mode === 'discussion' ? prev.discussionData ?? defaults.discussionData ?? null : prev.discussionData,
    quizLockdown: mode === 'quiz',
  };
}

function defaultDataFor(mode: ChatMode): {
  readonly teachingData?: TeachingModeData;
  readonly quizData?: QuizLockdownData;
  readonly reviewData?: ReviewModeData;
  readonly discussionData?: DiscussionModeData;
} {
  if (mode === 'teaching') {
    return {
      teachingData: {
        conceptId: 'intro',
        conceptName: 'Estate concept',
        conceptNameSw: null,
        bloomLevel: 'understand',
        keyPoints: [],
        keyPointsSw: [],
        conceptIndex: 0,
        totalConcepts: 1,
        isStreaming: false,
      },
    };
  }
  if (mode === 'review') {
    return {
      reviewData: {
        overallScore: 0,
        masteryDelta: 0,
        conceptsCovered: 0,
        quizAccuracy: 0,
        bloomLevelReached: 'understand',
        misconceptionsAddressed: 0,
        recommendedNextConcepts: [],
        recommendedReviewDate: null,
      },
    };
  }
  if (mode === 'discussion') {
    return {
      discussionData: {
        topic: 'Estate management',
        topicSw: null,
        replies: [],
        handRaisedCount: 0,
      },
    };
  }
  return {};
}
