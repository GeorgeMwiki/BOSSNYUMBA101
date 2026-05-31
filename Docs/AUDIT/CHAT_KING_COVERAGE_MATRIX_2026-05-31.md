# Chat-King Coverage Matrix (2026-05-31)

**Bar:** "everything can happen via home chat, user never has to leave
across all surfaces." — user mandate.

This matrix answers, for each app × action-category, whether a Mr. Mwikila
brain tool can produce the same persistent effect as a click / tap, with
no mock data and a real DB / service call.

Pairs with Borjie's
`Docs/AUDIT/CHAT_ACTION_COVERAGE_2026-05-29.md` for the cross-repo view.

## Methodology

1. Walked the 7 BN apps with
   `grep -rE 'onClick=|onSubmit=|onPress=' apps/**/*.tsx`
   filtered for mutation-flavoured verbs (lock / sign / dispatch /
   approve / reject / escalate / pin / export / share / send / create /
   delete / submit / publish / save / commit / cancel / undo / verify /
   invite / revoke / grant / set / toggle / flag / trigger / update /
   change / pay / book / schedule / terminate / assign / mark /
   complete / start / stop / withdraw / nominate).
2. Bucketed each into UI-only (open modal, toggle, paginate, navigate)
   vs **state-mutating**. Only state-mutating actions need chat parity.
3. Enumerated the brain-tool catalog with
   `grep -hE "^  id: '" services/api-gateway/src/composition/brain-tools/*.ts`
   (161 tools as of 2026-05-31, post chat-king wave).
4. Mapped each mutation action → tool. Missing tools triaged per app.

## 1. Per-app totals

| Surface | Raw bindings | Mutation actions | Chat-tool present | Chat-tool missing | Coverage |
|---------|--------------|-------------------|--------------------|--------------------|----------|
| owner-portal | 175 | 70 | 64 | 6 | 91.4% |
| admin-platform-portal | 33 | 24 | 18 | 6 | 75.0% |
| tenant-mobile | 61 | 28 | 26 | 2 | 92.9% |
| staff-mobile | 80 | 35 | 33 | 2 | 94.3% |
| customer-app | 94 | 32 | 28 | 4 | 87.5% |
| estate-manager-app | 64 | 30 | 25 | 5 | 83.3% |
| marketing | 38 | 14 | 14 | 0 | 100.0% |
| **TOTAL** | **545** | **233** | **208** | **25** | **89.3%** |

UI-only bindings (pagination, modal toggles, tab switches,
expand / collapse, navigation, focus, filter) are excluded — they don't
mutate persistent state and don't need chat parity.

## 2. Closed in this wave (chat-king-tools.ts)

Five HIGH-stakes WRITE tools landed wrapping real existing routes
(damage-deductions, negotiations, conditional-surveys). No mock data,
no fallback stubs.

| Tool id | Persona | Stakes | Route |
|---------|---------|--------|-------|
| `owner.damage_deduction.settle` | owner | HIGH | `POST /damage-deductions/:id/settle` |
| `owner.damage_deduction.respond` | owner | HIGH | `POST /damage-deductions/:id/respond` |
| `owner.negotiation.accept` | owner | HIGH | `POST /negotiations/:id/accept` |
| `owner.negotiation.reject` | owner | HIGH | `POST /negotiations/:id/reject` |
| `owner.conditional_survey.approve_plan` | owner | HIGH | `POST /conditional-surveys/:id/plans/:planId/approve` |

Catalog grew from 156 → **161 brain tools**. Owner-portal coverage
lifted from 85.7% (60/70) to 91.4% (64/70) — the gap closure focused
on the highest-value approval flows the owner uses daily.

## 3. Remaining 25 gaps — honest deferrals

Triaged into "deferrable to sibling wave" vs "backend gap, not just
chat gap" vs "intentionally manual" categories.

### 3.1 Owner-portal (6 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 1 | `owner.plan.complete_item` (plan-tree node complete) | DEFER — sibling plan-tree wave |
| 2 | `owner.plan.reject_item` (plan-tree node reject) | DEFER — sibling plan-tree wave |
| 3 | `owner.work_order.approve` (modal approve) | BACKEND-GAP — PATCH-only verb on `/work-orders/:id`; loopback client supports GET/POST only |
| 4 | `owner.work_order.reject` (modal reject) | Same as #3 |
| 5 | `owner.skill.create` | DEFER — sibling skills-marketplace wave |
| 6 | `owner.blackboard.export_pdf` | DUPLICATE — `owner.export_pdf` already exists; UI rename pending |

