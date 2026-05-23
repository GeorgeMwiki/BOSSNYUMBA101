'use client';

/**
 * Estate Manager — DG (Directeur Général / district-grade) view of the
 * executive brief.
 *
 * Differs from the owner-portal version in three ways:
 *   1. Scope is the manager's district (server-side RLS does the rest)
 *   2. Layout is denser — operators read fast
 *   3. Acts as a launch point: every section deep-links into the
 *      authoritative ops surface (workforce, parcels, briefing, etc.)
 *
 * Gated by `executive_brief_enabled` so the existing `/briefing` flow
 * stays untouched until ops decide to switch.
 *
 * TODO(wave3-int5): wire `executiveBriefService.getDistrictBrief()`
 * (added when api-client gains the executive-brief-engine port).
 */

import { useTranslations } from 'next-intl';
import { Sparkles, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { isFeatureEnabled } from '@/lib/featureFlags';

export default function ManagerBriefsPage() {
  const t = useTranslations('managerBriefs');
  const enabled = isFeatureEnabled('executive_brief_enabled');

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
        <section className="px-4 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t('disabledTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('disabledDescription')}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} showBack />
      <section className="px-4 py-4 space-y-4" data-testid="manager-briefs-empty">
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/30 p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-amber-500" />
          <h3 className="mt-3 text-base font-semibold">{t('emptyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('emptyDescription')}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { href: '/workforce', key: 'workforceCard' as const },
            { href: '/parcels', key: 'parcelsCard' as const },
            { href: '/proposals', key: 'proposalsCard' as const },
            { href: '/briefing', key: 'briefingCard' as const },
          ].map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 hover:border-amber-500"
              data-testid={`brief-launchpad-${key}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t(`launchpad.${key}`)}</span>
                <ExternalLink className="h-4 w-4 text-amber-500" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
