/**
 * Supabase service-role client for language-intelligence persistence.
 *
 * Repoints the ported LitFin `@/lib/supabase/server` import to the
 * canonical BossNyumba factory `@bossnyumba/supabase-client`. The ported
 * code calls `createServiceClient()` with no arguments and expects a
 * service-role client (RLS-bypassing) for the `translation_memory` and
 * `learned_vocabulary` tables, so this thin wrapper reads the same
 * environment variables the sibling `@bossnyumba/swahili-intelligence`
 * package uses and delegates to `createSupabaseAdminClient`.
 *
 * @module internal/supabase-client
 */

import {
  createSupabaseAdminClient,
  type SupabaseClient,
} from '@bossnyumba/supabase-client'

/**
 * Build a service-role Supabase client (bypasses RLS).
 *
 * Throws when credentials are absent so callers — which already wrap
 * persistence in `try/catch` and fall back to their in-memory caches —
 * degrade to local-only mode rather than issuing un-authenticated
 * requests.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase credentials not configured for language-intelligence persistence',
    )
  }

  return createSupabaseAdminClient({ url, serviceRoleKey })
}
