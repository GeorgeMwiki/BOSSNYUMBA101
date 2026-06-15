import type { AudiencePageCopy } from '@/components/audience/AudiencePage';
import type { Locale } from './i18n';

/**
 * Swahili variants — pragmatic per-audience port. We translate the
 * highest-traffic stubs first (individualLandlord, portfolioLandlord,
 * tenant). Audiences without a SW entry fall back to EN (and the
 * existing English COPY) so the page still renders.
 */
const COPY_SW: Partial<Record<string, Readonly<AudiencePageCopy>>> = {
  individualLandlord: {
    heroKicker: 'Kwa mwenye nyumba binafsi',
    heroHeadline: 'Endesha vyumba viwili',
    heroHeadlineAccent: 'kama mali ya mfululizo',
    heroSub:
      'Ukimiliki vitengo 1 hadi 5, Mwl. Mwikila anakusanya kodi kupitia M-Pesa kwa idhini ya mpangaji kwa mguso mmoja, anatuma vikumbusho vya kodi iliyochelewa kiotomatiki, anaandaa wasilisho la ushuru wa halmashauri kwa idhini yako ya mguso mmoja, na kukutumia barua pepe ya muhtasari wa ukurasa mmoja kila tarehe 1. Unabaki bure kwenye kiwango cha Smallholder (T1).',
    heroPrimaryCta: 'Jisajili — bure',
    heroSecondaryCta: 'Inavyofanya kazi',
    trustline: [
      'Bure hadi vitengo 5',
      'Kukusanya kodi kupitia M-Pesa',
      'Hakuna kadi inayohitajika',
    ],
    statsHeading: 'Imejengwa kwa mwenye nyumba wa Kitanzania, sio REIT ya Wall Street.',
    statsSub:
      'Wenye nyumba binafsi hupoteza asilimia 18 ya kodi ya mwaka kwa malipo yanayochelewa, simu za kufuatilia kwa mikono, na risiti zinazokosekana. Mwl. Mwikila huziba pengo hilo kwa vikumbusho vya kiotomatiki, leja ya kuingia mara mbili, na muhtasari wa ukurasa mmoja — kwa gharama sifuri kwenye kiwango cha Smallholder.',
    stats: [
      { value: '18%', label: 'Wastani wa upotevu wa kodi', sub: 'Kwa wenye nyumba wasio na vifaa Dar es Salaam (BOT 2025).' },
      { value: 'Masaa 4', label: 'Yameokolewa kwa mwezi', sub: 'Kwenye kufuatilia kodi, risiti na uhasibu.' },
      { value: 'TZS 0', label: 'Kwenye kiwango cha Smallholder', sub: 'Hadi vitengo 5, kiti kimoja, shughuli za msingi za mali.' },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Hatua tatu. Saa moja. Kisha inajiendesha yenyewe.',
    steps: [
      {
        n: '01',
        title: 'Ongeza vitengo vyako',
        body: 'Piga picha ukurasa wa hati; Mwl. Mwikila huchimba data ya mali na mpangaji. Ongeza nambari yako ya M-Pesa kupokea kodi.',
      },
      {
        n: '02',
        title: 'Mwl. Mwikila anakusanya',
        body: 'Wapangaji wanaidhinisha ombi la M-Pesa kwa simu zao. Waliochelewa hupata ukumbusho wa Kiswahili wa adabu kiotomatiki. Wewe unapata arifa kila malipo yanapofika.',
      },
      {
        n: '03',
        title: 'Muhtasari wa mwenye nyumba tarehe 1',
        body: 'Kila mwezi: kodi iliyopokelewa, ushuru wa halmashauri ulioandaliwa kwa idhini yako, matengenezo yanayodaiwa, salio kwa akaunti yako. PDF na barua pepe.',
      },
    ],
    problemKicker: 'Mkazo',
    problemHeading: 'Kufuatilia kwa mikono, risiti zinazokosekana,',
    problemHeadingAccent: 'na tarehe za mwisho za halmashauri',
    problemSub:
      'Mwenye nyumba binafsi hulipia mifumo iliyokosekana kwa muda wake. Mwl. Mwikila hubadilisha lahajedwali, kufuatilia kwa WhatsApp, na hofu ya mwezi wa ushuru wa halmashauri.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      { title: 'Kufuatilia kwa WhatsApp', desc: 'Unatumia asubuhi ya Jumamosi kufuatilia kodi kutoka kwa wapangaji watatu wote wanaoahidi "kesho".' },
      { title: 'Risiti zinazokosekana', desc: 'Mpangaji anadai amelipa; huwezi kupata SMS ya M-Pesa. Migogoro inaharibu uaminifu.' },
      { title: 'Hofu ya ushuru wa halmashauri', desc: 'Unakumbuka ushuru unahitajika tarehe 28 unapoona WhatsApp kutoka manispaa.' },
      { title: 'Karatasi za mwisho wa mwaka', desc: 'Kufungua ushuru hugeuka kuwa uchimbaji wa kiakiolojia wa siku kadhaa kwenye simu yako.' },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      { title: 'Vikumbusho vya Kiswahili kiotomatiki', desc: 'Mwl. Mwikila anatuma vikumbusho vya kodi iliyochelewa kiotomatiki kupitia WhatsApp, SMS na barua pepe kwa toni sahihi — yenye adabu, thabiti, sio ya kuudhi.' },
      { title: 'Risiti za kripto', desc: 'Kila malipo ya M-Pesa yanafika kwenye leja isiyobadilika ya kuingia mara mbili, hivyo risiti ni ile ile pande zote mbili — hakuna migogoro ya malipo tena.' },
      { title: 'Kalenda ya udhibiti', desc: 'Ushuru wa halmashauri, kodi ya mali, kurefusha mikataba — kila tarehe ya mwisho inafika kwenye simu yako siku 14 mapema.' },
      { title: 'Mwisho wa mwaka tayari kwa ushuru', desc: 'Muhtasari wa wamiliki unaunganisha kuwa pack tayari kwa TRA kwa sekunde 90, kwa idhini yako ya mguso mmoja.' },
    ],
    ctaHeading: 'Anza bure leo.',
    ctaSub: 'Kiwango cha Smallholder ni bure hadi vitengo 5. Jisajili na nambari yako ya M-Pesa — hakuna kadi inayohitajika.',
    ctaPrimary: 'Jisajili — bure',
  },
};

/**
 * Resolve audience copy by key + locale. Falls back to EN if SW
 * translation does not exist yet for a given audience.
 */
export function getAudienceCopy(
  key: keyof typeof COPY,
  locale: Locale,
): Readonly<AudiencePageCopy> {
  if (locale === 'sw' && COPY_SW[String(key)]) {
    return COPY_SW[String(key)] as Readonly<AudiencePageCopy>;
  }
  return COPY[key] as Readonly<AudiencePageCopy>;
}

/**
 * Per-audience-vertical copy for marketing pages. Adapted from the
 * parent fork's audience template and reframed for real estate.
 *
 * Real-estate audience verticals (see
 * Docs/PORT/BOSSNYUMBA_PORT_COORDINATION.md §4 domain map):
 *   for-individual-landlord
 *   for-portfolio-landlord
 *   for-tenant
 *   for-leasing-agency
 *   for-housing-cooperative
 *   for-real-estate-investor
 *   for-family-office
 *   for-bank (property finance / mortgage)
 *   for-regulator (housing regulator)
 *   for-community-housing
 *
 * Each entry is a `Readonly<AudiencePageCopy>` so the audience page
 * file is <40 LOC: a stub that imports the copy + the kicker icon.
 */

