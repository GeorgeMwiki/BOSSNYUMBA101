/**
 * Safe accessors for the `onboarding_progress` localStorage entry.
 *
 * Closes round-3 finding C-6 (CRITICAL) + L-7 (LOW): nine onboarding
 * screens called `JSON.parse(localStorage.getItem('onboarding_progress') || '{}')`
 * without any validation, so an attacker with XSS could plant a
 * malformed object that crashed the screen for every subsequent
 * visit, or smuggle arbitrary fields into the upload payload.
 *
 * The schema is intentionally permissive — onboarding progress is
 * user-collected free-form input — but we strip any value whose
 * shape is not a plain object, and we always wrap parsing in
 * try/catch so a corrupted entry self-heals on the next save.
 */

const ONBOARDING_PROGRESS_KEY = 'onboarding_progress';

export type OnboardingProgress = Readonly<Record<string, unknown>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  // Reject prototype-pollution-style payloads.
  if (Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Read + safely parse the `onboarding_progress` entry. Returns `{}`
 * on parse failure, missing entry, or non-object payloads.
 */
export function readOnboardingProgress(): OnboardingProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      // Defensive: wipe the bad entry so we don't keep parsing it.
      window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
      return {};
    }
    // Strip dangerous keys without copying them — `delete` would
    // mutate `parsed`, so we rebuild via a destructure.
    const { __proto__: _proto, constructor: _ctor, ...safe } =
      parsed as Record<string, unknown>;
    void _proto;
    void _ctor;
    return safe;
  } catch {
    try {
      window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    } catch {
      // ignore
    }
    return {};
  }
}

/**
 * Merge-write a patch into the `onboarding_progress` entry.
 */
export function patchOnboardingProgress(patch: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const current = readOnboardingProgress();
  const next = { ...current, ...patch };
  try {
    window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError or SecurityError — onboarding can continue
    // without progress persistence.
  }
}
