'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  Image as ImageIcon,
  MapPin,
  Mic,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Logomark } from '@bossnyumba/design-system';
import {
  CHAT_HEADER_GRADIENT,
  CHAT_USER_BUBBLE,
  CHAT_AI_BUBBLE,
} from '@bossnyumba/chat-ui';
import { getMessages, type Locale } from '@/lib/i18n';

/**
 * IGNITION HERO — Live Fabric marketing pattern. Carbon copy of
 * UPSTREAM_PATH/src/components/marketing/IgnitionHero.tsx adapted to
 * BossNyumba's real-estate domain. Mr. Mwikila is the AI Estate-
 * Management Partner; the choreographed reply mirrors a Dar es
 * Salaam landlord conversation, not credit/lending.
 *
 * Left: claim + CTA row. Right: live chat inset running a
 * choreographed mini-conversation that mirrors the EXACT aesthetic
 * of the platform widget (gradient header, MessageBubble styling,
 * compliance disclaimer, mic waveform). Live Fabric rule: marketing
 * pages don't use screenshots — they embed the product itself
 * running on safe demo data.
 */

function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

interface ChoreoTurn {
  readonly role: 'ai' | 'user';
  readonly body: string;
  readonly timestamp: string;
  readonly delay: number;
}

const DELAYS: readonly number[] = [400, 1800, 3200];

function getChoreo(locale: Locale, timestamp: string): ReadonlyArray<ChoreoTurn> {
  if (locale === 'sw') {
    return [
      {
        role: 'ai',
        body: "Habari. Mimi ni Mwl. Mwikila, Mshirika wako wa AI wa Usimamizi wa Mali. Umekuja kwa nini leo?",
        timestamp,
        delay: DELAYS[0],
      },
      {
        role: 'user',
        body: 'Ninaendesha vyumba 14 Mikocheni, Dar es Salaam. Ukusanyaji wa kodi una matatizo.',
        timestamp,
        delay: DELAYS[1],
      },
      {
        role: 'ai',
        body: 'Nimekuelewa. BossNyumba inaweza kuweka vyumba vyako 14 kwenye orodha moja ya kodi, kuoanisha malipo ya M-Pesa kiotomatiki, na kutuma vikumbusho kwa Kiswahili siku tatu kabla ya tarehe ya mwisho. Ungependa kuona jinsi makusanyo yako ya Machi yangeonekana?',
        timestamp,
        delay: DELAYS[2],
      },
    ];
  }
  return [
    {
      role: 'ai',
      body: "Hi. I'm Mr. Mwikila, your AI Estate-Management Partner. What brings you here today?",
      timestamp,
      delay: DELAYS[0],
    },
    {
      role: 'user',
      body: 'I run 14 units in Mikocheni, Dar es Salaam. Rent collection is messy.',
      timestamp,
      delay: DELAYS[1],
    },
    {
      role: 'ai',
      body: 'Got it. BossNyumba can put your 14 units on one rent-roll, auto-reconcile M-Pesa payments, and send Swahili reminders three days before each due date. Want to see how your March collection would have looked?',
      timestamp,
      delay: DELAYS[2],
    },
  ];
}

