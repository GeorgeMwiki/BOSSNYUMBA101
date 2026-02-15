'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CreditCard,
  Wrench,
  FileText,
  Calendar,
  CheckCheck,
  Trash2,
  Settings,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { NotificationItem } from '@/components/notifications/NotificationItem';

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

type CategoryFilter = 'all' | 'payments' | 'maintenance' | 'announcements';

const notifications: Notification[] = [
  {
    id: '1',
    category: 'payment_due',
    title: 'Payment Due Reminder',
    body: 'Your rent payment of KES 45,000 is due in 5 days.',
    timestamp: '2024-02-25T10:00:00Z',
    read: false,
    actionUrl: '/payments/pay',
  },
  {
    id: '2',
    category: 'maintenance_scheduled',
    title: 'Maintenance Scheduled',
    body: 'Your plumbing repair is scheduled for Feb 25 at 9:00 AM.',
    timestamp: '2024-02-24T14:30:00Z',
    read: false,
    actionUrl: '/maintenance/1',
  },
  {
    id: '3',
    category: 'payment_received',
    title: 'Payment Received',
    body: 'We received your payment of KES 45,000. Thank you!',
    timestamp: '2024-02-01T09:15:00Z',
    read: true,
    actionUrl: '/payments/2',
  },
  {
    id: '4',
    category: 'document_ready',
    title: 'Statement Available',
    body: 'Your February 2024 statement is ready to view.',
    timestamp: '2024-02-01T08:00:00Z',
    read: true,
    actionUrl: '/payments/statements',
  },
  {
    id: '5',
    category: 'maintenance_completed',
    title: 'Maintenance Completed',
    body: 'Your electrical repair has been completed. Please rate your experience.',
    timestamp: '2024-01-28T16:45:00Z',
    read: true,
    actionUrl: '/maintenance/3',
  },
  {
    id: '6',
    category: 'lease_expiring',
    title: 'Lease Expiring Soon',
    body: 'Your lease will expire in 75 days. Contact us about renewal options.',
    timestamp: '2024-01-15T10:00:00Z',
    read: true,
    actionUrl: '/lease',
  },
  {
    id: '7',
    category: 'announcement',
    title: 'Building Maintenance Notice',
    body: 'Water will be shut off on Feb 20 from 8am to 12pm for pipe repairs.',
    timestamp: '2024-02-10T09:00:00Z',
    read: false,
    actionUrl: '/support',
  },
];

const categoryIcons: Record<string, React.ElementType> = {
  payment_due: CreditCard,
  payment_received: CreditCard,
  payment_overdue: CreditCard,
  maintenance_update: Wrench,
  maintenance_scheduled: Wrench,
  maintenance_completed: Wrench,
  lease_expiring: Calendar,
  lease_renewal: FileText,
  document_ready: FileText,
  announcement: Bell,
  alert: Bell,
  reminder: Bell,
};

const categoryColors: Record<string, string> = {
  payment_due: 'bg-warning-50 text-warning-600',
  payment_received: 'bg-success-50 text-success-600',
  payment_overdue: 'bg-danger-50 text-danger-600',
  maintenance_update: 'bg-primary-50 text-primary-600',
  maintenance_scheduled: 'bg-primary-50 text-primary-600',
  maintenance_completed: 'bg-success-50 text-success-600',
  lease_expiring: 'bg-warning-50 text-warning-600',
  lease_renewal: 'bg-primary-50 text-primary-600',
  document_ready: 'bg-gray-100 text-gray-600',
  announcement: 'bg-primary-50 text-primary-600',
  alert: 'bg-danger-50 text-danger-600',
  reminder: 'bg-gray-100 text-gray-600',
};

const PAYMENT_CATEGORIES = ['payment_due', 'payment_received', 'payment_overdue', 'document_ready', 'lease_expiring', 'lease_renewal'];
const MAINTENANCE_CATEGORIES = ['maintenance_update', 'maintenance_scheduled', 'maintenance_completed'];
const ANNOUNCEMENT_CATEGORIES = ['announcement', 'alert', 'reminder'];

function getCategoryFilter(cat: string): CategoryFilter {
  if (PAYMENT_CATEGORIES.includes(cat)) return 'payments';
  if (MAINTENANCE_CATEGORIES.includes(cat)) return 'maintenance';
  if (ANNOUNCEMENT_CATEGORIES.includes(cat)) return 'announcements';
  return 'all';
}

export default function NotificationsPage() {
  const [items, setItems] = useState(notifications);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const unreadCount = items.filter((n) => !n.read).length;

  const filteredItems = items.filter((n) => {
    if (filter === 'all') return true;
    return getCategoryFilter(n.category) === filter;
  });

  const markAllAsRead = () => {
    setItems(items.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setItems(items.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAll = () => {
    setItems([]);
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const categoryTabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'payments', label: 'Payments' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'announcements', label: 'Announcements' },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        action={
          <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100">
            <Settings className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-4 py-4">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        {items.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : `${filteredItems.length} notification${filteredItems.length !== 1 ? 's' : ''}`}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary-600 flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-sm text-gray-500 flex items-center gap-1 hover:text-danger-600"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Notification List */}
        <div className="space-y-3">
          {filteredItems.map((notification) => {
            const Icon = categoryIcons[notification.category] || Bell;
            const colorClass = categoryColors[notification.category] || 'bg-gray-100 text-gray-600';

            return (
              <NotificationItem
                key={notification.id}
                id={notification.id}
                category={notification.category}
                title={notification.title}
                body={notification.body}
                timestamp={notification.timestamp}
                read={notification.read}
                icon={Icon}
                iconColor={colorClass}
                actionUrl={notification.actionUrl}
                onClick={() => handleNotificationClick(notification)}
              />
            );
          })}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
