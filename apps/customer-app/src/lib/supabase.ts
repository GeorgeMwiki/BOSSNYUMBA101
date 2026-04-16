/**
 * Supabase browser client for the customer-app.
 *
 * Mirrors the helper in estate-manager-app — single source of truth for the
 * tenant access token used by the tenant-assistant Brain surface.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function loadClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error(
      'customer-app: NEXT_PUBLIC_SUPABASE_URL and ' +
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

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await loadClient().auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

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
