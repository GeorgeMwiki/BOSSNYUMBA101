/**
 * Supabase Client Factory - BOSSNYUMBA
 *
 * Creates typed Supabase clients for server and browser contexts.
 * This project has its OWN Supabase project - never shared with other apps.
 *
 * Usage:
 *   Server: const supabase = createServerSupabaseClient();
 *   Browser: const supabase = createBrowserSupabaseClient();
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types.js';

// ============================================================================
// Server Client (service role - full access, use in API gateway / services)
// ============================================================================

let _serverClient: SupabaseClient<Database> | null = null;

export function createServerSupabaseClient(): SupabaseClient<Database> {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Server Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  _serverClient = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  return _serverClient;
}

// ============================================================================
// Browser Client (anon key - respects RLS)
// ============================================================================

let _browserClient: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Browser Supabase client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  _browserClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _browserClient;
}

// ============================================================================
// Anonymous Client (for unauthenticated operations like signup)
// ============================================================================

export function createAnonSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Anon Supabase client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// Check if Supabase is available
// ============================================================================

export function isSupabaseAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')
  );
}

// Re-export types
export type { SupabaseClient };
export type { Database };
