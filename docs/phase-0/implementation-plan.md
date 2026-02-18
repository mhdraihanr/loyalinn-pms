# Phase 0: Foundations - Implementation Plan

> **Updated:** 2026-02-18
> **Architecture:** 1 Tenant → Many Users, 1 User → max 1 Tenant

---

## Goal

Establish the foundational infrastructure for the Hotel PMS Integration & WhatsApp Automation web app.

**Architecture model:**

```
Tenant (Hotel A)
├── User 1 (owner)   ← registers as owner, creates tenant
├── User 2 (staff)   ← invited by owner via email
└── User 3 (staff)   ← invited by owner via email
```

**Key constraint:** `tenant_users.user_id UNIQUE` — enforced at database level. 1 user can only belong to 1 tenant.

---

## Task 0.1: Project Bootstrap ✅

**Files:**

- `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- `.env.local.example` — environment variables template
- `lib/env.ts` — fail-fast env validation

**Env groups:**

- App: `NEXT_PUBLIC_APP_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- WAHA: `WAHA_BASE_URL`, `WAHA_API_KEY`
- PMS: `PMS_WEBHOOK_SECRET`

---

## Task 0.2: Multi-User Tenant Schema + RLS ✅

**Files:** `supabase/schema.sql`, `supabase/seed.sql`, `supabase/README.md`

**Tables (10 tables):**

| Table                 | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `tenants`             | Hotel entity                                                   |
| `tenant_users`        | User membership — `UNIQUE(user_id)`, roles: `owner` \| `staff` |
| `pms_configurations`  | PMS integration settings                                       |
| `waha_configurations` | WhatsApp API settings                                          |
| `guests`              | Guest profiles from PMS                                        |
| `reservations`        | Reservation data from PMS                                      |
| `message_templates`   | Customizable message templates                                 |
| `message_logs`        | Audit trail                                                    |
| `inbound_events`      | Webhook deduplication                                          |
| `automation_jobs`     | Message queue with retry                                       |

**Key schema:**

```sql
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS design:**

- Members (owner + staff): view tenant, view members, manage guests/reservations/templates
- Owner only: update tenant settings, manage members, manage PMS/WAHA config
- Service role: inbound events, automation jobs

---

## Task 0.3: Auth, Middleware, Tenant Context, Invite Flow ✅

**Files:**

| File                      | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `lib/supabase/client.ts`  | Browser Supabase client                                    |
| `lib/supabase/server.ts`  | Server Supabase client (SSR)                               |
| `lib/supabase/admin.ts`   | Admin client (service role, bypasses RLS)                  |
| `middleware.ts`           | Session refresh + route protection                         |
| `lib/auth/tenant.ts`      | Tenant context: `getCurrentUserTenant()`, `requireOwner()` |
| `lib/auth/onboarding.ts`  | `createTenantAsOwner()` — creates tenant + assigns owner   |
| `lib/auth/invitations.ts` | `inviteStaffMember()`, `acceptStaffInvitation()`           |

**Registration flow (owner):**

```typescript
// 1. User signs up
const {
  data: { user },
} = await supabase.auth.signUp({ email, password });

// 2. Create tenant + assign as owner (atomic)
await createTenantAsOwner(user.id, "My Hotel Name");

// 3. Redirect to dashboard
```

**Invite flow (staff):**

```typescript
// Owner sends invite
await inviteStaffMember(ownerUserId, "staff@hotel.com");
// → Supabase sends magic-link email with pending_tenant_id in metadata

// Staff clicks link, completes signup, then:
await acceptStaffInvitation(newUserId);
// → Creates tenant_users record with role='staff'
```

---

## Task 0.4: Migration Strategy ✅

**Files:** `supabase/migrations/README.md`, `docs/migrations.md`

Naming: `YYYYMMDDHHMMSS_description.sql`

---

## Task 0.5: Observability ✅

**Files:** `lib/observability/types.ts`, `lib/observability/logger.ts`, `docs/runbook.md`

---

## Acceptance Criteria — All Met ✅

- [x] Project bootstrapped with TypeScript + Tailwind
- [x] Env vars documented and validated
- [x] 10-table schema with RLS (owner vs staff policies)
- [x] `UNIQUE(user_id)` on `tenant_users` — 1 user max 1 tenant
- [x] Supabase client, server, and admin utilities
- [x] Middleware for session refresh + route protection
- [x] Owner can create tenant on registration
- [x] Owner can invite staff via email
- [x] Staff cannot create tenants or invite others
- [x] Migration strategy documented
- [x] Structured logging + operational runbook
- [x] Production build passing

---

## Architecture Comparison

| Aspect             | Old (1:1)         | **Current**            |
| ------------------ | ----------------- | ---------------------- |
| User → Tenant      | 1 user = 1 tenant | 1 user = max 1 tenant  |
| Tenant → Users     | 1 tenant = 1 user | 1 tenant = many users  |
| Team collaboration | ❌ No             | ✅ Yes (owner + staff) |
| RBAC               | ❌ No             | ✅ owner \| staff      |
| Invite flow        | ❌ No             | ✅ Email invite        |
| Tables             | 9                 | 10 (inc. tenant_users) |

---

## Next Steps: Phase 1

1. Set up Supabase project → run `supabase/schema.sql`
2. Build signup page with hotel name field (owner flow)
3. Build invite page for owners to invite staff
4. Build accept-invite callback route
5. Proceed to Phase 1 UI components
