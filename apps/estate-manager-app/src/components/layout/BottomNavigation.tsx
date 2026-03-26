'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Search,
  Calendar,
  BarChart3,
  Wrench,
  MapPin,
  FileText,
  Package,
  Shield,
  DollarSign,
  Menu,
} from 'lucide-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/parcels', icon: MapPin, label: 'Parcels' },
  { href: '/applications', icon: FileText, label: 'Apps' },
  { href: '/assets', icon: Package, label: 'Assets' },
  { href: '/collections', icon: DollarSign, label: 'Collect' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
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
