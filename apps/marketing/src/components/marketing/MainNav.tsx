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
import { type Locale } from '@/lib/i18n';

/**
 * BossNyumba MainNav — carbon copy of the upstream fork's MainNav pattern
 * adapted to BossNyumba's real-estate audience verticals. Scroll-aware
 * backdrop, "Who We Serve" mega-menu, smart CTA per page. Locale-aware so
 * EN and SW renders are pure.
 */

interface NavLabels {
  readonly whoWeServe: string;
  readonly pricing: string;
  readonly about: string;
  readonly docs: string;
  readonly support: string;
  readonly login: string;
  readonly getStarted: string;
  readonly requestDemo: string;
  readonly menuToggle: string;
  readonly homeAria: string;
  readonly categories: {
    readonly individuals: string;
    readonly operators: string;
    readonly capital: string;
    readonly public: string;
    readonly enterprise: string;
    readonly community: string;
  };
}

function getLabels(locale: Locale): NavLabels {
  if (locale === 'sw') {
    return {
      whoWeServe: 'Tunaowahudumia',
      pricing: 'Bei',
      about: 'Kuhusu',
      docs: 'Nyaraka',
      support: 'Msaada',
      login: 'Ingia',
      getStarted: 'Anza sasa',
      requestDemo: 'Omba onyesho',
      menuToggle: 'Funga/fungua menyu',
      homeAria: 'Ukurasa wa nyumbani wa BossNyumba',
      categories: {
        individuals: 'Watu binafsi',
        operators: 'Waendeshaji',
        capital: 'Mtaji',
        public: 'Umma',
        enterprise: 'Mashirika',
        community: 'Jamii',
      },
    };
  }
  return {
    whoWeServe: 'Who We Serve',
    pricing: 'Pricing',
    about: 'About',
    docs: 'Docs',
    support: 'Support',
    login: 'Log In',
    getStarted: 'Get started',
    requestDemo: 'Request demo',
    menuToggle: 'Toggle menu',
    homeAria: 'BossNyumba home',
    categories: {
      individuals: 'Individuals',
      operators: 'Operators',
      capital: 'Capital',
      public: 'Public',
      enterprise: 'Enterprise',
      community: 'Community',
    },
  };
}

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

function buildAudienceCategories(
  labels: NavLabels,
  sw: boolean,
): ReadonlyArray<AudienceCategory> {
  return [
    {
      title: labels.categories.individuals,
      items: [
        {
          label: sw ? 'Mwenye nyumba binafsi' : 'Individual landlord',
          desc: sw
            ? 'Vyumba viwili vitatu. Mshirika tulivu wa uendeshaji.'
            : 'One or two properties. Calm operator co-pilot.',
          href: '/for-individual-landlord',
          icon: Home,
        },
        {
          label: sw ? 'Mpangaji' : 'Tenant',
          desc: sw
            ? 'Mkataba, kodi, matengenezo — kwenye eneo moja.'
            : 'Lease, rent, maintenance — all in one place.',
          href: '/for-tenant',
          icon: UserCircle,
        },
      ],
    },
    {
      title: labels.categories.operators,
      items: [
        {
          label: sw ? 'Mwenye mali ya mfululizo' : 'Portfolio landlord',
          desc: sw
            ? 'Mali nyingi pamoja na hazina.'
            : 'Multi-property portfolios with treasury.',
          href: '/for-portfolio-landlord',
          icon: Building,
        },
        {
          label: sw ? 'Wakala wa upangishaji' : 'Leasing agency',
          desc: sw
            ? 'Mtiririko wa udalali pamoja na hesabu za kamisheni.'
            : 'Brokerage flows + commission accounting.',
          href: '/for-leasing-agency',
          icon: Briefcase,
        },
        {
          label: sw ? 'Ushirika wa nyumba' : 'Housing cooperative',
          desc: sw
            ? 'Utawala wa wanachama pamoja na huduma shirikishi.'
            : 'Member governance + shared facilities.',
          href: '/for-housing-cooperative',
          icon: Users,
        },
      ],
    },
    {
      title: labels.categories.capital,
      items: [
        {
          label: sw ? 'Mwekezaji wa mali' : 'Real-estate investor',
          desc: sw
            ? 'Cap-rate, mavuno, thamani, mfumo wa kutoka.'
            : 'Cap-rate, yield, valuation, exit modelling.',
          href: '/for-real-estate-investor',
          icon: Building2,
        },
        {
          label: sw ? 'Ofisi ya familia' : 'Family office',
          desc: sw
            ? 'Usimamizi wa mali wa vizazi.'
            : 'Inter-generational estate stewardship.',
          href: '/for-family-office',
          icon: HeartHandshake,
        },
        {
          label: sw ? 'Benki' : 'Bank',
          desc: sw
            ? 'Dawati la mikopo iliyotegemea mali.'
            : 'Property-collateralised lending desk.',
          href: '/for-bank',
          icon: Landmark,
        },
      ],
    },
    {
      title: labels.categories.public,
      items: [
        {
          label: sw ? 'Mdhibiti' : 'Regulator',
          desc: sw
            ? 'Ishara ya utii ya NHC / BRELA / TRA.'
            : 'NHC / BRELA / TRA compliance signal.',
          href: '/for-regulator',
          icon: ShieldCheck,
        },
        {
          label: sw ? 'Makazi ya jamii' : 'Community housing',
          desc: sw
            ? 'Waendeshaji wa makazi ya bei nafuu na yasiyo ya faida.'
            : 'Affordable + non-profit housing operators.',
          href: '/for-community-housing',
          icon: HeartHandshake,
        },
        {
          label: sw ? 'Taasisi ya serikali' : 'Government entity',
          desc: sw
            ? 'Mashirika ya serikali na wizara zinazohudumia mali za umma.'
            : 'Parastatals and ministries stewarding public property.',
          href: '/for-government-entity',
          icon: Landmark,
        },
      ],
    },
    {
      title: labels.categories.enterprise,
      items: [
        {
          label: sw ? 'Mali za makampuni' : 'Corporate portfolio',
          desc: sw
            ? 'Nyumba za wafanyakazi, ofisi za matawi, maghala kama mali moja.'
            : 'Staff housing, branch offices, warehouses as one estate.',
          href: '/for-corporate-portfolio',
          icon: Building2,
        },
        {
          label: sw ? 'REIT na mfuko wa mali' : 'REIT and property fund',
          desc: sw
            ? 'NAV ya kila siku, faida na hasara kwa kila mali, ukaguzi wa kiwango cha wanahisa.'
            : 'Daily NAV, per-asset P&L, unitholder-grade audit.',
          href: '/for-reit',
          icon: LineChart,
        },
        {
          label: sw ? 'Chuo kikuu na hospitali' : 'University and hospital',
          desc: sw
            ? 'Mali ya kampasi, faida na hasara kwa kila kitivo, ukaguzi wa kiwango cha wafadhili.'
            : 'Campus estate, per-faculty P&L, donor-grade audit.',
          href: '/for-institutional-landlord',
          icon: GraduationCap,
        },
      ],
    },
    {
      title: labels.categories.community,
      items: [
        {
          label: sw ? 'Ubalozi na NGO' : 'Diplomatic mission and NGO',
          desc: sw
            ? 'Mali katika miji mingi, leja iliyo tayari kwa ukaguzi wa wafadhili.'
            : 'Multi-capital estate, donor-audit-ready ledger.',
          href: '/for-embassy-ngo',
          icon: Globe,
        },
        {
          label: sw ? 'Taasisi ya kidini' : 'Religious organisation',
          desc: sw
            ? 'Michango iliyo wazi kwa waumini pamoja na taarifa za wadhamini.'
            : 'Congregation-transparent dues + trustee statements.',
          href: '/for-religious-organization',
          icon: Church,
        },
        {
          label: sw ? 'SACCO na ushirika' : 'SACCO and cooperative',
          desc: sw
            ? 'Leja inayoonekana kwa wanachama na taarifa zilizotayari kwa msajili.'
            : 'Member-visible ledger + registrar-ready filings.',
          href: '/for-cooperative-sacco',
          icon: Users,
        },
      ],
    },
  ];
}

