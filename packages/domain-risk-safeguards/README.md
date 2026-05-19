# @bossnyumba/domain-risk-safeguards

**Phase M-F — Domain-Risk Safeguards.** BOSSNYUMBA-specific hardening layer
addressing the four risk classes called out in `.research/l3-brain-hardening-frontier-audit.md`:

1. **Fair-housing / disparate-impact** (HUD May-2024 + EU AI Act HIGH-RISK
   + SafeRent settlement playbook).
2. **Excessive-agency on Voyager-style skill promotion** (OWASP LLM06).
3. **Klarna-pattern auto-execution failure class** on disputes / refunds /
   late-fee waivers / lease amendments / eviction decisions.
4. **Jurisdictional-creep silent-fallback class** (already-fixed bug now
   codified as a CI-enforced class).
5. **Tenant-privacy threat-model** for biometric / transcript / M-Pesa SMS /
   lease PDF channels.

Each safeguard is wire-agnostic — all I/O is delegated to ports.

## Modules

| Path | Purpose | Tests |
|------|---------|-------|
| `src/disparate-impact/` | Quarterly DI audit (4/5ths + Chi-squared + Cohen's d) on screening & lease decisions | 12 fixtures |
| `src/skill-promotion-gate/` | HARD human-in-the-loop gate for Voyager skill promotion | 8 scenarios |
| `src/klarna-pattern/` | Draft-and-route wrap for high-stakes action classes | 8 attempts |
| `src/jurisdictional-scanner/` | Static-analysis scanner for silent-jurisdiction fallback class | 10 source files |
| `src/tenant-privacy/` | Retention + egress-audit enforcement for PII channels | 5 + 5 |
| `src/quarterly-report/` | Per-tenant + platform-wide quarterly compliance report | full report |

## Cited Mitigations

- **HUD AI Guidance, May 2024** — fair-housing applies to AI-driven screening.
- **EU AI Act** (phased 2025–2026) — tenant screening = HIGH RISK class.
- **SafeRent settlement** — disparate-impact testing is now table stakes.
- **OWASP LLM06 (Excessive Agency, 2025)** — skill-library auto-promotion is excess agency.
- **Klarna case study** — auto-resolution on judgment cases destroys CSAT.
- **Sierra outcome-based posture** — success only when human confirms.
- **Tanzanian PDPA 2022 + Kenyan DPA + Nigerian NDPA + GDPR** — privacy retention.

## Integration

This package emits *verdicts* and *reports* — it does not directly mutate
state. Downstream services (chat-server, K-G in-chat tab, kernel HQ tools)
consume these verdicts through `*Port` interfaces.
