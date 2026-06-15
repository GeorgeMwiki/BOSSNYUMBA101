/**
 * Careers role source of truth.
 *
 * The index (`/careers`) and the detail route (`/careers/[slug]`) both
 * read from this single array so every "Apply" link resolves to a real,
 * rendered role page — no 404s. The `slug` is stored explicitly (rather
 * than derived at the link site) so the index and the route never drift.
 */

export interface Role {
  readonly slug: string;
  readonly title: string;
  readonly team: string;
  readonly location: string;
  readonly type: string;
  readonly summary: string;
  readonly responsibilities: ReadonlyArray<string>;
  readonly requirements: ReadonlyArray<string>;
}

export const ROLES: ReadonlyArray<Role> = [
  {
    slug: 'senior-backend-engineer-hono-drizzle',
    title: 'Senior backend engineer (Hono + Drizzle)',
    team: 'Platform',
    location: 'Dar es Salaam · Hybrid',
    type: 'Full-time',
    summary:
      'Own the API gateway and the data layer that the entire platform runs on — Hono BFF, Drizzle schemas, row-level security, and the double-entry ledger path.',
    responsibilities: [
      'Design and ship Hono route handlers behind the api-gateway composition root.',
      'Model tenant-scoped schemas in Drizzle with row-level security force-enabled.',
      'Keep the money path correct: every write goes through the ledger posting service.',
    ],
    requirements: [
      '5+ years building production TypeScript backends.',
      'Deep comfort with Postgres, transactions, and migration discipline.',
      'A bias for honest error states over silent failure.',
    ],
  },
  {
    slug: 'senior-frontend-engineer-next-vite',
    title: 'Senior frontend engineer (Next + Vite)',
    team: 'Product',
    location: 'Dar es Salaam · Hybrid',
    type: 'Full-time',
    summary:
      'Build the owner cockpit and marketing surfaces — a Next.js marketing site and an 80+ page Vite owner portal, fully bilingual sw/en.',
    responsibilities: [
      'Ship accessible, fast React surfaces against the shared design system.',
      'Hold the absolute language-toggle invariant: one locale, everywhere.',
      'Wire real data and honest loading, empty, and error states.',
    ],
    requirements: [
      '5+ years of React, with strong Next.js and Vite experience.',
      'A real eye for craft, motion, and accessibility (WCAG 2.2 AA).',
      'Comfort working across a monorepo with shared packages.',
    ],
  },
  {
    slug: 'ai-engineer-master-brain-lmbm',
    title: 'AI engineer — Master Brain + LMBM',
    team: 'AI',
    location: 'Remote (EAT ±3h)',
    type: 'Full-time',
    summary:
      'Work on the 12-agent brain kernel — think-pipeline, sensors, debate, and retrieval — that powers Mr. Mwikila across every property domain.',
    responsibilities: [
      'Extend the think-pipeline and reasoning kernel with new capabilities.',
      'Improve retrieval quality and grounding against the property knowledge base.',
      'Build evals and red-team harnesses that gate every shipped change.',
    ],
    requirements: [
      'Hands-on experience building LLM agent systems in production.',
      'Strong evaluation instincts — you measure before you trust.',
      'Fluency in TypeScript and a pragmatic approach to prompts and tools.',
    ],
  },
  {
    slug: 'mobile-engineer-expo-react-native',
    title: 'Mobile engineer (Expo / React Native)',
    team: 'Mobile',
    location: 'Nairobi · Hybrid',
    type: 'Full-time',
    summary:
      'Ship the tenant and workforce apps in Expo — offline-first, voice-capable, and built for low-end Android across East Africa.',
    responsibilities: [
      'Build and maintain the tenant and staff Expo apps.',
      'Make offline, voice, and low-bandwidth flows feel first-class.',
      'Keep the bilingual experience pixel-perfect on small screens.',
    ],
    requirements: [
      '4+ years of React Native, ideally with Expo.',
      'Experience shipping for constrained, low-end Android devices.',
      'Care for the field realities of East African connectivity.',
    ],
  },
  {
    slug: 'solutions-architect-property-domain',
    title: 'Solutions architect (property domain)',
    team: 'Solutions',
    location: 'Dar es Salaam · On-site',
    type: 'Full-time',
    summary:
      'Translate the messy reality of East African property operations into clean onboarding — leases, rent rolls, and portfolios mapped onto the platform.',
    responsibilities: [
      'Run live data imports with prospects during demos.',
      'Map real portfolios onto the platform model.',
      'Feed field learning back into product and engineering.',
    ],
    requirements: [
      'Deep knowledge of property management operations.',
      'Comfort with data, spreadsheets, and a little SQL.',
      'Fluent Swahili and English.',
    ],
  },
  {
    slug: 'customer-success-manager-tanzania',
    title: 'Customer success manager — Tanzania',
    team: 'Success',
    location: 'Dar es Salaam · On-site',
    type: 'Full-time',
    summary:
      'Own the success of Tanzanian landlords and operators from onboarding through renewal — the human face of Mr. Mwikila.',
    responsibilities: [
      'Onboard and retain Tanzanian customers across every audience.',
      'Turn customer signal into product priorities.',
      'Run training and adoption in Swahili and English.',
    ],
    requirements: [
      '3+ years in customer success or account management.',
      'Property or fintech experience is a strong plus.',
      'Fluent Swahili and English.',
    ],
  },
  {
    slug: 'customer-success-manager-kenya',
    title: 'Customer success manager — Kenya',
    team: 'Success',
    location: 'Nairobi · On-site',
    type: 'Full-time',
    summary:
      'Own the success of Kenyan landlords and operators from onboarding through renewal as we expand the M-Pesa rent rail into Kenya.',
    responsibilities: [
      'Onboard and retain Kenyan customers across every audience.',
      'Partner with the Tanzania team on shared playbooks.',
      'Run training and adoption in Swahili and English.',
    ],
    requirements: [
      '3+ years in customer success or account management.',
      'Knowledge of the Kenyan property and M-Pesa landscape.',
      'Fluent Swahili and English.',
    ],
  },
  {
    slug: 'sre-devops-engineer',
    title: 'SRE / DevOps engineer',
    team: 'Platform',
    location: 'Remote (EAT ±3h)',
    type: 'Full-time',
    summary:
      'Keep the platform fast, observable, and always-on — Kubernetes, OpenTelemetry, and the deploy pipeline that ships every service.',
    responsibilities: [
      'Own the Kubernetes deploys, cronjobs, and worker fleet.',
      'Build observability that makes incidents short and rare.',
      'Harden the platform against the failure modes that matter.',
    ],
    requirements: [
      '4+ years in SRE or platform engineering.',
      'Strong Kubernetes, CI/CD, and OpenTelemetry experience.',
      'A calm, evidence-first incident temperament.',
    ],
  },
  {
    slug: 'designer-product-brand',
    title: 'Designer (product + brand)',
    team: 'Product',
    location: 'Remote (EAT ±5h)',
    type: 'Full-time',
    summary:
      'Shape both the product surfaces and the BossNyumba brand — from cockpit interactions to the marketing identity — held to a world-class bar.',
    responsibilities: [
      'Design product flows that feel calm and trustworthy.',
      'Evolve the brand system across marketing and product.',
      'Hold the bilingual experience to a single, coherent standard.',
    ],
    requirements: [
      '5+ years of product and/or brand design.',
      'A portfolio that shows craft, systems thinking, and motion.',
      'Comfort designing for two languages as a first-class constraint.',
    ],
  },
];

export function getRoleBySlug(slug: string): Role | undefined {
  return ROLES.find((role) => role.slug === slug);
}

export const CAREERS_INBOX = 'careers@bossnyumba.com';