function ChatTurn({
  role,
  body,
  timestamp,
  show,
}: {
  readonly role: 'ai' | 'user';
  readonly body: string;
  readonly timestamp: string;
  readonly show: boolean;
}) {
  if (!show) return null;
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: isUser ? 12 : -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'flex gap-2 max-w-[85%]',
          isUser ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        {!isUser && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(36_92%_72%/0.55),hsl(24_72%_50%/0.25)_60%,transparent_85%)] ring-1 ring-primary/20">
            <Logomark size={22} variant="premium" />
          </div>
        )}
        <div className="min-w-0">
          <div
            className={cn(
              'relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              isUser ? CHAT_USER_BUBBLE : CHAT_AI_BUBBLE,
            )}
          >
            {!isUser && (
              <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-[hsl(36_86%_64%)] via-[hsl(24_72%_50%)] to-[hsl(14_62%_30%)] opacity-60" />
            )}
            {body}
          </div>
          <div
            className={cn(
              'mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/80',
              isUser ? 'justify-end' : 'justify-start',
            )}
          >
            <span>{timestamp}</span>
            {!isUser && (
              <Volume2
                size={11}
                className="text-muted-foreground/60"
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Animated waveform that matches the widget mic input area. */
function MiniWaveform() {
  const bars = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="flex items-center justify-center gap-[2px] h-4">
      {bars.map((i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full bg-primary/60"
          animate={{
            height: [4, 8 + Math.sin(i) * 4, 4, 12 - Math.cos(i) * 3, 4],
            opacity: [0.5, 0.9, 0.5, 0.9, 0.5],
          }}
          transition={{
            duration: 1.2 + (i % 3) * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
}

export interface IgnitionHeroProps {
  readonly locale: Locale;
}

export function IgnitionHero({ locale }: IgnitionHeroProps) {
  const t = getMessages(locale).hero;
  const chat = t.chat;
  const sw = locale === 'sw';
  const choreo = getChoreo(locale, chat.timestamp);
  const [shown, setShown] = useState<boolean[]>(choreo.map(() => false));

  useEffect(() => {
    const timers: number[] = [];
    let kickoffTimeout: ReturnType<typeof setTimeout> | null = null;
    let listenerAttached = false;

    const startChoreography = () => {
      choreo.forEach((turn, i) => {
        timers.push(
          window.setTimeout(
            () =>
              setShown((prev) => {
                const next = [...prev];
                next[i] = true;
                return next;
              }),
            turn.delay,
          ),
        );
      });
    };

    if (document.readyState === 'complete') {
      kickoffTimeout = setTimeout(startChoreography, 0);
    } else {
      window.addEventListener('load', startChoreography, { once: true });
      listenerAttached = true;
    }

    return () => {
      if (listenerAttached) {
        window.removeEventListener('load', startChoreography);
      }
      if (kickoffTimeout !== null) clearTimeout(kickoffTimeout);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <section className="relative isolate overflow-hidden">
      {/* Ambient copper wash + ember floor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 -z-10 h-[560px] w-[560px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            'radial-gradient(circle, hsl(24 82% 58% / 0.4) 0%, hsl(24 70% 48% / 0.12) 40%, transparent 72%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 -z-10 h-[620px] w-[620px] rounded-full blur-3xl opacity-25"
        style={{
          background:
            'radial-gradient(circle, hsl(14 70% 48% / 0.35) 0%, hsl(14 60% 35% / 0.1) 44%, transparent 75%)',
        }}
      />

      <div className="mx-auto flex min-h-[88vh] max-w-7xl flex-col items-stretch gap-12 px-5 pb-20 pt-16 md:grid md:grid-cols-[1.15fr_1fr] md:gap-12 md:pt-24 lg:gap-16">
        {/* LEFT — claim + CTAs */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{t.pill}</span>
          </div>

          <h1
            className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.025em] text-foreground md:text-6xl lg:text-7xl"
            style={{ textWrap: 'balance' }}
          >
            {sw ? (
              <>
                Mfumo wa kwanza duniani wa{' '}
                <span className="relative inline-block">
                  <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                    Mshirika wa AI wa Usimamizi wa Mali
                  </span>
                </span>{' '}
                anayejifunza mali zako.
              </>
            ) : (
              <>
                The world&rsquo;s first{' '}
                <span className="relative inline-block">
                  <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                    AI Estate-Management Partner
                  </span>
                </span>{' '}
                that learns your portfolio.
              </>
            )}
          </h1>

          <p
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            style={{ textWrap: 'pretty' }}
          >
            {sw
              ? 'BossNyumba ni mfumo pekee wa uendeshaji uliojengwa kusimamia mwenye nyumba binafsi, mali ya mfululizo, mfuko, kampasi, ujumbe, au shirika la umma kwa ubongo mmoja tulivu. Mwl. Mwikila anasimamia mikataba, kodi, wafanyakazi wa matengenezo, hazina, utii, na muhtasari wa asubuhi kwa idhini yako — kwa lugha mbili, kiwango cha ukaguzi, kila hatua imesainiwa.'
              : 'BossNyumba is the only operating system built to run a single landlord, a portfolio, a fund, a campus, a mission, or a parastatal on the same calm brain. Mr. Mwikila handles leases, rent, maintenance staff, treasury, compliance, and the morning brief on your authority — bilingual, audit-grade, every action signed.'}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_8px_24px_-4px_hsl(24_72%_50%/0.45),0_2px_6px_hsl(14_62%_30%/0.2)] transition-all hover:scale-[1.03] hover:shadow-[0_12px_32px_-4px_hsl(24_72%_50%/0.55),0_4px_10px_hsl(14_62%_30%/0.25)] active:scale-[0.97]"
            >
              {t.ctaPilot}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3.5 text-base font-semibold text-foreground transition-all hover:bg-card hover:border-primary/40"
            >
              {sw ? 'Onyesha jinsi inavyofanya kazi' : 'See it move'}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {sw ? 'Usalama wa kiwango cha biashara' : 'Enterprise-grade security'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {sw ? 'Kiswahili na Kiingereza, asili' : 'Swahili + English, native'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {sw ? 'Inafanya kazi nje ya mtandao, kwa sauti, kupitia USSD' : 'Works offline, by voice, over USSD'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-info" />
              {sw ? 'Kila hadhira, daraja la kwanza' : 'Every audience, first-class'}
            </span>
          </div>
        </div>

        {/* RIGHT — live chat inset that mirrors the platform widget EXACTLY */}
        <div className="relative flex items-center">
          <div
            className="relative w-full overflow-hidden rounded-[28px] border border-border/50 bg-background/92 shadow-[0_28px_80px_rgb(15_23_42_/_0.22)] ring-1 ring-border/30 backdrop-blur-2xl"
            style={{ minHeight: '520px' }}
          >
            {/* Gradient header */}
            <div
              className={cn(
                'flex items-center justify-between border-b border-white/10 px-4 py-3 text-primary-foreground',
                CHAT_HEADER_GRADIENT,
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20 shadow-[0_4px_12px_rgb(0_0_0_/_0.1)] backdrop-blur-sm">
                  <Logomark size={20} variant="premium" />
                </div>
                <h3 className="text-base font-semibold leading-tight tracking-[-0.01em]">
                  {chat.assistant}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-90">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {chat.languageLabel}
                </span>
                <span className="h-3 w-px bg-primary-foreground/20" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  <span className="h-1 w-1 rounded-full bg-emerald-300 animate-pulse" />
                  {chat.live}
                </span>
              </div>
            </div>

            {/* Conversation body */}
            <div className="space-y-3 px-4 py-3 min-h-[300px]">
              {choreo.map((turn, i) => (
                <ChatTurn
                  key={i}
                  role={turn.role}
                  body={turn.body}
                  timestamp={turn.timestamp}
                  show={shown[i] ?? false}
                />
              ))}
            </div>

            {/* AI compliance disclaimer */}
            <div className="absolute inset-x-0 bottom-[88px] flex items-center justify-center gap-2 bg-[hsl(36_45%_97%)] dark:bg-white/[0.03] px-4 py-2 text-center backdrop-blur-sm before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[hsl(24_72%_50%/0.4)] before:to-transparent">
              <ShieldCheck
                size={12}
                className="shrink-0 text-[hsl(24_72%_50%)] dark:text-[hsl(36_70%_64%)]"
                aria-hidden
              />
              <p className="text-[11px] font-medium leading-snug tracking-[-0.005em] text-[hsl(14_40%_30%)] dark:text-[hsl(36_20%_72%)]">
                {chat.disclaimer}
              </p>
            </div>

            {/* Composer */}
            <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur-md">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  aria-label={chat.voice}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={chat.attach}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <Link
                  href="/sign-up"
                  className="group inline-flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <span className="flex-1">{chat.ask}</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_78%_54%)_50%,hsl(14_62%_36%)_100%)] text-primary-foreground shadow-[0_8px_20px_-4px_hsl(24_72%_50%/0.45),0_2px_6px_hsl(14_62%_30%/0.2)] transition-all hover:scale-[1.04] hover:shadow-[0_10px_24px_-4px_hsl(24_72%_50%/0.55),0_3px_8px_hsl(14_62%_30%/0.25)] active:scale-[0.96]"
                  aria-label={chat.send}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {chat.languageHint} <span className="font-semibold text-signal-700">{chat.language}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{chat.micReady}</span>
              </div>
            </div>

            {/* Subtle waveform watermark */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[88px] flex justify-center pb-1 opacity-40">
              <MiniWaveform />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
