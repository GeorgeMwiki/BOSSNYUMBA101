/**
 * Jarvis prefill contract.
 *
 * Surfaces like /skills ("Create new Skill") and /plan ("Propose new item",
 * "Discuss with MD") let the owner jump into the Jarvis chat with the input
 * pre-filled. The Jarvis composer lives on its own route (`/jarvis`), so the
 * prefill travels as react-router location state — a deterministic handoff
 * with no window-event timing race and no listener-less dispatch.
 *
 * The consumer (`pages/Jarvis.tsx`) reads `JARVIS_PREFILL_STATE_KEY` off
 * `location.state`, seeds its draft once, and (when `autoSubmit`) sends.
 */
import type { NavigateOptions } from 'react-router-dom';
import { ROUTES } from './routes';

/** The shape carried in react-router location state. */
export interface JarvisPrefill {
  /** Text to drop into the Jarvis composer. */
  readonly prompt: string;
  /** When true, the prefilled prompt is sent immediately; otherwise it
   *  only seeds the input so the owner can edit before sending. */
  readonly autoSubmit: boolean;
}

/** Location-state key under which the prefill is carried to /jarvis. */
export const JARVIS_PREFILL_STATE_KEY = 'jarvisPrefill' as const;

/** Location-state object understood by the Jarvis route. */
export interface JarvisPrefillState {
  readonly [JARVIS_PREFILL_STATE_KEY]?: JarvisPrefill;
}

/**
 * Build the `(to, options)` pair for navigating to Jarvis with a prefill.
 * Use as `navigate(...openJarvisWithPrefill(prompt))`.
 */
export function openJarvisWithPrefill(
  prompt: string,
  autoSubmit = false,
): readonly [string, NavigateOptions] {
  const state: JarvisPrefillState = {
    [JARVIS_PREFILL_STATE_KEY]: { prompt, autoSubmit },
  };
  return [ROUTES.jarvis, { state }] as const;
}

/** Read + narrow a prefill off an unknown react-router location state. */
export function readJarvisPrefill(
  locationState: unknown,
): JarvisPrefill | null {
  if (!locationState || typeof locationState !== 'object') return null;
  const candidate = (locationState as JarvisPrefillState)[
    JARVIS_PREFILL_STATE_KEY
  ];
  if (
    candidate &&
    typeof candidate.prompt === 'string' &&
    typeof candidate.autoSubmit === 'boolean'
  ) {
    return candidate;
  }
  return null;
}
