'use client';

import { ArrowLeft, Bell, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showProfile?: boolean;
  action?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle, 
  showBack, 
  showNotifications = true,
  showProfile,
  action 
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {showNotifications && (
            <Link href="/notifications" className="p-2 rounded-full hover:bg-gray-100 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
            </Link>
          )}
          {showProfile && (
            <Link href="/settings" className="p-2 rounded-full hover:bg-gray-100">
              <User className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
