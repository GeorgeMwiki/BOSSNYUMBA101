/**
 * Browser-side Supabase client for marketing (tenant sign-in only).
 *
 * Uses `@supabase/ssr`'s `createBrowserClient` so the session cookies
 * are written into the document jar with the SSR shape the owner portal
 * (cross-origin) can also read once the tenant lands on `dashboard?as=tenant`.
 *
 * Marketing never holds the service-role key — only the public anon key.
 * Provisioning (tenant + user creation) happens server-side at
 * `POST /api/v1/tenants/signup`; this client is exclusively for the
 * `auth.signInWithPassword` exchange after signup completes.
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let singleton: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (singleton !== null) return singleton;
  const env = getSupabaseEnv();
  const created: SupabaseClient = createBrowserClient(env.url, env.anonKey);
  singleton = created;
  return created;
}
