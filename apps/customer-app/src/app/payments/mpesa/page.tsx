'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Loader2,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReceiptDownloadButton } from '@/components/payments/ReceiptDownloadButton';
import { useStkPolling } from '@/components/payments/useStkPolling';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrencyPreference } from '@/lib/hooks/useCurrencyPreference';

/**
 * Local phase of the STK flow that the page itself owns (before the poll
 * hook takes over). `confirm` collects the M-Pesa number; `initiating`
 * spans the create-intent + /process round-trip; `polling` hands off to
 * `useStkPolling`; `error` covers a failed initiation (distinct from a
 * failed *poll*, which the hook reports as `failed`).
 */
type InitPhase =
  | { kind: 'confirm' }
  | { kind: 'initiating' }
  | { kind: 'polling'; paymentId: string }
  | { kind: 'error'; message: string };

/** Basic E.164-ish guard — the gateway re-validates with a stricter regex. */
function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function MpesaPayInner() {
  const t = useTranslations('mpesaPay');
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { code: currencyCode, format: formatCurrency } = useCurrencyPreference();

  const intentIdParam = searchParams.get('id');
  const amountParam = searchParams.get('amount');
  const currencyParam = searchParams.get('currency');

  const amount = useMemo(() => {
    if (!amountParam) return null;
    const parsed = Number(amountParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [amountParam]);

  const [phone, setPhone] = useState<string>(user?.phone ?? '');
  const [phase, setPhase] = useState<InitPhase>({ kind: 'confirm' });

  const pollingId = phase.kind === 'polling' ? phase.paymentId : null;
  const { state: pollState, secondsRemaining } = useStkPolling({
    intentId: pollingId,
  });

  const handlePay = useCallback(async () => {
    if (!isPlausiblePhone(phone)) {
      setPhase({ kind: 'error', message: t('invalidPhone') });
      return;
    }

    setPhase({ kind: 'initiating' });

    try {
      // Reuse the existing pending intent when the upstream flow supplied
      // one (its amount/currency are canonical server-side); otherwise mint
      // a fresh intent from the displayed amount. We need an amount in the
      // create path — guard against navigating here with neither.
      let paymentId = intentIdParam;
      if (!paymentId) {
        if (amount == null) {
          setPhase({ kind: 'error', message: t('missingAmount') });
          return;
        }
        const intent = await api.payments.createIntent({
          amount,
          currency: currencyParam ?? currencyCode,
          description: t('rentPaymentDescription'),
        });
        paymentId = intent.id;
      }

      await api.payments.processPayment(paymentId, {
        channel: 'mpesa',
        phoneNumber: phone,
      });

      // Hand polling over to the hook keyed on the gateway payment id (the
      // /status route resolves the engine intent internally).
      setPhase({ kind: 'polling', paymentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('initiationFailed');
      setPhase({ kind: 'error', message });
    }
  }, [amount, currencyCode, currencyParam, intentIdParam, phone, t]);

  const handleRetry = useCallback(() => {
    setPhase({ kind: 'confirm' });
  }, []);

  const isPolling = phase.kind === 'polling' && (pollState.kind === 'idle' || pollState.kind === 'polling');
  const succeeded = phase.kind === 'polling' && pollState.kind === 'succeeded';
  const pollFailed = phase.kind === 'polling' && pollState.kind === 'failed';
  const pollTimedOut = phase.kind === 'polling' && pollState.kind === 'timeout';

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="space-y-5 px-4 py-4 pb-24">
        {/* Amount summary */}
        <section className="card p-5">
          <div className="text-sm text-gray-400">{t('amountToPay')}</div>
          <div className="mt-1 text-3xl font-semibold text-white">
            {amount != null ? formatCurrency(amount) : '—'}
          </div>
        </section>

        {/* Confirm / initiating phase */}
        {(phase.kind === 'confirm' || phase.kind === 'initiating' || phase.kind === 'error') && (
          <section className="card space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-500/15 p-3">
                <Smartphone className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <div className="font-medium text-white">{t('payWithMpesa')}</div>
                <p className="text-sm text-gray-400">{t('stkExplain')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="mpesa-phone" className="text-sm text-gray-300">
                {t('phoneLabel')}
              </label>
              <input
                id="mpesa-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="input"
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={phase.kind === 'initiating'}
              />
            </div>

            {phase.kind === 'error' && (
              <Alert variant="danger">
                <AlertDescription>{phase.message}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              className="w-full"
              onClick={handlePay}
              disabled={phase.kind === 'initiating' || amount == null}
            >
              {phase.kind === 'initiating' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('initiating')}
                </span>
              ) : (
                t('sendStkPrompt')
              )}
            </Button>
          </section>
        )}

        {/* Pending — STK prompt sent, awaiting the customer's PIN entry */}
        {isPolling && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-green-400" />
            <div className="font-medium text-white">{t('checkYourPhone')}</div>
            <p className="text-sm text-gray-400">{t('enterPinPrompt')}</p>
            <p className="text-xs text-gray-500">
              {t('expiresIn', { seconds: secondsRemaining })}
            </p>
          </section>
        )}

        {/* Success */}
        {succeeded && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <div className="text-lg font-semibold text-white">{t('paymentSuccess')}</div>
            <p className="text-sm text-gray-400">{t('paymentSuccessBody')}</p>
            {phase.kind === 'polling' && (
              <ReceiptDownloadButton paymentId={phase.paymentId} size="default" />
            )}
          </section>
        )}

        {/* Failure (declined / cancelled) or timeout */}
        {(pollFailed || pollTimedOut) && (
          <section className="card flex flex-col items-center gap-3 p-6 text-center">
            <XCircle className="h-12 w-12 text-red-400" />
            <div className="text-lg font-semibold text-white">{t('paymentFailed')}</div>
            <p className="text-sm text-gray-400">
              {pollTimedOut
                ? t('paymentTimeout')
                : pollState.kind === 'failed'
                  ? pollState.reason
                  : t('paymentFailedBody')}
            </p>
            <Button type="button" variant="outline" onClick={handleRetry}>
              {t('tryAgain')}
            </Button>
          </section>
        )}
      </div>
    </>
  );
}

function MpesaPayFallback() {
  const t = useTranslations('mpesaPay');
  return <PageHeader title={t('title')} showBack />;
}

export default function MpesaPage() {
  return (
    <Suspense fallback={<MpesaPayFallback />}>
      <MpesaPayInner />
    </Suspense>
  );
}
