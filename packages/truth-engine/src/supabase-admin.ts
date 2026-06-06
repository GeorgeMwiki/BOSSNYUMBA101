/**
 * Supabase admin client (BossNyumba wiring)
 *
 * The truth-engine claim store persists to the `truth_claims` /
 * `truth_evidence` / `truth_*` Supabase tables using the service-role client
 * (bypasses RLS) — these are system-curated knowledge tables, written by cron
 * and admin actors, not tenant-scoped rows.
 *
 * The ported `@/lib/supabase/server` `createServiceClient()` is repointed onto
 * the canonical `@bossnyumba/supabase-client` `createSupabaseAdminClient(...)`,
 * which wraps `@supabase/supabase-js` with the service-role key and refuses to
 * create an admin client from the anon key.
 *
 * Env is read once per process and the client memoised, mirroring the original
 * module's singleton behaviour.
 */

import {
  createSupabaseAdminClient,
} from "@bossnyumba/supabase-client";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Build (or return the memoised) Supabase service-role client.
 *
 * Throws if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing — the
 * truth engine cannot persist evidence without a service-role connection, and
 * failing loud here is safer than silently falling back to an RLS-enforced
 * client that would reject every system write.
 */
export function createServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "truth-engine: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the claim store",
    );
  }
  cachedClient = createSupabaseAdminClient({ url, serviceRoleKey });
  return cachedClient;
}
