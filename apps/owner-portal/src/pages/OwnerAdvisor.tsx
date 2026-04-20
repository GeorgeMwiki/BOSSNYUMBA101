/**
 * OwnerAdvisor — streams SSE from /api/v1/ai/chat.
 *
 * Mount point: /owner/advisor
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdaptiveRenderer,
  Blackboard,
  TeachingModeLayout,
  QuizLockdownOverlay,
  ReviewModeSummary,
  detectModeFromResponse,
  generateBlocks,
  useChatStream,
  INITIAL_CHAT_MODE_STATE,
  type AdaptiveMessageMetadata,
  type ChatMode,
  type ChatModeState,
  type TeachingModeData,
  type QuizLockdownData,
  type ReviewModeData,
} from '@bossnyumba/chat-ui';

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly metadata?: AdaptiveMessageMetadata;
  readonly isStreaming?: boolean;
}

export default function OwnerAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [modeState, setModeState] = useState<ChatModeState>(INITIAL_CHAT_MODE_STATE);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);

  const { state, sendMessage: sendStream, cancel, approveAction, rejectAction } = useChatStream(
    'owner-advisor',
    {
      endpoint: '/api/v1/ai/chat',
      onEvent: (evt) => {
        if (evt.type === 'turn_end' && activeAssistantId) {
          const text = state.assistantText;
          const toolCalls = state.toolCalls.map((t) => t.name);
          const detection = detectModeFromResponse({
            responseText: text,
            toolCalls,
            currentMode: modeState.mode,
            isGroupSession: false,
            sessionMessageCount: messages.length,
          });
          const blocks = generateBlocks({ responseText: text, toolCalls });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantId
                ? { ...m, text, metadata: { uiBlocks: blocks }, isStreaming: false }
                : m,
            ),
          );
          setModeState((prev) => applyMode(prev, detection.suggestedMode, detection.reason));
        }
      },
    },
  );

  useEffect(() => {
    if (!state.isStreaming || !activeAssistantId) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === activeAssistantId ? { ...m, text: state.assistantText, isStreaming: true } : m,
      ),
    );
  }, [state.assistantText, state.isStreaming, activeAssistantId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || state.isStreaming) return;
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '', isStreaming: true }]);
      setActiveAssistantId(assistantId);
      setInput('');
      await sendStream(text, { forcePersonaId: 'owner-advisor' });
    },
    [state.isStreaming, sendStream],
  );

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 16, padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Owner Advisor</h1>

        {modeState.mode === 'teaching' && modeState.teachingData && (
          <TeachingModeLayout data={modeState.teachingData} language="en" />
        )}
        {modeState.mode === 'review' && modeState.reviewData && (
          <ReviewModeSummary data={modeState.reviewData} language="en" />
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m) => (
            <li
              key={m.id}
              style={{ background: m.role === 'user' ? '#dbeafe' : '#fff', padding: 12, borderRadius: 12 }}
            >
              <div style={{ fontSize: 11, color: '#64748b' }}>{m.role}</div>
              <div style={{ fontSize: 14, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                {m.text}
                {m.isStreaming && <span style={{ color: '#64748b' }}> …</span>}
              </div>
              {m.metadata && (
                <AdaptiveRenderer metadata={m.metadata} language="en" onSendMessage={sendMessage} />
              )}
            </li>
          ))}
          {state.isStreaming && <li style={{ color: '#64748b', fontSize: 12 }}>Typing…</li>}
          {state.toolCalls.length > 0 && (
            <li style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.toolCalls.map((t, i) => (
                <span
                  key={`${t.name}-${i}`}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: t.ok === false ? '#fee2e2' : '#ecfdf5',
                    color: t.ok === false ? '#991b1b' : '#065f46',
                  }}
                >
                  {t.ok === undefined ? 'running' : t.ok ? 'ok' : 'fail'}: {t.name}
                </span>
              ))}
            </li>
          )}
          {state.proposedAction && !state.proposedAction.decision && (
            <li style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 6 }}>
                Proposed ({state.proposedAction.risk}): {state.proposedAction.description}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={approveAction}
                  style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6 }}
                >
                  Approve
                </button>
                <button
                  onClick={rejectAction}
                  style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6 }}
                >
                  Reject
                </button>
              </div>
            </li>
          )}
          {state.error && <li style={{ color: '#991b1b', fontSize: 12 }}>Error: {state.error}</li>}
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
            placeholder="Ask about my portfolio, arrears, property comparisons …"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          />
          {state.isStreaming ? (
            <button
              type="button"
              onClick={cancel}
              style={{ padding: '8px 14px', background: '#ef4444', color: '#fff', borderRadius: 8, border: 'none' }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none' }}
            >
              Send
            </button>
          )}
        </form>
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
  const transition = { from: prev.mode, to: mode, reason, triggeredBy: 'ai' as const, timestamp: new Date().toISOString() };
  const defaults = defaultDataFor(mode);
  return {
    ...prev,
    mode,
    transitionHistory: [...prev.transitionHistory, transition],
    teachingData: mode === 'teaching' ? prev.teachingData ?? defaults.teachingData ?? null : prev.teachingData,
    quizData: mode === 'quiz' ? prev.quizData ?? defaults.quizData ?? null : prev.quizData,
    reviewData: mode === 'review' ? prev.reviewData ?? defaults.reviewData ?? null : prev.reviewData,
    quizLockdown: mode === 'quiz',
  };
}

function defaultDataFor(mode: ChatMode): {
  readonly teachingData?: TeachingModeData;
  readonly quizData?: QuizLockdownData;
  readonly reviewData?: ReviewModeData;
} {
  if (mode === 'teaching') {
    return {
      teachingData: {
        conceptId: 'intro',
        conceptName: 'Portfolio concept',
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
  return {};
}
