'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  ShieldCheck,
  Network,
  LineChart,
  Mic,
  Plug,
  Workflow,
  FileCheck,
  Scale,
  Languages,
  HandCoins,
  Building2,
  Wrench,
  KeyRound,
  BarChart3,
  HeartHandshake,
  Home,
} from 'lucide-react';

import { Logomark } from '@bossnyumba/design-system';

/**
 * Shared marketing capabilities section. Carbon copy of
 * LITFIN_PATH/src/components/marketing/CapabilitiesSection.tsx
 * adapted to BossNyumba's real-estate domain.
 *
 * Tells the reader WHAT BossNyumba actually does for their audience,
 * in concrete product terms: named features, integrations, metrics.
 */

export type CapabilityAudience =
  | 'platform'
  | 'landlord'
  | 'tenant'
  | 'agency'
  | 'cooperative'
  | 'investor'
  | 'bank'
  | 'regulator';

export interface Capability {
  readonly icon: LucideIcon;
  readonly name: string;
  readonly description: string;
}

function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const PLATFORM_CORE: ReadonlyArray<Capability> = [
  {
    icon: Brain,
    name: '3-provider AI orchestration',
    description:
      'Claude, OpenAI, DeepSeek routed by task. Opus for deep reasoning on lease disputes, Haiku for fast triage, GPT-4 for structured extraction from PDFs.',
  },
  {
    icon: Network,
    name: 'Live estate knowledge graph',
    description:
      'Every property, lease, tenant, payment, ticket as nodes with temporal edges. Ask in natural language; get cited answers grounded in your real data.',
  },
  {
    icon: LineChart,
    name: 'Cash-flow forecasting',
    description:
      'Per-unit, per-month rent forecast. Default-risk early signal. Maintenance budget projection with explainable driver subgraphs.',
  },
  {
    icon: ShieldCheck,
    name: 'Enterprise-grade security',
    description:
      'RLS on every tenant-scoped table, AES-256-GCM field encryption, hash-chained audit. PDPA + GDPR ready. SOC 2 Type II on the roadmap.',
  },
  {
    icon: Mic,
    name: 'Voice on every phone',
    description:
      'Swahili and English STT/TTS, OpenAI Realtime for calls. Works on feature phones via staged call + USSD. Mr. Mwikila speaks like a Tanzanian.',
  },
  {
    icon: Plug,
    name: 'Native payment rails',
    description:
      'M-Pesa, Airtel Money, Tigo Pesa, Stripe, NHC, BRELA, TRA connectors via MCP. Circuit-breaker + retry + idempotency on every webhook.',
  },
];

const LANDLORD_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: Workflow,
    name: 'Lease lifecycle engine',
    description:
      'Application → screening → contract → move-in → renewal → exit. Every state-transition audit-trailed and reversible.',
  },
  {
    icon: HandCoins,
    name: 'Rent treasury',
    description:
      'Auto-reconcile M-Pesa, bank transfers, cash. Per-unit running balance. 3-day-before reminders in Swahili. Late-fee policy enforced.',
  },
  {
    icon: Wrench,
    name: 'Maintenance dispatch',
    description:
      'Tenants report tickets in chat or photo. AI triages severity. Auto-routes to your preferred technicians. Spend approval at your touch.',
  },
  {
    icon: FileCheck,
    name: 'Compliance auto-pack',
    description:
      'BRELA registration, TRA receipts, NHC reports generated automatically. Evidence-backed, exportable, regulator-ready.',
  },
  {
    icon: Home,
    name: 'Tenant CRM',
    description:
      'One record per tenant across history, payments, complaints, references. Renewal-likelihood scored. Hot leads surfaced.',
  },
  {
    icon: BarChart3,
    name: 'Owner brief',
    description:
      'A two-minute 06:00 brief: who paid, who didn\'t, what needs your attention, what Mr. Mwikila did overnight.',
  },
];

