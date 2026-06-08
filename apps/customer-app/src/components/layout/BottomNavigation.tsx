'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, Wrench, User, MessageCircle } from 'lucide-react';
// `prefetchOnHover` injects `<link rel="prefetch">` on first hover / focus
// / touchstart so the destination route is cache-warm before the click.
// Next's <Link> prefetches in viewport by default; this is the cheaper,
// more deterministic hover signal on top.
import { prefetchOnHover } from '@bossnyumba/performance-toolkit/lazy-load';

// NOTE: the `/marketplace` entry was removed from the bottom nav until the
// surface is wired to live vendor/catalog data. The route still exists and
// renders `LiveDataRequiredScreen`, but advertising it in the primary nav
// sent every tenant into a dead-end screen. Re-add this entry once the
// marketplace listings page consumes the gateway marketplace router.
const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/payments', icon: CreditCard, label: 'Pay' },
  { href: '/requests', icon: Wrench, label: 'Requests' },
  { href: '/messages', icon: MessageCircle, label: 'Messages' },
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
          const prefetch = prefetchOnHover(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              {...prefetch}
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
