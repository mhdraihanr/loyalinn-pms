# Phase 0: Foundations - Refactoring Summary

## ⚠️ Architecture Change: Multi-Tenant → Single Tenant Per User

**Date:** 2026-02-17  
**Reason:** Simplified architecture for solo hotel owners

---

## What Changed

### Database Schema

#### ✅ **Modified `tenants` table**

```sql
-- Added user_id column with UNIQUE constraint (1:1 relationship)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ❌ **Removed `tenant_users` table**

- No longer needed for single tenant per user model
- Role-based access control removed

#### ✅ **Updated RLS Policies**

```sql
-- OLD (Multi-tenant)
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  );

-- NEW (Single tenant per user)
CREATE POLICY "Users can manage their tenant" ON tenants
  FOR ALL USING (user_id = auth.uid());
```

All other table policies updated to use:

```sql
tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
```

#### ✅ **Updated Indexes**

- Removed: `idx_tenant_users_tenant_id`, `idx_tenant_users_user_id`
- Added: `idx_tenants_user_id`

---

### Application Code

#### ❌ **Removed `lib/auth/rbac.ts`**

- No RBAC needed (no roles: owner, admin, agent)
- Every user is the owner of their own tenant

#### ✅ **Simplified `lib/auth/tenant.ts`**

```typescript
// OLD
export type TenantUser = {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "agent";
};

// NEW
export type UserTenant = {
  tenantId: string;
  userId: string;
};
```

#### ✅ **Created `lib/auth/onboarding.ts`**

- Auto-create tenant when user signs up
- `createTenantForUser(userId, hotelName)`
- `userHasTenant(userId)`

---

### Documentation

#### Updated Files:

- ✅ `docs/plan.md` - Changed principles to "Single tenant per user"
- ✅ `docs/plan.md` - Updated Task 0.2 and 0.3 descriptions
- ✅ `supabase/schema.sql` - New schema with user_id
- ✅ `supabase/seed.sql` - Updated for new model
- ✅ `supabase/README.md` - Reflected architecture change

---

## Pros & Cons

### ✅ Advantages

- **Simpler schema** - No junction table
- **Simpler RLS policies** - Direct user_id lookup
- **No RBAC complexity** - No role management
- **Easier onboarding** - Auto-create tenant on signup

### ❌ Limitations

- **No team collaboration** - Cannot add staff/agents
- **No multi-property** - User can only manage one hotel
- **Not scalable** - Cannot grow to team-based operation

---

## Migration Impact

### Breaking Changes:

1. `tenant_users` table removed
2. `lib/auth/rbac.ts` removed
3. `getCurrentTenantUser()` → `getCurrentUserTenant()`
4. No more role-based permissions

### New Features:

1. Auto-tenant creation on signup
2. Simplified tenant context
3. Direct user-to-tenant relationship

---

## Verification

✅ **Production Build:** Passed  
✅ **TypeScript Compilation:** No errors  
✅ **RLS Policies:** Updated and tested  
✅ **Git Commit:** `refactor: convert from multi-tenant to single tenant per user architecture`

---

## Next Steps

1. **Update signup flow** to call `createTenantForUser()`
2. **Test onboarding** - Verify tenant auto-creation
3. **Remove role checks** from any future code
4. **Update Phase 1 plans** to reflect no team features

---

## Rollback Plan

If you need to revert to multi-tenant:

```bash
git revert HEAD
npm install
npm run build
```

Or restore from commit: `51d6032` (last multi-tenant version)
