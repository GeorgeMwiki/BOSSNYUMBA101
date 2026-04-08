# Tax Rates Reference — BOSSNYUMBA tax-compliance

This document captures the **rates hard-coded** in `src/engine/tax-calculator.ts`
and the authoritative sources they came from. Update this file any time a rate
changes and bump the constant in the same commit.

> These rates are engineering defaults. They are **not** legal or tax advice.
> Always confirm with a licensed tax advisor before a production cut-over.

---

## Tanzania Revenue Authority (TRA)

### VAT

| Supply                               | Rate | Source                                              |
| ------------------------------------ | ---- | --------------------------------------------------- |
| Standard rate (commercial rent etc.) | 18%  | VAT Act 2014, s. 5; TRA VAT FAQ, current as of 2026 |
| Residential rent                     | 0%   | VAT Act 2014, Schedule (exempt supplies)            |

Implemented as `TZ_VAT_STANDARD_RATE = 0.18` and `calculateVAT` defaults to 0%
when `isCommercial === false`.

### Withholding Tax on Rent (Income Tax Act, Cap. 332)

| Landlord type          | Rate | Source                            |
| ---------------------- | ---- | --------------------------------- |
| Resident individual    | 10%  | ITA Cap. 332, s. 82; First Sched. |
| Non-resident           | 15%  | ITA Cap. 332, s. 82; First Sched. |

Implemented as `WHT_RENT_RESIDENT_RATE = 0.10` and
`WHT_RENT_NON_RESIDENT_RATE = 0.15`.

### Withholding Tax on Services

| Provider type       | Rate | Source                    |
| ------------------- | ---- | ------------------------- |
| Resident            | 5%   | ITA Cap. 332, First Sched |
| Non-resident        | 15%  | ITA Cap. 332, First Sched |

---

## Monthly Rental Income (MRI) — DISPUTED

The effective rate is **under reconciliation**. Two prior internal analyses
produced different answers:

1. **10%** — legacy rate prior to the Kenya Finance Act 2023.
   - Reference: Kenya Income Tax Act, Section 6A (original enactment).
2. **7.5%** — rate effective **1 January 2024** following the Finance Act 2023
   amendments to Section 6A.
   - Reference: Kenya Revenue Authority public notice on Monthly Rental
     Income Tax, January 2024.
   - Reference: Finance Act 2023 (Kenya), assented 26 June 2023, commencement
     of MRI rate change 1 Jan 2024.

### Decision (engineering default)

We default to **7.5%** (`MRI_DEFAULT_RATE = 0.075`) because:

- It is the most recent published KRA rate we have a citation for.
- Under-withholding is worse for the landlord than over-withholding is for the
  tenant, but we still prefer accuracy to fiscal conservatism.

### Escape hatch

Operators can override the default without a redeploy by setting the env var
`MRI_RATE_OVERRIDE` to a decimal in `[0, 1]`:

```
MRI_RATE_OVERRIDE=0.10   # revert to legacy 10%
MRI_RATE_OVERRIDE=0.075  # explicit current default
```

Invalid values (non-numeric, negative, >1) are silently ignored and the
default is used. See `getMriRate()` in `tax-calculator.ts`.

### Action items (TODO)

- [ ] Get written confirmation from tax advisor on the current MRI rate.
- [ ] If 7.5% is confirmed, remove this dispute section.
- [ ] If 10% is confirmed, change `MRI_DEFAULT_RATE` and the test fixtures.
- [ ] Track any Finance Act 2025 / 2026 amendments that touch Section 6A.

---

## Scope note

This package does **not** cover:

- KRA eTIMS (Electronic Tax Invoice Management System)
- KRA eRITS (Electronic Rental Income Tax System)

Those integrations live in a separate service owned by another team.
Do not add `src/kra-etims/` or `src/kra-erits/` here.
