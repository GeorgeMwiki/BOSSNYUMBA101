'use client';

import { cn } from '@bossnyumba/design-system';

type DateFormat =
  | 'short' // 25 Feb 2024
  | 'long' // 25 February 2024
  | 'full' // Monday, 25 February 2024
  | 'relative' // 3 days ago
  | 'dateTime'; // 25 Feb 2024, 10:30

interface DateDisplayProps {
  date: string | Date;
  format?: DateFormat;
  className?: string;
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DateDisplay({
  date,
  format = 'short',
  className,
}: DateDisplayProps) {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return <span className={className}>—</span>;
  }

  const locale = 'en-KE';

  let formatted: string;
  switch (format) {
    case 'short':
      formatted = d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      break;
    case 'long':
      formatted = d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      break;
    case 'full':
      formatted = d.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      break;
    case 'relative':
      formatted = formatRelative(d);
      break;
    case 'dateTime':
      formatted = d.toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      break;
    default:
      formatted = d.toLocaleDateString(locale);
  }

  return <span className={cn(className)}>{formatted}</span>;
}
