# Phase 0: Foundations (Updated for Single Tenant Per User)

> **⚠️ ARCHITECTURE UPDATE (2026-02-17):**  
> Refactored from multi-tenant to **single tenant per user** model.  
> See [refactoring-summary.md](./refactoring-summary.md) for complete details.

---

## Overview

Phase 0 established the foundational infrastructure for the Hotel PMS Integration & WhatsApp Automation Web App using a **single tenant per user** architecture where each user manages their own hotel independently.

**Architecture:** 1 User = 1 Tenant (1:1 relationship)

---

## What Was Accomplished

### ✅ Task 0.1: Project Bootstrap

- Next.js 14 with TypeScript, Tailwind CSS, and App Router
- Supabase dependencies (@supabase/supabase-js, @supabase/ssr)
- Environment variables template
- Environment validation utility

### ✅ Task 0.2: Single Tenant Per User Schema + RLS

**Database Tables (9 tables):**

1. **tenants** - User's hotel (1:1 with auth.users via user_id)
2. **pms_configurations** - PMS integration settings
3. **waha_configurations** - WhatsApp API settings
4. **guests** - Guest profiles synced from PMS
5. **reservations** - Reservation data
6. **message_templates** - Customizable templates
7. **message_logs** - Message audit trail
8. **inbound_events** - Webhook deduplication
9. **automation_jobs** - Message queue with retry

**Security:**

- Row Level Security (RLS) on all tables
- Direct user_id lookup from tenants table
- Users can only access their own tenant data

### ✅ Task 0.3: Auth, Middleware, Tenant Context

**Created:**

- `lib/supabase/client.ts` - Client-side Supabase
- `lib/supabase/server.ts` - Server-side Supabase
- `middleware.ts` - Auth session refresh & route protection
- `lib/auth/tenant.ts` - Tenant context utilities
- `lib/auth/onboarding.ts` - Auto-create tenant on signup

**Key Features:**

- Cookie-based SSR authentication
- Automatic tenant creation when user signs up
- No RBAC needed (every user owns their tenant)

### ✅ Task 0.4: Migration Strategy

- Migration directory structure
- Comprehensive migration guidelines
- Rollback procedures

### ✅ Task 0.5: Observability

- Structured logging with context
- Operational runbook with incident procedures

---

## Key Differences from Multi-Tenant

| Aspect                       | Multi-Tenant (Old)            | Single Tenant Per User (Current) |
| ---------------------------- | ----------------------------- | -------------------------------- |
| **User-Tenant Relationship** | Many users → 1 tenant         | 1 user → 1 tenant                |
| **Team Collaboration**       | ✅ Yes (owner, admin, agent)  | ❌ No                            |
| **Database Tables**          | 10 tables (inc. tenant_users) | 9 tables (no tenant_users)       |
| **RBAC**                     | ✅ Yes (3 roles)              | ❌ No (user is owner)            |
| **RLS Policies**             | Complex (via tenant_users)    | Simple (direct user_id)          |
| **Onboarding**               | Manual tenant assignment      | Auto-create tenant               |

---

## Git Commits

```
c22b95d docs: add refactoring summary for single tenant per user conversion
4e530ac refactor: convert from multi-tenant to single tenant per user architecture
51d6032 docs: organize Phase 0 documentation into dedicated folder
43afa45 docs: add Phase 0 implementation walkthrough
aaf9d8f fix: resolve TypeScript error in RBAC permissions type
2bb84c9 feat: add structured logging and operational runbook
8b53fed docs: add database migration strategy
ee455c6 feat: add Supabase auth, middleware, and RBAC (later removed)
0632945 feat: add multi-tenant database schema with RLS (later refactored)
4f1ae27 feat: initialize Next.js 14 project
```

---

## Project Structure

```
a-proposal2/
├── .env.local.example          # Environment variables template
├── middleware.ts               # Auth middleware
├── next.config.ts              # Next.js configuration
├── lib/
│   ├── env.ts                  # Environment validation
│   ├── auth/
│   │   ├── tenant.ts          # Tenant context utilities
│   │   └── onboarding.ts      # Auto-create tenant on signup
│   ├── observability/
│   │   ├── types.ts           # Logging types
│   │   └── logger.ts          # Structured logger
│   └── supabase/
│       ├── client.ts          # Client-side Supabase
│       └── server.ts          # Server-side Supabase
├── supabase/
│   ├── schema.sql             # Database schema (single tenant)
│   ├── seed.sql               # Seed data (commented)
│   └── migrations/            # Migration files
└── docs/
    ├── migrations.md          # Migration strategy
    ├── runbook.md             # Operational runbook
    └── phase-0/
        ├── README.md          # This file
        ├── implementation-plan.md  # Original multi-tenant plan
        ├── walkthrough.md     # Original walkthrough
        └── refactoring-summary.md  # Refactoring details
```

---

## Acceptance Criteria - All Met ✅

- ✅ Next.js 14 project with TypeScript and Tailwind CSS
- ✅ Environment variables documented and validated
- ✅ Single tenant per user database schema with RLS
- ✅ Supabase client and server utilities
- ✅ Middleware for auth session refresh and route protection
- ✅ Tenant context utilities (no RBAC)
- ✅ Auto-tenant creation on signup
- ✅ Migration strategy documented
- ✅ Structured logging with request tracing
- ✅ Operational runbook
- ✅ Production build passing

---

## Next Steps: Phase 1

Before proceeding to Phase 1:

1. **Set up Supabase Project:**
   - Create project at https://supabase.com
   - Run `supabase/schema.sql` in SQL Editor
   - Copy project URL and keys to `.env.local`

2. **Implement Signup Flow:**
   - Create signup page
   - Call `createTenantForUser()` after user signs up
   - Redirect to onboarding to collect hotel name

3. **Test Authentication:**
   - Verify middleware redirects work
   - Test tenant auto-creation
   - Confirm RLS policies block cross-user access

4. **Review Documentation:**
   - [migrations.md](../migrations.md) - Schema change workflow
   - [runbook.md](../runbook.md) - Operational procedures
   - [refactoring-summary.md](./refactoring-summary.md) - Architecture changes

---

## Important Notes

### ⚠️ Limitations of Single Tenant Per User

- **No team collaboration** - Cannot add staff/agents to help manage hotel
- **No multi-property** - User can only manage one hotel
- **Not scalable for teams** - Cannot grow to team-based operation

### 💡 When to Consider Multi-Tenant

If you need:

- Multiple users managing the same hotel
- Role-based permissions (owner, admin, agent)
- User managing multiple properties
- Team collaboration features

→ See [architecture-analysis-single-tenant.md](../architecture-analysis-single-tenant.md) for migration path back to multi-tenant.

---

**Status:** ✅ **COMPLETED**  
**Production Build:** ✅ Passing  
**TypeScript:** ✅ No errors  
**Architecture:** Single Tenant Per User
