# Phase 0: Foundations - Implementation Plan (Single Tenant Per User)

> **Updated:** 2026-02-17  
> **Architecture:** Single Tenant Per User (1:1 relationship)  
> **Note:** This is the updated plan. Original multi-tenant plan archived for reference.

---

## Goal

Establish the foundational infrastructure for a **single tenant per user** Hotel PMS Integration & WhatsApp Automation web app with Next.js 14, Supabase, and WAHA.

**Key Principle:** Each user manages their own hotel independently (1 User = 1 Tenant).

---

## Architecture Overview

**Model:** 1 User → 1 Tenant (1:1 relationship)

- Direct `user_id` foreign key in tenants table
- No `tenant_users` junction table needed
- No RBAC system (every user owns their tenant)
- Automatic tenant creation on signup
- Simplified RLS policies with direct user_id lookup

---

## Task Breakdown

### Task 0.1: Project Bootstrap ✅

**Objective:** Initialize Next.js 14 project with required dependencies

**Files Created:**

- `package.json` - Dependencies
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration
- `.env.local.example` - Environment variables template
- `lib/env.ts` - Environment validation

**Key Dependencies:**

- `next@14.x`
- `@supabase/supabase-js`
- `@supabase/ssr`
- `tailwindcss`

---

### Task 0.2: Single Tenant Per User Schema + RLS ✅

**Objective:** Create database schema with 1:1 user-tenant relationship

**Files Created:**

- `supabase/schema.sql` - Complete schema
- `supabase/seed.sql` - Demo data (commented)
- `supabase/README.md` - Documentation

**Database Tables (9 tables):**

```sql
-- Core tenant table (1:1 with users)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Other tables:
-- pms_configurations, waha_configurations, guests, reservations,
-- message_templates, message_logs, inbound_events, automation_jobs
```

**RLS Policies:**

```sql
-- Direct user_id lookup (simple!)
CREATE POLICY "Users can manage their tenant" ON tenants
  FOR ALL USING (user_id = auth.uid());

-- Tenant-scoped tables
CREATE POLICY "Users can manage their guests" ON guests
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );
```

**Key Features:**

- Row Level Security on all tables
- Direct user_id lookup (no junction table)
- Service role for webhooks/automation
- Performance indexes

---

### Task 0.3: Auth, Middleware, Tenant Context ✅

**Objective:** Set up authentication and automatic tenant creation

**Files Created:**

- `lib/supabase/client.ts` - Client-side Supabase
- `lib/supabase/server.ts` - Server-side Supabase
- `middleware.ts` - Auth session refresh & route protection
- `lib/auth/tenant.ts` - Tenant context utilities
- `lib/auth/onboarding.ts` - Auto-create tenant

**Tenant Context (`lib/auth/tenant.ts`):**

```typescript
export type UserTenant = {
  tenantId: string;
  userId: string;
};

export async function getCurrentUserTenant(): Promise<UserTenant | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tenant) return null;

  return {
    tenantId: tenant.id,
    userId: user.id,
  };
}
```

**Onboarding (`lib/auth/onboarding.ts`):**

```typescript
export async function createTenantForUser(
  userId: string,
  hotelName: string,
): Promise<string> {
  const supabase = await createClient();

  const slug = hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      user_id: userId,
      name: hotelName,
      slug: slug,
    })
    .select("id")
    .single();

  if (error) throw error;
  return tenant.id;
}
```

**Middleware (`middleware.ts`):**

- Refresh auth session
- Protect `/dashboard` routes
- Redirect authenticated users from auth pages

---

### Task 0.4: Migration Strategy ✅

**Objective:** Document database migration workflow

**Files Created:**

- `supabase/migrations/README.md`
- `docs/migrations.md`

**Migration Naming:** `YYYYMMDDHHMMSS_description.sql`

**Workflow:**

1. Create migration file
2. Test locally
3. Document rollback
4. Apply to production

---

### Task 0.5: Observability ✅

**Objective:** Set up structured logging and operational runbook

**Files Created:**

- `lib/observability/types.ts` - Log types
- `lib/observability/logger.ts` - Structured logger
- `docs/runbook.md` - Operational procedures

**Structured Logging:**

- Log levels: debug, info, warn, error, fatal
- Context: requestId, tenantId, userId, etc.
- Error categories: validation, integration, retryable, fatal

**Runbook Includes:**

- Monitoring metrics
- Incident response playbooks
- Alert thresholds
- On-call procedures

---

## Acceptance Criteria

All criteria met ✅:

- [x] Next.js 14 project with TypeScript and Tailwind CSS
- [x] Environment variables documented and validated
- [x] Single tenant per user database schema with RLS
- [x] Supabase client and server utilities
- [x] Middleware for auth session refresh and route protection
- [x] Tenant context utilities (no RBAC)
- [x] Auto-tenant creation on signup
- [x] Migration strategy documented
- [x] Structured logging with request tracing
- [x] Operational runbook
- [x] Production build passing
- [x] All changes committed to git

---

## Key Differences from Multi-Tenant

| Aspect                 | Multi-Tenant           | Single Tenant Per User |
| ---------------------- | ---------------------- | ---------------------- |
| **Tables**             | 10 (inc. tenant_users) | 9 (no tenant_users)    |
| **User-Tenant**        | Many → 1               | 1 → 1                  |
| **RBAC**               | ✅ Yes (3 roles)       | ❌ No                  |
| **RLS Complexity**     | High (junction)        | Low (direct)           |
| **Team Collaboration** | ✅ Yes                 | ❌ No                  |
| **Onboarding**         | Manual                 | Auto-create            |

---

## Signup Flow Integration

**When user signs up:**

```typescript
// 1. User signs up via Supabase Auth
const {
  data: { user },
} = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password",
});

// 2. Auto-create tenant
await createTenantForUser(user.id, "My Hotel Name");

// 3. Redirect to dashboard
router.push("/dashboard");
```

---

## Next Steps

1. **Set up Supabase:**
   - Create project at supabase.com
   - Run `supabase/schema.sql`
   - Copy credentials to `.env.local`

2. **Implement Signup:**
   - Create signup page with hotel name field
   - Call `createTenantForUser()` after signup
   - Handle errors gracefully

3. **Test RLS:**
   - Create multiple test users
   - Verify data isolation
   - Test cross-user access attempts

4. **Proceed to Phase 1:**
   - Build UI components
   - Create dashboard
   - Implement guest management

---

## Important Notes

### ⚠️ Limitations

- **No team collaboration** - Cannot add staff/agents
- **No multi-property** - One hotel per user
- **Not scalable for teams** - Solo owner only

### 💡 Migration to Multi-Tenant

If you later need team features, see:

- `docs/architecture-analysis-single-tenant.md` - Migration guide
- Commit `51d6032` - Last multi-tenant version

---

**Status:** ✅ Completed  
**Build:** ✅ Passing  
**Architecture:** Single Tenant Per User
