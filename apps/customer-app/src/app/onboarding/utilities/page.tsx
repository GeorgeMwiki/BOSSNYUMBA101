'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Droplets,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Info,
  Flame,
  Wifi,
  Gauge,
} from 'lucide-react';
import { EmptyState } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type OnboardingUtilityAccount } from '@/lib/api';
import { ROUTES } from '@/lib/routes';

/**
 * Static, generic per-utility-type presentation. The ICON and the
 * instructional COPY are generic templates (allowed to stay per the
 * no-mock mandate — they carry no fabricated identifiers). Every
 * IDENTIFIER (meter number, account number, provider) comes from the
 * resident's REAL `utility_accounts` record fetched below.
 */
const TYPE_ICON: Record<string, React.ElementType> = {
  electricity: Zap,
  water: Droplets,
  gas: Flame,
  internet: Wifi,
};

const INSTRUCTION_KEY: Record<string, string> = {
  electricity: 'electricity',
  water: 'water',
  gas: 'gas',
};

export default function OnboardingUtilitiesPage() {
  const t = useTranslations('pageHeaders');
  const tU = useTranslations('p89.onboardingUtilities');
  const router = useRouter();

  const utilitiesQuery = useQuery({
    queryKey: ['onboarding-utilities'],
    queryFn: () => api.onboarding.getUtilities(),
  });

  const accounts = utilitiesQuery.data?.utilities ?? [];

  const [acknowledged, setAcknowledged] = useState<Record<string, true>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acknowledgedCount = accounts.filter((a) => acknowledged[a.id]).length;
  const allAcknowledged = accounts.length > 0 && acknowledgedCount === accounts.length;

  const handleAcknowledge = (id: string) => {
    setAcknowledged((prev) => ({ ...prev, [id]: true }));
    const currentIdx = accounts.findIndex((a) => a.id === id);
    const next = accounts[currentIdx + 1];
    if (next && !acknowledged[next.id]) {
      setExpandedId(next.id);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const handleContinue = async () => {
    setIsSubmitting(true);

    try {
      await api.onboarding.updateStep('utilities', {
        acknowledged: accounts.map((a) => a.id),
      });
    } catch {
      // Best-effort step persistence — never blocks advancing.
    }

    const progress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}',
    );
    progress.utilities = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    setIsSubmitting(false);
    router.push(ROUTES.onboarding.orientation);
  };

  const KNOWN_TYPES = ['electricity', 'water', 'gas', 'internet'];
  const typeLabel = (account: OnboardingUtilityAccount) => {
    const key = KNOWN_TYPES.includes(account.utilityType) ? account.utilityType : 'other';
    return tU(`type.${key}`);
  };

  const instructionFor = (account: OnboardingUtilityAccount) => {
    const key = INSTRUCTION_KEY[account.utilityType] ?? 'generic';
    return tU(`instructions.${key}`);
  };

  return (
    <>
      <PageHeader title={t('utilitiesSetup')} showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {utilitiesQuery.isLoading && (
          <div className="card p-4 text-sm text-gray-400">{tU('loading')}</div>
        )}

        {utilitiesQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 flex items-center justify-between gap-3">
            <span>{(utilitiesQuery.error as Error).message || tU('errorLoad')}</span>
            <button
              type="button"
              onClick={() => utilitiesQuery.refetch()}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {tU('retry')}
            </button>
          </div>
        )}

        {/* Honest empty/pending state — the unit has no utility accounts
            provisioned yet, so there are no real meters to show. We NEVER
            fabricate a meter identifier here. */}
        {!utilitiesQuery.isLoading && !utilitiesQuery.error && accounts.length === 0 && (
          <EmptyState
            icon={<Gauge className="h-8 w-8" />}
            title={tU('emptyTitle')}
            description={tU('emptyDesc')}
          />
        )}

        {accounts.length > 0 && (
          <>
            {/* Progress */}
            <div className="card p-4 bg-primary-50 border-primary-100">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-primary-700 font-medium">{tU('reviewProgress')}</span>
                <span className="text-primary-600">
                  {acknowledgedCount} {tU('of')} {accounts.length} {tU('reviewed')}
                </span>
              </div>
              <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{ width: `${(acknowledgedCount / accounts.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <p>{tU('intro')}</p>
            </div>

            {/* Utility Cards — one per REAL account */}
            <div className="space-y-4">
              {accounts.map((account) => {
                const Icon = TYPE_ICON[account.utilityType] ?? Gauge;
                const isExpanded = expandedId === account.id;
                const isAcknowledged = Boolean(acknowledged[account.id]);

                return (
                  <div key={account.id} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : account.id)}
                      className="w-full p-4 flex items-center gap-3 text-left"
                    >
                      <div
                        className={`p-2.5 rounded-xl ${
                          isAcknowledged ? 'bg-success-50' : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            isAcknowledged ? 'text-success-600' : 'text-gray-600'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{typeLabel(account)}</h3>
                          {isAcknowledged && <Check className="w-4 h-4 text-success-600" />}
                        </div>
                        {/* Real provider — never fabricated. */}
                        <p className="text-sm text-gray-500">{account.provider}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {/* Real meter number (if present on the account). */}
                        {account.meterNumber && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">
                              {tU('meterNumberLabel')}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-medium text-sm">
                                {account.meterNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(account.meterNumber!)}
                                className="btn text-xs bg-gray-200 text-gray-700 px-2 py-1 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                {copiedText === account.meterNumber
                                  ? tU('reviewedDone')
                                  : tU('copyMeterNumber')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Real account number. */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">
                            {tU('accountNumberLabel')}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-medium text-sm">
                              {account.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(account.accountNumber)}
                              className="btn text-xs bg-gray-200 text-gray-700 px-2 py-1 flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedText === account.accountNumber
                                ? tU('reviewedDone')
                                : tU('copyAccountNumber')}
                            </button>
                          </div>
                        </div>

                        {/* Generic instructional copy (no fabricated IDs). */}
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {instructionFor(account)}
                        </p>

                        {!isAcknowledged ? (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(account.id)}
                            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            {tU('iReviewed')}
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-sm text-success-600 font-medium py-2">
                            <Check className="w-4 h-4" />
                            {tU('reviewedDone')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Fixed bottom button — only when there are real accounts to review. */}
      {accounts.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            onClick={handleContinue}
            disabled={!allAcknowledged || isSubmitting}
            className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {tU('saving')}
              </>
            ) : (
              <>
                {tU('continue')}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