const TENANT_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: KeyRound,
    name: 'One-tap rent payment',
    description:
      'M-Pesa STK push. Receipt issued instantly. Running balance always live. Pay early to build your tenancy score.',
  },
  {
    icon: Wrench,
    name: 'Maintenance in chat',
    description:
      'Snap a photo, type the problem in Swahili. AI triages, your landlord is notified, the right technician arrives. No call centre.',
  },
  {
    icon: FileCheck,
    name: 'Lease + receipts always to hand',
    description:
      'Signed lease, payment receipts, inspection reports. All in one place. Exportable for visa or loan applications.',
  },
];

const AGENCY_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: Workflow,
    name: 'Listing-to-close workflow',
    description:
      'Lead in → viewing scheduled → offer made → lease drafted → commission calculated. Every step recorded.',
  },
  {
    icon: HandCoins,
    name: 'Commission accounting',
    description:
      'Per-agent split. Trail-commission tracked across renewal cycles. Statements auto-generated. TRA-compliant invoicing.',
  },
  {
    icon: Building2,
    name: 'Multi-portfolio mandate',
    description:
      'Manage 5 to 500 owners under one console. RLS-isolated. Per-mandate reporting. Owner self-serve dashboards.',
  },
];

const COOPERATIVE_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: HeartHandshake,
    name: 'Member governance',
    description:
      'Member rolls, voting, AGM minutes, contributions ledger. Cooperative Audit Office reports auto-generated.',
  },
  {
    icon: HandCoins,
    name: 'Shared-facility costing',
    description:
      'Allocate water, security, gardening across units fairly. Per-member statement always live.',
  },
  {
    icon: BarChart3,
    name: 'Member performance dashboard',
    description:
      'Contribution history, loan utilisation, default patterns, dividend projections — one live view.',
  },
];

const INVESTOR_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: LineChart,
    name: 'Cap-rate + yield modelling',
    description:
      'Per-property cap-rate, gross yield, net yield, IRR. Comparable-set benchmarking against Dar es Salaam, Nairobi, Kampala.',
  },
  {
    icon: BarChart3,
    name: 'Exit modelling',
    description:
      'Hold-vs-sell analysis with sensitivity over interest, occupancy, and cap-rate movement. Decision-journal-grade.',
  },
  {
    icon: Brain,
    name: 'Acquisition scout',
    description:
      'Mr. Mwikila sifts off-market deals matched to your thesis. Cites comparables. Flags structural risks.',
  },
];

const BANK_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: ShieldCheck,
    name: 'Property-collateral monitoring',
    description:
      'Live cash-flow on every charged property. Coverage ratio recalculated nightly. Early-warning before covenant breach.',
  },
  {
    icon: FileCheck,
    name: 'Valuation + title verification',
    description:
      'Auto-cross-reference BRELA title, NHC registry, last 3 valuations. Discrepancy flagged before disbursement.',
  },
  {
    icon: Scale,
    name: '5Cs for property lending',
    description:
      'Character, Capacity, Capital, Collateral, Conditions — tuned for property exposure. Per-product weights. Contradiction detection.',
  },
];

const REGULATOR_CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: FileCheck,
    name: 'Regulator-grade audit trail',
    description:
      'Hash-chained, append-only. Every action with actor, timestamp, evidence. PCCB + EITI export-ready.',
  },
  {
    icon: Languages,
    name: 'Bilingual evidence',
    description:
      'Every record renders in Swahili or English at the click. Translations tied to the source document, not retranslated each view.',
  },
  {
    icon: ShieldCheck,
    name: 'Privacy by construction',
    description:
      'PDPA: data-subject access, erasure, portability — all native APIs. Consent ledger immutable.',
  },
];

const AUDIENCE_MAP: Record<CapabilityAudience, ReadonlyArray<Capability>> = {
  platform: PLATFORM_CORE,
  landlord: LANDLORD_CAPABILITIES,
  tenant: TENANT_CAPABILITIES,
  agency: AGENCY_CAPABILITIES,
  cooperative: COOPERATIVE_CAPABILITIES,
  investor: INVESTOR_CAPABILITIES,
  bank: BANK_CAPABILITIES,
  regulator: REGULATOR_CAPABILITIES,
};

