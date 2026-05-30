'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Shield, Mail, MapPin, ExternalLink } from 'lucide-react';

import { Wordmark, BRAND } from '@bossnyumba/design-system';

/**
 * BossNyumba MarketingFooter — carbon copy of LitFin's MarketingFooter
 * pattern (LITFIN_PATH/src/components/marketing/MarketingFooter.tsx)
 * adapted to BossNyumba's real-estate audience matrix.
 *
 * 4-column LitFin footer: Company · Platform · Capabilities · Resources,
 * plus legal row and contact block.
 */

interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

interface FooterSection {
  readonly title: string;
  readonly links: ReadonlyArray<FooterLink>;
}

export function MarketingFooter() {
  const FOOTER_LINKS: Record<string, FooterSection> = useMemo(
    () => ({
      company: {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'Contact', href: '/contact' },
          { label: 'Careers', href: '/careers' },
          { label: 'Blog', href: '/blog' },
        ],
      },
      platform: {
        title: 'Who We Serve',
        links: [
          { label: 'Individual landlord', href: '/for-individual-landlord' },
          { label: 'Portfolio landlord', href: '/for-portfolio-landlord' },
          { label: 'Tenant', href: '/for-tenant' },
          { label: 'Leasing agency', href: '/for-leasing-agency' },
          { label: 'Housing cooperative', href: '/for-housing-cooperative' },
          { label: 'Real-estate investor', href: '/for-real-estate-investor' },
          { label: 'Family office', href: '/for-family-office' },
          { label: 'Bank', href: '/for-bank' },
          { label: 'Regulator', href: '/for-regulator' },
          { label: 'Community housing', href: '/for-community-housing' },
        ],
      },
      capabilities: {
        title: 'Capabilities',
        links: [
          {
            label: 'Mr. Mwikila — AI Estate-Management Partner',
            href: '/for-individual-landlord',
          },
          { label: 'Rent treasury', href: '/for-portfolio-landlord' },
          { label: 'Maintenance dispatch', href: '/for-individual-landlord' },
          { label: 'Compliance auto-pack', href: '/for-regulator' },
          { label: 'Voice AI (Swahili/EN)', href: '/for-tenant' },
        ],
      },
      resources: {
        title: 'Resources',
        links: [
          { label: 'Docs', href: '/docs' },
          { label: 'Status', href: '/status' },
          { label: 'DPA', href: '/dpa' },
          { label: 'Pilot programme', href: '/pilot' },
        ],
      },
    }),
    [],
  );

  return (
    <footer className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12 md:py-16">
        {/* Top row — wordmark + tagline + 4 link columns */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" aria-label="BossNyumba home">
              <Wordmark size="md" premium />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              {BRAND.longTagline}
            </p>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Dar es Salaam · Nairobi · Kampala</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <a
                  href="mailto:hello@bossnyumba.co.tz"
                  className="hover:text-foreground transition-colors"
                >
                  hello@bossnyumba.co.tz
                </a>
              </div>
            </div>
          </div>

          {Object.values(FOOTER_LINKS).map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {link.label}
                      {link.external && <ExternalLink className="h-3 w-3" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row — legal + compliance signal */}
        <div className="mt-12 pt-8 border-t border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span>
              PDPA · GDPR · NHC · BRELA · TRA compliant · RLS on every record
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">
              Legal
            </Link>
            <Link href="/dpa" className="hover:text-foreground transition-colors">
              DPA
            </Link>
            <span>&copy; {new Date().getFullYear()} BossNyumba Ltd.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
