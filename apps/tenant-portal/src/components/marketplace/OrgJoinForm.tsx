'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  joinErrorMessage,
  marketplaceClient,
} from '@/lib/marketplace/api-client';
import type { JoinErrorCode } from '@/lib/marketplace/types';

/**
 * Special-code entry form. Validates the code with the api-gateway,
 * shows a friendly message on any error, and routes to the org page
 * on success.
 */
export function OrgJoinForm(): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { readonly kind: 'success'; readonly orgName: string }
    | { readonly kind: 'error'; readonly message: string }
    | null
  >(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await marketplaceClient.joinOrg(code.trim());
      setFeedback({ kind: 'success', orgName: result.orgName });
      // Give the toast a moment to settle then hop to the org page.
      setTimeout(() => {
        router.push(`/marketplace/orgs/${result.orgId}`);
      }, 800);
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'BAD_REQUEST';
      setFeedback({
        kind: 'error',
        message: joinErrorMessage(code as JoinErrorCode),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4"
    >
      <div>
        <h3 className="text-base font-semibold text-ink">Join with a code</h3>
        <p className="text-xs text-ink-muted">
          Your organisation will give you a code (e.g. ASHA-WELCOME). Enter it
          here to link your account.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Organisation code
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. ASHA-WELCOME"
          className="rounded-chat border border-ink-muted/20 px-3 py-2 font-mono text-sm uppercase tracking-wide focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || code.trim().length < 2}
        className="self-start rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? 'Linking…' : 'Join organisation'}
      </button>
      {feedback?.kind === 'success' ? (
        <p className="text-sm text-emerald-700">
          Joined {feedback.orgName}. Redirecting…
        </p>
      ) : null}
      {feedback?.kind === 'error' ? (
        <p className="text-sm text-red-700">{feedback.message}</p>
      ) : null}
    </form>
  );
}
