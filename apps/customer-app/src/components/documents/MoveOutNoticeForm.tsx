/**
 * Move-out notice form — multi-field surface that POSTs to
 * `/api/v1/leases/current/move-out`.
 *
 * Fields:
 *   - Move-out date (required)
 *   - Reason (required, free-text)
 *   - Forwarding address (optional)
 *   - Deposit return preference (radio: bank / mpesa / cheque)
 *
 * On success, renders an inline confirmation banner. The E2E spec asserts
 * that the success text matches `/submitted|received|confirmed/i`.
 */
'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

type DepositPreference = 'bank' | 'mpesa' | 'cheque';

interface FormState {
  readonly moveOutDate: string;
  readonly reason: string;
  readonly forwardingAddress: string;
  readonly depositPreference: DepositPreference;
}

const INITIAL_STATE: FormState = {
  moveOutDate: '',
  reason: '',
  forwardingAddress: '',
  depositPreference: 'bank',
};

function token(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('customer_token') ?? ''
    : '';
}

interface MoveOutFormProps {
  readonly onSubmitted?: () => void;
}

export function MoveOutNoticeForm({ onSubmitted }: MoveOutFormProps) {
  const t = useTranslations('p89.moveOut');
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!state.moveOutDate || !state.reason.trim()) {
      setError('Move-out date and reason are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const auth = token();
      const res = await fetch(
        `${getApiBaseUrl()}/leases/current/move-out`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({
            moveOutDate: state.moveOutDate,
            reason: state.reason.trim(),
            forwardingAddress: state.forwardingAddress.trim() || undefined,
            depositReturnPreference: state.depositPreference,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { submittedAt?: string };
        error?: { message?: string };
      };
      if (!res.ok || body.success === false) {
        throw new Error(body.error?.message ?? `Submission failed (HTTP ${res.status})`);
      }
      setSubmittedAt(body.data?.submittedAt ?? new Date().toISOString());
      setState(INITIAL_STATE);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [state, onSubmitted]);

  if (submittedAt) {
    return (
      <div
        role="status"
        data-testid="move-out-confirmation"
        className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 p-4 text-sm flex items-start gap-3"
      >
        <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Move-out notice submitted.</p>
          <p className="text-xs text-emerald-300/70 mt-1">
            We have received your notice. Your manager will confirm the
            move-out inspection within 48 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      data-testid="move-out-form"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="space-y-3"
    >
      {error && (
        <div
          role="alert"
          className="rounded bg-red-900/30 border border-red-500/40 text-red-200 p-2 text-sm"
        >
          {error}
        </div>
      )}

      <label className="block text-sm text-gray-300">
        Move-out date
        <input
          type="date"
          value={state.moveOutDate}
          onChange={(e) => updateField('moveOutDate', e.target.value)}
          required
          min={new Date().toISOString().slice(0, 10)}
          data-testid="move-out-date"
          className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
        />
      </label>

      <label className="block text-sm text-gray-300">
        Reason
        <textarea
          value={state.reason}
          onChange={(e) => updateField('reason', e.target.value)}
          rows={3}
          required
          placeholder={t('reasonPlaceholder')}
          data-testid="move-out-reason"
          className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
        />
      </label>

      <label className="block text-sm text-gray-300">
        Forwarding address (optional)
        <input
          type="text"
          value={state.forwardingAddress}
          onChange={(e) => updateField('forwardingAddress', e.target.value)}
          placeholder={t('depositPlaceholder')}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
        />
      </label>

      <fieldset className="block text-sm text-gray-300">
        <legend className="mb-2">{t('depositLegend')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['bank', 'mpesa', 'cheque'] as const).map((preference) => (
            <label
              key={preference}
              className={`rounded border px-3 py-2 text-center text-sm cursor-pointer ${
                state.depositPreference === preference
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300'
              }`}
            >
              <input
                type="radio"
                name="depositPreference"
                value={preference}
                checked={state.depositPreference === preference}
                onChange={() => updateField('depositPreference', preference)}
                className="sr-only"
              />
              {preference === 'bank'
                ? 'Bank'
                : preference === 'mpesa'
                  ? 'M-Pesa'
                  : 'Cheque'}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        data-testid="submit-move-out"
        className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {submitting ? 'Submitting…' : 'Submit move-out notice'}
      </button>
    </form>
  );
}

export default MoveOutNoticeForm;
