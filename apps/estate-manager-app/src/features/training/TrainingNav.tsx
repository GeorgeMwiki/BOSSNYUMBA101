'use client';

/**
 * <TrainingNav> — segmented sub-navigation across the three coworker training
 * surfaces: chat-training (/coworker/training), scenario simulation
 * (/coworker/training/scenarios), and the mastery checkpoint
 * (/coworker/training/checkpoint).
 *
 * Mirrors how other estate-manager sections surface sibling pages (Link +
 * usePathname active state), keeping the look native to the app.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessagesSquare, GraduationCap, Award } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';

const ITEMS = [
  { href: ROUTES.coworker.training, icon: MessagesSquare, key: 'navChat' as const, exact: true },
  { href: ROUTES.coworker.trainingScenarios, icon: GraduationCap, key: 'navScenarios' as const },
  { href: ROUTES.coworker.trainingCheckpoint, icon: Award, key: 'navCheckpoint' as const },
];

export function TrainingNav() {
  const t = useTranslations('training');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('navLabel')}
      className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1"
    >
      {ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : (pathname?.startsWith(item.href) ?? false);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              isActive
                ? 'bg-sky-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
