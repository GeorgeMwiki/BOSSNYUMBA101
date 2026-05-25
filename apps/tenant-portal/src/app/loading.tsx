/**
 * Root suspense fallback — Next.js convention. Streams immediately while
 * server components resolve so users never see a blank tab. Marked with
 * `aria-busy`/`aria-live` so screen readers announce the loading state.
 */

export default function Loading(): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center p-6 bg-surface-subtle text-ink"
    >
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-2 border-ink-muted/30 border-t-brand"
        />
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    </div>
  );
}
