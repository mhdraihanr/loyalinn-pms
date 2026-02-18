# Phase 0: Foundations - Walkthrough

> **Updated:** 2026-02-18
> **Architecture:** 1 Tenant → Many Users, 1 User → max 1 Tenant

## Overview

Phase 0 established the foundational infrastructure for the Hotel PMS Integration & WhatsApp Automation Web App.

**Model:**

```
Tenant (Hotel A)
├── User 1 (owner)   ← registers, creates tenant
├── User 2 (staff)   ← invited by owner via email
└── User 3 (staff)   ← invited by owner via email
```

**Key constraint:** `tenant_users.user_id UNIQUE` — 1 user can only belong to 1 tenant (database-enforced).

---

## Task 0.1: Project Bootstrap ✅

- Next.js 14 + TypeScript + Tailwind CSS + App Router
- Supabase dependencies (`@supabase/supabase-js`, `@supabase/ssr`)
- `.env.local.example` — all required env vars documented
- `lib/env.ts` — fail-fast validation on startup

---

## Task 0.2: Multi-User Tenant Schema + RLS ✅

**10 tables created:**

1. **tenants** — hotel entity
2. **tenant_users** — membership with `UNIQUE(user_id)`, roles: `owner` | `staff`
3. **pms_configurations** — PMS integration settings
4. **waha_configurations** — WhatsApp API settings
5. **guests** — guest profiles from PMS
6. **reservations** — reservation data from PMS
7. **message_templates** — customizable templates
8. **message_logs** — audit trail
9. **inbound_events** — webhook deduplication
10. **automation_jobs** — message queue with retry

**RLS policy design:**

| Table               | Members (owner+staff) | Owner only             |
| ------------------- | --------------------- | ---------------------- |
| tenants             | SELECT                | UPDATE                 |
| tenant_users        | SELECT                | INSERT, UPDATE, DELETE |
| pms_configurations  | SELECT                | ALL                    |
| waha_configurations | SELECT                | ALL                    |
| guests              | ALL                   | —                      |
| reservations        | ALL                   | —                      |
| message_templates   | ALL                   | —                      |
| message_logs        | SELECT                | —                      |
| inbound_events      | service role          | —                      |
| automation_jobs     | service role          | —                      |

---

## Task 0.3: Auth, Middleware, Tenant Context, Invite Flow ✅

**Files created:**

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — SSR server client
- `lib/supabase/admin.ts` — service role client (bypasses RLS)
- `middleware.ts` — session refresh + route protection
- `lib/auth/tenant.ts` — `getCurrentUserTenant()`, `requireUserTenant()`, `requireOwner()`
- `lib/auth/onboarding.ts` — `createTenantAsOwner()` with duplicate guard
- `lib/auth/invitations.ts` — `inviteStaffMember()`, `acceptStaffInvitation()`

**Owner registration flow:**

```
Register → createTenantAsOwner(userId, hotelName) → dashboard
```

**Staff invite flow:**

```
Owner invites email → Supabase sends magic link (with pending_tenant_id in metadata)
→ Staff clicks link → acceptStaffInvitation(userId) → tenant_users record created
```

---

## Task 0.4: Migration Strategy ✅

- `supabase/migrations/README.md` — naming convention
- `docs/migrations.md` — workflow, rollback, best practices

---

## Task 0.5: Observability ✅

- `lib/observability/types.ts` — log levels, context, error categories
- `lib/observability/logger.ts` — structured logger
- `docs/runbook.md` — monitoring, incident playbooks, escalation

---

## Project Structure

```
a-proposal2/
├── middleware.ts
├── lib/
│   ├── env.ts
│   ├── auth/
│   │   ├── tenant.ts        # getCurrentUserTenant, requireOwner
│   │   ├── onboarding.ts    # createTenantAsOwner
│   │   └── invitations.ts   # inviteStaffMember, acceptStaffInvitation
│   ├── observability/
│   │   ├── types.ts
│   │   └── logger.ts
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── admin.ts         # service role client
└── supabase/
    ├── schema.sql            # 10 tables, RLS, indexes
    ├── seed.sql
    └── migrations/
```

---

## Acceptance Criteria — All Met ✅

- ✅ Next.js 14 + TypeScript + Tailwind
- ✅ Env vars documented and validated
- ✅ 10-table schema with role-based RLS
- ✅ `UNIQUE(user_id)` — 1 user max 1 tenant
- ✅ Owner can create tenant on registration
- ✅ Owner can invite staff via email
- ✅ Staff cannot create tenants or invite others
- ✅ Migration strategy documented
- ✅ Structured logging + runbook
- ✅ Production build passing

---

## Next Steps: Phase 1

1. Set up Supabase project → run `supabase/schema.sql`
2. Build signup page (owner flow with hotel name)
3. Build invite page (owner sends staff invite)
4. Build accept-invite callback route
5. Phase 1: UI components, dashboard, guest management
