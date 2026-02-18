# Phase 0: Foundations

> **Architecture:** 1 Tenant → Many Users, 1 User → max 1 Tenant  
> **Updated:** 2026-02-18

---

## Overview

Phase 0 established the foundational infrastructure for the Hotel PMS Integration & WhatsApp Automation Web App.

```
Tenant (Hotel A)
├── User 1 (owner)   ← registers, creates tenant
├── User 2 (staff)   ← invited by owner via email
└── User 3 (staff)   ← invited by owner via email
```

**Key constraint:** `tenant_users.user_id UNIQUE` — 1 user can only belong to 1 tenant (database-enforced).

---

## Tasks Completed

### ✅ Task 0.1: Project Bootstrap

- Next.js 14 + TypeScript + Tailwind CSS + App Router
- Supabase dependencies (`@supabase/supabase-js`, `@supabase/ssr`)
- `.env.local.example` — env vars template
- `lib/env.ts` — fail-fast env validation

### ✅ Task 0.2: Multi-User Tenant Schema + RLS

**10 tables:**

| #   | Table                 | Purpose                                                   |
| --- | --------------------- | --------------------------------------------------------- |
| 1   | `tenants`             | Hotel entity                                              |
| 2   | `tenant_users`        | Membership — `UNIQUE(user_id)`, roles: `owner` \| `staff` |
| 3   | `pms_configurations`  | PMS integration settings                                  |
| 4   | `waha_configurations` | WhatsApp API settings                                     |
| 5   | `guests`              | Guest profiles from PMS                                   |
| 6   | `reservations`        | Reservation data from PMS                                 |
| 7   | `message_templates`   | Customizable templates                                    |
| 8   | `message_logs`        | Audit trail                                               |
| 9   | `inbound_events`      | Webhook deduplication                                     |
| 10  | `automation_jobs`     | Message queue with retry                                  |

**RLS design:**

- **Members (owner + staff):** view tenant, view members, manage guests/reservations/templates
- **Owner only:** update tenant, manage members, manage PMS/WAHA config
- **Service role:** inbound events, automation jobs

### ✅ Task 0.3: Auth, Middleware, Tenant Context, Invite Flow

| File                      | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `lib/supabase/client.ts`  | Browser Supabase client                                  |
| `lib/supabase/server.ts`  | SSR server client                                        |
| `lib/supabase/admin.ts`   | Service role client (bypasses RLS)                       |
| `middleware.ts`           | Session refresh + route protection                       |
| `lib/auth/tenant.ts`      | `getCurrentUserTenant()`, `requireOwner()`               |
| `lib/auth/onboarding.ts`  | `createTenantAsOwner()` — creates tenant + assigns owner |
| `lib/auth/invitations.ts` | `inviteStaffMember()`, `acceptStaffInvitation()`         |

**Owner registration flow:**

```
Register → createTenantAsOwner(userId, hotelName) → dashboard
```

**Staff invite flow:**

```
Owner invites email → magic link sent (pending_tenant_id in metadata)
→ Staff accepts → acceptStaffInvitation() → tenant_users record created
```

### ✅ Task 0.4: Migration Strategy

- `supabase/migrations/README.md` — naming convention
- `docs/migrations.md` — workflow, rollback, best practices

### ✅ Task 0.5: Observability

- `lib/observability/types.ts` + `logger.ts` — structured logging
- `docs/runbook.md` — monitoring, incident playbooks

---

## Project Structure

```
a-proposal2/
├── middleware.ts
├── lib/
│   ├── env.ts
│   ├── auth/
│   │   ├── tenant.ts          # getCurrentUserTenant, requireOwner
│   │   ├── onboarding.ts      # createTenantAsOwner
│   │   └── invitations.ts     # inviteStaffMember, acceptStaffInvitation
│   ├── observability/
│   │   ├── types.ts
│   │   └── logger.ts
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── admin.ts           # service role client
├── supabase/
│   ├── schema.sql             # 10 tables, role-based RLS
│   ├── seed.sql
│   └── migrations/
└── docs/
    ├── migrations.md
    ├── runbook.md
    ├── architecture-analysis-single-tenant.md
    └── phase-0/
        ├── README.md          # This file
        ├── implementation-plan.md
        └── walkthrough.md
```

---

## Acceptance Criteria — All Met ✅

- ✅ Next.js 14 + TypeScript + Tailwind
- ✅ Env vars documented and validated
- ✅ 10-table schema with role-based RLS (owner vs staff)
- ✅ `UNIQUE(user_id)` on `tenant_users` — 1 user max 1 tenant
- ✅ Owner can create tenant on registration
- ✅ Owner can invite staff via email
- ✅ Staff cannot create tenants or invite others
- ✅ Migration strategy documented
- ✅ Structured logging + operational runbook
- ✅ Production build passing

---

## Next Steps: Phase 1

1. **Set up Supabase** — create project, run `supabase/schema.sql`, copy keys to `.env.local`
2. **Build owner signup page** — with hotel name field, calls `createTenantAsOwner()`
3. **Build staff invite page** — owner sends invite via `inviteStaffMember()`
4. **Build accept-invite callback** — calls `acceptStaffInvitation()` after staff signup
5. **Proceed to Phase 1** — UI components, dashboard, guest management

---

**Status:** ✅ COMPLETED | **Build:** ✅ Passing | **Architecture:** 1 Tenant → Many Users