interface CapabilitiesSectionProps {
  readonly audience: CapabilityAudience;
  readonly kicker?: string;
  readonly headline?: string;
  readonly subhead?: string;
  readonly className?: string;
}

const DEFAULT_COPY: Record<
  CapabilityAudience,
  { readonly kicker: string; readonly headline: string; readonly subhead: string }
> = {
  platform: {
    kicker: 'What BossNyumba is, concretely',
    headline: 'An AI-native estate operating system.',
    subhead:
      'Not a chat bolted onto a spreadsheet. Six interlocking systems, every one shipping in production. Built for Tanzanian real-estate first, generalised second.',
  },
  landlord: {
    kicker: 'What you get, named',
    headline: 'Everything a modern landlord needs.',
    subhead:
      'Lease engine, rent treasury, maintenance dispatch, compliance pack, tenant CRM, owner brief. Mr. Mwikila as the calm partner.',
  },
  tenant: {
    kicker: 'What you get, concretely',
    headline: 'Renting, finally civilised.',
    subhead:
      'One-tap rent, maintenance in chat, lease and receipts always to hand. Free to use. Your landlord pays for the brain.',
  },
  agency: {
    kicker: 'Built for letting agencies',
    headline: 'Your brokerage, automated.',
    subhead:
      'Listing-to-close workflow, commission accounting, multi-portfolio mandate, agent productivity dashboards.',
  },
  cooperative: {
    kicker: 'Built for housing cooperatives',
    headline: 'Member governance, made simple.',
    subhead:
      'Member rolls, AGM minutes, shared-facility costing, performance dashboards, cooperative audit reports.',
  },
  investor: {
    kicker: 'Built for property investors',
    headline: 'Decisions you can defend.',
    subhead:
      'Cap-rate modelling, exit analysis, acquisition scout, comparable-set benchmarking across East Africa.',
  },
  bank: {
    kicker: 'Built for property-collateral desks',
    headline: 'Live collateral, live coverage.',
    subhead:
      'Property-collateral monitoring, valuation cross-reference, 5Cs framework tuned for property exposure.',
  },
  regulator: {
    kicker: 'Built for regulators',
    headline: 'Evidence to the field level.',
    subhead:
      'Hash-chained audit trail, bilingual evidence, PDPA-native consent ledger. The operating system regulators wish operators ran.',
  },
};

export function CapabilitiesSection({
  audience,
  kicker,
  headline,
  subhead,
  className,
}: CapabilitiesSectionProps) {
  const capabilities = AUDIENCE_MAP[audience];
  const copy = DEFAULT_COPY[audience];
  const resolvedKicker = kicker ?? copy.kicker;
  const resolvedHeadline = headline ?? copy.headline;
  const resolvedSubhead = subhead ?? copy.subhead;

  return (
    <section
      className={cn(
        'relative isolate overflow-hidden py-16 md:py-24 px-5 border-t border-border bg-card/40',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[480px] w-[480px] rounded-full blur-3xl opacity-20"
        style={{
          background:
            'radial-gradient(circle, hsl(24 82% 58% / 0.35) 0%, hsl(24 70% 48% / 0.08) 45%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 md:mb-14 flex max-w-3xl items-start gap-4">
          <Logomark size={36} variant="premium" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              {resolvedKicker}
            </p>
            <h2 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-foreground leading-[1.05]">
              {resolvedHeadline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              {resolvedSubhead}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <article
                key={cap.name}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border bg-card p-5',
                  'shadow-sm',
                  'transition-[border-color,box-shadow,transform] duration-300',
                  'hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg',
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl',
                    'opacity-0 transition-opacity duration-500',
                    'group-hover:opacity-50',
                  )}
                  style={{
                    background:
                      'radial-gradient(circle, hsl(24 82% 60% / 0.5) 0%, transparent 70%)',
                  }}
                />
                <div
                  className={cn(
                    'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md',
                    'bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]',
                    'transition-all duration-300',
                    'group-hover:bg-primary/20 group-hover:scale-105',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                  {cap.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {cap.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
