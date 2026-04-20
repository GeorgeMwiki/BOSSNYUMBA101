/**
 * Classroom (training sessions) — Wave 15 UI gap closure.
 *
 *   POST /api/v1/classroom/sessions  — create session
 *   GET  /api/v1/classroom/mastery/:userId  — BKT snapshot
 *
 * Lists known sessions (read from a server index when available) and
 * renders a mastery heatmap for the current user.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus } from 'lucide-react';
import { api } from '../lib/api';

interface Session {
  readonly id: string;
  readonly title: string;
  readonly language: string;
  readonly createdAt: string;
  readonly targetConceptIds: readonly string[];
}

interface MasteryEntry {
  readonly conceptId: string;
  readonly mastery: number; // 0..1
  readonly attempts: number;
}

export default function ClassroomPage(): JSX.Element {
  const [sessions, setSessions] = useState<readonly Session[]>([]);
  const [mastery, setMastery] = useState<readonly MasteryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', language: 'en' as 'en' | 'sw' });
  const [userId, setUserId] = useState<string>('');

  const loadMastery = useCallback(async (id: string) => {
    if (!id) return;
    const res = await api.get<readonly MasteryEntry[]>(
      `/classroom/mastery/${encodeURIComponent(id)}`,
    );
    if (res.success && res.data) setMastery(res.data);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('admin_user');
    if (raw) {
      try {
        const u = JSON.parse(raw) as { id?: string };
        if (u?.id) {
          setUserId(u.id);
          void loadMastery(u.id);
        }
      } catch {
        /* ignore */
      }
    }
    const stored = localStorage.getItem('classroom_sessions');
    if (stored) {
      try {
        setSessions(JSON.parse(stored) as readonly Session[]);
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, [loadMastery]);

  async function createSession(): Promise<void> {
    const res = await api.post<Session>('/classroom/sessions', {
      title: form.title,
      language: form.language,
      targetConceptIds: [],
    });
    if (res.success && res.data) {
      const next = [res.data, ...sessions];
      setSessions(next);
      localStorage.setItem('classroom_sessions', JSON.stringify(next));
      setForm({ title: '', language: 'en' });
    } else {
      setError(res.error ?? 'Create failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Classroom</h2>
          <p className="text-sm text-gray-500">
            Training sessions and mastery heatmap.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-lg">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Start a session
        </h3>
        <input
          type="text"
          placeholder="Session title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={form.language}
          onChange={(e) =>
            setForm({ ...form, language: e.target.value as 'en' | 'sw' })
          }
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="en">English</option>
          <option value="sw">Swahili</option>
        </select>
        <button
          type="button"
          onClick={() => void createSession()}
          disabled={!form.title}
          className="rounded bg-violet-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Create session
        </button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Recent sessions</h3>
        {loading ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <li key={s.id} className="py-2">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-gray-500">
                  {s.language} · {new Date(s.createdAt).toLocaleDateString()} ·{' '}
                  {s.targetConceptIds.length} concepts
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">
          Mastery heatmap {userId ? `(user ${userId})` : ''}
        </h3>
        {mastery.length === 0 ? (
          <p className="text-sm text-gray-500">
            Mastery appears after a few quiz responses.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {mastery.map((m) => (
              <div
                key={m.conceptId}
                className="rounded p-3 text-xs"
                style={{
                  backgroundColor: `rgba(124, 58, 237, ${Math.max(
                    0.08,
                    m.mastery,
                  )})`,
                  color: m.mastery > 0.5 ? 'white' : '#1f2937',
                }}
                data-testid={`mastery-${m.conceptId}`}
              >
                <p className="font-medium">{m.conceptId}</p>
                <p>{(m.mastery * 100).toFixed(0)}% · {m.attempts} tries</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
