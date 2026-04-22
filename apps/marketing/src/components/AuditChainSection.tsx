import { Fingerprint, Link2, ShieldCheck } from 'lucide-react';

/**
 * AuditChainSection — the compliance + trust differentiator.
 *
 * Every agent turn, every autonomous action, every privacy-budget
 * debit writes one row to a cryptographically-chained append-only log
 * (SHA-256 prev-hash → this-hash, HMAC-signed). Regulators, auditors,
 * and insurers can verify the chain without trusting us.
 *
 * The section renders a simulated chain fragment so operators can
 * SEE what an entry looks like, followed by a three-bullet summary
 * of what the chain guarantees.
 */
export function AuditChainSection() {
  return (
    <section
      className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8"
      aria-labelledby="chain-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          07 · On the Chain
        </p>
        <h2
          id="chain-heading"
          className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl"
        >
          Every action is cryptographically on the record.
        </h2>
        <p className="mx-auto mt-5 max-w-[60ch] text-lg leading-relaxed text-neutral-500">
          BossNyumba runs an append-only audit chain with SHA-256 prev-hash
          pointers and an HMAC signature per entry. User message content is
          hashed, never stored. Regulators, auditors, and insurers can verify
          the chain without trusting us.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-widest text-signal-500">
              Chain fragment · thread th_18a · last 4 entries
            </p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
              <ShieldCheck className="h-3 w-3 text-signal-500" />
              Chain verified
            </span>
          </header>
          <ol className="divide-y divide-border">
            {CHAIN_FRAGMENT.map((entry) => (
              <li key={entry.seq} className="grid grid-cols-[auto_1fr] gap-4 px-5 py-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <span className="font-mono text-[0.58rem] uppercase tracking-widest text-neutral-500">
                    #{entry.seq}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-signal-500/30 bg-signal-500/5 text-signal-500">
                    <Link2 className="h-3 w-3" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2 font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
                    <span>{entry.at}</span>
                    <span>·</span>
                    <span className="text-foreground">{entry.actor}</span>
                    <span>·</span>
                    <span className={entry.decisionClass}>{entry.decision}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {entry.action}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.62rem] text-neutral-500">
                    <span>
                      prev <span className="text-foreground">{entry.prev}</span>
                    </span>
                    <span>
                      this <span className="text-signal-500">{entry.hash}</span>
                    </span>
                    {entry.sig && (
                      <span className="inline-flex items-center gap-1">
                        <Fingerprint className="h-2.5 w-2.5 text-signal-500" />
                        sig <span className="text-foreground">{entry.sig}</span>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <footer className="border-t border-border px-5 py-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-widest text-neutral-500">
              Chain depth: 18,429 entries · last signed 00:04 UTC · regulator-exportable NDJSON bundle
            </p>
          </footer>
        </div>

        <ul className="flex flex-col gap-5">
          {GUARANTEES.map((g) => (
            <li
              key={g.title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <p className="font-mono text-[0.62rem] uppercase tracking-widest text-signal-500">
                {g.kicker}
              </p>
              <h3 className="mt-2 font-display text-lg font-medium tracking-tight">
                {g.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {g.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const CHAIN_FRAGMENT: ReadonlyArray<{
  seq: number;
  at: string;
  actor: string;
  decision: string;
  decisionClass: string;
  action: string;
  prev: string;
  hash: string;
  sig?: string;
}> = [
  {
    seq: 18426,
    at: '07:02:11',
    actor: 'user · head_of_estates',
    decision: 'proposed',
    decisionClass: 'text-signal-500',
    action: 'ci.user_message · hash sha256:7b3a…e91',
    prev: '9f…c2',
    hash: '3a…e91',
    sig: 'hmac:4f…22',
  },
  {
    seq: 18427,
    at: '07:02:12',
    actor: 'ai_system · mwikila',
    decision: 'proposed',
    decisionClass: 'text-signal-500',
    action: 'ci.plan · 3 steps',
    prev: '3a…e91',
    hash: '8c…d04',
    sig: 'hmac:1a…9b',
  },
  {
    seq: 18428,
    at: '07:02:14',
    actor: 'ai_system · mwikila',
    decision: 'executed',
    decisionClass: 'text-success',
    action: 'ci.tool_call.graph_lookup_node · unit_3b · arrears=12d',
    prev: '8c…d04',
    hash: 'b1…7ae',
    sig: 'hmac:5d…c1',
  },
  {
    seq: 18429,
    at: '07:02:15',
    actor: 'ai_system · mwikila',
    decision: 'executed',
    decisionClass: 'text-success',
    action: 'ci.turn_done · 3842ms · 2 citations · 0 artifacts',
    prev: 'b1…7ae',
    hash: '2e…440',
    sig: 'hmac:9e…88',
  },
];

const GUARANTEES: ReadonlyArray<{
  kicker: string;
  title: string;
  body: string;
}> = [
  {
    kicker: 'Provable, not promised',
    title: 'SHA-256 hash chain · HMAC per entry',
    body: 'Every row carries a prev-hash pointer plus an HMAC signature. Tampering any entry invalidates every signature after it. Export the chain, verify offline.',
  },
  {
    kicker: 'Minimal disclosure',
    title: 'User content is hashed, not stored',
    body: 'A regulator can prove you asked X at time T without re-disclosing X. Raw text lives in the conversation memory (scoped + revocable); the chain carries provenance only.',
  },
  {
    kicker: 'Scope-separated',
    title: 'Tenant chain · Platform chain — never mixed',
    body: 'Per-tenant audit chains are strictly isolated. Platform-scope (HQ) queries land on a reserved platform chain. Cross-scope probes return empty, never leak existence.',
  },
];
