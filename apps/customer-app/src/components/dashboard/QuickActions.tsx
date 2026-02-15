'use client';

import Link from 'next/link';
import { CreditCard, Wrench, FileText, MessageCircle } from 'lucide-react';

const actions = [
  {
    href: '/payments/pay',
    icon: CreditCard,
    label: 'Pay Rent',
    color: 'bg-primary-600',
  },
  {
    href: '/requests/new',
    icon: Wrench,
    label: 'Report Issue',
    color: 'bg-success-600',
  },
  {
    href: '/lease',
    icon: FileText,
    label: 'Lease',
    color: 'bg-warning-600',
  },
  {
    href: '/support',
    icon: MessageCircle,
    label: 'Support',
    color: 'bg-gray-600',
  },
];

export function QuickActions() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Quick Actions</h2>
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
