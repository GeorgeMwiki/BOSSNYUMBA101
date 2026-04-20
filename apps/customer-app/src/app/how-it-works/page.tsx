/**
 * /how-it-works — explains the unified brain in plain language.
 * Three sections: talk anywhere, teach + act, remember + learn.
 */

import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata = {
  title: 'How it works — BOSSNYUMBA',
  description:
    'One brain across every role. Talk anywhere, and Mr. Mwikila teaches, acts, and learns.',
};

export default function HowItWorksPage() {
  return (
    <MarketingShell
      title="One brain, across every role, in every language."
      subtitle="BOSSNYUMBA is not a chat bolted onto software. The product is the AI — and Mr. Mwikila is the same brain whether you are an owner on Monday, a tenant on Wednesday, or a station master at 2am."
      heroCtaLabel="Ask him anything"
    >
      <section className="mb-16 rounded-xl border border-slate-200 bg-white p-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Step 1
        </div>
        <h2 className="mb-3 text-2xl font-semibold text-slate-900">Talk to Mr. Mwikila anywhere</h2>
        <p className="mb-2 text-slate-700">
          There is a single chat available on every page of the platform — the web app, the mobile
          app, WhatsApp, and even voice notes from a station master at the gate. Whatever role you
          are in, Mr. Mwikila adapts his language. An owner hears "IRR" and "cap rate"; a station
          master hears "incident log" and "gate watch". Same brain, different lens.
        </p>
        <p className="text-sm text-slate-500">
          Under the hood, the conversation always knows the page context — arrears, maintenance,
          renewal, dashboard — so the responses fit the moment.
        </p>
      </section>

      <section className="mb-16 rounded-xl border border-slate-200 bg-white p-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Step 2
        </div>
        <h2 className="mb-3 text-2xl font-semibold text-slate-900">He teaches, then he acts</h2>
        <p className="mb-2 text-slate-700">
          Most AI assistants answer questions. Mr. Mwikila does two things: he teaches you what to
          think about, and then he acts — drafts the reminder, dispatches the vendor, compiles
          the owner report. Every action is a proposal you approve; nothing is done behind your
          back. You keep the judgement, he absorbs the repetition.
        </p>
        <p className="text-sm text-slate-500">
          Every significant action is logged with its reasoning, so if something goes sideways you
          can trace exactly why.
        </p>
      </section>

      <section className="mb-16 rounded-xl border border-slate-200 bg-white p-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Step 3
        </div>
        <h2 className="mb-3 text-2xl font-semibold text-slate-900">He remembers, and he learns</h2>
        <p className="mb-2 text-slate-700">
          Tell Mr. Mwikila once that you prefer Swahili reminders for ground-floor tenants and
          English for the upper floors, and he will do it forever. Every decision you correct
          trains the next. Your estate's quirks — the one tenant who pays in three instalments
          every month, the gate that needs a quarterly service — become institutional memory.
        </p>
        <p className="text-sm text-slate-500">
          Memory is per tenant and per user role. He never shares your estate's data with another
          customer.
        </p>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="mb-3 text-2xl font-semibold text-emerald-900">
          The best way to understand is to talk to him.
        </h2>
        <p className="mb-4 text-emerald-900/80">
          Ask him anything about your portfolio, your tenants, or your day. No signup required —
          just open the chat and start.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Launch the chat
        </a>
      </section>
    </MarketingShell>
  );
}
