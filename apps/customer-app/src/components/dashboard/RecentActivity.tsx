'use client';

import { useTranslations } from 'next-intl';
import { CreditCard, Wrench, FileText, CheckCircle } from 'lucide-react';
import { useCurrencyPreference } from '@/lib/hooks/useCurrencyPreference';

interface ActivityItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly amount?: number;
  readonly amountSuffix?: string;
  readonly time: string;
  readonly icon: typeof CreditCard;
  readonly iconColor: string;
}

const activities: ReadonlyArray<ActivityItem> = [
  {
    id: '1',
    type: 'payment',
    title: 'Rent Payment Received',
    description: 'paid via M-Pesa',
    amount: 45000,
    amountSuffix: 'paid via M-Pesa',
    time: '2 days ago',
    icon: CreditCard,
    iconColor: 'text-success-600 bg-success-50',
  },
  {
    id: '2',
    type: 'maintenance',
    title: 'Maintenance Request Updated',
    description: 'Plumbing issue scheduled for tomorrow',
    time: '3 days ago',
    icon: Wrench,
    iconColor: 'text-warning-600 bg-warning-50',
  },
  {
    id: '3',
    type: 'document',
    title: 'Statement Available',
    description: 'February 2024 statement ready',
    time: '1 week ago',
    icon: FileText,
    iconColor: 'text-primary-600 bg-primary-50',
  },
  {
    id: '4',
    type: 'maintenance',
    title: 'Maintenance Completed',
    description: 'Electrical repair completed',
    time: '2 weeks ago',
    icon: CheckCircle,
    iconColor: 'text-success-600 bg-success-50',
  },
];

export function RecentActivity() {
  const t = useTranslations('recentActivity');
  const { format: formatCurrency } = useCurrencyPreference();
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">{t('heading')}</h2>
      <div className="card divide-y divide-gray-100">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const description =
            typeof activity.amount === 'number'
              ? `${formatCurrency(activity.amount)} ${activity.amountSuffix ?? ''}`.trim()
              : activity.description;
          return (
            <div key={activity.id} className="flex items-start gap-3 p-4">
              <div className={`p-2 rounded-lg ${activity.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{activity.title}</div>
                <div className="text-sm text-gray-500 truncate">
                  {description}
                </div>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {activity.time}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
