// LitFin-rebase: marketing layout now mirrors LitFin's RSC + 5 client
// islands shell. The layout itself stays out of the client bundle —
// MainNav, MarketingFooter, ScrollProgressBar, MarketingWidgetSlot,
// CookieConsent each hydrate independently as client islands.
//
// Source pattern this mirrors:
//   LITFIN_PATH/src/app/(marketing)/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Inter, Syne } from 'next/font/google';
import './globals.css';
import { getLocale } from '@/lib/locale';
import { getMessages } from '@/lib/i18n';
import { CookieConsent } from '@/components/CookieConsent';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ScrollProgressBar } from '@/components/marketing/animations/ScrollProgressBar';
import { MainNav } from '@/components/marketing/MainNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingWidgetSlot } from '@/components/marketing/MarketingWidgetSlot';
import { ErrorBoundary } from '@bossnyumba/design-system';

/**
 * Typography stack — LitFin parity:
 *   - Display: Syne (geometric sans, distinctive weight curve)
 *   - Sans:    Inter (variable, optical-size aware)
 * Shipped from `next/font/google` with subset-latin only so the initial
 * CSS payload stays small.
 */
const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans-override',
  display: 'swap',
});

const fontDisplay = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-override',
  display: 'swap',
});

/**
 * Resolve the canonical marketing site origin. Preview deploys override
 * via `NEXT_PUBLIC_MARKETING_SITE_URL`; production builds must set it
 * (we keep a literal dev fallback only for `next dev`).
 */
function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_MARKETING_SITE_URL must be set in production marketing builds.',
    );
  }
  return 'https://bossnyumba.co.tz';
}

const SITE_URL = resolveSiteUrl();

export const metadata: Metadata = {
  title: 'BossNyumba — The head of the house, amplified',
  description:
    'BossNyumba (Swahili: head of the house) is the autonomous operating system for property portfolios. A brain that boots, listens, acts, remembers, and asks permission correctly. Ten domains, one calm operator, across 232 jurisdictions and 11 languages.',
  applicationName: 'BossNyumba',
  metadataBase: new URL(SITE_URL),
  keywords: [
    'property management Tanzania',
    'AI-native property OS',
    'property lease management',
    'rent-collection treasury',
    'property-management compliance Tanzania',
    'NHC',
    'BRELA',
    'Mr. Mwikila',
    'BossNyumba',
    'real-estate operating system',
  ],
  openGraph: {
    title: 'BossNyumba — The head of the house, amplified',
    description:
      'Run your entire Property Portfolio on autopilot. Leases, rent, maintenance staff, treasury, compliance, marketplace, holdings, subsidiaries, ancillary businesses, family office, succession, asset register. Swahili-first.',
    type: 'website',
    siteName: 'BossNyumba',
    locale: 'sw_TZ',
    alternateLocale: ['en_US'],
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BossNyumba — AI Real-Estate Managing Director',
    description:
      'Run your entire Property Portfolio on autopilot. Bilingual sw/en. Multi-tenant. NHC + BRELA + TRA aware.',
    creator: '@bossnyumba_tz',
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      sw: SITE_URL,
      en: `${SITE_URL}?lang=en`,
    },
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#17100A',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

/**
 * Marketing Layout (RSC) — LitFin pattern.
 *
 * No OnboardingProvider here, onboarding walkthrough popups are portal-
 * only (owner, tenant, agency, admin). The Mr. Mwikila widget still
 * renders for interactive chat context on marketing pages, behind a
 * client island that lazy-loads the widget bundle.
 *
 * Structure mirrors LITFIN_PATH/src/app/(marketing)/layout.tsx:
 *   PortalErrorBoundary
 *     > BossNyumbaAIProvider (lives inside MarketingWidgetSlot)
 *       > ScrollProgressBar (client island)
 *       > marketing-shell
 *           > MainNav (client island)
 *           > main #main-content
 *           > MarketingFooter (client island)
 *       > MarketingWidgetSlot (client island)
 */
export default async function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = getMessages(locale).common;
  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased min-h-screen font-sans">
        <ErrorBoundary>
          <ScrollProgressBar />
          <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
            {t.skipToContent}
          </a>
          <div className="marketing-shell">
            <MainNav />
            <main id="main-content" tabIndex={-1} className="pt-16">
              {children}
            </main>
            <MarketingFooter />
          </div>
          <CookieConsent locale={locale} />
          <MarketingWidgetSlot locale={locale} />
          <ServiceWorkerRegister />
        </ErrorBoundary>
      </body>
    </html>
  );
}