### 3.2 Admin-platform-portal (6 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 7 | `admin.advisor.submit` (6 advisor variants) | DEFER — sibling advisor wave; one tool can cover all six |
| 8 | `admin.warehouse.create` | DEFER — sibling warehouse wave |
| 9 | `admin.feature_flag.toggle` | DEFER — Borjie has `admin.feature-flags.set`; port pending |
| 10 | `admin.data_privacy.submit` | DEFER — sibling DSAR wave |
| 11 | `admin.integration.revoke` | DEFER — sibling integrations wave |
| 12 | `admin.legacy_migration.commit` | INTENTIONALLY MANUAL — destructive, requires four-eye |

### 3.3 tenant-mobile (2 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 13 | `tenant.guest.revoke_pass` | DEFER — sibling guest-pass wave |
| 14 | `tenant.payment.refund_request` | DEFER — sibling payments wave |

### 3.4 staff-mobile (2 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 15 | `staff.handoff.acknowledge` | DEFER — sibling handoff wave |
| 16 | `staff.tools.checkout_log` | DEFER — sibling tool-tracking wave |

### 3.5 customer-app (4 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 17 | `customer.assistant.thumbs_up` | LOW PRIORITY — telemetry only |
| 18 | `customer.assistant.thumbs_down` | LOW PRIORITY — telemetry only |
| 19 | `customer.marketplace.save_search` | DEFER — sibling marketplace wave |
| 20 | `customer.announcements.dismiss` | DEFER — sibling notification-state wave |

### 3.6 estate-manager-app (5 remaining)

| # | Missing tool | Disposition |
|---|--------------|-------------|
| 21 | `manager.tender.create_response` | DEFER — sibling tender wave |
| 22 | `manager.parcel.scan_in` | DEFER — barcode scanner is hardware-bound |
| 23 | `manager.calendar.book_slot` | DEFER — sibling calendar wave |
| 24 | `manager.work_order.assign_to_self` | DEFER — `manager.task.assign_staff` close substitute |
| 25 | `manager.customer.add_note` | DEFER — sibling CRM wave |

## 4. Audit boundary — what was NOT counted

- Pure presentation actions (paginate, expand, filter, scroll, toggle
  modal, switch tab, lang switch, theme switch, focus, navigate).
- Auth actions (sign-out — these go through Supabase, not chat).
- Refresh / refetch buttons (server-state hygiene, not new mutations).
- Form-internal input changes (`onChange` for typing).

Including these would inflate the denominator without adding mutation
surface; the 545 → 233 filter is the right baseline.

## 5. Final tally

```
BN apps:       208 / 233 = 89.3% chat-reachable
Closed this wave: +5 tools (156 → 161 catalog)
Deferred:        20 tools to identified sibling waves
                  4 LOW-priority / intentionally manual
                  1 backend-gap (PATCH verb)
```

## 6. Verification

Re-run with:

```bash
# count mutation-flavour actions per app
for app in owner-portal admin-platform-portal tenant-mobile staff-mobile customer-app estate-manager-app marketing; do
  count=$(grep -rEn 'onClick|onPress|onSubmit' apps/$app \
    --include='*.tsx' --exclude-dir=node_modules --exclude-dir=__tests__ --exclude-dir=.next 2>/dev/null \
    | grep -iE 'lock|sign|dispatch|approve|reject|escalate|export|share|send|create|delete|submit|publish|save|commit|cancel|undo|verify|invite|revoke|grant|set|toggle|flag|trigger|update|change|pay|book|schedule|terminate|assign|mark|complete|start|stop|pin|reorder|withdraw|nominate' \
    | wc -l | tr -d ' ')
  echo "$app: $count"
done

# distinct brain-tool IDs
grep -hE "^  id: '" services/api-gateway/src/composition/brain-tools/*.ts | sort -u | wc -l
```

Expected output as of 2026-05-31:

```
owner-portal: 175
admin-platform-portal: 33
tenant-mobile: 61
staff-mobile: 80
customer-app: 94
estate-manager-app: 64
marketing: 38
161
```
