'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CreditCard, Wrench, FileText, MessageCircle } from 'lucide-react';

export function QuickActions() {
  const t = useTranslations('quickActions');
  const actions = [
    { href: '/payments/pay', icon: CreditCard, label: t('payRent'), color: 'bg-primary-600' },
    { href: '/requests/new', icon: Wrench, label: t('reportIssue'), color: 'bg-success-600' },
    { href: '/lease', icon: FileText, label: t('lease'), color: 'bg-warning-600' },
    { href: '/support', icon: MessageCircle, label: t('support'), color: 'bg-gray-600' },
  ];
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">{t('heading')}</h2>
      <div className="grid grid-cols-4 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center"
            >
              <div className={`${action.color} p-3 rounded-xl mb-2`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-gray-600 text-center">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
