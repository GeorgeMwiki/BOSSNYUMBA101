'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ChevronDown,
  HelpCircle,
  Menu,
  X,
  ArrowRight,
  Home,
  Users,
  Briefcase,
  Building,
  Landmark,
  ShieldCheck,
  HeartHandshake,
  UserCircle,
  Globe,
  GraduationCap,
  LineChart,
  Church,
} from 'lucide-react';

import { Wordmark } from '@bossnyumba/design-system';

/**
 * BossNyumba MainNav — carbon copy of LitFin's MainNav pattern
 * (LITFIN_PATH/src/components/marketing/MainNav.tsx) adapted to
 * BossNyumba's real-estate audience verticals. Scroll-aware backdrop,
 * "Who We Serve" mega-menu, smart CTA per page.
 */

// ----------------------------------------------------------------------------
// "Who We Serve" mega-menu — BossNyumba real-estate audiences only.
// ----------------------------------------------------------------------------

interface AudienceItem {
  readonly label: string;
  readonly desc: string;
  readonly href: string;
  readonly icon: typeof Home;
}

interface AudienceCategory {
  readonly title: string;
  readonly items: ReadonlyArray<AudienceItem>;
}

const AUDIENCE_CATEGORIES: ReadonlyArray<AudienceCategory> = [
  {
    title: 'Individuals',
    items: [
      {
        label: 'Individual landlord',
        desc: 'One or two properties. Calm operator co-pilot.',
        href: '/for-individual-landlord',
        icon: Home,
      },
      {
        label: 'Tenant',
        desc: 'Lease, rent, maintenance — all in one place.',
        href: '/for-tenant',
        icon: UserCircle,
      },
    ],
  },
  {
    title: 'Operators',
    items: [
      {
        label: 'Portfolio landlord',
        desc: 'Multi-property portfolios with treasury.',
        href: '/for-portfolio-landlord',
        icon: Building,
      },
      {
        label: 'Leasing agency',
        desc: 'Brokerage flows + commission accounting.',
        href: '/for-leasing-agency',
        icon: Briefcase,
      },
      {
        label: 'Housing cooperative',
        desc: 'Member governance + shared facilities.',
        href: '/for-housing-cooperative',
        icon: Users,
      },
    ],
  },
  {
    title: 'Capital',
    items: [
      {
        label: 'Real-estate investor',
        desc: 'Cap-rate, yield, valuation, exit modelling.',
        href: '/for-real-estate-investor',
        icon: Building2,
      },
      {
        label: 'Family office',
        desc: 'Inter-generational estate stewardship.',
        href: '/for-family-office',
        icon: HeartHandshake,
      },
      {
        label: 'Bank',
        desc: 'Property-collateralised lending desk.',
        href: '/for-bank',
        icon: Landmark,
      },
    ],
  },
  {
    title: 'Public',
    items: [
      {
        label: 'Regulator',
        desc: 'NHC / BRELA / TRA compliance signal.',
        href: '/for-regulator',
        icon: ShieldCheck,
      },
      {
        label: 'Community housing',
        desc: 'Affordable + non-profit housing operators.',
        href: '/for-community-housing',
        icon: HeartHandshake,
      },
      {
        label: 'Government entity',
        desc: 'Parastatals and ministries stewarding public property.',
        href: '/for-government-entity',
        icon: Landmark,
      },
    ],
  },
  {
    title: 'Enterprise',
    items: [
      {
        label: 'Corporate portfolio',
        desc: 'Staff housing, branch offices, warehouses as one estate.',
        href: '/for-corporate-portfolio',
        icon: Building2,
      },
      {
        label: 'REIT and property fund',
        desc: 'Daily NAV, per-asset P&L, unitholder-grade audit.',
        href: '/for-reit',
        icon: LineChart,
      },
      {
        label: 'University and hospital',
        desc: 'Campus estate, per-faculty P&L, donor-grade audit.',
        href: '/for-institutional-landlord',
        icon: GraduationCap,
      },
    ],
  },
  {
    title: 'Community',
    items: [
      {
        label: 'Diplomatic mission and NGO',
        desc: 'Multi-capital estate, donor-audit-ready ledger.',
        href: '/for-embassy-ngo',
        icon: Globe,
      },
      {
        label: 'Religious organisation',
        desc: 'Congregation-transparent dues + trustee statements.',
        href: '/for-religious-organization',
        icon: Church,
      },
      {
        label: 'SACCO and cooperative',
        desc: 'Member-visible ledger + registrar-ready filings.',
        href: '/for-cooperative-sacco',
        icon: Users,
      },
    ],
  },
] as const;

