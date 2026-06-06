'use client';

/**
 * DomainPicker — step 1 of the coworker create-course flow.
 *
 * A grid of estate-management topic domains (rent affordability, tenancy law,
 * compliance, repairs, portfolio ops, investment strategy). Bilingual labels;
 * the chosen domain id + resolved label flow up to the parent flow.
 *
 * Pulls the catalog from `@bossnyumba/ai-copilot/courses` (isomorphic schema /
 * domains module exposed via a dedicated subpath export — safe on the client).
 */

import { useMemo } from 'react';
import {
  BookOpen,
  Building2,
  Scale,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { COURSE_DOMAINS, type CourseDomain } from '@bossnyumba/ai-copilot/courses';

// Explicit named imports only — a namespace `import * as Icons` pulls the
// entire lucide-react module into this route's graph and defeats the app's
// modularizeImports / optimizePackageImports tree-shaking. This map covers
// every `CourseDomain.icon` value shipped in COURSE_DOMAINS; unknown names
// fall back to BookOpen below.
const DOMAIN_ICONS: Readonly<Record<string, LucideIcon>> = {
  Building2,
  Scale,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
};

type Language = 'en' | 'sw';

export interface DomainSelection {
  readonly domainId: string;
  readonly label: string;
}

interface DomainPickerProps {
  readonly language: Language;
  readonly onSelect: (selection: DomainSelection) => void;
}

function DomainIcon({ name }: { name: string }): JSX.Element {
  const Resolved = DOMAIN_ICONS[name] ?? BookOpen;
  return <Resolved className="w-5 h-5 text-sky-600" />;
}

export function DomainPicker({ language, onSelect }: DomainPickerProps): JSX.Element {
  const t = useTranslations('createCourse');
  const domains = useMemo<ReadonlyArray<CourseDomain>>(() => COURSE_DOMAINS, []);

  return (
    <section aria-labelledby="domain-step-heading" className="space-y-4">
      <div>
        <h2 id="domain-step-heading" className="text-lg font-semibold text-gray-900">
          {t('domainHeading')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('domainSubheading')}</p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list">
        {domains.map((domain) => {
          const label = language === 'sw' ? domain.labelSw : domain.labelEn;
          const description =
            language === 'sw' ? domain.descriptionSw : domain.descriptionEn;
          return (
            <li key={domain.id}>
              <button
                type="button"
                onClick={() => onSelect({ domainId: domain.id, label })}
                className="group w-full text-left rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-sky-400 hover:bg-sky-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                    <DomainIcon name={domain.icon} />
                  </span>
                  <span className="font-medium text-gray-900">{label}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{description}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
