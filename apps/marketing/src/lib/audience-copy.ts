import type { AudiencePageCopy } from '@/components/audience/AudiencePage';

/**
 * Per-audience-vertical copy for marketing pages. Ported from
 * Borjie's mining-audience template and reframed for real estate.
 *
 * Mining vertical -> real-estate vertical mapping (see
 * Docs/PORT/BOSSNYUMBA_PORT_COORDINATION.md §4 domain map):
 *   for-pml          -> for-individual-landlord
 *   for-sml          -> for-portfolio-landlord
 *   for-buyer        -> for-tenant
 *   for-off-taker    -> for-leasing-agency
 *   for-cooperative  -> for-housing-cooperative
 *   for-investor     -> for-real-estate-investor
 *   for-family-office (kept)
 *   for-bank (kept — property finance / mortgage)
 *   for-regulator (kept — housing regulator)
 *   for-csr-community -> for-community-housing
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
      "If you own one to five units, Mr. Mwikila collects rent over M-Pesa, chases late tenants in Swahili, files your council levy, and emails you a one-page owner statement on the 1st. You stay free on tier T1 — Mkulima.",
    heroPrimaryCta: 'Sign Up — free',
    heroSecondaryCta: 'How it works',
    trustline: [
      'Free up to 5 units',
      'M-Pesa rent collection',
      'No card needed',
    ],
    statsHeading: 'Built for the Tanzanian landlord, not the Wall-Street REIT.',
    statsSub:
      'Individual landlords lose 18% of annual rent to late payments, manual chase calls, and missing receipts. Mr. Mwikila closes the gap with the same brain that powers REITs — at zero cost on Mkulima.',
    stats: [
      { value: '18%', label: 'Average rent leakage', sub: 'For untooled landlords in Dar es Salaam (BOT 2025).' },
      { value: '4 hrs', label: 'Saved per month', sub: 'On rent chase + receipts + bookkeeping.' },
      { value: '0 TZS', label: 'On Mkulima', sub: 'Up to 5 units, one seat, core property ops.' },
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
        body: 'Tenants pay over their phone. Late payers get a polite Swahili reminder. You get a notification when each payment lands.',
      },
      {
        n: '03',
        title: 'Owner statement on the 1st',
        body: 'Every month: rent received, council levy filed, maintenance owed, net to your account. PDF + email.',
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
      { title: 'Automatic Swahili reminders', desc: 'Mr. Mwikila chases late tenants with the right tone — polite, firm, never spammy.' },
      { title: 'Cryptographic receipts',      desc: "Every M-Pesa payment lands in the double-entry ledger. Tenant signs the receipt in-app." },
      { title: 'Regulatory calendar',         desc: 'Council levy, property tax, lease renewals — every deadline lands on your phone 14 days early.' },
      { title: 'Tax-ready year-end',          desc: 'Owner statements concatenate into a TRA-ready PDF in 90 seconds.' },
    ],
    ctaHeading: 'Anza bure leo.',
    ctaSub: 'Start free today. Mkulima is free up to 5 units. Sign up with your M-Pesa number — no card needed.',
    ctaPrimary: 'Sign Up — free',
  },

  portfolioLandlord: {
    heroKicker: 'For the portfolio landlord',
    heroHeadline: 'When five units become',
    heroHeadlineAccent: 'fifty',
    heroSub:
      "Mr. Mwikila scales with you. Add buildings, blocks, and entire estates without adding spreadsheets. Cross-property cash flow, consolidated owner statements, and an autonomy dial that lets you delegate the boring parts.",
    heroPrimaryCta: 'Book a 20-minute demo',
    heroSecondaryCta: 'See the platform',
    trustline: [
      'Up to 2,500 units on Kampuni',
      'Multi-currency TZS/KES/USD',
      'Master Brain reasoning',
    ],
    statsHeading: 'Stop being your own bookkeeper.',
    statsSub:
      'Portfolio landlords spend 22 hours a month on operations that should be automated. Mr. Mwikila reclaims that time and gives you a head briefing instead.',
    stats: [
      { value: '22 hrs', label: 'Saved per month', sub: 'Per 100 units, on rent ops + maintenance triage + statements.' },
      { value: '94%',    label: 'Auto-resolved tickets', sub: 'Maintenance tickets Mr. Mwikila routes without you touching them.' },
      { value: '1 click', label: 'Owner statement', sub: 'Consolidated across every property, every entity, every currency.' },
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
      { title: 'Maintenance auto-triage',   desc: "Photos of leaks land in tickets, Mr. Mwikila dispatches the right handyman, escrows the bill." },
      { title: 'Per-building P&L',          desc: 'Live profitability per property, per block, per estate — exportable in any currency.' },
      { title: 'Regulatory calendar',       desc: 'Every council, every deadline, e-filed where supported. You sign once.' },
    ],
    ctaHeading: 'Run more, do less.',
    ctaSub: 'Book a 20-minute demo. We will import a sample of your portfolio live and show you the cockpit you would land on tomorrow.',
    ctaPrimary: 'Book a demo',
  },

  tenant: {
    heroKicker: 'For tenants and prospects',
    heroHeadline: 'Find a home,',
    heroHeadlineAccent: 'sign in minutes',
    heroSub:
      "Search verified properties across Dar, Arusha, Mwanza, Mbeya, and Nairobi. Tour virtually with the property manager. Sign your lease on your phone. Pay rent over M-Pesa. Get a digital receipt every month.",
    heroPrimaryCta: 'Browse listings',
    heroSecondaryCta: 'How signing works',
    trustline: [
      'Verified landlords only',
      'M-Pesa rent + escrow',
      'Digital receipts',
    ],
    statsHeading: "BossNyumba listings are the verified ones.",
    statsSub:
      'Every property on BossNyumba has a title-verified landlord, an inspected unit, and a lease template approved under the Land Act. No ghost listings.',
    stats: [
      { value: '100%', label: 'Title-verified',  sub: 'Every landlord verified against the registry before listing.' },
      { value: 'Hr-1', label: 'Lease in hand',   sub: 'From offer accepted to digital signature, often under an hour.' },
      { value: '0%',   label: 'Hidden fees',     sub: 'Service charges and deposits disclosed up front, on every listing.' },
    ],
    stepsKicker: 'How signing works',
    stepsHeading: 'Three steps. From scroll to keys.',
    steps: [
      { n: '01', title: 'Browse + tour',  body: 'Filter by area, bedrooms, price. Request a virtual tour or an in-person visit straight from the listing.' },
      { n: '02', title: 'Make an offer',  body: 'Tap "I want this". The landlord sees your verified profile (NIDA, employer, references) and accepts or counter-offers.' },
      { n: '03', title: 'Sign + pay',     body: 'Sign the lease on your phone with NIDA verification. First month + deposit paid into escrow over M-Pesa.' },
    ],
    problemKicker: 'The rental trap',
    problemHeading: 'Ghost listings, missing deposits,',
    problemHeadingAccent: 'no receipts',
    problemSub:
      'Renting on WhatsApp groups means scams, ghost landlords, and disputes that never settle. BossNyumba pulls the rental market into a verified, receipt-backed system.',
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Ghost listings',     desc: 'The photo was beautiful; the apartment was demolished six months ago.' },
      { title: 'Vanishing deposits', desc: 'You paid the deposit; the landlord never returned it; you have no signed paperwork.' },
      { title: 'Receipt-less rent',  desc: 'Rent paid over M-Pesa is a transaction; you have no receipt the landlord can dispute.' },
      { title: 'Unfair eviction',    desc: 'No written notice, no notice period, no path to dispute.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Verified listings only',   desc: 'Title-checked landlords, inspected units, council-approved leases.' },
      { title: 'Escrowed deposits',        desc: 'Your deposit sits in an escrow account; released only with your in-app sign-off at move-out.' },
      { title: 'Signed monthly receipts',  desc: 'Every rent payment generates a hash-chained receipt, signed by both sides.' },
      { title: 'Tenant rights',            desc: "Lease + notice + dispute path explained in Swahili and English. Built on the Land Act, not vibes." },
    ],
    ctaHeading: 'Tafuta nyumba leo.',
    ctaSub: 'Browse verified listings. No account needed to look — only to sign.',
    ctaPrimary: 'Browse listings',
  },

  leasingAgency: {
    heroKicker: 'For leasing agencies + corporate housing',
    heroHeadline: 'Place tenants ten times',
    heroHeadlineAccent: 'faster',
    heroSub:
      'Source verified inventory across Tanzania and Kenya. Match prospects to units with the AI matcher. Generate corporate-housing offers in minutes. Get paid commission automatically on lease execution.',
    heroPrimaryCta: 'Book a partner call',
    heroSecondaryCta: 'See the agency cockpit',
    trustline: [
      'Multi-landlord inventory',
      'Auto-paid commission',
      'Corporate-housing OS',
    ],
    statsHeading: 'The OS leasing agencies wish they had built.',
    statsSub:
      'Agencies on BossNyumba close placements 10x faster, get paid commission on the same day the lease lands, and stop chasing landlords for inventory updates.',
    stats: [
      { value: '10x',   label: 'Placement speed',  sub: 'From prospect to keys, vs WhatsApp-based agencies.' },
      { value: 'Same day', label: 'Commission paid', sub: 'Auto-disbursed on lease execution. No invoice chasing.' },
      { value: '3,200+',label: 'Live units',       sub: 'Verified inventory across Dar, Nairobi, Arusha, Mwanza.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Wire up your prospects. Match. Place. Get paid.',
    steps: [
      { n: '01', title: 'Sync prospects',  body: 'Bring corporate clients (banks, embassies, enterprise tenants). BossNyumba builds a brief from their relocation requirements.' },
      { n: '02', title: 'AI matcher',      body: "Mr. Mwikila ranks verified inventory against the brief — bedrooms, schools, security, commute, budget — in seconds." },
      { n: '03', title: 'Auto commission', body: 'Tenant signs, deposit lands in escrow, commission lands in your account the same day. No invoicing.' },
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
      { title: 'Auto-disbursed commission', desc: 'Same-day payment to your M-Pesa or bank, with a signed statement.' },
      { title: 'Corporate offer generator', desc: 'PDF + virtual tour + lease draft for every prospect, in two minutes.' },
      { title: 'Verified reference loop',   desc: 'NIDA, employer, prior-landlord verification — auto, no phone calls.' },
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
      'BossNyumba gives every cooperative member a real-time view of dues paid, the building maintenance plan, the AGM calendar, and the cooperative bank balance. Mr. Mwikila handles dues collection, vendor disputes, and the bookkeeping the registrar wants.',
    heroPrimaryCta: 'Apply for cooperative tier',
    heroSecondaryCta: 'How it works',
    trustline: [
      '30% off all tiers',
      'AGM-ready statements',
      'Member voting in-app',
    ],
    statsHeading: 'Cooperatives need transparency. Mr. Mwikila ships it.',
    statsSub:
      'BossNyumba bakes the cooperative-governance model into the product so dues, decisions, and disputes have one source of truth.',
    stats: [
      { value: '30%', label: 'Discount',          sub: 'Off every tier for registered cooperatives.' },
      { value: '1-tap', label: 'AGM statement',     sub: 'Registrar-ready, member-ready, accountant-ready.' },
      { value: 'In-app', label: 'Member voting',  sub: 'Quorum, weighted votes, audit trail — built in.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'From registration to AGM, all in one place.',
    steps: [
      { n: '01', title: 'Register the cooperative', body: 'Upload the cooperative certificate. BossNyumba mints the member roster, dues schedule, and governance rules.' },
      { n: '02', title: 'Dues + transparency',      body: 'Members pay monthly dues over M-Pesa. Every member sees who paid, who owes, what the cooperative spent.' },
      { n: '03', title: 'AGM + voting',             body: 'Schedule the AGM in-app. Members RSVP, vote on motions, see the audited statement. The registrar gets the filing automatically.' },
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
      { title: 'Escrowed vendor pay',  desc: 'Vendor work milestoned and escrowed in-app; member signs off; payment releases.' },
      { title: 'AGM in-app',           desc: 'Motions, voting, minutes, attendance — all hash-chained.' },
      { title: 'Auto registrar filing', desc: 'Year-end statement and minutes filed automatically where supported.' },
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
      { value: '5-yr IRR',  label: 'Conformal prediction', sub: 'With 80% / 90% / 95% confidence band, per prospect.' },
      { value: '+18%',      label: 'Avg yield uplift',     sub: 'On portfolios operated by Mr. Mwikila vs manual.' },
      { value: '1 click',   label: 'To operator mode',    sub: 'Move from due-diligence to operations in-app.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Shortlist. Diligence. Close. Operate.',
    steps: [
      { n: '01', title: 'Shortlist',   body: 'Drop in URLs, photos, or the property registry number. Mr. Mwikila builds a deal brief in 60 seconds.' },
      { n: '02', title: 'Diligence',   body: 'Title chain, zoning, building condition, comparable sales, rent rolls, levy history — one PDF.' },
      { n: '03', title: 'Operate',     body: 'Sign at close; Mr. Mwikila imports the tenant roster and starts collecting rent the same day.' },
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
      'Family-office-grade reporting on a real-estate portfolio: consolidated NAV, debt service coverage, succession-ready entity maps, and a single Mr. Mwikila advisor across every property, entity, and currency.',
    heroPrimaryCta: 'Book a family-office demo',
    heroSecondaryCta: 'See the consolidator',
    trustline: [
      'Multi-entity consolidation',
      'Succession-ready maps',
      'Multi-currency NAV',
    ],
    statsHeading: 'Built for the long-horizon owner.',
    statsSub:
      'Family-office clients run BossNyumba across 30 to 300 properties spanning multiple holding companies, trusts, and jurisdictions. Mr. Mwikila reasons across all of them as one estate.',
    stats: [
      { value: '15+', label: 'Entities per client',  sub: 'Trusts, holding companies, partnerships, single-asset SPVs.' },
      { value: 'Daily', label: 'Consolidated NAV',   sub: 'Marked to market, FX-converted, debt-adjusted.' },
      { value: '99.95%', label: 'Audit-ready',       sub: 'Append-only ledger that satisfies external auditors.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the estate. Mr. Mwikila keeps it consolidated.',
    steps: [
      { n: '01', title: 'Map the estate', body: 'Upload the corporate structure (trusts, holdcos, SPVs). Mr. Mwikila builds the consolidation graph.' },
      { n: '02', title: 'Connect cashflows', body: 'Sync every bank, M-Pesa wallet, escrow, and rent stream into the double-entry ledger.' },
      { n: '03', title: 'Daily briefing',  body: 'Each morning: NAV, DSCR, rent yield by entity, alerts on succession + tax events.' },
    ],
    problemKicker: 'The principal\'s problem',
    problemHeading: 'Three accountants, one principal,',
    problemHeadingAccent: 'no consolidated view',
    problemSub:
      "Family offices run on humans who hold institutional memory in their heads. Mr. Mwikila externalises that memory so the principal always has the same view.",
    problemTitle: 'Without BossNyumba',
    problems: [
      { title: 'Three accountants',  desc: 'Three sets of books, three currencies, three reconciliation cycles. None of them agree.' },
      { title: 'Succession opacity', desc: 'When the principal steps back, the next generation does not know which entity owns what.' },
      { title: 'FX leakage',         desc: 'TZS rent converted to USD at the wrong moment loses 4% a year you can never recover.' },
      { title: 'Asset register drift', desc: 'You discover at the audit that two assets are missing from the schedule.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      { title: 'Single consolidator', desc: 'One ledger, one NAV, every entity, every currency, marked daily.' },
      { title: 'Succession map',      desc: "Ownership graph, voting rights, beneficiary map — exportable for the family meeting." },
      { title: 'Treasury sweep',      desc: 'Auto-FX hedging on TZS rent receipts. Documented, auditable, principal-signed.' },
      { title: 'Living asset register', desc: 'Every asset, every entity, every encumbrance, hash-chained.' },
    ],
    ctaHeading: 'One estate. One advisor. One ledger.',
    ctaSub: 'Book a 45-minute family-office demo. We will model your structure live.',
    ctaPrimary: 'Book a demo',
  },

  bank: {
    heroKicker: 'For banks + property finance',
    heroHeadline: "Underwrite property cash flows",
    heroHeadlineAccent: 'in real time',
    heroSub:
      'BossNyumba surfaces verified, hash-chained property cash flows so banks can underwrite mortgages, bridge loans, and acquisition finance with confidence — even for small landlords who never had bankable books.',
    heroPrimaryCta: 'Book a credit demo',
    heroSecondaryCta: 'See the credit feed',
    trustline: [
      'Hash-chained cash flows',
      'Conformal DSCR projections',
      'API-first credit feed',
    ],
    statsHeading: 'Bank the underbanked landlord.',
    statsSub:
      "Most Tanzanian landlords have rentable assets and no bankable books. BossNyumba's audit chain turns receipts into underwritable cash flow.",
    stats: [
      { value: '12 mo',  label: 'Live cash-flow history', sub: 'Per landlord, hash-chained, exportable to your credit system.' },
      { value: '+38%',   label: 'Underwrite-ready pool',  sub: 'Of Mfanyabiashara-and-above landlords on BossNyumba.' },
      { value: 'API',    label: 'Direct feed',            sub: 'Read-only API into landlord-consented cash-flow data.' },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Consent. Score. Lend. Monitor.',
    steps: [
      { n: '01', title: 'Landlord consents',  body: 'Your customer authorises a read-only data share to your bank via in-app consent flow.' },
      { n: '02', title: 'Score',              body: 'Pull 12-month rent collection, occupancy, levy compliance, maintenance reserve — all hash-chained.' },
      { n: '03', title: 'Lend + monitor',     body: 'Disburse over your existing rails. Monitor DSCR live; default warnings 90 days early.' },
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
      { title: 'Verified cash flows',    desc: 'Hash-chained 12-month rent + maintenance + levy history per landlord.' },
      { title: 'Cash-flow LTV',          desc: 'Lend against rent yield as well as title; price for risk you can actually see.' },
      { title: 'Live DSCR feed',         desc: 'Real-time DSCR per loan; alerts when cover drops below covenants.' },
      { title: 'Portfolio dashboard',    desc: 'Per-product, per-region health metrics; risk-rated alerts, not anniversary reviews.' },
    ],
    ctaHeading: 'Lend to the landlords you have always wanted to.',
    ctaSub: 'Book a 30-minute credit demo. We will walk through the consent flow, the data feed, and the underwriting model.',
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
      'BossNyumba powers cooperative housing, community land trusts, and worker-housing partnerships for NGOs, industrial towns, and university campuses. Mr. Mwikila runs the dues, the allocations, the disputes, and the AGM.',
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
      { n: '02', title: 'Dues + allocation',   body: 'Members pay dues; vacancies are allocated by transparent lottery. Every step is hash-chained.' },
      { n: '03', title: 'AGM + transparency',  body: 'AGM in-app: motions, voting, AGM minutes, audited financials — all member-visible.' },
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
      { title: 'Allocation lottery',  desc: 'Transparent, weighted, auditable — based on dues paid, time on list, family size.' },
      { title: 'AGM in-app',          desc: 'Motions, voting, minutes, attendance — hash-chained.' },
      { title: 'Donor reports',       desc: 'NGOs and corporates get a quarterly impact pack, auto-generated, audit-ready.' },
    ],
    ctaHeading: 'Trust, baked in.',
    ctaSub: 'Apply for the community-housing tier. Registered schemes get 30% off every tier.',
    ctaPrimary: 'Apply',
  },
} as const satisfies Record<string, AudiencePageCopy>;
