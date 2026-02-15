'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, CreditCard, Wrench, Bell, User } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/lease', icon: FileText, label: 'Lease' },
  { href: '/payments', icon: CreditCard, label: 'Pay' },
  { href: '/requests', icon: Wrench, label: 'Requests' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
