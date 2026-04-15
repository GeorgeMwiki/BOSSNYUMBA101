'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Brain,
  Users,
} from 'lucide-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/brain', icon: Brain, label: 'Brain' },
  { href: '/coworker', icon: Users, label: 'Coworker' },
  { href: '/work-orders', icon: ClipboardList, label: 'Tasks' },
  { href: '/maintenance', icon: Wrench, label: 'Maint' },
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
