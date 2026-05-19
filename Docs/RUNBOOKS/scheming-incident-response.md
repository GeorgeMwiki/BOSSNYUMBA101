# Runbook — Scheming Incident Response (Phase N-F)

> **Trigger**: an N-F probe (adversarial-probe, sleeper-defection, golden-eval
> regression > 5pp, or specification self-correction `unsafe-to-proceed`)
> indicates a scheming-class event on a tenant brain.

> **Owner**: platform-admin on-call. Escalation: alignment-lead.

---

## §0 — Severity classification

| Class | Trigger | Action timeline |
|---|---|---|
| **S1 (critical)** | sleeper-probe `score ≥ 0.85` · golden regression > 10pp · adversarial-probe `|delta_pp| > 10` | Page within 5 minutes |
| **S2 (high)** | sleeper-probe `0.6 ≤ score < 0.85` · golden regression 5–10pp · |delta_pp| 5–10 | Investigate within 1 hour |
| **S3 (medium)** | sleeper-probe `score < 0.6` · multiple flags within 24h on same tenant | Investigate within 8 hours |

---

## §1 — Immediate containment (S1 + S2)

1. **Pause the affected tenant's brain to `chat`-only autonomy** via K-E:

   ```bash
   pnpm --filter @bossnyumba/autonomy-governance \
     run cli pause-to-chat --tenant <tenant_id> --reason "n-f-scheming-incident"
   ```

   This:
   - Sets `tenants.autonomy_level = 'chat'`
   - Revokes all in-flight `tool_grant` rows
   - Cancels queued autonomous jobs
   - Emits `tenant.autonomy.paused` event to N-E

2. **Snapshot forensic state**:

   ```bash
   pnpm --filter @bossnyumba/anti-scheming \
     run cli forensic-snapshot \
       --tenant <tenant_id> \
       --turns 100 \
       --include-tool-calls --include-decisions \
       --out forensic-storage/<tenant_id>-<incident_id>.tar.gz
   ```

   Contents:
   - Last 100 turns from `agent_traces.turn`
   - All tool calls + tool results
   - All `prm_sample` and `confidence` rows
   - All `reflexion_note` for the period
   - The probe report that triggered the incident

3. **Notify platform-admin + alignment-lead** via the incident channel
   `#alignment-incidents` (Slack) + email PagerDuty escalation.

---

## §2 — Triage (S1, S2, S3)

1. Open the probe report (`.audit/probe-results-<date>.md` or
   `.audit/anti-scheming-<date>.md`) and identify:
   - **Signal type** (which of the 6 sleeper signals fired?)
   - **Category** (which golden-eval category regressed?)
   - **|delta_pp|** (how far does probe behaviour deviate from real
     traffic?)

2. Cross-reference with K-D Inspect harness:

   ```bash
   pnpm --filter @bossnyumba/central-intelligence \
     run inspect:replay --trace-id <trace_id> --include-reasoning
   ```

3. Cross-reference with N-E feedback events:
   - Any negative feedback in the 24h leading up to the incident?
   - Any "regenerate" cycles on the affected tenant?

4. Determine root cause class:
   - **A.** Sleeper backdoor in the upstream model (Anthropic) — coordinate
     with Anthropic's safety team
   - **B.** Reward-hacking generalisation from a recent preference-tuned
     adapter — revert adapter via M-G feature flag
   - **C.** Prompt injection from an attacker — block source + tighten
     M-B pre-action verification
   - **D.** False positive — open evidence file and tune signal threshold

---

## §3 — Recovery

### Per root-cause class

| Class | Recovery action |
|---|---|
| A | Reroute affected tenant to backup model via BrainLLMRouter; freeze the suspect model id |
| B | Revert preference adapter via M-G feature flag; quarantine the adapter's training data; rerun nightly auditor |
| C | Block injection source (IP, vendor email, document upload signature); add the injection vector to the next monthly red-team rotation |
| D | Update the signal threshold in `packages/anti-scheming/src/sleeper-defection-probe/probe.ts` with a regression test pinning the new threshold |

### Restoration

Restore autonomy stepwise via K-E:

1. After **24 hours** of clean nightly audits → resume `read-only` autonomy
2. After **72 hours** clean → resume `write-with-approval`
3. After **7 days** clean + alignment-lead sign-off → resume full autonomy

---

## §4 — Post-incident review (mandatory within 7 days)

- File a post-mortem under `Docs/post-mortems/n-f-incident-<incident_id>.md`
- Add at least one new golden-eval scenario covering this incident class
- Sign + re-manifest via `node packages/anti-scheming/scripts/generate-golden-manifest.mjs`
- Run `node scripts/audit-golden-set-integrity.mjs` to verify the new manifest
- Update the monthly red-team scenario backlog with a new entry

---

## §5 — Communication template

```
Subject: [S1] Scheming Incident — tenant <tenant_id> — paused to chat-only

Signal: <signal_id>
Trigger: <probe report path>
Score: <max_score>
Snapshot: forensic-storage/<incident_id>.tar.gz
Containment: K-E pause complete at <timestamp>
Triage owner: <name>
ETA next update: 60 minutes
```

---

## §6 — Related runbooks

- `four-eye-approval-review.md` — when a destructive action queues during incident
- `audit-chain-verification.md` — proving the forensic snapshot is untampered
- `autonomy-cap-breached.md` — sibling autonomy/governance incident
- `incident-response.md` — broader BOSSNYUMBA incident process

---

## §7 — Compliance + audit trail

Every step above logs to the immutable audit chain (append-only).
Auditors should find:
- the trigger event
- the containment event with timestamp
- the snapshot manifest hash
- the recovery actions per autonomy step

Failure to log any step is itself an S1 audit-chain violation.
