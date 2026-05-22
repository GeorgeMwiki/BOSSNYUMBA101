# Model Card — Adaptive Layout Engine v1 (UI-1) — Kenya

**Model ID:** `adaptive-layout-engine-v1`
**Version:** 1.0
**Date:** 2026-05-22
**Owner:** UX team (Brain · UI surface)
**Jurisdiction:** Kenya (KE pack)
**Stakes:** Low (cosmetic — UI rearrangement only; no material decisions; **DPA s.35 not triggered**)
**Status:** Production

---

## Purpose

The Adaptive Layout Engine personalises the order, size and prominence of UI panels in the BossNyumba customer-app and estate-manager-app based on the user's recent interactions. It surfaces the most-used actions higher and hides rarely-touched panels. Goal: reduce time-to-task for high-frequency workflows (pay rent via Daraja STK, log maintenance, view receipts).

## Architecture

Hybrid: rule-based scorer + light LLM rationale layer.

1. Action-frequency rollup per user (last 30 days) computed nightly into `user_action_stats`.
2. Rule-based ranker assigns a score to each candidate panel.
3. LLM (Claude Haiku) generates a one-line rationale and validates against accessibility rules.
4. Final layout cached for the user for 24 h.

## Training data

**Rule-based primarily — no model training.** Haiku rationale layer is a frozen foundation model; no fine-tuning. Inputs are aggregate counts only (no PII passed to LLM).

## Inputs

- `user_action_stats` (counts per action category, last 30 days)
- `user_role` (tenant / property-mgr / owner)
- `accessibility_preferences` (high contrast, large text, screen reader)
- `device_class` (mobile / tablet / desktop)
- `region` (KE — controls KES-formatting default, Daraja STK CTA prominence)

## Outputs

- Ordered list of panels with scores
- One-line rationale per move
- Accessibility-valid flag

## Performance

| Metric | Target | Last measured |
|---|---|---|
| Time-to-first-meaningful-paint | < 1.5 s | TODO |
| Task-completion-time for top-3 actions | -20% vs. fixed layout | TODO |
| Accessibility WCAG 2.2 AA | 100% pass | TODO |
| Layout-override rate | < 10% | TODO |
| KE language coverage (English + Kiswahili + Sheng UI) | 100% | TODO |

## Limitations

- Cold-start: new users see default layout for first 7 days
- Mobile-first design; small desktops may see suboptimal density
- Does not consider time-of-day or seasonal patterns
- Cannot personalise content order within a panel

## Monitoring

- Daily job emits `layout_adaptation_event`
- Override-rate dashboard tracked by UX team
- Fairness slice: ensure adaptation effectiveness equal across KE regions, language preferences, income sources (cross-ref `ke/06-fairness-and-non-discrimination.md`)

## Privacy

- No PII passed to LLM rationale layer (aggregate counts only)
- DPA 2019 s.35 NOT triggered (cosmetic only — no material decision)
- DPIA-KE-004 (low-medium risk, TODO sign-off)
- Data residency: aggregate stats stay in Supabase `fra1` with EU SCC for Haiku call

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-22 | Initial release (UI-1 wave) |

> TODO: collect 30 days of KE production metrics and update Performance section.
