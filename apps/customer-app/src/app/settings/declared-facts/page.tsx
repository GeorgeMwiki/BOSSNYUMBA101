'use client';

/**
 * Declared facts — user-managed semantic memory overrides.
 *
 * The kernel's step-4 memory recall ranks `source: 'declared'` facts
 * above extracted / consolidated ones. This page is the consumer-side
 * UI for adding / listing / removing those facts.
 *
 * Example uses for a tenant:
 *   - "preferred_language" = "sw"
 *   - "quiet_hours_start"  = "20:00"
 *   - "preferred_pay_day"  = "28"
 *
 * The page is intentionally minimal — list, add, delete. The backing
 * API lives at `POST/GET/DELETE /api/v1/memory/declare`.
 */

import { useEffect, useState, useTransition } from 'react';
import { Trash2, Plus, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface DeclaredFact {
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly source: string;
  readonly lastSeenAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  facts?: ReadonlyArray<T>;
  error?: { code: string; message: string };
}

async function fetchDeclared(): Promise<ReadonlyArray<DeclaredFact>> {
  try {
    const res = await fetch('/api/v1/memory/declare', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ApiResponse<DeclaredFact>;
    return data.facts ?? [];
  } catch {
    return [];
  }
}

async function postDeclared(
  key: string,
  value: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/memory/declare', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteDeclared(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/memory/declare', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function DeclaredFactsPage(): JSX.Element {
  const [facts, setFacts] = useState<ReadonlyArray<DeclaredFact>>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const rows = await fetchDeclared();
      setFacts(rows);
    })();
  }, []);

  const refresh = (): void => {
    void (async () => {
      const rows = await fetchDeclared();
      setFacts(rows);
    })();
  };

  const handleAdd = (): void => {
    if (!newKey.trim() || !newValue.trim()) {
      setMessage('Both key and value are required.');
      return;
    }
    startTransition(async () => {
      const ok = await postDeclared(newKey.trim(), newValue.trim());
      setMessage(ok ? 'Saved.' : 'Could not save.');
      if (ok) {
        setNewKey('');
        setNewValue('');
        refresh();
      }
    });
  };

  const handleDelete = (key: string): void => {
    startTransition(async () => {
      const ok = await deleteDeclared(key);
      setMessage(ok ? `Removed ${key}.` : 'Could not remove.');
      if (ok) refresh();
    });
  };

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Declared facts" showBack />
      <p className="mt-3 text-sm text-neutral-400">
        Things you&apos;ve told me about yourself — these override anything I
        infer from your activity.
      </p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">
          Add a new fact
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="block text-xs text-neutral-600 mb-1">Key</span>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="preferred_language"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              disabled={pending}
            />
          </label>
          <label className="flex-1">
            <span className="block text-xs text-neutral-600 mb-1">Value</span>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="sw"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Save
          </button>
        </div>
        {message ? (
          <p className="mt-2 text-xs text-neutral-700">{message}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">
          Your facts
        </h2>
        {facts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            You haven&apos;t declared any facts yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {facts.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {f.key}
                  </p>
                  <p className="truncate text-xs text-neutral-600">
                    {typeof f.value === 'string'
                      ? f.value
                      : JSON.stringify(f.value)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(f.key)}
                  disabled={pending}
                  className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-600 disabled:opacity-40"
                  aria-label={`Remove ${f.key}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-neutral-500">
        Declared facts are private to you and override the AI&apos;s
        inferred guesses. <Save className="inline h-3 w-3" /> means saved.
      </p>
    </div>
  );
}
