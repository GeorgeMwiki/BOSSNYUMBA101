/**
 * Blog post source of truth.
 *
 * The index (`/blog`) and the detail route (`/blog/[slug]`) both read
 * from this single array so the links the index renders always resolve
 * to a real, rendered post — no 404s. `body` holds the post copy as an
 * ordered list of paragraphs; the detail route renders them in order.
 */

export type PostTag = 'Product' | 'Field notes' | 'Engineering' | 'Policy';

export interface Post {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly tag: PostTag;
  readonly readingMinutes: number;
  readonly body: ReadonlyArray<string>;
}

export const POSTS: ReadonlyArray<Post> = [
  {
    slug: 'mr-mwikila-canonical-launch',
    title: 'Mr. Mwikila is now your AI Property Operations Manager',
    excerpt:
      'We have locked the canonical identity. One name, one title, one chat header across every Boss Nyumba surface. Here is why we did it and what it means for tenant trust.',
    date: '2026-05-22',
    tag: 'Product',
    readingMinutes: 4,
    body: [
      'For most of our pilot, the assistant inside Boss Nyumba went by a handful of names depending on which screen you opened. On the owner cockpit it was the "co-pilot"; in the tenant app it was simply "the assistant"; in the chat header it borrowed whatever the last designer had typed. That inconsistency is small until it is not — until a tenant in Mikocheni asks their landlord who exactly is sending these Swahili rent reminders.',
      'So we locked it. Across every surface — owner web, tenant mobile, the marketing site, the chat header, the audit trail — the assistant is Mr. Mwikila, your AI Property Operations Manager. One name. One title. One face.',
      'The reason is trust. A property manager is a person you build a relationship with over years. When the brain handling your lease, your rent, and your maintenance has a consistent identity, the trust transfers. People do not trust "the system"; they trust Mr. Mwikila.',
      'Operationally, the canonical identity also gives us a single audit subject. Every signed action in the hash-chained ledger now attributes to one actor, which makes dispute resolution and regulator review dramatically cleaner.',
    ],
  },
  {
    slug: 'm-pesa-rent-collection-at-50-units',
    title: 'M-Pesa rent collection at 50 units: what we learned',
    excerpt:
      'Lessons from running rent collection over M-Pesa for a 53-unit portfolio in Kinondoni: reconciliation, dispute rates, and the one config we wish we had set on day one.',
    date: '2026-05-08',
    tag: 'Field notes',
    readingMinutes: 6,
    body: [
      'A 53-unit portfolio in Kinondoni was our first real stress test for M-Pesa rent collection at scale. Here is what surprised us, what broke, and the single configuration we wish we had flipped on day one.',
      'Reconciliation is the whole game. The hard part was never accepting a payment — it was matching an inbound M-Pesa transaction to the right tenant, the right unit, and the right month, when the reference field is a free-text mess that tenants type from memory. Our auto-reconciler started at roughly 80% match confidence; by tuning on the tenant phone number plus a rolling expected-amount window we pushed it past 97%.',
      'Dispute rates fell once reminders went out three days early in Swahili. Disputes are almost always about timing, not amount — a tenant who got a reminder rarely disputes the charge.',
      'The config we wish we had set on day one: lock the expected due-date window per lease before the first collection cycle. Without it, the reconciler has no anchor and every early or late payment looks ambiguous.',
    ],
  },
  {
    slug: 'autonomy-dial-for-property-managers',
    title: 'The autonomy dial for property managers',
    excerpt:
      'Five levels of autonomy, ten property domains. How we settled on the dial, and which level your portfolio should start at.',
    date: '2026-04-24',
    tag: 'Product',
    readingMinutes: 5,
    body: [
      'Autonomy is not a single switch. A landlord might be happy for Mr. Mwikila to send rent reminders unattended but want to approve every maintenance contractor personally. So we built a dial, not a toggle.',
      'There are five levels — from observe-only, through suggest, draft, act-with-approval, all the way to fully autonomous within policy — applied independently across ten property domains: leases, rent, maintenance, treasury, compliance, communications, and more.',
      'Where should you start? Almost everyone should begin at draft for money-touching domains and act-with-approval for communications. You watch the assistant work for a few cycles, build trust, and turn the dial up domain by domain.',
      'Critically, the dial never overrides policy. A fully autonomous setting still respects the inviolable rules — kill-switches, four-eyes thresholds, and sovereign approvals — that sit beneath every action.',
    ],
  },
  {
    slug: 'append-only-rent-ledger',
    title: 'Why our rent ledger is append-only (and what that means for disputes)',
    excerpt:
      'The hash-chained audit invariant inside Boss Nyumba. How it survives phone changes, accountant turnover, and tenant-vs-landlord disputes.',
    date: '2026-04-09',
    tag: 'Engineering',
    readingMinutes: 7,
    body: [
      'Every financial event in Boss Nyumba is written once and never edited. The rent ledger is append-only and hash-chained: each entry carries the hash of the one before it, so any tampering breaks the chain and is immediately detectable.',
      'This matters most in disputes. When a tenant and landlord disagree about whether March rent was paid, there is no "trust me" — there is a cryptographically verifiable record that survives phone changes, accountant turnover, and even a change of management company.',
      'Append-only also means corrections are reversals, not edits. If a payment was misapplied, we post a compensating entry. The original stays visible. An auditor can always reconstruct exactly what happened and when.',
      'The double-entry invariant underneath guarantees the books always balance. Every money path goes through a single posting service, so there is no back door that could write an unbalanced or untraceable entry.',
    ],
  },
  {
    slug: 'housing-regulator-evidence-pack',
    title: 'What an evidence-based housing regulator dashboard looks like',
    excerpt:
      'Live, anonymised, hash-chained district median rents. We built it for the regulator pilot. Here is the architecture.',
    date: '2026-03-27',
    tag: 'Policy',
    readingMinutes: 6,
    body: [
      'Regulators do not need access to individual leases — they need trustworthy aggregates. So we built a regulator dashboard that exposes anonymised, district-level median rents, derived from the same hash-chained ledger that powers everything else.',
      'The key design constraint was privacy by construction. Aggregates are computed with minimum-cohort thresholds so no single tenant or landlord can be re-identified, and the dashboard never exposes raw transactions.',
      'Because the underlying data is append-only and hash-chained, the regulator can verify that the numbers were not retrofitted. The evidence pack is reproducible: given the same window, the same figures come out every time.',
      'This is what evidence-based housing policy can look like — live signal instead of stale surveys, with cryptographic integrity that both the regulator and the regulated can trust.',
    ],
  },
  {
    slug: 'swahili-first-product-decisions',
    title: 'Swahili-first product decisions we made (and a few we regret)',
    excerpt:
      'The case for defaulting to Swahili in the UI, the chat, and the receipts. The case against. And the design tradeoffs nobody talks about.',
    date: '2026-03-14',
    tag: 'Product',
    readingMinutes: 5,
    body: [
      'Boss Nyumba is bilingual, and the language toggle is absolute: when a user picks Swahili, every surface — chat, receipts, reminders, errors, greetings — is Swahili, with zero English bleeding through, and vice versa. That sounds obvious. It is genuinely hard.',
      'The hard part is the long tail. It is easy to translate the homepage. It is the toast that fires on a failed M-Pesa retry, the empty-state copy on a screen nobody visits, the greeting that must never mix "Habari" with "Hello" — those are where mixed-language bugs hide.',
      'We default new users to English and let Tanzanian users switch to Swahili in settings, because English is the safest fallback across our audiences. Some of the team still argues we should default to Swahili in-market. It is a live debate.',
      'What we do not regret: treating the toggle as a hard invariant rather than a best-effort. A half-translated product reads as a half-built product, and trust is the whole business.',
    ],
  },
];

export function getPostBySlug(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug);
}

export const TAG_TONE: Record<PostTag, string> = {
  Product: 'text-signal-500',
  'Field notes': 'text-emerald-400',
  Engineering: 'text-blue-400',
  Policy: 'text-amber-400',
};
