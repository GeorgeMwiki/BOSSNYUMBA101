'use client';

import { LucideIcon } from 'lucide-react';

export interface NotificationItemProps {
  id: string;
  category: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  icon?: LucideIcon;
  iconColor?: string;
  actionUrl?: string;
  onClick?: () => void;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationItem({
  title,
  body,
  timestamp,
  read,
  icon: Icon,
  iconColor = 'bg-gray-100 text-gray-600',
  onClick,
}: NotificationItemProps) {
  return (
    <div
      onClick={onClick}
      className={`card p-4 cursor-pointer transition-all ${
        !read ? 'bg-primary-50/50 border-primary-100' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm">{title}</div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {formatTimestamp(timestamp)}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{body}</p>
        </div>
      </div>
    </div>
  );
}