const AUDIENCE_CATEGORIES_FOR_HREFS: ReadonlyArray<AudienceCategory> =
  buildAudienceCategories(getLabels('en'), false);

const ALL_AUDIENCE_HREFS = AUDIENCE_CATEGORIES_FOR_HREFS.flatMap((cat) =>
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

function getPageCTA(pathname: string, labels: NavLabels): PageCTA | null {
  if (TENANT_PAGES.has(pathname)) {
    return { label: labels.getStarted, href: '/sign-up' };
  }
  if (OPERATOR_PAGES.has(pathname)) {
    return { label: labels.requestDemo, href: '/book-demo' };
  }
  return null;
}

function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export interface MainNavProps {
  readonly locale: Locale;
}

export function MainNav({ locale }: MainNavProps) {
  const pathname = usePathname();
  const labels = getLabels(locale);
  const sw = locale === 'sw';
  const AUDIENCE_CATEGORIES = buildAudienceCategories(labels, sw);
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

  const pageCTA = getPageCTA(pathname ?? '/', labels);
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
        <Link href="/" className="shrink-0" aria-label={labels.homeAria}>
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
              {labels.whoWeServe}
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
            {labels.pricing}
          </Link>
          <Link
            href="/about"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            {labels.about}
          </Link>
          <Link
            href="/docs"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            {labels.docs}
          </Link>
          <Link
            href="/contact"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="h-4 w-4 inline mr-1" />
            {labels.support}
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            {labels.login}
          </Link>
          <Link
            href={pageCTA?.href ?? '/sign-up'}
            className="bg-gradient-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:shadow-glow-lg active:scale-[0.97]"
          >
            {pageCTA?.label ?? labels.getStarted}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label={labels.menuToggle}
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
                  {labels.pricing}
                </Link>
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  {labels.about}
                </Link>
                <Link
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  {labels.docs}
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-medium text-foreground"
                >
                  {labels.support}
                </Link>
              </div>
              <div className="pt-2 border-t border-border/30 flex gap-2">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 text-sm font-medium text-foreground rounded-lg border border-border"
                >
                  {labels.login}
                </Link>
                <Link
                  href={pageCTA?.href ?? '/sign-up'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-gradient-brand flex-1 text-center py-2 text-sm font-semibold text-primary-foreground rounded-lg"
                >
                  {pageCTA?.label ?? labels.getStarted}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
