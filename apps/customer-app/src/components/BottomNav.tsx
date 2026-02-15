'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FileText,
  CreditCard,
  Wrench,
  MessageCircle,
  Bell,
  User,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

interface BottomNavProps {
  variant?: 'default' | 'compact';
  showLabels?: boolean;
  notificationCount?: number;
  messageCount?: number;
}

const defaultNavItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/lease', icon: FileText, label: 'Lease' },
  { href: '/payments', icon: CreditCard, label: 'Pay' },
  { href: '/maintenance', icon: Wrench, label: 'Requests' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav({
  variant = 'default',
  showLabels = true,
  notificationCount = 0,
  messageCount = 0,
}: BottomNavProps) {
  const pathname = usePathname();

  const navItems = defaultNavItems.map((item) => ({
    ...item,
    badge:
      item.href === '/notifications'
        ? notificationCount
        : item.href === '/chat'
        ? messageCount
        : undefined,
  }));

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 ${
        variant === 'compact' ? 'pb-safe-area' : ''
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-4 transition-colors min-w-0 relative ${
                variant === 'compact' ? 'min-h-[52px]' : 'min-h-[56px]'
              } ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`${variant === 'compact' ? 'w-5 h-5' : 'w-6 h-6'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              {showLabels && (
                <span
                  className={`text-xs mt-1 ${
                    isActive ? 'font-medium' : ''
                  }`}
                >
                  {item.label}
                </span>
              )}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Alternative compact version with center action button
export function BottomNavWithAction({
  onActionClick,
  actionIcon: ActionIcon = CreditCard,
  actionLabel = 'Pay',
  notificationCount = 0,
}: {
  onActionClick?: () => void;
  actionIcon?: React.ElementType;
  actionLabel?: string;
  notificationCount?: number;
}) {
  const pathname = usePathname();

  const leftItems: NavItem[] = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/maintenance', icon: Wrench, label: 'Requests' },
  ];

  const rightItems: NavItem[] = [
    { href: '/notifications', icon: Bell, label: 'Alerts', badge: notificationCount },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around relative">
        {leftItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-6 min-h-[56px] ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Center Action Button */}
        <button
          onClick={onActionClick}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary-700 active:scale-95 transition-all"
        >
          <ActionIcon className="w-6 h-6" />
        </button>
        <div className="w-16" /> {/* Spacer for center button */}

        {rightItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-6 min-h-[56px] relative ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Export both as named exports
export default BottomNav;
