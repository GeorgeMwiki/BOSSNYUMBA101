# BOSSNYUMBA Platform Segmentation Plan

## The Problem

The current admin portal contains features that belong in the **Owner Portal** (the business platform for property owners). The admin portal should be the **Karbone Internal Admin** — a platform management tool for Karbone staff only.

---

## The 4 Apps — Corrected Roles

### 1. Customer App (NO CHANGES)
**Users:** Tenants / Residents  
**Purpose:** Self-service for people living in properties  
**Status:** Correct as-is. No changes needed.

### 2. Estate Manager App (NO CHANGES)
**Users:** Field staff / Estate managers (added by admins in the Owner Portal)  
**Purpose:** Day-to-day property operations in the field  
**Status:** Correct as-is. No changes needed.

### 3. Owner Portal (MAJOR EXPANSION)
**Users:** Property owners, Super Admins, Admins (4 tiers)  
**Purpose:** The one-stop business management platform for property owners  
**Role hierarchy:**
- **Owner** — Full access, account creator, can delete account
- **Super Admin** — Same powers as Owner, EXCEPT cannot delete the account or data outside policy
- **Admin Tier 1-4** — Decreasing access levels, set by Owner/Super Admin
- Admins can add/manage Estate Managers and Field Workers

**What moves FROM admin portal TO owner portal:**
- User & Role Management (managing staff, admins, estate managers)
- Permission Matrix (granular per-module CRUD permissions)
- Approval Matrix (workflows, escalation rules, thresholds)
- Communications (templates, campaigns, broadcasts to residents)
- Support Case Management (ticket tracking, timeline, escalation)
- Operations Monitoring (service health for their org, control tower)
- Integrations (webhooks, API keys for their org)
- Organization Configuration (general, payments, email, notifications, security, branding)
- Audit Log (for their organization's actions)
- AI Cockpit (maintenance analytics, SLA, decision audit for their properties)

### 4. Karbone Admin Portal (SLIMMED DOWN)
**Users:** Karbone internal staff only  
**Purpose:** Manage the BOSSNYUMBA SaaS platform itself  
**What stays / what it becomes:**
- Platform-wide dashboard (all orgs, all properties, global stats)
- Organization/Account management (create, suspend, delete accounts)
- Multi-tenant onboarding wizard (onboard new organizations)
- Subscription & Billing management (plans, MRR, invoicing orgs)
- Feature Flags (enable/disable features per organization)
- Platform System Health (infrastructure, services, uptime)
- Platform Analytics (cross-org metrics, growth, churn)
- Platform Audit Log (Karbone staff actions across all orgs)
- Platform Support (escalated issues from all organizations)
- Platform Configuration (global settings, payment gateways, email providers)

---

## Detailed Feature Migration Map

### Features MOVING from Admin Portal → Owner Portal

| # | Feature | Current Admin Route | New Owner Portal Route | Files to Move |
|---|---------|-------------------|----------------------|---------------|
| 1 | User Management | `/users` | `/users` | `UsersPage.tsx` |
| 2 | Roles & Permissions | `/roles` | `/roles` | `RolesPage.tsx` |
| 3 | Permission Matrix | `/roles/permissions` | `/roles/permissions` | `roles/PermissionMatrix.tsx` |
| 4 | Approval Matrix | `/roles/approvals` | `/roles/approvals` | `roles/ApprovalMatrix.tsx` |
| 5 | Communications Hub | `/communications` | `/communications` | `communications/page.tsx` |
| 6 | Comm Templates | `/communications/templates` | `/communications/templates` | `communications/templates/page.tsx` |
| 7 | Comm Campaigns | `/communications/campaigns` | `/communications/campaigns` | `communications/campaigns/page.tsx` |
| 8 | Comm Broadcasts | `/communications/broadcasts` | `/communications/broadcasts` | `communications/broadcasts/page.tsx` |
| 9 | Support Cases | `/support` | `/support` | `SupportPage.tsx` |
| 10 | Customer Timeline | `/support/timeline` | `/support/timeline` | `support/CustomerTimeline.tsx` |
| 11 | Escalation Queue | `/support/escalation` | `/support/escalation` | `support/Escalation.tsx` |
| 12 | Operations Center | `/operations` | `/operations` | `OperationsPage.tsx` |
| 13 | Control Tower | `/operations/control-tower` | `/operations/control-tower` | `operations/ControlTower.tsx` |
| 14 | AI Cockpit | `/ai` | `/ai` | `ai/AICockpit.tsx` |
| 15 | Org Configuration | `/configuration` | `/configuration` | `ConfigurationPage.tsx` |
| 16 | Org Audit Log | `/audit` | `/audit` | `AuditLogPage.tsx` |
| 17 | Integrations Hub | `/integrations` | `/integrations` | `integrations/page.tsx` |
| 18 | Webhooks | `/integrations/webhooks` | `/integrations/webhooks` | `integrations/webhooks/page.tsx` |
| 19 | API Keys | `/integrations/api-keys` | `/integrations/api-keys` | `integrations/api-keys/page.tsx` |
| 20 | Compliance Docs | `/compliance` | (merge with existing) | `compliance/page.tsx` |
| 21 | Compliance Documents | `/compliance/documents` | `/compliance/documents` | `compliance/documents/page.tsx` |
| 22 | Data Requests | `/compliance/data-requests` | `/compliance/data-requests` | `compliance/data-requests/page.tsx` |
| 23 | Reports | `/reports` | (merge with existing) | `ReportsPage.tsx` |

### Features STAYING in Karbone Admin Portal

| # | Feature | Route | Purpose |
|---|---------|-------|---------|
| 1 | Platform Dashboard | `/` | Cross-org stats, global KPIs |
| 2 | Organization List | `/tenants` | List all orgs on platform |
| 3 | Org Detail | `/tenants/:id` | View/manage specific org |
| 4 | Org Onboarding | `/tenants/onboard` | Onboard new organization |
| 5 | Platform Overview | `/platform` | Platform-wide metrics |
| 6 | Subscriptions | `/platform/subscriptions` | Manage org subscriptions |
| 7 | Platform Billing | `/platform/billing` | Invoice orgs, track MRR |
| 8 | Feature Flags | `/platform/feature-flags` | Per-org feature toggles |
| 9 | System Health | `/system` | Infrastructure monitoring |
| 10 | Platform Analytics | `/analytics` | Cross-org analytics |
| 11 | Platform Audit | `/audit` | Karbone staff actions |
| 12 | Platform Config | `/configuration` | Global platform settings |
| 13 | Platform Support | `/support` | Escalated cross-org issues |

---

## Implementation Steps

### Phase 1: Adapt Owner Portal API Layer (prerequisite)
The owner portal currently uses raw `api.get/post` with `useState/useEffect`. The migrated pages from admin portal use `@tanstack/react-query` and `@bossnyumba/api-client` services. We need to:

1. **Add React Query to owner portal** — Install `@tanstack/react-query`, add QueryClientProvider in main.tsx
2. **Add `@bossnyumba/api-client` service imports** — The migrated pages already import these

### Phase 2: Move Pages from Admin Portal → Owner Portal
For each of the 23 features listed above:

1. Copy the page file from `admin-portal/src/` to `owner-portal/src/`
2. Adapt imports: Change `from '../lib/api'` to the owner portal's api path
3. Adapt routing imports: Both use `react-router-dom`, so minimal changes
4. Adapt auth checks: Use owner portal's AuthContext role/permissions
5. Add route to owner portal's `App.tsx`
6. Add navigation item to owner portal's `Layout.tsx`

### Phase 3: Update Owner Portal Navigation
The sidebar needs to expand from 14 items to accommodate the new sections. Group into categories:

**Proposed Owner Portal Sidebar Structure:**
```
OVERVIEW
  Dashboard
  Portfolio
  Properties

OPERATIONS  
  Maintenance
  Work Orders (Control Tower)
  Inspections
  Approvals

PEOPLE
  Tenants
  Vendors
  Users & Staff
  Roles & Permissions

FINANCE
  Financial
  Budgets
  Invoices & Payments

COMMUNICATIONS
  Messages
  Announcements
  Campaigns
  Templates
  Broadcasts

ANALYTICS & REPORTS
  Analytics
  Reports
  AI Cockpit

COMPLIANCE
  Documents
  Licenses & Insurance
  Data Requests

ADMINISTRATION
  Configuration
  Integrations
  Audit Log
  Support

ACCOUNT
  Settings
```

### Phase 4: Slim Down Admin Portal
Remove the 23 migrated features from admin portal. What remains:

**Karbone Admin Sidebar:**
```
Dashboard (platform-wide)
Organizations
  - List
  - Onboard New
  - Detail
Platform
  - Overview
  - Subscriptions  
  - Billing
  - Feature Flags
System Health
Analytics (platform-wide)
Support (escalated)
Audit Log (platform)
Configuration (global)
```

### Phase 5: Role-Based Access in Owner Portal
Add permission checks to the owner portal routes:

- **Owner**: All access
- **Super Admin**: All access except account deletion
- **Admin Tier 1**: Full operational access (properties, tenants, finance, maintenance, communications, reports)
- **Admin Tier 2**: Operational access without financial (properties, tenants, maintenance, communications)
- **Admin Tier 3**: Read-only + maintenance requests
- **Admin Tier 4**: Read-only access

### Phase 6: Update Auth Context
Owner portal's AuthContext already has `role` and `permissions` fields. Add:
- Role constants: `OWNER`, `SUPER_ADMIN`, `ADMIN_1`, `ADMIN_2`, `ADMIN_3`, `ADMIN_4`
- Permission-based route guards
- Conditional sidebar items based on role

---

## File Count Estimates

| Action | Files |
|--------|-------|
| Files to copy from admin → owner | ~25 page files |
| Owner portal routing update | 1 file (App.tsx) |
| Owner portal navigation update | 1 file (Layout.tsx) |
| Owner portal query setup | 2 files (main.tsx, QueryProvider) |
| Admin portal route cleanup | 1 file (App.tsx) |
| Admin portal nav cleanup | 1 file (Layout.tsx) |
| Admin portal page renames (org context) | ~5 files |
| **Total files touched** | **~36 files** |

---

## What Does NOT Change
- Customer App — untouched
- Estate Manager App — untouched  
- Shared packages (@bossnyumba/api-client, @bossnyumba/design-system) — untouched
- API endpoints — untouched (same backend serves both portals)
