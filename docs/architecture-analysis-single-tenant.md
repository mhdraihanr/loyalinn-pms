# Architecture Analysis: Final Model

> **Decision date:** 2026-02-18
> **Status:** ✅ Implemented

---

## Final Architecture: 1 Tenant → Many Users, 1 User → max 1 Tenant

```
Tenant (Hotel A)
├── User 1 (owner)   ← creates tenant on registration
├── User 2 (staff)   ← invited by owner via email
└── User 3 (staff)   ← invited by owner via email

Tenant (Hotel B)
├── User 4 (owner)
└── User 5 (staff)
```

**Key constraint:** `tenant_users.user_id UNIQUE` — a user can only belong to one tenant. Enforced at the database level.

---

## Architecture Comparison

| Aspect             | Multi-Tenant (original) | Single/User (v1) | **Final Model**     |
| ------------------ | ----------------------- | ---------------- | ------------------- |
| Tenant → Users     | Many                    | 1                | **Many**            |
| User → Tenants     | Many                    | 1                | **1 (max)**         |
| Roles              | owner, admin, agent     | none             | **owner, staff**    |
| Team collaboration | ✅ Yes                  | ❌ No            | **✅ Yes**          |
| User in 2 tenants  | ✅ Allowed              | N/A              | **❌ Blocked**      |
| Invite flow        | ❌ No                   | ❌ No            | **✅ Email invite** |
| Schema complexity  | High                    | Low              | **Medium**          |

---

## Database Schema

### `tenants` table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `tenant_users` table (key constraint)

```sql
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- UNIQUE on user_id = 1 user can only be in 1 tenant
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Application Code

### `lib/auth/tenant.ts`

- `getCurrentUserTenant()` — returns `{ tenantId, userId, role }`
- `requireUserTenant()` — throws if no tenant
- `requireOwner()` — throws if not owner

### `lib/auth/onboarding.ts`

- `createTenantAsOwner(userId, hotelName)` — creates tenant + assigns owner (with duplicate guard)
- `userHasTenant(userId)` — check before registration

### `lib/auth/invitations.ts`

- `inviteStaffMember(ownerUserId, email)` — sends magic-link via Supabase Admin API
- `acceptStaffInvitation(userId)` — creates `tenant_users` record from metadata

### `lib/supabase/admin.ts`

- `createAdminClient()` — service role client, bypasses RLS

---

## Why This Model

| Requirement                    | Solution                                  |
| ------------------------------ | ----------------------------------------- |
| Team can manage hotel together | `tenant_users` with many users per tenant |
| User cannot manage 2 hotels    | `UNIQUE(user_id)` on `tenant_users`       |
| Owner controls who joins       | Email invite via Supabase Auth Admin API  |
| Staff has limited access       | Role-based RLS policies                   |
| Simple onboarding              | Owner creates tenant on registration      |

---

## RLS Policy Summary

```sql
-- Members can view their tenant
CREATE POLICY "Members can view their tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

-- Only owners can update tenant
CREATE POLICY "Owners can update their tenant" ON tenants
  FOR UPDATE USING (
    id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- All members can manage guests
CREATE POLICY "Members can manage guests" ON guests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );
```
