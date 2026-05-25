/**
 * Thin client for `/api/v1/ask/*`.
 *
 * The browser sends the session cookie that the api-gateway / identity
 * service issued (same cookie the customer-app already uses). Server
 * components / route handlers in this app can `fetch()` the same URL —
 * we don't add a bespoke session-fetch layer here because all of that
 * machinery already lives in `apps/customer-app/src/lib/supabase.ts`
 * and the spec asked us to mirror it. When the cookie isn't present
 * the api-gateway returns 401 and the UI surfaces a sign-in nudge.
 */

export interface AskChip {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly priority: number;
  readonly reason: string;
}

export interface AskCitation {
  readonly id: string;
  readonly label: string;
  readonly source: string;
}

export interface AskEvidence {
  readonly id: string;
  readonly resource: string;
  readonly summary: string;
}

export interface AskAnswer {
  readonly answer: string;
  readonly answerId: string;
  readonly intent: string;
  readonly citations: ReadonlyArray<AskCitation>;
  readonly suggestedFollowUps: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<AskEvidence>;
  readonly redactedFields: ReadonlyArray<string>;
  readonly deniedSnippetIds: ReadonlyArray<string>;
}

export interface AskError {
  readonly code: string;
  readonly message: string;
}

const API_BASE =
  (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined) ?? '/api/v1';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      // ignore
    }
    throw new Error(
      `Request failed (${res.status})${detail ? `: ${detail}` : ''}`,
    );
  }
  const body = (await res.json()) as { success: boolean; data: T };
  return body.data;
}

export async function fetchStartingPoints(
  sessionId?: string,
): Promise<{ chips: ReadonlyArray<AskChip> }> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(`${API_BASE}/ask/starting-points${qs}`, {
    credentials: 'include',
  });
  return jsonOrThrow(res);
}

export async function postAsk(
  question: string,
  sessionId?: string,
): Promise<AskAnswer> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, sessionId }),
  });
  return jsonOrThrow(res);
}

export async function postFeedback(args: {
  readonly sessionId: string;
  readonly answerId: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly freeText?: string;
}): Promise<{ recorded: boolean }> {
  const res = await fetch(`${API_BASE}/ask/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  return jsonOrThrow(res);
}
