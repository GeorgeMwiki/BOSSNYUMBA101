'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Shield, Mail, MapPin, ExternalLink } from 'lucide-react';

import { Wordmark } from '@bossnyumba/design-system';
import { getMessages, type Locale } from '@/lib/i18n';

/**
 * BossNyumba MarketingFooter — locale-aware so EN and SW renders are pure.
 * Carbon copy of LitFin's MarketingFooter pattern.
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

export interface MarketingFooterProps {
  readonly locale: Locale;
}

export function MarketingFooter({ locale }: MarketingFooterProps) {
  const t = getMessages(locale);
  const ft = t.footer;
  const sw = locale === 'sw';

  const audienceLabels: ReadonlyArray<{ slug: string; en: string; sw: string }> = [
    { slug: 'individual-landlord', en: 'Individual landlord', sw: 'Mwenye nyumba binafsi' },
    { slug: 'portfolio-landlord', en: 'Portfolio landlord', sw: 'Mwenye mali ya mfululizo' },
    { slug: 'tenant', en: 'Tenant', sw: 'Mpangaji' },
    { slug: 'leasing-agency', en: 'Leasing agency', sw: 'Wakala wa upangishaji' },
    { slug: 'housing-cooperative', en: 'Housing cooperative', sw: 'Ushirika wa nyumba' },
    { slug: 'real-estate-investor', en: 'Real-estate investor', sw: 'Mwekezaji wa mali' },
    { slug: 'family-office', en: 'Family office', sw: 'Ofisi ya familia' },
    { slug: 'bank', en: 'Bank', sw: 'Benki' },
    { slug: 'regulator', en: 'Regulator', sw: 'Mdhibiti' },
    { slug: 'community-housing', en: 'Community housing', sw: 'Makazi ya jamii' },
    { slug: 'corporate-portfolio', en: 'Corporate portfolio', sw: 'Mali za makampuni' },
    { slug: 'government-entity', en: 'Government entity', sw: 'Taasisi ya serikali' },
    { slug: 'reit', en: 'REIT and property fund', sw: 'REIT na mfuko wa mali' },
    { slug: 'embassy-ngo', en: 'Diplomatic mission and NGO', sw: 'Ubalozi na NGO' },
    { slug: 'institutional-landlord', en: 'University and hospital', sw: 'Chuo kikuu na hospitali' },
    { slug: 'religious-organization', en: 'Religious organisation', sw: 'Taasisi ya kidini' },
    { slug: 'cooperative-sacco', en: 'SACCO and cooperative', sw: 'SACCO na ushirika' },
  ];

  const cmp = sw
    ? { about: 'Kuhusu', pricing: 'Bei', contact: 'Wasiliana nasi', careers: 'Ajira', blog: 'Blogu' }
    : { about: 'About', pricing: 'Pricing', contact: 'Contact', careers: 'Careers', blog: 'Blog' };
  const caps = sw
    ? {
        mwikila: 'Mwl. Mwikila — Mshirika wa AI wa Usimamizi wa Mali',
        treasury: 'Hazina ya kodi',
        maint: 'Usimamizi wa matengenezo',
        compliance: 'Kifurushi cha utii',
        voice: 'Sauti ya AI (Kiswahili/Kiingereza)',
      }
    : {
        mwikila: 'Mr. Mwikila — AI Estate-Management Partner',
        treasury: 'Rent treasury',
        maint: 'Maintenance dispatch',
        compliance: 'Compliance auto-pack',
        voice: 'Voice AI (Swahili/EN)',
      };
  const res = sw
    ? { docs: 'Nyaraka', status: 'Hali ya mfumo', dpa: 'DPA', pilot: 'Programu ya majaribio' }
    : { docs: 'Docs', status: 'Status', dpa: 'DPA', pilot: 'Pilot programme' };

  const FOOTER_LINKS: Record<string, FooterSection> = useMemo(
    () => ({
      company: {
        title: ft.company,
        links: [
          { label: cmp.about, href: '/about' },
          { label: cmp.pricing, href: '/pricing' },
          { label: cmp.contact, href: '/contact' },
          { label: cmp.careers, href: '/careers' },
          { label: cmp.blog, href: '/blog' },
        ],
      },
      platform: {
        title: ft.audience,
        links: audienceLabels.map((entry) => ({
          label: sw ? entry.sw : entry.en,
          href: `/for-${entry.slug}`,
        })),
      },
      capabilities: {
        title: ft.links.capabilities,
        links: [
          { label: caps.mwikila, href: '/for-individual-landlord' },
          { label: caps.treasury, href: '/for-portfolio-landlord' },
          { label: caps.maint, href: '/for-individual-landlord' },
          { label: caps.compliance, href: '/for-regulator' },
          { label: caps.voice, href: '/for-tenant' },
        ],
      },
      resources: {
        title: ft.resources,
        links: [
          { label: res.docs, href: '/docs' },
          { label: res.status, href: '/status' },
          { label: res.dpa, href: '/dpa' },
          { label: res.pilot, href: '/pilot' },
        ],
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  return (
    <footer className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2 md:col-span-2">
            <Link
              href="/"
              aria-label={sw ? 'Ukurasa wa nyumbani wa BossNyumba' : 'BossNyumba home'}
            >
              <Wordmark size="md" premium />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              {ft.tagline}
            </p>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{ft.contactLocation}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <a
                  href={`mailto:${ft.contactEmail}`}
                  className="hover:text-foreground transition-colors"
                >
                  {ft.contactEmail}
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

        <div className="mt-12 pt-8 border-t border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span>{ft.regulatorStrip}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {ft.links.privacy}
            </Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">
              {ft.legal}
            </Link>
            <Link href="/dpa" className="hover:text-foreground transition-colors">
              {res.dpa}
            </Link>
            <span>
              &copy; {new Date().getFullYear()} BossNyumba Ltd. {ft.rights}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
