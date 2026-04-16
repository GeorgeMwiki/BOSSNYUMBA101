/**
 * Supabase browser client for the estate-manager-app.
 *
 * Single source of truth for the access token used by every Brain call.
 * No anonymous fallbacks — if the env vars are missing, every helper
 * throws so the failure surfaces immediately rather than silently
 * producing requests with no Authorization header (which the production
 * routes reject with 401).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function loadClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error(
      'estate-manager-app: NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.'
    );
  }
  client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export function getSupabase(): SupabaseClient {
  return loadClient();
}

/**
 * Fetch the current access token. Refreshes on the fly via the Supabase JS
 * client. Returns `null` (and never throws) when the user is not signed in,
 * so calling code can present a sign-in prompt rather than crashing.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await loadClient().auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Convenience: produce headers for an authenticated fetch. Throws when
 * there is no session — callers that want a graceful fallback should call
 * `getAccessToken()` directly.
 */
export async function authedHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated — Supabase session required.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}
