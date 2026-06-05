'use client';

/**
 * Training-mode context — drives an interactive scenario-simulation run.
 *
 * Mount point: /coworker/training/scenarios (gap 9).
 *
 * Holds the live session state for ONE scenario run: the transcript, the
 * objective-coverage the backend reports, the elapsed timer (decision-capture
 * timing), and the final score. Every server call goes through the api-client
 * `trainingScenariosService`, which targets the gateway's
 * /api/v1/scenarios/* routes.
 *
 * HONEST-DEGRADE: the gateway throws a typed `ApiClientError` on 503
 * (SERVICE_UNAVAILABLE) / 403 (FORBIDDEN_ROLE_MODE) / 404. Those surface here
 * as `state.error` with a machine-readable `state.errorCode` so the page can
 * render a graceful unavailable / locked state — never fabricated content.
 *
 * Admin-locked role-mode: the chosen `roleMode` is sent to the server, which
 * validates it against the scenario kind's allowlist. A client cannot
 * self-grant a mode; a rejected mode comes back as FORBIDDEN_ROLE_MODE.
 *
 * Ported (shape-only) from LitFin's officer-portal TrainingModeContext and
 * retargeted lending -> real estate.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  trainingScenariosService,
  type ScenarioView,
  type ScenarioRoleMode,
  type TurnReply,
} from '@bossnyumba/api-client';
import type { TrainingLanguage } from './training-language';

/** One transcript line in a run. `learner` is the operator; `counterparty` is the grounded reply. */
export interface TranscriptTurn {
  readonly id: string;
  readonly learner: string;
  readonly reply: TurnReply | null;
  readonly at: string;
}

export type SessionPhase = 'briefing' | 'active' | 'complete';

export interface TrainingState {
  readonly scenario: ScenarioView | null;
  readonly roleMode: ScenarioRoleMode | null;
  readonly sessionId: string | null;
  readonly phase: SessionPhase;
  readonly transcript: readonly TranscriptTurn[];
  readonly coveredConceptIds: readonly string[];
  readonly objectivesTotal: number;
  readonly objectivesCovered: number;
  readonly isSending: boolean;
  readonly isStarting: boolean;
  readonly elapsedMs: number;
  readonly score: number | null;
  readonly passed: boolean | null;
  /** Human-readable error (already localized by the caller-supplied messages). */
  readonly error: string | null;
  /** Machine-readable error code so the page can branch (e.g. SERVICE_UNAVAILABLE). */
  readonly errorCode: string | null;
}

const INITIAL_STATE: TrainingState = {
  scenario: null,
  roleMode: null,
  sessionId: null,
  phase: 'briefing',
  transcript: [],
  coveredConceptIds: [],
  objectivesTotal: 0,
  objectivesCovered: 0,
  isSending: false,
  isStarting: false,
  elapsedMs: 0,
  score: null,
  passed: null,
  error: null,
  errorCode: null,
};

type Action =
  | { readonly type: 'start_pending'; readonly scenario: ScenarioView; readonly roleMode: ScenarioRoleMode | null }
  | {
      readonly type: 'start_ok';
      readonly sessionId: string;
      readonly scenario: ScenarioView;
      readonly roleMode: ScenarioRoleMode;
      readonly objectivesTotal: number;
    }
  | { readonly type: 'send_pending'; readonly turn: TranscriptTurn }
  | {
      readonly type: 'send_ok';
      readonly reply: TurnReply | null;
      readonly coveredConceptIds: readonly string[];
      readonly objectivesTotal: number;
      readonly objectivesCovered: number;
    }
  | { readonly type: 'complete_ok'; readonly score: number; readonly passed: boolean }
  | { readonly type: 'tick'; readonly elapsedMs: number }
  | { readonly type: 'error'; readonly message: string; readonly code: string | null }
  | { readonly type: 'reset' };

