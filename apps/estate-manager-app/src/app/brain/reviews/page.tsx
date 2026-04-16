'use client';

/**
 * Brain Review Queue — admin/manager dashboard for pending PROPOSED_ACTION
 * turns that need human approval. Each card links to the originating
 * thread and offers Approve / Reject inline.
 */

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Brain,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { brainFetch } from '@/lib/brain-client';

interface QueueItem {
  threadId: string;
  threadTitle: string;
  personaId: string;
  copilotRequestId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requestedAt: string;
  preview?: string;
}

export default function ReviewsPage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await brainFetch<{ items: QueueItem[] }>(
        '/api/brain/review-queue'
      );
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load review queue');
      setItems([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function decide(item: QueueItem, decision: 'approved' | 'rejected') {
    if (busy) return;
    setBusy(item.copilotRequestId);
    try {
      await brainFetch('/api/brain/review', {
        method: 'POST',
        body: JSON.stringify({
          threadId: item.threadId,
          copilotRequestId: item.copilotRequestId,
          decision,
        }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'review submission failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Brain Reviews"
        subtitle="Approve or reject pending Brain-proposed actions"
        showBack
      />
      <div className="px-4 py-3 pb-24 max-w-3xl mx-auto flex flex-col gap-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {items === null && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Loader2 className="w-4 h-4 animate-spin" /> loading queue…
          </div>
        )}
        {items?.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col items-center text-center gap-2 text-gray-600">
            <ShieldCheck className="w-8 h-8 text-green-500" />
            <p className="font-medium text-gray-900">Inbox zero.</p>
            <p className="text-sm">
              The Brain has nothing waiting for your approval right now.
            </p>
          </div>
        )}
        {items?.map((item) => (
          <Card
            key={`${item.threadId}::${item.copilotRequestId}`}
            item={item}
            busy={busy === item.copilotRequestId}
            onApprove={() => decide(item, 'approved')}
            onReject={() => decide(item, 'rejected')}
          />
        ))}
      </div>
    </>
  );
}

function Card({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const riskTone: Record<QueueItem['riskLevel'], string> = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-sky-100 text-sky-800',
    HIGH: 'bg-amber-100 text-amber-900',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Brain className="w-4 h-4 text-sky-500" />
        <span>{item.personaId}</span>
        <span className={`rounded-full px-2 py-0.5 ${riskTone[item.riskLevel]}`}>
          risk {item.riskLevel}
        </span>
        <span className="text-gray-400 ml-auto">
          {new Date(item.requestedAt).toLocaleString()}
        </span>
      </div>
      <div>
        <Link
          href={`/brain/threads/${item.threadId}`}
          className="font-medium text-gray-900 hover:underline flex items-center gap-1"
        >
          {item.threadTitle}
          <ChevronRight className="w-4 h-4" />
        </Link>
        {item.preview && (
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
            {item.preview}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <XCircle className="w-4 h-4" /> Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className="flex-1 rounded-xl bg-green-600 text-white px-3 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}