export const COPY = {
  individualLandlord: {
    heroKicker: 'For the individual landlord',
    heroHeadline: 'Run two flats',
    heroHeadlineAccent: 'like a portfolio',
    heroSub:
      "If you own one to five units, Mr. Mwikila collects rent over M-Pesa with one-tap tenant approval, sends polite late-rent reminders automatically, prepares your council-levy filing for your one-tap approval, and emails you a one-page owner statement on the 1st. You stay free on the Smallholder tier (T1).",
    heroPrimaryCta: 'Sign Up — free',
    heroSecondaryCta: 'How it works',
    trustline: [
      'Free up to 5 units',
      'M-Pesa rent collection',
      'No card needed',
    ],
    statsHeading: 'Built for the Tanzanian landlord, not the Wall-Street REIT.',
    statsSub:
      'Individual landlords lose 18% of annual rent to late payments, manual chase calls, and missing receipts. Mr. Mwikila closes the gap with automatic reminders, a double-entry rent ledger, and a one-page owner statement — at zero cost on the Smallholder tier.',
    stats: [
      { value: '18%', label: 'Average rent leakage', sub: 'For untooled landlords in Dar es Salaam (BOT 2025).' },
      { value: '4 hrs', label: 'Saved per month', sub: 'On rent chase + receipts + bookkeeping.' },
      { value: '0 TZS', label: 'On Smallholder tier', sub: 'Up to 5 units, one seat, core property ops.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Three steps. One hour. Then it runs itself.',
    steps: [
      {
        n: '01',
        title: 'Add your units',
        body: 'Snap a photo of the title page; Mr. Mwikila extracts the property + tenant data. Add your M-Pesa number to receive rent.',
      },
      {
        n: '02',
        title: 'Mr. Mwikila collects',
        body: 'Tenants approve the M-Pesa prompt on their phone. Late payers get a polite Swahili reminder automatically. You get a notification when each payment lands.',
      },
      {
        n: '03',
        title: 'Owner statement on the 1st',
        body: 'Every month: rent received, council levy prepared for your approval, maintenance owed, net to your account. PDF + email.',
      },
    ],
    problemKicker: 'The squeeze',
    problemHeading: 'Manual chase, missing receipts,',
    problemHeadingAccent: 'and council deadlines',
    problemSub:
      'The single landlord pays for the missing systems with their own time. Mr. Mwikila replaces the spreadsheet, the WhatsApp chase, and the panicked council-levy month.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'WhatsApp chase loops', desc: 'You spend Saturday morning chasing rent from three tenants who all promise "kesho".' },
      { title: 'Missing receipts',     desc: 'Tenant claims they paid; you cannot find the M-Pesa SMS. Disputes erode trust.' },
      { title: 'Council levy panic',   desc: 'You remember the levy is due on the 28th when you see the WhatsApp from the municipality.' },
      { title: 'Year-end paperwork',   desc: 'Tax filing turns into a multi-day archaeology dig through your phone.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Automatic Swahili reminders', desc: 'Mr. Mwikila sends late-rent reminders automatically over WhatsApp, SMS, and email with the right tone — polite, firm, never spammy.' },
      { title: 'Cryptographic receipts',      desc: "Every M-Pesa payment lands in an immutable double-entry ledger, so the receipt is the same on both sides — no more disputed payments." },
      { title: 'Regulatory calendar',         desc: 'Council levy, property tax, lease renewals — every deadline lands on your phone 14 days early.' },
      { title: 'Tax-ready year-end',          desc: 'Owner statements concatenate into a TRA-ready filing pack in 90 seconds, for your one-tap approval.' },
    ],
    ctaHeading: 'Start free today.',
    ctaSub: 'The Smallholder tier is free up to 5 units. Sign up with your M-Pesa number — no card needed.',
    ctaPrimary: 'Sign Up — free',
  },

  portfolioLandlord: {
    heroKicker: 'For the portfolio landlord',
    heroHeadline: 'When five units become',
    heroHeadlineAccent: 'fifty',
    heroSub:
      "Mr. Mwikila scales with you. Add buildings, blocks, and entire estates without adding spreadsheets. Cross-property cash flow, portfolio analytics, monthly owner statements, and an autonomy dial that lets you delegate the boring parts for your approval.",
    heroPrimaryCta: 'Book a 20-minute demo',
    heroSecondaryCta: 'See the platform',
    trustline: [
      'Up to 2,500 units on Corporate tier',
      'Multi-currency TZS/KES/USD',
      'Master Brain reasoning',
    ],
    statsHeading: 'Stop being your own bookkeeper.',
    statsSub:
      'Portfolio landlords burn their evenings on rent ops, maintenance triage, and statements that should be automated. Mr. Mwikila reclaims that time and gives you a morning briefing instead.',
    stats: [
      { value: 'Daily', label: 'Morning brief', sub: 'A one-screen overnight brief, generated on a schedule by the executive-brief engine.' },
      { value: 'Auto', label: 'Late-rent reminders', sub: 'Sent over WhatsApp, SMS, and email with channel failover — no manual chase.' },
      { value: '1 click', label: 'Owner statement', sub: 'Monthly statement across every property, exportable in any currency.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Import your portfolio. Set the autonomy. Walk away.',
    steps: [
      { n: '01', title: 'Import',         body: 'Bring your Excel + Drive + WhatsApp history. Mr. Mwikila extracts properties, leases, tenants, and arrears.' },
      { n: '02', title: 'Set autonomy',   body: 'Choose how much Mr. Mwikila does on his own per domain — Finance, Maintenance, Compliance, Leasing.' },
      { n: '03', title: 'Receive briefing', body: 'Each morning at 6am: a one-screen brief of what happened overnight, what needs your eye, and what he handled.' },
    ],
    problemKicker: 'The growth tax',
    problemHeading: 'More units, more',
    problemHeadingAccent: 'spreadsheets',
    problemSub:
      "When the portfolio grows past ten units, the spreadsheet stops being enough. You either hire an in-house manager, or you accept the leakage. Mr. Mwikila is the third option.",
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Spreadsheet sprawl',       desc: 'One sheet per building, none of them reconcile, none of them survive a phone change.' },
      { title: 'Maintenance backlog',      desc: 'Tickets pile up on WhatsApp; you forget the broken cistern in unit 4B for three weeks.' },
      { title: 'Cash-flow blind spots',    desc: 'You cannot tell which building is actually profitable until the year-end accountant arrives.' },
      { title: 'Compliance whack-a-mole',  desc: 'Different councils, different deadlines, different forms. Something always slips.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'One portfolio cockpit',     desc: 'Every property, every unit, every tenant — one page, real-time.' },
      { title: 'Maintenance triage',        desc: "Photos of leaks land in tickets; Mr. Mwikila proposes the right vendor and the work order for your approval." },
      { title: 'Per-building analytics',    desc: 'Occupancy, revenue, and expense analytics per property, per block — exportable in any currency.' },
      { title: 'Regulatory calendar',       desc: 'Every council, every deadline surfaced early; Mr. Mwikila prepares each filing for your one-tap approval.' },
    ],
    ctaHeading: 'Run more, do less.',
    ctaSub: 'Book a 20-minute demo. We will import a sample of your portfolio live and show you the cockpit you would land on tomorrow.',
    ctaPrimary: 'Book a demo',
  },

  tenant: {
    heroKicker: 'For tenants and prospects',
    heroHeadline: 'Find a home,',
    heroHeadlineAccent: 'apply in minutes',
    heroSub:
      "Search verified properties across Dar, Arusha, Mwanza, Mbeya, and Nairobi. Request a tour. Apply with your verified profile, place a bid, and chat with the property manager — all from your phone.",
    heroPrimaryCta: 'Browse listings',
    heroSecondaryCta: 'How applying works',
    trustline: [
      'Verified landlords only',
      'Verified applicant profile',
      'In-app chat',
    ],
    statsHeading: "BossNyumba listings are the verified ones.",
    statsSub:
      'Every property on BossNyumba has a title-verified landlord, an inspected unit, and a lease template approved under the Land Act. No ghost listings.',
    stats: [
      { value: '100%', label: 'Title-verified',  sub: 'Every landlord verified against the registry before listing.' },
      { value: 'NIDA', label: 'Verified profile', sub: 'Apply once with a verified identity profile; no repeating yourself per landlord.' },
      { value: '0%',   label: 'Hidden fees',     sub: 'Service charges and deposits disclosed up front, on every listing.' },
    ],
    stepsKicker: 'How applying works',
    stepsHeading: 'Three steps. From scroll to shortlist.',
    steps: [
      { n: '01', title: 'Browse + tour',  body: 'Filter by area, bedrooms, price. Request a virtual tour or an in-person visit straight from the listing.' },
      { n: '02', title: 'Apply + bid',    body: 'Tap "I want this". The landlord sees your verified profile (NIDA, employer, references) and accepts, counter-offers, or invites a bid.' },
      { n: '03', title: 'Agree the terms', body: 'Chat with the property manager in-app to settle move-in, deposit, and lease terms before you commit.' },
    ],
    problemKicker: 'The rental trap',
    problemHeading: 'Ghost listings, missing deposits,',
    problemHeadingAccent: 'no receipts',
    problemSub:
      'Renting on WhatsApp groups means scams, ghost landlords, and disputes that never settle. BossNyumba pulls the rental market into a verified, receipt-backed system.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Ghost listings',     desc: 'The photo was beautiful; the apartment was demolished six months ago.' },
      { title: 'Unverified landlords', desc: 'You cannot tell who actually owns the unit, or whether the deposit is safe.' },
      { title: 'Hidden terms',       desc: 'Service charges and deposit rules surface only after you have committed.' },
      { title: 'Unfair eviction',    desc: 'No written notice, no notice period, no path to dispute.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Verified listings only',   desc: 'Title-checked landlords, inspected units, council-approved lease templates.' },
      { title: 'Verified applicant profile', desc: 'Apply once with a NIDA-verified profile and references; the landlord sees a real applicant, not a WhatsApp message.' },
      { title: 'Transparent terms up front', desc: 'Service charges, deposit, and lease terms disclosed on every listing — and confirmed in in-app chat before you commit.' },
      { title: 'Tenant rights',            desc: "Lease + notice + dispute path explained in Swahili and English. Built on the Land Act, not vibes." },
    ],
    ctaHeading: 'Tafuta nyumba leo.',
    ctaSub: 'Browse verified listings. No account needed to look — only to apply.',
    ctaPrimary: 'Browse listings',
  },

  leasingAgency: {
    heroKicker: 'For leasing agencies + corporate housing',
    heroHeadline: 'Place tenants ten times',
    heroHeadlineAccent: 'faster',
    heroSub:
      'Source verified inventory across Tanzania and Kenya. Match prospects to units with the AI matcher. Generate corporate-housing offers in minutes. Track every placement and commission on one ledger.',
    heroPrimaryCta: 'Book a partner call',
    heroSecondaryCta: 'See the agency cockpit',
    trustline: [
      'Multi-landlord inventory',
      'Commission on one ledger',
      'Corporate-housing OS',
    ],
    statsHeading: 'The OS leasing agencies wish they had built.',
    statsSub:
      'Agencies on BossNyumba work from live verified inventory, match prospects with the AI matcher, and track every placement and commission on one ledger instead of a WhatsApp thread.',
    stats: [
      { value: 'Live', label: 'Inventory feed',   sub: 'Landlords update Mr. Mwikila; you see verified availability in real time.' },
      { value: 'AI',   label: 'Prospect matcher', sub: 'Ranks verified inventory against each brief — bedrooms, schools, security, commute, budget.' },
      { value: '1',    label: 'Commission ledger', sub: 'Every placement and commission booked to one double-entry ledger with a signed statement.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Wire up your prospects. Match. Place. Get paid.',
    steps: [
      { n: '01', title: 'Sync prospects',  body: 'Bring corporate clients (banks, embassies, enterprise tenants). BossNyumba builds a brief from their relocation requirements.' },
      { n: '02', title: 'AI matcher',      body: "Mr. Mwikila ranks verified inventory against the brief — bedrooms, schools, security, commute, budget — in seconds." },
      { n: '03', title: 'Track commission', body: 'When the placement lands, the commission is booked to one ledger with a signed statement — no more chasing landlords for a confirmation.' },
    ],
    problemKicker: 'The agency tax',
    problemHeading: 'Inventory drift, commission chasing,',
    problemHeadingAccent: 'and no platform',
    problemSub:
      "Most agencies run on WhatsApp groups, half-updated spreadsheets, and trust. The good ones close one in twenty; the great ones close one in ten. BossNyumba moves you to one in three.",
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Inventory drift',   desc: "Half the units in your spreadsheet aren't actually available." },
      { title: 'Commission limbo',  desc: 'You closed the lease in March; the commission lands in July.' },
      { title: 'No corporate offer', desc: 'Banks want a slick PDF; you send a WhatsApp message with photos.' },
      { title: 'Manual reference checks', desc: 'You spend hours calling employers to verify what BossNyumba can verify in seconds.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Live inventory feed',     desc: "Landlords update Mr. Mwikila; you see the truth in real time." },
      { title: 'Commission on one ledger', desc: 'Every placement and commission booked to a double-entry ledger with a signed statement — no more invoice limbo.' },
      { title: 'Corporate offer generator', desc: 'PDF + virtual tour + lease draft for every prospect, in two minutes.' },
      { title: 'Verified reference loop',   desc: 'NIDA, employer, and prior-landlord verification on the applicant profile — far fewer phone calls.' },
    ],
    ctaHeading: 'Become a BossNyumba partner agency.',
    ctaSub: 'Book a 20-minute partner call. We will walk you through the agency cockpit and the commission flow.',
    ctaPrimary: 'Book a partner call',
  },

  housingCooperative: {
    heroKicker: 'For housing cooperatives',
    heroHeadline: "Run your cooperative",
    heroHeadlineAccent: 'transparently',
    heroSub:
      'BossNyumba gives every cooperative member a real-time view of dues paid, the building maintenance plan, the AGM calendar, and the cooperative bank balance. Mr. Mwikila handles dues collection, member allocations, and the bookkeeping the registrar wants.',
    heroPrimaryCta: 'Apply for cooperative tier',
    heroSecondaryCta: 'How it works',
    trustline: [
      '30% off all tiers',
      'AGM-ready statements',
      'Member-visible dues ledger',
    ],
    statsHeading: 'Cooperatives need transparency. Mr. Mwikila ships it.',
    statsSub:
      'BossNyumba bakes the cooperative-governance model into the product so dues, decisions, and disputes have one source of truth.',
    stats: [
      { value: '30%', label: 'Discount',          sub: 'Off every tier for registered cooperatives.' },
      { value: '1-tap', label: 'AGM statement',     sub: 'Registrar-ready, member-ready, accountant-ready.' },
      { value: 'Live', label: 'Dues ledger',       sub: 'Every member sees who paid, who owes, and the cooperative balance — settled per member.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'From registration to AGM, all in one place.',
    steps: [
      { n: '01', title: 'Register the cooperative', body: 'Upload the cooperative certificate. BossNyumba mints the member roster, dues schedule, and governance rules.' },
      { n: '02', title: 'Dues + transparency',      body: 'Members pay monthly dues over M-Pesa. Every member sees who paid, who owes, what the cooperative spent.' },
      { n: '03', title: 'AGM + filing',             body: 'Schedule the AGM in-app. Members see the audited statement. Mr. Mwikila generates a registrar-ready filing pack in one tap for you to submit.' },
    ],
    problemKicker: 'The cooperative trap',
    problemHeading: 'Disputes, missing minutes,',
    problemHeadingAccent: 'and lost trust',
    problemSub:
      'Cooperatives fail when transparency fails. Mr. Mwikila enforces transparency by default — every member sees the same numbers.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Dues opacity',         desc: 'Members ask "who paid?" — nobody can produce a clean ledger.' },
      { title: 'Vendor disputes',      desc: 'The cooperative paid TZS 4M to a vendor; the work is half-done; no contract, no escrow.' },
      { title: 'AGM minutes drift',    desc: 'Last year\'s motions disappear; the chair changes; institutional memory dies.' },
      { title: 'Registrar friction',   desc: 'Annual filing turns into a multi-month accounting exercise.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Live dues ledger',     desc: 'Every member sees who paid, who owes, and the cooperative bank balance.' },
      { title: 'Member allocations',   desc: 'Dues and distributions allocated per member through the double-entry ledger — every cent traceable.' },
      { title: 'AGM-ready records',    desc: 'Minutes, attendance, and the audited statement — all hash-chained and member-visible.' },
      { title: 'Registrar-ready pack', desc: 'Year-end statement and minutes assembled into a registrar-ready filing pack in one tap, for you to submit.' },
    ],
    ctaHeading: 'Apply for the cooperative tier.',
    ctaSub: 'Registered housing cooperatives get 30% off every tier. Email community@bossnyumba.com from your registered domain.',
    ctaPrimary: 'Apply',
  },

  realEstateInvestor: {
    heroKicker: 'For real-estate investors',
    heroHeadline: 'See yield before',
    heroHeadlineAccent: 'you buy',
    heroSub:
      'BossNyumba reasons over title, zoning, comparable sales, current rent rolls, and council levy history to give every prospect property a five-year IRR with conformal confidence. Then operates it for you after you buy.',
    heroPrimaryCta: 'Book an investor demo',
    heroSecondaryCta: 'See the deal cockpit',
    trustline: [
      'Conformal IRR predictions',
      'Title-and-zoning audited',
      'Operator after close',
    ],
    statsHeading: 'From shortlist to operator, one platform.',
    statsSub:
      'Most investors juggle a spreadsheet, an agent, a lawyer, and a property manager. Mr. Mwikila collapses that into one cockpit.',
    stats: [
      { value: '5-yr IRR',  label: 'Conformal prediction', sub: 'With 80% / 90% / 95% confidence band, per prospect — calibrated, not a point guess.' },
      { value: 'One',       label: 'Diligence pack',       sub: 'Title chain, zoning, condition, comparables, rent rolls, levy history — one PDF.' },
      { value: '1 click',   label: 'To operator mode',    sub: 'Move from due-diligence to operations in-app.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Shortlist. Diligence. Close. Operate.',
    steps: [
      { n: '01', title: 'Shortlist',   body: 'Drop in URLs, photos, or the property registry number. Mr. Mwikila builds a deal brief in 60 seconds.' },
      { n: '02', title: 'Diligence',   body: 'Title chain, zoning, building condition, comparable sales, rent rolls, levy history — one PDF.' },
      { n: '03', title: 'Operate',     body: 'At close, Mr. Mwikila imports the tenant roster and starts collecting rent over M-Pesa with one-tap tenant approval — booked to a double-entry ledger.' },
    ],
    problemKicker: 'The diligence tax',
    problemHeading: 'Bad data, hidden levies,',
    problemHeadingAccent: 'and operator drift',
    problemSub:
      'Most real-estate losses are foreseeable. The data exists; it just lives in fifteen unconnected places. Mr. Mwikila reads all fifteen.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Title surprises',      desc: 'You discover the disputed clause four months after closing.' },
      { title: 'Hidden levies',        desc: 'The council has a TZS 28M arrears bill that did not show up in the agent\'s deck.' },
      { title: 'Optimistic rent rolls', desc: 'The seller\'s rent roll is two years out of date and assumes 100% occupancy.' },
      { title: 'Operator drift',       desc: 'The property manager you inherit underperforms the market by 15% and you do not notice for a year.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Title-chain audit',    desc: 'Every transfer back to the registry, flagged for disputes and easements.' },
      { title: 'Levy audit',           desc: 'Every council, every levy, every arrears day — surfaced before close.' },
      { title: 'Conformal rent rolls', desc: 'Actual rent collected last 12 months + occupancy + churn, all hash-chained.' },
      { title: 'Operator benchmarking', desc: 'Mr. Mwikila compares your portfolio against anonymised peers monthly.' },
    ],
    ctaHeading: 'Diligence in days, not months.',
    ctaSub: 'Book a 30-minute investor demo. Bring a prospect address; we will run the full diligence live.',
    ctaPrimary: 'Book an investor demo',
  },

  familyOffice: {
    heroKicker: 'For family offices',
    heroHeadline: "Treat property like the",
    heroHeadlineAccent: 'asset class it is',
    heroSub:
      'Family-office-grade reporting on a real-estate portfolio: an immutable double-entry ledger, monthly owner statements, audit-ready compliance exports, and portfolio analytics — with a single Mr. Mwikila advisor across every property and currency.',
    heroPrimaryCta: 'Book a family-office demo',
    heroSecondaryCta: 'See the reporting',
    trustline: [
      'Audit-ready ledger',
      'Monthly owner statements',
      'Portfolio analytics',
    ],
    statsHeading: 'Built for the long-horizon owner.',
    statsSub:
      'Family-office clients run BossNyumba across large property portfolios spanning multiple holding companies, trusts, and jurisdictions. Mr. Mwikila keeps every property on one audit-ready ledger.',
    stats: [
      { value: 'Immutable', label: 'Double-entry ledger', sub: 'Every receipt and disbursement booked, balanced, and append-only — the same number on both sides.' },
      { value: 'Monthly', label: 'Owner statements',   sub: 'Generated and delivered on schedule, exportable in any currency.' },
      { value: 'Export', label: 'Audit-ready',         sub: 'Hash-chained compliance exports your external auditor can verify offline.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the estate. Mr. Mwikila keeps the books.',
    steps: [
      { n: '01', title: 'Map the estate', body: 'Add the properties across your holding companies and trusts. Mr. Mwikila organises them under one owner view.' },
      { n: '02', title: 'Connect rent flows', body: 'Collect rent over M-Pesa with one-tap tenant approval; every payment books to the double-entry ledger.' },
      { n: '03', title: 'Scheduled reporting',  body: 'Monthly owner statements and portfolio analytics — occupancy, revenue, expenses — with audit-ready exports on demand.' },
    ],
    problemKicker: 'The principal\'s problem',
    problemHeading: 'Three accountants, one principal,',
    problemHeadingAccent: 'three sets of books',
    problemSub:
      "Family offices run on humans who hold the books in their heads. Mr. Mwikila puts every property on one audit-ready ledger so the principal always sees the same numbers.",
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Three sets of books',  desc: 'Three accountants, three reconciliation cycles. None of them agree, and none survives a handover.' },
      { title: 'Statement lag',      desc: 'Owner statements arrive late and inconsistent, so the principal trades on a stale picture.' },
      { title: 'Receipt disputes',   desc: 'Rent paid over mobile money has no shared record; payments get disputed months later.' },
      { title: 'Audit scramble',     desc: 'External audits turn into a multi-week archaeology dig because nothing is hash-chained.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'One owner ledger',    desc: 'Every rent receipt and disbursement booked to one immutable double-entry ledger across every property — the same number on both sides.' },
      { title: 'Scheduled statements', desc: 'Monthly owner statements generated and delivered automatically, exportable in any currency for the family meeting.' },
      { title: 'Portfolio analytics',  desc: 'Occupancy, revenue, and expense analytics across the portfolio — so the principal always sees the same picture.' },
      { title: 'Audit-ready exports', desc: 'Hash-chained, append-only compliance exports your external auditor can verify offline.' },
    ],
    ctaHeading: 'One estate. One advisor. One ledger.',
    ctaSub: 'Book a 45-minute family-office demo. We will stand up the ledger, statements, and analytics on a sample of your portfolio.',
    ctaPrimary: 'Book a demo',
  },

  bank: {
    heroKicker: 'For banks + property finance',
    heroHeadline: "Underwrite property cash flows",
    heroHeadlineAccent: 'you can verify',
    heroSub:
      'BossNyumba turns verified, hash-chained property cash flows into a computed credit score so banks can underwrite mortgages, bridge loans, and acquisition finance with confidence — even for small landlords who never had bankable books.',
    heroPrimaryCta: 'Book a credit demo',
    heroSecondaryCta: 'See the credit score',
    trustline: [
      'Hash-chained cash flows',
      'Computed credit score',
      'Consented API feed on the roadmap',
    ],
    statsHeading: 'Bank the underbanked landlord.',
    statsSub:
      "Most Tanzanian landlords have rentable assets and no bankable books. BossNyumba's audit chain turns receipts into underwritable cash flow.",
    stats: [
      { value: '12 mo',  label: 'Cash-flow history', sub: 'Per landlord, hash-chained, exportable to your credit system as a compliance export.' },
      { value: 'Score',  label: 'Credit rating',     sub: 'A computed credit score with a scoring model, scheduled recompute, and a verifiable certificate.' },
      { value: 'Roadmap', label: 'Consented API feed', sub: 'A read-only API into landlord-consented cash-flow data is on the roadmap.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Export. Score. Lend. Review.',
    steps: [
      { n: '01', title: 'Landlord shares',     body: 'Your customer exports their hash-chained cash-flow history as a compliance export you can verify offline. (A direct consented API feed is on the roadmap.)' },
      { n: '02', title: 'Score',              body: '12-month rent collection, occupancy, and levy compliance roll into a computed credit score with a verifiable certificate.' },
      { n: '03', title: 'Lend + review',      body: 'Disburse over your existing rails. Pull an on-demand refinancing report with LTV/DSCR stress tests at review time.' },
    ],
    problemKicker: 'The credit gap',
    problemHeading: 'Bankable landlords with',
    problemHeadingAccent: 'unbankable books',
    problemSub:
      'You know there are good landlords in your branch network. You just cannot underwrite them — no statements, no audited rent rolls, no verified occupancy.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'WhatsApp rent rolls',    desc: 'The applicant brings a WhatsApp screenshot. You decline.' },
      { title: 'Title-only collateral',  desc: 'You can lend against the deed, but not against the cash flow. Your LTV stays conservative.' },
      { title: 'Post-disburse blindness', desc: 'Once disbursed, you have no visibility on DSCR until the borrower defaults.' },
      { title: 'Manual portfolio review', desc: 'Annual reviews are a phone-call exercise; defaults catch you late.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Verified cash flows',    desc: 'Hash-chained 12-month rent + maintenance + levy history per landlord, exportable to your credit system.' },
      { title: 'Computed credit score',  desc: 'A scoring model turns rent yield into a credit score with a verifiable certificate — price for risk you can actually see.' },
      { title: 'On-demand stress test',  desc: 'Pull a refinancing report with LTV/DSCR stress tests at underwriting and review — on demand, not once a year.' },
      { title: 'Portfolio analytics',    desc: 'Per-region health metrics across the consented book; analytics, not anniversary phone calls.' },
    ],
    ctaHeading: 'Lend to the landlords you have always wanted to.',
    ctaSub: 'Book a 30-minute credit demo. We will walk through the credit score, the exportable cash-flow history, and the underwriting model.',
    ctaPrimary: 'Book a credit demo',
  },

  regulator: {
    heroKicker: 'For housing regulators',
    heroHeadline: 'See the rental market',
    heroHeadlineAccent: 'as it actually is',
    heroSub:
      'BossNyumba gives the housing regulator a live, anonymised view of the rental market: lease counts, average rents by district, deposit-dispute volumes, tenant complaints, and council-levy compliance — all opt-in by landlord and constitutionally bounded.',
    heroPrimaryCta: 'Book a regulator demo',
    heroSecondaryCta: 'See the dashboard',
    trustline: [
      'Constitutionally bounded',
      'Tenant-consent first',
      'Live + auditable',
    ],
    statsHeading: 'Evidence-based housing policy.',
    statsSub:
      "Regulators craft policy on yearly surveys. BossNyumba surfaces the same market signals daily — without ever exposing a single individual's data.",
    stats: [
      { value: 'Live',    label: 'Market signal',         sub: 'Lease counts, district median rents, dispute volumes — updated daily.' },
      { value: 'Anon',    label: 'Differential privacy',  sub: 'No individual landlord or tenant ever identifiable from the dashboard.' },
      { value: 'Audited', label: 'Hash-chained',          sub: 'Every export carries a cryptographic provenance proof.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Aggregate. Anonymise. Audit. Share.',
    steps: [
      { n: '01', title: 'Aggregate',  body: 'BossNyumba aggregates lease, rent, dispute, and compliance data across consented landlords.' },
      { n: '02', title: 'Anonymise',  body: 'Differential-privacy thresholds prevent re-identification at district or building level.' },
      { n: '03', title: 'Share',      body: 'Regulator dashboard + monthly evidence pack + ad-hoc query endpoint, all hash-chained.' },
    ],
    problemKicker: 'The policy gap',
    problemHeading: 'Yearly surveys, ad-hoc complaints,',
    problemHeadingAccent: 'no live signal',
    problemSub:
      'Housing regulators design rent caps and tenant-protection acts on stale data. Mr. Mwikila brings the market signal into the regulator\'s morning brief.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Stale surveys',         desc: 'Last year\'s NBS housing survey informs this year\'s council policy.' },
      { title: 'Anecdotal complaints',  desc: 'Tenant association sends a letter; you do not know how representative it is.' },
      { title: 'Council fragmentation', desc: '184 councils, 184 different lease-registration formats. No consolidated view.' },
      { title: 'No early warning',      desc: 'Eviction spikes are visible only in news cycles, not in dashboards.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Daily market signal',  desc: 'District median rents, lease churn, occupancy — updated nightly.' },
      { title: 'Dispute heat-map',     desc: 'Where are tenants and landlords actually fighting? Get the answer monthly.' },
      { title: 'Council interoperability', desc: 'Consistent lease + levy data across all participating councils.' },
      { title: 'Eviction early-warning', desc: 'Rising eviction filings visible 60-90 days before the news cycle.' },
    ],
    ctaHeading: 'Bring policy out of the rear-view mirror.',
    ctaSub: 'Book a 30-minute regulator demo with our public-sector lead.',
    ctaPrimary: 'Book a regulator demo',
  },

  communityHousing: {
    heroKicker: 'For community housing',
    heroHeadline: 'Housing for the people',
    heroHeadlineAccent: 'who build the city',
    heroSub:
      'BossNyumba powers cooperative housing, community land trusts, and worker-housing partnerships for NGOs, industrial towns, and university campuses. Mr. Mwikila runs the dues ledger and member allocations, and assembles AGM-ready records.',
    heroPrimaryCta: 'Apply for community tier',
    heroSecondaryCta: 'See the model',
    trustline: [
      '30% community discount',
      'Allocation transparency',
      'Member-first governance',
    ],
    statsHeading: 'Community housing that the community trusts.',
    statsSub:
      'Most community housing fails because the books are opaque and the allocations are political. Mr. Mwikila enforces transparent dues, fair allocations, and AGM-ready records.',
    stats: [
      { value: '30%',    label: 'Community discount', sub: 'Off every tier for registered community-housing schemes.' },
      { value: 'Public', label: 'Dues ledger',        sub: 'Every member sees every payment.' },
      { value: 'Fair',   label: 'Allocation lottery', sub: 'Hash-chained, audit-ready, dispute-resistant.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Three steps to a community-housing OS.',
    steps: [
      { n: '01', title: 'Register the scheme', body: 'Upload the scheme certificate. BossNyumba mints the member roster, dues schedule, and allocation rules.' },
      { n: '02', title: 'Dues + allocation',   body: 'Members pay dues; vacancies are allocated transparently and booked through the double-entry ledger. Every step is hash-chained.' },
      { n: '03', title: 'AGM + transparency',  body: 'AGM in-app: minutes, attendance, audited financials — all member-visible and hash-chained.' },
    ],
    problemKicker: 'The community gap',
    problemHeading: 'Opaque dues, political allocations,',
    problemHeadingAccent: 'lost trust',
    problemSub:
      'Community housing dies when transparency dies. Mr. Mwikila enforces transparency by default so the scheme survives leadership changes.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Opaque dues',        desc: 'Members do not know who paid, who owes, or what the scheme spent.' },
      { title: 'Political allocations', desc: 'Vacant units go to the chair\'s friend; members complain in vain.' },
      { title: 'AGM drift',          desc: "Last year's motions disappear; this year's chair has no institutional memory." },
      { title: 'Donor distrust',     desc: 'NGOs and corporates lose confidence; funding dries up.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Public dues ledger',  desc: 'Every member, every payment, every cooperative spend — visible to all members.' },
      { title: 'Transparent allocation',  desc: 'Vacancies allocated on transparent, auditable rules and booked through the double-entry ledger — every cent traceable.' },
      { title: 'AGM-ready records',   desc: 'Minutes, attendance, and audited financials — hash-chained and member-visible.' },
      { title: 'Donor reports',       desc: 'NGOs and corporates get a quarterly impact pack, generated from live data, audit-ready.' },
    ],
    ctaHeading: 'Trust, baked in.',
    ctaSub: 'Apply for the community-housing tier. Registered schemes get 30% off every tier.',
    ctaPrimary: 'Apply',
  },

  corporatePortfolio: {
    heroKicker: 'For corporate portfolios',
    heroHeadline: "The world's first AI Estate-Management Partner",
    heroHeadlineAccent: 'for corporate property',
    heroSub:
      'Mr. Mwikila is the calm second-in-command for any enterprise holding staff housing, branch offices, warehouses, or retail premises as part of operations. One lease ledger, utilities metering and reconciliation, portfolio analytics, and audit-ready compliance exports across every site.',
    heroPrimaryCta: 'Book an enterprise demo',
    heroSecondaryCta: 'See the reporting',
    trustline: [
      'Audit-grade double-entry ledger',
      'Utilities metering + reconciliation',
      'Portfolio analytics',
    ],
    statsHeading: 'Stop running your property estate on three spreadsheets.',
    statsSub:
      'Corporate portfolios leak recoverable cost to lease drift, levy slippage, and uninvoiced utilities. Mr. Mwikila puts every site on one ledger and surfaces the leakage in analytics, across every site and currency.',
    stats: [
      { value: 'One', label: 'Lease ledger', sub: 'Every lease, levy, and utility bill booked to one immutable double-entry ledger.' },
      { value: 'Metered', label: 'Utilities', sub: 'Water, electricity, gas — accounts, readings, and bills tracked and reconciled per site.' },
      { value: 'Export', label: 'Audit-ready', sub: 'Hash-chained compliance exports into your enterprise BI, in any currency.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the portfolio. Set the policy. Mr. Mwikila keeps the books.',
    steps: [
      { n: '01', title: 'Map every site', body: 'Add your leases, levies, vendor contracts, and utility accounts. Mr. Mwikila organises them under one site-by-site view.' },
      { n: '02', title: 'Set policy + autonomy', body: 'Choose how much Mr. Mwikila prepares for you per domain — leases, levies, maintenance — within your corporate authority matrix; every action lands for one-tap approval.' },
      { n: '03', title: 'Receive the daily brief', body: 'Each morning at 06:00: the exception list, the levy calendar, portfolio analytics, and the three decisions only a CFO can make.' },
    ],
    problemKicker: 'The enterprise tax',
    problemHeading: 'Real-estate cost lives in spreadsheets,',
    problemHeadingAccent: 'not your ERP',
    problemSub:
      'Most enterprise ERPs treat real estate as a cost line, not a portfolio. The result is invisible leakage that compounds quarter over quarter.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Lease drift', desc: 'Renewal options lapse silently. Rent escalations miss the index date. Your real cost is higher than your finance team thinks.' },
      { title: 'Levy slippage', desc: 'Council, property tax, utilities — each lands in a different inbox. Late fees compound and nobody is accountable.' },
      { title: 'Utilities black box', desc: 'Branch utilities are billed by the meter, paid by petty cash, and reconciled by nobody. Leakage is structural.' },
      { title: 'No portfolio view', desc: 'Treasury cannot tell which branch is profitable, which is a millstone, which is breaking even.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Lease watchtower', desc: 'Every renewal option, every escalation, every break clause surfaced 90 days before the trigger date.' },
      { title: 'Single levy desk', desc: 'Every council, every tax authority, every utility, every cadence surfaced in one place; Mr. Mwikila prepares each filing for your one-tap approval.' },
      { title: 'Utilities reconciliation', desc: 'Meter reads ingested, bills validated, anomalies surfaced — water, electricity, and gas tracked and reconciled per site.' },
      { title: 'Portfolio analytics', desc: 'Occupancy, revenue, and expense analytics per branch and per region. Exportable into your enterprise BI in any currency.' },
    ],
    ctaHeading: 'Run the portfolio you already own.',
    ctaSub: 'Book a 30-minute enterprise demo. We will stand up the ledger, utilities reconciliation, and analytics on a sample of your sites and surface the leakage you cannot currently see.',
    ctaPrimary: 'Book an enterprise demo',
  },

  governmentEntity: {
    heroKicker: 'For government and parastatal entities',
    heroHeadline: 'Public property,',
    heroHeadlineAccent: 'public-trust ledger',
    heroSub:
      'Mr. Mwikila gives parastatals, ministries, and regional government entities a transparent, auditable operating system for their property estate. Every levy collected, every lease recorded, every vendor paid lands on a hash-chained, regulator-exportable ledger.',
    heroPrimaryCta: 'Book a government demo',
    heroSecondaryCta: 'See the public ledger',
    trustline: [
      'Hash-chained, audit-exportable',
      'Sovereign data residency',
      'Auditor-ready by default',
    ],
    statsHeading: 'Public property deserves public-grade tools.',
    statsSub:
      'Government property estates lose value through opaque ledgers, lapsed leases, and uncollected levies. Mr. Mwikila installs the transparency the public expects without the political cost of a manual audit.',
    stats: [
      { value: '100%', label: 'Audit coverage', sub: 'Every action hash-chained, append-only, exportable to the Controller and Auditor General offline.' },
      { value: 'Daily', label: 'Public ledger', sub: 'Anonymised summary statistics on revenue, occupancy, and arrears available to citizens on demand.' },
      { value: 'Zero', label: 'Manual handover risk', sub: 'When the director rotates, the institutional memory rotates with the system, not with the person.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Mandate. Map. Operate.',
    steps: [
      { n: '01', title: 'Mandate', body: 'Your principal secretary signs the public-trust mandate. Mr. Mwikila operates inside the bounds of the mandate, never beyond.' },
      { n: '02', title: 'Map every asset', body: 'Bring your existing estate records. Reconcile leases, levies, encumbrances, and dispute status into one knowledge graph.' },
      { n: '03', title: 'Operate with audit chain', body: 'Every collection, every disbursement, every decision hash-chained. The Controller and Auditor General reads the chain, not your filing cabinet.' },
    ],
    problemKicker: 'The public-sector tax',
    problemHeading: 'Opaque ledgers,',
    problemHeadingAccent: 'lost revenue',
    problemSub:
      'Government property estates carry the largest balance-sheet exposure in any economy and the weakest tooling. Mr. Mwikila closes the gap without political cost.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Lapsed government leases', desc: 'Public-sector leases lapse because no one is tracking renewal dates in the same place as rent collection.' },
      { title: 'Uncollected ground rent', desc: 'Ground-rent files sit in cabinets. Collection runs ad hoc. Citizens pay irregularly; nobody chases consistently.' },
      { title: 'Audit findings stack', desc: 'Every cycle, the Auditor General finds the same gaps. Remediation never sticks because there is no real-time system.' },
      { title: 'Director rotation risk', desc: 'When the head of property estate rotates, institutional memory walks out with them. Successor starts from zero.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Lease auto-pilot', desc: 'Renewal options, escalations, ground-rent payments surfaced 90 days early. Mr. Mwikila drafts the renewal pack itself.' },
      { title: 'Citizen-pay rails', desc: 'Ground rent collectible on M-Pesa, Tigo Pesa, Airtel Money, or bank. Receipt issued in seconds, hash-chained on the public ledger.' },
      { title: 'Audit chain by default', desc: 'Every action append-only and signed. Auditor General reads the chain, not the filing cabinet.' },
      { title: 'Continuity through rotation', desc: 'Institutional memory lives in the system. Successor lands on day one with a full estate brief, ready to act.' },
    ],
    ctaHeading: 'Run the public estate, in public.',
    ctaSub: 'Book a 30-minute briefing with our public-sector lead. We will walk through the audit chain, the citizen-pay rails, and the public-ledger dashboard.',
    ctaPrimary: 'Book a government demo',
  },

  reit: {
    heroKicker: 'For REITs and property funds',
    heroHeadline: "The world's first AI Estate-Management Partner",
    heroHeadlineAccent: 'for institutional real estate',
    heroSub:
      'Mr. Mwikila is the operating system Real Estate Investment Trusts and institutional property funds run their estate on. An immutable double-entry ledger, unitholder-grade audit chains, portfolio analytics, audit-ready compliance exports, and an AI Chief of Staff that briefs the fund manager every morning.',
    heroPrimaryCta: 'Book a fund-manager demo',
    heroSecondaryCta: 'See the fund cockpit',
    trustline: [
      'Unitholder-grade audit chain',
      'Portfolio analytics',
      'Compliance exports',
    ],
    statsHeading: 'Run the fund on one ledger.',
    statsSub:
      'REITs and property funds run on quarterly reporting cycles that hide intra-quarter risk. Mr. Mwikila keeps every asset on one immutable ledger so the picture is always current, without adding a single FTE.',
    stats: [
      { value: 'Immutable', label: 'Double-entry ledger', sub: 'Every rent receipt, disbursement, and capex booked, balanced, and append-only.' },
      { value: 'Analytics', label: 'Per-region', sub: 'Occupancy, revenue, and expense analytics per region and fund vehicle, exportable to your custodian.' },
      { value: 'Export', label: 'Audit-ready', sub: 'Hash-chained, append-only compliance exports that satisfy external auditors and unitholders.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the fund. Set the autonomy. Run the books.',
    steps: [
      { n: '01', title: 'Map the fund', body: 'Add your fund vehicles, sub-funds, and SPVs. Mr. Mwikila organises every asset under one fund view.' },
      { n: '02', title: 'Wire every asset', body: 'Collect rent over M-Pesa with one-tap tenant approval; every receipt, disbursement, and capex commitment books to one double-entry ledger.' },
      { n: '03', title: 'Daily fund manager brief', body: 'Each morning: portfolio analytics, the exception list, an on-demand refinancing report for covenant stress tests, and the three decisions only the fund manager can make.' },
    ],
    problemKicker: 'The institutional tax',
    problemHeading: 'Quarterly reporting hides',
    problemHeadingAccent: 'intra-quarter risk',
    problemSub:
      'Most REITs and property funds run on a 90-day reporting cycle. The risk that builds inside the cycle is invisible until it is the next quarter\'s problem.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Stale books', desc: 'Quarterly close means unitholders trade on a three-month-old picture. Bid-ask spreads widen.' },
      { title: 'Covenant blindness', desc: 'DSCR is computed once a quarter. By the time you breach, you breach by months.' },
      { title: 'Fragile audit trail', desc: 'Each SPV reports separately, in spreadsheets that do not survive a handover or an external audit.' },
      { title: 'Lessor opacity', desc: 'Tenants pay on different rails and cycles. Reconciliation is a multi-week exercise.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'One immutable ledger', desc: 'Every asset, every unit, every fund vehicle on one append-only double-entry ledger, exportable to your custodian.' },
      { title: 'On-demand covenant test', desc: 'Pull a refinancing report with DSCR, LTV, and ICR stress tests whenever you need it — at review, not once a quarter.' },
      { title: 'Audit-ready exports', desc: 'Every sub-fund and SPV exportable as a hash-chained, append-only compliance pack with the audit chain attached.' },
      { title: 'Tenant rail reconciliation', desc: 'M-Pesa and bank receipts reconciled into one tenant ledger via webhook callbacks — booked, balanced, traceable.' },
    ],
    ctaHeading: 'One fund. One brief. One ledger.',
    ctaSub: 'Book a 45-minute fund-manager demo. We will stand up the ledger, analytics, and audit-ready exports on a sample of your portfolio.',
    ctaPrimary: 'Book a fund-manager demo',
  },

  embassyNgo: {
    heroKicker: 'For diplomatic missions and NGOs',
    heroHeadline: 'One estate, every',
    heroHeadlineAccent: 'capital',
    heroSub:
      'Mr. Mwikila runs the property estate of diplomatic missions, international NGOs, and donor agencies across multiple capitals. A donor-audit-ready double-entry ledger, jurisdiction-aware compliance, audit-ready exports, and a single advisor across every residence, office, and field outpost.',
    heroPrimaryCta: 'Book a mission demo',
    heroSecondaryCta: 'See the mission cockpit',
    trustline: [
      'Donor-audit-ready ledger',
      'Per-jurisdiction compliance',
      'Audit-ready exports',
    ],
    statsHeading: 'Built for the mission that spans capitals.',
    statsSub:
      'Diplomatic missions and international NGOs run property estates across multiple jurisdictions on inherited spreadsheets. Mr. Mwikila puts every outpost on one audit-ready ledger without imposing one country\'s rules on another.',
    stats: [
      { value: 'One ledger', label: 'Every outpost', sub: 'One double-entry ledger across every residence, office, and outpost, exportable in any currency.' },
      { value: 'Donor-grade', label: 'Audit chain', sub: 'Every disbursement hash-chained and ready for the donor\'s external auditor.' },
      { value: 'Per jurisdiction', label: 'Compliance', sub: 'Local lease law, local tax regime, local utility quirks — handled per outpost.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Map every capital. Set the policy. Mr. Mwikila operates.',
    steps: [
      { n: '01', title: 'Map every capital', body: 'Add the mission estate: chancery, residences, outposts, field offices. Mr. Mwikila ingests the local lease, levy, and utility rules per capital.' },
      { n: '02', title: 'Set the donor policy', body: 'Configure the donor-audit cadence and disbursement authority matrix. Every action stays inside donor-approved bounds.' },
      { n: '03', title: 'Receive the head-of-mission brief', body: 'Each morning: per-capital cost, exception list, donor-audit cadence, and the three decisions only the head of mission can make.' },
    ],
    problemKicker: 'The mission tax',
    problemHeading: 'Inherited spreadsheets,',
    problemHeadingAccent: 'opaque ledgers',
    problemSub:
      'Missions and NGOs run on institutional memory that rotates every 2-4 years. Mr. Mwikila externalises that memory so the successor lands on day one with the full estate brief.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Rotating institutional memory', desc: 'Each tour leaves the estate slightly worse documented than they found it. Successor starts from inherited folders.' },
      { title: 'Donor-audit panic', desc: 'Annual donor audits consume the finance officer for weeks. Findings rarely close before the next cycle.' },
      { title: 'Multi-jurisdiction drift', desc: 'Each capital plays by local rules, on local rails. The mission cannot tell which outpost is healthy.' },
      { title: 'Lessor disputes', desc: 'Lease renewals negotiated under time pressure. Landlords exploit the diplomatic timeline.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Institutional memory by default', desc: 'Every lease, levy, dispute, and decision lives in the system. Successor lands with a full estate brief.' },
      { title: 'Donor audit chain', desc: 'Every disbursement hash-chained, append-only, exportable to the donor auditor offline.' },
      { title: 'Per-jurisdiction compliance', desc: 'Local lease law, local tax regime, local utility quirks handled per outpost without imposing one country\'s rules on another.' },
      { title: 'Lessor playbook', desc: 'Mr. Mwikila knows your renewal calendar, your fallback options, and your market comparables. Negotiations start from strength.' },
    ],
    ctaHeading: 'Run the mission estate, properly.',
    ctaSub: 'Book a 30-minute mission demo. We will walk through the donor audit chain, the per-jurisdiction ledger, and the head-of-mission brief.',
    ctaPrimary: 'Book a mission demo',
  },

  institutionalLandlord: {
    heroKicker: 'For universities and hospitals',
    heroHeadline: 'Run the campus',
    heroHeadlineAccent: 'as one estate',
    heroSub:
      'Mr. Mwikila is the operating system for universities, university colleges, hospitals, and teaching-hospital systems that hold large institutional property estates. An immutable double-entry ledger, donor-grade audit chain, portfolio analytics per building, maintenance triage, and a vice-chancellor brief that lands at 06:00 every morning.',
    heroPrimaryCta: 'Book a vice-chancellor demo',
    heroSecondaryCta: 'See the campus cockpit',
    trustline: [
      'Per-building analytics',
      'Donor + grant audit-ready',
      'Maintenance triage',
    ],
    statsHeading: 'Built for the institution that owns its city block.',
    statsSub:
      'Universities and hospitals are among the largest property owners in any city and the worst-tooled. Mr. Mwikila gives the vice-chancellor and the hospital director a single estate brief without imposing new processes on faculty.',
    stats: [
      { value: 'Per building', label: 'Analytics', sub: 'Occupancy, revenue, and expense analytics per residence hall, teaching block, and outpost clinic.' },
      { value: 'Triage', label: 'Maintenance', sub: 'Faculty staff photograph issues; Mr. Mwikila proposes the right trade and work order for sign-off.' },
      { value: 'Donor-grade', label: 'Audit', sub: 'Every disbursement hash-chained and ready for the donor or grant auditor.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Map the campus. Route the maintenance. Brief the principal.',
    steps: [
      { n: '01', title: 'Map every building', body: 'Add your estate: faculties, residences, clinics, outposts. Mr. Mwikila reconciles ownership, leases, and donor restrictions per building.' },
      { n: '02', title: 'Triage maintenance', body: 'Faculty staff photograph issues. Mr. Mwikila proposes the right trade and the work order; you approve, then sign off on completion with a photo.' },
      { n: '03', title: 'Daily principal brief', body: 'Each morning: campus-wide analytics, exception list, donor-audit cadence, and the three decisions only the vice-chancellor or hospital director can make.' },
    ],
    problemKicker: 'The institution tax',
    problemHeading: 'Departmental silos,',
    problemHeadingAccent: 'campus-wide blindness',
    problemSub:
      'Universities and hospitals run their property estate on departmental silos. The estate director cannot tell which building is profitable, which is a millstone, which is breaking even.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Departmental sprawl', desc: 'Each faculty, each clinic, each residence hall keeps its own books. Pulling one estate-wide view costs weeks every term.' },
      { title: 'Maintenance backlog', desc: 'Tickets pile up on faculty admin. The leaking lab is fixed three weeks late. The boiler is replaced reactively, not proactively.' },
      { title: 'Donor restriction drift', desc: 'A building was donated for nursing instruction. Twelve years later, the philosophy department occupies it. Donor relations fray.' },
      { title: 'Grant-audit panic', desc: 'Annual grant audits consume the bursar\'s office for weeks. Findings rarely close before the next cycle.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Single campus cockpit', desc: 'Every faculty, every residence, every clinic — one screen, real-time, with analytics exportable into the institution\'s ERP.' },
      { title: 'Maintenance triage', desc: 'Faculty staff photograph issues. Mr. Mwikila proposes the right trade and work order for your approval, then records sign-off on completion.' },
      { title: 'Donor restriction tags', desc: 'Every building tagged with donor restrictions. Mr. Mwikila warns the estate director before any usage drift.' },
      { title: 'Grant-audit chain', desc: 'Every grant-funded disbursement hash-chained and exportable to the grant auditor offline.' },
    ],
    ctaHeading: 'Run the campus as one estate.',
    ctaSub: 'Book a 45-minute vice-chancellor demo. We will walk through the campus cockpit, the maintenance triage, and the donor restriction tags.',
    ctaPrimary: 'Book a vice-chancellor demo',
  },

  religiousOrganization: {
    heroKicker: 'For religious organisations',
    heroHeadline: 'Steward your congregation\'s estate',
    heroHeadlineAccent: 'with public-trust transparency',
    heroSub:
      'Mr. Mwikila runs the property estate of mosques, churches, temples, and dioceses. Congregation-transparent dues ledger, AGM-ready trustee statements, faith-aligned governance, and hash-chained provenance on every disbursement.',
    heroPrimaryCta: 'Apply for the steward tier',
    heroSecondaryCta: 'See the trustee dashboard',
    trustline: [
      '30% steward discount',
      'Congregation-transparent ledger',
      'Trustee-ready AGM statements',
    ],
    statsHeading: 'Faith communities deserve faith-grade tools.',
    statsSub:
      'Religious organisations hold significant property estates and the lowest tooling budget. Mr. Mwikila gives the trustees the transparency the congregation expects without imposing commercial accounting jargon.',
    stats: [
      { value: '30%', label: 'Steward discount', sub: 'Off every tier for registered places of worship and faith-based organisations.' },
      { value: 'Public', label: 'Dues ledger', sub: 'Every congregation member can see what was given and what was spent.' },
      { value: 'AGM-ready', label: 'Trustee statement', sub: 'Annual general meeting deck regenerates from live data in one click.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Register the trust. Open the ledger. Steward in public.',
    steps: [
      { n: '01', title: 'Register the trust', body: 'Upload your faith-based registration certificate and trustee roster. Mr. Mwikila mints the trust ledger, dues schedule, and governance rules.' },
      { n: '02', title: 'Open the dues ledger', body: 'Tithes, offerings, and dues paid over M-Pesa or bank. Every payment lands in the public ledger; every member sees who gave and what was spent.' },
      { n: '03', title: 'Steward the AGM', body: 'Trustee statements, audited financials, minutes, attendance — all hash-chained and exportable to the registrar.' },
    ],
    problemKicker: 'The faith-community gap',
    problemHeading: 'Cash offerings,',
    problemHeadingAccent: 'opaque trusts',
    problemSub:
      'Faith communities run on trust, but trust without transparency breaks across leadership transitions. Mr. Mwikila installs the transparency the congregation expects without imposing commercial accounting jargon.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Cash-offering opacity', desc: 'Cash given at service has no record. Trustees and treasurers carry institutional risk personally.' },
      { title: 'Property-disposal disputes', desc: 'A diocese sells a parish hall; the congregation discovers it after the fact. Trust erodes.' },
      { title: 'AGM minutes drift', desc: 'Last year\'s motions disappear. The new chair has no institutional memory.' },
      { title: 'Vendor disputes', desc: 'The mosque paid a contractor for repairs that were never completed. No contract, no escrow, no recourse.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Digital tithe rails', desc: 'M-Pesa tithe channels with one-tap giver approval. Every gift receipted to the double-entry ledger, hash-chained, member-visible.' },
      { title: 'Transparent disposal', desc: 'Any property disposal triggers a congregation-notification + trustee sign-off workflow. No silent sales.' },
      { title: 'AGM-ready records', desc: 'Minutes, attendance, and audited financials — all hash-chained and exportable to the registrar.' },
      { title: 'Milestoned vendor pay', desc: 'Vendor work milestoned; trustee approves each milestone before Mr. Mwikila books the payment to the ledger — every cent traceable.' },
    ],
    ctaHeading: 'Steward in public.',
    ctaSub: 'Apply for the steward tier. Registered places of worship and faith-based organisations get 30% off every tier. Email steward@bossnyumba.co.tz from your registered domain.',
    ctaPrimary: 'Apply',
  },

  cooperativeSacco: {
    heroKicker: 'For SACCOs and cooperatives',
    heroHeadline: 'Member-owned property,',
    heroHeadlineAccent: 'member-visible ledger',
    heroSub:
      'Mr. Mwikila runs the property estate of SACCOs, cooperative societies, and member-investment groups. Member-transparent dues ledger, transparent member allocations, registrar-ready AGM filings, and one-tap statements that satisfy both members and the cooperative registrar.',
    heroPrimaryCta: 'Apply for the cooperative tier',
    heroSecondaryCta: 'See the SACCO cockpit',
    trustline: [
      '30% cooperative discount',
      'Registrar-ready filings',
      'Member-visible ledger',
    ],
    statsHeading: 'Member-owned. Member-visible. Member-trusted.',
    statsSub:
      'SACCOs and cooperatives fail when transparency fails. Mr. Mwikila enforces transparency by default — every member sees the same numbers, every registrar reads the same filing.',
    stats: [
      { value: '30%', label: 'Cooperative discount', sub: 'Off every tier for registered SACCOs and cooperative societies.' },
      { value: 'Public', label: 'Dues ledger', sub: 'Every member sees every contribution and every disbursement.' },
      { value: '1-tap', label: 'Registrar pack', sub: 'Annual statement assembled in the format the cooperative registrar accepts, for you to submit.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Register. Enrol members. Operate in public.',
    steps: [
      { n: '01', title: 'Register the cooperative', body: 'Upload the cooperative certificate and member roster. Mr. Mwikila mints the dues schedule, allocation rules, and governance graph.' },
      { n: '02', title: 'Enrol members', body: 'Members pay shares and dues over M-Pesa or bank. Every contribution receipted, hash-chained, member-visible.' },
      { n: '03', title: 'AGM + filings', body: 'Annual general meeting in-app: minutes, attendance, audited statement. Registrar-ready pack in one tap, in the format they accept, for you to submit.' },
    ],
    problemKicker: 'The cooperative gap',
    problemHeading: 'Opaque dues,',
    problemHeadingAccent: 'political allocations',
    problemSub:
      'Cooperatives die when transparency dies. Mr. Mwikila enforces transparency by default so the cooperative survives leadership transitions and grows beyond a single chair\'s patronage network.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Dues opacity', desc: 'Members do not know who paid and who owes. Treasurer carries institutional risk personally.' },
      { title: 'Political allocations', desc: 'Vacant units or member benefits go to the chair\'s friend. Members complain in vain.' },
      { title: 'AGM drift', desc: 'Last year\'s motions disappear. New chair starts from a blank slate.' },
      { title: 'Registrar friction', desc: 'Annual registrar filing turns into a multi-month accounting exercise that distracts from member service.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Live dues ledger', desc: 'Every member sees every contribution, every disbursement, and the cooperative bank balance — live.' },
      { title: 'Transparent allocation', desc: 'Vacant units or member benefits allocated on transparent rules and booked through the double-entry ledger — every cent traceable.' },
      { title: 'AGM-ready records', desc: 'Minutes, attendance, and the audited statement — all hash-chained and audit-ready.' },
      { title: 'Registrar-ready pack', desc: 'Annual statement assembled in the format the cooperative registrar accepts, in one tap, for you to submit.' },
    ],
    ctaHeading: 'Member-owned property, member-visible ledger.',
    ctaSub: 'Apply for the cooperative tier. Registered SACCOs and cooperative societies get 30% off every tier. Email cooperative@bossnyumba.co.tz from your registered domain.',
    ctaPrimary: 'Apply',
  },
} as const satisfies Record<string, AudiencePageCopy>;