const ALL_AUDIENCE_HREFS = AUDIENCE_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => item.href),
);

// ----------------------------------------------------------------------------
// Smart CTA per page — operator pages → "Request demo", everyone else
// (home, tenants, marketing) → "Get started".
// ----------------------------------------------------------------------------

const TENANT_PAGES = new Set<string>(['/', '/for-individual-landlord', '/for-tenant', '/about', '/pricing']);
const OPERATOR_PAGES = new Set<string>([
  '/for-portfolio-landlord',
  '/for-leasing-agency',
  '/for-housing-cooperative',
  '/for-real-estate-investor',
  '/for-family-office',
  '/for-bank',
  '/for-regulator',
  '/for-community-housing',
  '/for-corporate-portfolio',
  '/for-government-entity',
  '/for-reit',
  '/for-embassy-ngo',
  '/for-institutional-landlord',
  '/for-religious-organization',
  '/for-cooperative-sacco',
]);

interface PageCTA {
  readonly label: string;
  readonly href: string;
}

function getPageCTA(pathname: string): PageCTA | null {
  if (TENANT_PAGES.has(pathname)) {
    return { label: 'Get started', href: '/sign-up' };
  }
  if (OPERATOR_PAGES.has(pathname)) {
    return { label: 'Request demo', href: '/book-demo' };
  }
  return null;
}

function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function MainNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [audienceDropdownOpen, setAudienceDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const audienceRef = useRef<HTMLDivElement>(null);

  // Scroll-aware nav background
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close audience dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (audienceRef.current && !audienceRef.current.contains(e.target as Node)) {
        setAudienceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pageCTA = getPageCTA(pathname ?? '/');
  const isOnAudiencePage = ALL_AUDIENCE_HREFS.includes(pathname ?? '');

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/92 backdrop-blur-2xl shadow-[0_18px_50px_rgb(15_23_42_/_0.08)] border-b border-border/60'
          : 'bg-background/72 backdrop-blur-xl border-b border-border/40',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="shrink-0" aria-label="BossNyumba home">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Wordmark size="sm" premium />
          </motion.div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Who We Serve mega-menu */}
          <div className="relative" ref={audienceRef}>
            <button
              type="button"
              onClick={() => setAudienceDropdownOpen(!audienceDropdownOpen)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isOnAudiencePage
                  ? 'text-foreground bg-muted/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Users className="h-4 w-4" />
              Who We Serve
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  audienceDropdownOpen && 'rotate-180',
                )}
              />
            </button>
            <AnimatePresence>
              {audienceDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-[720px] p-4 rounded-2xl bg-card border border-border/50 shadow-xl backdrop-blur-xl"
                >
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {AUDIENCE_CATEGORIES.map((cat) => (
                      <div key={cat.title}>
                        <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {cat.title}
                        </h4>
                        <div className="space-y-1">
                          {cat.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setAudienceDropdownOpen(false)}
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground">
                                    {item.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground line-clamp-1">
                                    {item.desc}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/pricing"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            About
          </Link>
          <Link
            href="/docs"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/contact"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="h-4 w-4 inline mr-1" />
            Support
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            Log In
          </Link>
          <Link
            href={pageCTA?.href ?? '/sign-up'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_-4px_hsl(24_72%_50%/0.45),0_2px_6px_hsl(14_62%_30%/0.2)] transition-all hover:scale-[1.03] hover:shadow-[0_10px_24px_-4px_hsl(24_72%_50%/0.55),0_3px_8px_hsl(14_62%_30%/0.25)] active:scale-[0.97]"
          >
            {pageCTA?.label ?? 'Sign Up'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-border/40 bg-background/95 backdrop-blur-xl"
          >
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4 space-y-4">
              {AUDIENCE_CATEGORIES.map((cat) => (
                <div key={cat.title}>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.title}
                  </h4>
                  <div className="space-y-0.5">
                    {cat.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-2 text-sm text-foreground hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-border/30 space-y-1">
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  Pricing
                </Link>
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  About
                </Link>
                <Link
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  Docs
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  Support
                </Link>
              </div>
              <div className="pt-2 border-t border-border/30 flex gap-2">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-sm font-medium text-foreground rounded-lg border border-border"
                >
                  Log In
                </Link>
                <Link
                  href={pageCTA?.href ?? '/sign-up'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-sm font-semibold text-primary-foreground rounded-lg bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)]"
                >
                  {pageCTA?.label ?? 'Sign Up'}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
