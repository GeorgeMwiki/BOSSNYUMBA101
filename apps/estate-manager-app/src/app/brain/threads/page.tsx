'use client';

/**
 * Brain Threads — list of past + active conversations with the Brain.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { brainFetch } from '@/lib/brain-client';

interface ThreadRow {
  id: string;
  title: string;
  primaryPersonaId: string;
  status: 'open' | 'resolved' | 'archived';
  updatedAt: string;
  lastEventAt?: string;
}

export default function ThreadsPage() {
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    brainFetch<{ threads: ThreadRow[] }>('/api/brain/threads?limit=100')
      .then((d) => setRows(d.threads))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'failed to load threads');
        setRows([]);
      });
  }, []);

  return (
    <>
      <PageHeader title="Brain Threads" subtitle="All conversations with the Brain" showBack />
      <div className="px-4 py-3 pb-24 max-w-3xl mx-auto flex flex-col gap-2">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {rows === null && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Loader2 className="w-4 h-4 animate-spin" /> loading…
          </div>
        )}
        {rows?.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col items-center text-center gap-2 text-gray-600">
            <Brain className="w-8 h-8 text-sky-500" />
            <p className="font-medium text-gray-900">No threads yet.</p>
            <p className="text-sm">
              Start a conversation from <Link href="/brain" className="text-sky-600 underline">Brain</Link>.
            </p>
          </div>
        )}
        {rows?.map((t) => (
          <Link
            key={t.id}
            href={`/brain/threads/${t.id}`}
            className="rounded-2xl border border-gray-100 bg-white p-3 flex items-center gap-3 hover:bg-gray-50"
          >
            <Brain className="w-5 h-5 text-sky-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{t.title}</div>
              <div className="text-xs text-gray-500 truncate">
                {t.primaryPersonaId} · {t.status} · {new Date(t.updatedAt).toLocaleString()}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </>
  );
}
