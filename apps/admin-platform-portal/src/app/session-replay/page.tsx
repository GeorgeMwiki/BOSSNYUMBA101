/**
 * Session replay landing page — Central Command Phase B (B5).
 *
 * Lists recent sessions for the tenant. Click-through navigates to
 * `/session-replay/<sessionId>` which renders the rrweb-player.
 *
 * Admin-gated by the staff layout (SUPER_ADMIN + ADMIN). The gateway
 * also enforces the role gate at the API tier — defence-in-depth.
 *
 * TODO (Phase C): free-text + facet search across sessions.
 */

import Link from 'next/link';
import { PageShell } from '@/components/migrated/PageShell';

interface RecentSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly surface: string;
  readonly firstCapturedAt: string;
  readonly lastCapturedAt: string;
  readonly chunkCount: number;
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: { code: string; message?: string };
}

async function fetchRecentSessions(): Promise<{
  sessions: RecentSession[];
  error: string | null;
}> {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/v1/session-replay/sessions`,
      {
        cache: 'no-store',
        // The server-side caller would normally forward the cookie; in
        // a degraded environment without a session we still want a
        // graceful render so the operator sees a clear empty-state.
      },
    );
    if (!res.ok) {
      return {
        sessions: [],
        error: `Recent-sessions fetch failed (${res.status})`,
      };
    }
    const body = (await res.json()) as ApiEnvelope<{
      sessions: RecentSession[];
    }>;
    if (!body.success || !body.data) {
      return {
        sessions: [],
        error: body.error?.message ?? 'API returned an error envelope',
      };
    }
    return { sessions: body.data.sessions, error: null };
  } catch (err) {
    return {
      sessions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function SessionReplayLandingPage() {
  const { sessions, error } = await fetchRecentSessions();
  return (
    <PageShell
      title="Session replay"
      subtitle="Cold-store playback of operator sessions. rrweb events are PII-masked at capture; the brain never sees the bytes."
    >
      {error ? (
        <div className="rounded-md border border-warning bg-warning/10 p-4 text-sm text-warning mb-4">
          {error}
        </div>
      ) : null}
      {sessions.length === 0 ? (
        <div className="text-sm text-neutral-400">
          No replay sessions recorded in the current window. Visit any
          admin page — the recorder boots from the layout provider and
          flushes a chunk every 30 seconds.
        </div>
      ) : (
        <table className="w-full text-sm text-neutral-300 border-collapse">
          <thead className="text-neutral-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="text-left py-2 pr-3">Session</th>
              <th className="text-left py-2 pr-3">User</th>
              <th className="text-left py-2 pr-3">Surface</th>
              <th className="text-left py-2 pr-3">First captured</th>
              <th className="text-left py-2 pr-3">Last captured</th>
              <th className="text-left py-2 pr-3">Chunks</th>
              <th className="text-left py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId} className="border-t border-border">
                <td className="py-2 pr-3 font-mono break-all">{s.sessionId}</td>
                <td className="py-2 pr-3">{s.userId}</td>
                <td className="py-2 pr-3">{s.surface}</td>
                <td className="py-2 pr-3">{s.firstCapturedAt}</td>
                <td className="py-2 pr-3">{s.lastCapturedAt}</td>
                <td className="py-2 pr-3">{s.chunkCount}</td>
                <td className="py-2 pr-3">
                  <Link
                    href={`/session-replay/${encodeURIComponent(s.sessionId)}`}
                    className="text-signal-500 hover:underline"
                  >
                    Play →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
