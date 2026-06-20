import {
  Home,
  UserCircle,
  Building,
  Briefcase,
  Users,
  Building2,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  GraduationCap,
  LineChart,
  Globe,
  Church,
} from 'lucide-react';

/**
 * Canonical "Who We Serve" audience taxonomy — the SINGLE source of truth for
 * every real-estate business BossNyumba serves. Both the nav mega-menu
 * (MainNav) and the homepage "Built for every real-estate business" band
 * (WhoWeServeSection) build from this so labels, ordering, hrefs, and icons
 * never drift between surfaces. Every entry maps 1:1 to a `/for-*` route and
 * to a `COPY` key in `audience-copy.ts`. Labels are single-locale per the
 * active toggle (no en/sw mixing).
 */

export interface AudienceItem {
  readonly label: string;
  readonly desc: string;
  readonly href: string;
  readonly icon: typeof Home;
}

export interface AudienceCategory {
  readonly title: string;
  readonly items: ReadonlyArray<AudienceItem>;
}

/** The six group titles, resolved to the active locale by the caller. */
export interface AudienceCategoryLabels {
  readonly individuals: string;
  readonly operators: string;
  readonly capital: string;
  readonly public: string;
  readonly enterprise: string;
  readonly community: string;
}

export function buildAudienceCategories(
  categories: AudienceCategoryLabels,
  sw: boolean
): ReadonlyArray<AudienceCategory> {
  return [
    {
      title: categories.individuals,
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
      title: categories.operators,
      items: [
        {
          label: sw ? 'Mwenye mali ya mfululizo' : 'Portfolio landlord',
          desc: sw ? 'Mali nyingi pamoja na hazina.' : 'Multi-property portfolios with treasury.',
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
      title: categories.capital,
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
          desc: sw ? 'Usimamizi wa mali wa vizazi.' : 'Inter-generational estate stewardship.',
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
      title: categories.public,
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
      title: categories.enterprise,
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
            ? 'Leja iliyofungwa kwa heshi, uchambuzi wa portfolio, ripoti za utii.'
            : 'Hash-chained ledger, portfolio analytics, compliance exports.',
          href: '/for-reit',
          icon: LineChart,
        },
        {
          label: sw ? 'Chuo kikuu na hospitali' : 'University and hospital',
          desc: sw
            ? 'Ripoti za utii, uchambuzi wa portfolio, ukaguzi uliofungwa kwa heshi.'
            : 'Compliance exports, portfolio analytics, hash-chained audit.',
          href: '/for-institutional-landlord',
          icon: GraduationCap,
        },
      ],
    },
    {
      title: categories.community,
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

/** Every audience href, for active-state checks. Titles do not affect hrefs. */
const HREF_PROBE_TITLES: AudienceCategoryLabels = {
  individuals: '',
  operators: '',
  capital: '',
  public: '',
  enterprise: '',
  community: '',
};

export const ALL_AUDIENCE_HREFS: ReadonlyArray<string> = buildAudienceCategories(
  HREF_PROBE_TITLES,
  false
).flatMap((cat) => cat.items.map((item) => item.href));