function reducer(state: TrainingState, action: Action): TrainingState {
  switch (action.type) {
    case 'start_pending':
      return {
        ...INITIAL_STATE,
        scenario: action.scenario,
        roleMode: action.roleMode,
        isStarting: true,
      };
    case 'start_ok':
      return {
        ...state,
        sessionId: action.sessionId,
        scenario: action.scenario,
        roleMode: action.roleMode,
        objectivesTotal: action.objectivesTotal,
        phase: 'active',
        isStarting: false,
        error: null,
        errorCode: null,
      };
    case 'send_pending':
      return {
        ...state,
        transcript: [...state.transcript, action.turn],
        isSending: true,
        error: null,
        errorCode: null,
      };
    case 'send_ok': {
      const transcript = updateLastReply(state.transcript, action.reply);
      return {
        ...state,
        transcript,
        coveredConceptIds: action.coveredConceptIds,
        objectivesTotal: action.objectivesTotal,
        objectivesCovered: action.objectivesCovered,
        isSending: false,
      };
    }
    case 'complete_ok':
      return {
        ...state,
        phase: 'complete',
        score: action.score,
        passed: action.passed,
        isSending: false,
      };
    case 'tick':
      return { ...state, elapsedMs: action.elapsedMs };
    case 'error':
      return {
        ...state,
        isSending: false,
        isStarting: false,
        error: action.message,
        errorCode: action.code,
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

/** Attach the grounded reply to the most recent (optimistic) learner turn. */
function updateLastReply(
  transcript: readonly TranscriptTurn[],
  reply: TurnReply | null,
): readonly TranscriptTurn[] {
  if (transcript.length === 0) return transcript;
  return transcript.map((turn, i) =>
    i === transcript.length - 1 ? { ...turn, reply } : turn,
  );
}

export interface TrainingContextValue {
  readonly state: TrainingState;
  /** Start a run. Role-mode (if any) is validated server-side. */
  readonly start: (scenario: ScenarioView, roleMode: ScenarioRoleMode | null) => Promise<void>;
  /** Send a learner turn; the grounded counterparty reply streams back. */
  readonly send: (message: string, coveredConceptIds?: readonly string[]) => Promise<void>;
  /** Close the run with a final score in [0, 1]. */
  readonly complete: (score: number, notes?: string) => Promise<void>;
  /** Tear the run down (return to the browser). */
  readonly reset: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export interface TrainingProviderProps {
  readonly language: TrainingLanguage;
  /** Localized fallback used when a thrown error carries no message. */
  readonly genericErrorMessage: string;
  readonly children: ReactNode;
}

export function TrainingProvider({
  language,
  genericErrorMessage,
  children,
}: TrainingProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const startedAtRef = useRef<number | null>(null);

  // Decision-capture timer: tick once a second while a run is active. The
  // elapsed time is fed into the completion score so a fast, accurate run
  // scores better than a slow one.
  useEffect(() => {
    if (state.phase !== 'active') {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      dispatch({ type: 'tick', elapsedMs: Date.now() - startedAtRef.current });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  const toError = useCallback(
    (err: unknown): { message: string; code: string | null } => {
      const e = err as { message?: string; code?: string } | null;
      return {
        message: e?.message?.trim() ? e.message : genericErrorMessage,
        code: e?.code ?? null,
      };
    },
    [genericErrorMessage],
  );

  const start = useCallback(
    async (scenario: ScenarioView, roleMode: ScenarioRoleMode | null) => {
      dispatch({ type: 'start_pending', scenario, roleMode });
      try {
        const res = await trainingScenariosService.startSession(
          roleMode ? { scenarioId: scenario.id, roleMode } : { scenarioId: scenario.id },
        );
        const data = res.data;
        dispatch({
          type: 'start_ok',
          sessionId: data.sessionId,
          scenario: data.scenario,
          roleMode: data.roleMode,
          objectivesTotal: data.scenario.briefing.objectives?.length ?? 0,
        });
      } catch (err) {
        const { message, code } = toError(err);
        dispatch({ type: 'error', message, code });
      }
    },
    [toError],
  );

  const send = useCallback(
    async (message: string, coveredConceptIds?: readonly string[]) => {
      const sessionId = state.sessionId;
      if (!sessionId || state.isSending) return;
      const turn: TranscriptTurn = {
        id: `t-${Date.now()}`,
        learner: message,
        reply: null,
        at: new Date().toISOString(),
      };
      dispatch({ type: 'send_pending', turn });
      try {
        const res = await trainingScenariosService.turn(
          sessionId,
          coveredConceptIds && coveredConceptIds.length > 0
            ? { message, coveredConceptIds }
            : { message },
        );
        const data = res.data;
        dispatch({
          type: 'send_ok',
          reply: data.reply,
          coveredConceptIds: data.coveredConceptIds,
          objectivesTotal: data.objectivesTotal,
          objectivesCovered: data.objectivesCovered,
        });
      } catch (err) {
        const { message: m, code } = toError(err);
        dispatch({ type: 'error', message: m, code });
      }
    },
    [state.sessionId, state.isSending, toError],
  );

  const complete = useCallback(
    async (score: number, notes?: string) => {
      const sessionId = state.sessionId;
      if (!sessionId) return;
      try {
        const res = await trainingScenariosService.complete(
          sessionId,
          notes
            ? { score, coveredConceptIds: state.coveredConceptIds, notes }
            : { score, coveredConceptIds: state.coveredConceptIds },
        );
        dispatch({ type: 'complete_ok', score: res.data.score, passed: res.data.passed });
      } catch (err) {
        const { message, code } = toError(err);
        dispatch({ type: 'error', message, code });
      }
    },
    [state.sessionId, state.coveredConceptIds, toError],
  );

  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<TrainingContextValue>(
    () => ({ state, start, send, complete, reset }),
    [state, start, send, complete, reset],
  );

  // `language` is reserved for future grounded-reply locale selection; the
  // server already returns both en + sw on every reply so the consumer picks.
  void language;

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) {
    throw new Error('useTraining must be used within a <TrainingProvider>');
  }
  return ctx;
}
