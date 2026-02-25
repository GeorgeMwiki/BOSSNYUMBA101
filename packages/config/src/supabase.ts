/**
 * Supabase Configuration - BOSSNYUMBA
 *
 * Separate Supabase project for BOSSNYUMBA only.
 * Never mix with other projects (Pongezi, etc.).
 *
 * Uses environment variables exclusively - no hard-coded URLs or keys.
 */

import { z } from 'zod';

// ============================================================================
// Schema - Validates Supabase env vars at startup
// ============================================================================

export const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .describe('Supabase project URL (unique per project)'),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    .describe('Supabase anon/public key'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .optional()
    .describe('Supabase service role key (server-side only, never expose to client)'),
});

export type SupabaseConfig = z.infer<typeof supabaseSchema>;

// ============================================================================
// Loader - Reads and validates from environment
// ============================================================================

let _supabaseConfig: SupabaseConfig | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  if (_supabaseConfig) return _supabaseConfig;

  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const result = supabaseSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Supabase configuration is REQUIRED in production.\n` +
        `Missing or invalid environment variables:\n${issues}\n\n` +
        `Ensure BOSSNYUMBA has its own separate Supabase project configured.`
      );
    }

    // Development: warn but allow graceful degradation
    console.warn(
      `[supabase] Supabase not configured. Some features will be unavailable.\n${issues}`
    );

    // Return empty config for dev - services should handle this gracefully
    _supabaseConfig = {
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    };
    return _supabaseConfig;
  }

  _supabaseConfig = result.data;
  return _supabaseConfig;
}

/**
 * Check if Supabase is properly configured (not empty placeholders).
 * Use this to conditionally enable features that require Supabase.
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return !!(
    config.NEXT_PUBLIC_SUPABASE_URL &&
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !config.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')
  );
}

/**
 * Assert Supabase is configured. Throws in production, warns in dev.
 */
export function requireSupabase(): SupabaseConfig {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Supabase is required in production. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
    }
    console.warn('[supabase] Supabase not configured - falling back to mock data');
  }
  return getSupabaseConfig();
}
