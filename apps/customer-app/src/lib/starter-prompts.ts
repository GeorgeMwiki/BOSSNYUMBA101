/**
 * starter-prompts — fetch dynamic conversation starters or fall back
 * to role-aware hardcoded prompts when the org/property endpoints are
 * unavailable.
 *
 * EP-4 outsized-UX improvement: the empty assistant surface should
 * never be a blank wall. Every empty state ships with 4 clickable
 * cards the user can fire without typing a single character.
 */

import { humanizeError } from './humanize-error';

export interface StarterPrompt {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
}

const TENANT_FALLBACK: ReadonlyArray<StarterPrompt> = Object.freeze([
  {
    id: 'tenant:rent-due',
    label: 'When is my next rent due?',
    prompt: 'When is my next rent payment due?',
  },
  {
    id: 'tenant:maintenance',
    label: 'Open a maintenance request',
    prompt: 'I need to report a maintenance issue in my unit.',
  },
  {
    id: 'tenant:lease',
    label: 'Explain my lease',
    prompt: 'Can you summarise the key terms of my lease?',
  },
  {
    id: 'tenant:receipts',
    label: 'Find a payment receipt',
    prompt: 'Show me my recent rent payment receipts.',
  },
]);

/**
 * Try to fetch contextual prompts from the backend. Falls back to the
 * baked-in tenant prompts on any failure (network, 4xx, 5xx) so the
 * empty state always renders.
 */
export async function fetchStarterPrompts(
  authedHeaders: () => Promise<Record<string, string>>,
): Promise<ReadonlyArray<StarterPrompt>> {
  try {
    const headers = await authedHeaders();
    const res = await fetch('/api/properties/alerts', {
      method: 'GET',
      headers,
    });
    if (!res.ok) return TENANT_FALLBACK;
    const data = (await res.json().catch(() => null)) as
      | { prompts?: ReadonlyArray<StarterPrompt> }
      | null;
    if (!data || !Array.isArray(data.prompts)) return TENANT_FALLBACK;
    const cleaned = data.prompts
      .filter(
        (p): p is StarterPrompt =>
          typeof p?.id === 'string' &&
          typeof p?.label === 'string' &&
          typeof p?.prompt === 'string',
      )
      .slice(0, 4);
    return cleaned.length > 0 ? cleaned : TENANT_FALLBACK;
  } catch (error) {
    // Swallow — the fallback is good enough and we don't want the
    // empty state itself to throw. We do humanise the error in case a
    // caller wants to log it.
    void humanizeError(error);
    return TENANT_FALLBACK;
  }
}

export const TENANT_STARTER_PROMPTS = TENANT_FALLBACK;
