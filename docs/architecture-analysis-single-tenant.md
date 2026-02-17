# Single Tenant Per User - Architecture Analysis

## Current Architecture (Multi-Tenant)

**Model:** Multiple users can belong to one tenant (hotel)

```
Tenant (Hotel A)
├── User 1 (Owner)
├── User 2 (Admin)
└── User 3 (Agent)

Tenant (Hotel B)
├── User 4 (Owner)
└── User 2 (Admin) ← Same user in multiple tenants
```

**Use Case:** SaaS platform untuk banyak hotel, setiap hotel punya tim staff

---

## Proposed Architecture (Single Tenant Per User)

**Model:** One user = One tenant (1:1 relationship)

```
User 1 → Tenant 1 (User 1's Hotel)
User 2 → Tenant 2 (User 2's Hotel)
User 3 → Tenant 3 (User 3's Hotel)
```

**Use Case:** Personal hotel management app, setiap user manage hotel mereka sendiri

---

## Required Changes

### 1. Database Schema Changes

#### ❌ **REMOVE** `tenant_users` table

**Reason:** Tidak perlu junction table karena 1 user = 1 tenant

#### ✅ **SIMPLIFY** `tenants` table

```sql
-- OLD (Multi-tenant)
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW (Single tenant per user)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Changes:**

- Add `user_id` column with UNIQUE constraint (1:1 relationship)
- Direct reference to `auth.users`
- No need for `tenant_users` table

#### ✅ **SIMPLIFY** RLS Policies

```sql
-- OLD (Multi-tenant) - Complex lookup
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- NEW (Single tenant per user) - Direct lookup
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (user_id = auth.uid());
```

**All other tables:**

```sql
-- OLD
CREATE POLICY "Users can manage guests" ON guests
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- NEW
CREATE POLICY "Users can manage guests" ON guests
  FOR ALL USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
```

---

### 2. Application Code Changes

#### ❌ **REMOVE** RBAC System

**File:** `lib/auth/rbac.ts`

**Reason:** Tidak perlu roles (owner, admin, agent) karena setiap user adalah owner dari tenant mereka sendiri

#### ✅ **SIMPLIFY** Tenant Context

**File:** `lib/auth/tenant.ts`

```typescript
// OLD (Multi-tenant)
export type TenantUser = {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "agent";
};

export async function getCurrentTenantUser(): Promise<TenantUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, user_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) return null;
  return {
    tenantId: tenantUser.tenant_id,
    userId: tenantUser.user_id,
    role: tenantUser.role,
  };
}

// NEW (Single tenant per user)
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

#### ✅ **ADD** Tenant Auto-Creation on Signup

**New File:** `lib/auth/onboarding.ts`

```typescript
export async function createTenantForNewUser(
  userId: string,
  hotelName: string,
): Promise<string> {
  const supabase = await createClient();

  const slug = hotelName.toLowerCase().replace(/\s+/g, "-");

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

**Usage in signup flow:**

```typescript
// After user signs up
const {
  data: { user },
} = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password",
});

// Automatically create tenant for user
await createTenantForNewUser(user.id, "My Hotel Name");
```

---

### 3. Migration Path

#### Option A: Fresh Start (Recommended for new projects)

1. Drop existing database
2. Apply new schema
3. Re-seed data

#### Option B: Migrate Existing Data

```sql
-- Step 1: Add user_id to tenants table
ALTER TABLE tenants ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Step 2: Migrate data (assign tenant to first owner)
UPDATE tenants t
SET user_id = (
  SELECT tu.user_id
  FROM tenant_users tu
  WHERE tu.tenant_id = t.id
    AND tu.role = 'owner'
  LIMIT 1
);

-- Step 3: Make user_id required and unique
ALTER TABLE tenants ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tenants ADD CONSTRAINT tenants_user_id_unique UNIQUE (user_id);

-- Step 4: Drop tenant_users table
DROP TABLE tenant_users CASCADE;

-- Step 5: Update RLS policies (see above)
```

---

## Pros & Cons Comparison

### Multi-Tenant (Current)

**✅ Pros:**

- Team collaboration (multiple users per hotel)
- Role-based access control
- Scalable for enterprise hotels with large teams
- User can manage multiple hotels

**❌ Cons:**

- More complex schema
- More complex RLS policies
- Requires RBAC implementation
- Harder to understand for simple use cases

### Single Tenant Per User (Proposed)

**✅ Pros:**

- Simpler schema (no junction table)
- Simpler RLS policies
- No RBAC needed
- Easier to understand
- Perfect for solo hotel owners
- Auto-tenant creation on signup

**❌ Cons:**

- ❌ **NO team collaboration** (critical limitation!)
- ❌ **Cannot share access** with staff
- ❌ **Cannot manage multiple hotels** per user
- Not scalable for growing businesses

---

## Recommendation

### ❓ **Question to Answer:**

**Apakah hotel owner akan:**

1. **Bekerja sendiri?** → Single tenant per user
2. **Punya staff/tim?** → Multi-tenant (current)
3. **Manage multiple properties?** → Multi-tenant (current)

### 🎯 **My Recommendation:**

**KEEP Multi-Tenant Architecture** karena:

1. **Flexibility:** Bisa support solo owner DAN team
2. **Scalability:** Bisa grow dari 1 user ke team
3. **Future-proof:** Tidak perlu refactor nanti
4. **Industry standard:** Hampir semua hotel management software multi-tenant

**Jika tetap ingin single tenant per user:**

- Cocok untuk **personal hobby project**
- Cocok untuk **MVP testing** dengan 1 user
- **TIDAK cocok** untuk production hotel management system

---

## Implementation Checklist (If Switching to Single Tenant)

### Database

- [ ] Add `user_id` to `tenants` table
- [ ] Add UNIQUE constraint on `user_id`
- [ ] Drop `tenant_users` table
- [ ] Update all RLS policies
- [ ] Create migration script

### Application Code

- [ ] Remove `lib/auth/rbac.ts`
- [ ] Simplify `lib/auth/tenant.ts`
- [ ] Create `lib/auth/onboarding.ts`
- [ ] Update signup flow to auto-create tenant
- [ ] Remove all role checks in code
- [ ] Update middleware (remove role resolution)

### Documentation

- [ ] Update `docs/plan.md` principles
- [ ] Update `supabase/schema.sql`
- [ ] Update `supabase/README.md`
- [ ] Update Phase 0 documentation

### Testing

- [ ] Test tenant auto-creation on signup
- [ ] Test RLS policies
- [ ] Verify no cross-user data access
- [ ] Test all CRUD operations

---

## Decision Matrix

| Feature             | Multi-Tenant | Single Tenant/User |
| ------------------- | ------------ | ------------------ |
| Team collaboration  | ✅ Yes       | ❌ No              |
| Multiple properties | ✅ Yes       | ❌ No              |
| Simple schema       | ❌ No        | ✅ Yes             |
| RBAC needed         | ✅ Yes       | ❌ No              |
| Solo owner          | ✅ Yes       | ✅ Yes             |
| Scalability         | ✅ High      | ❌ Low             |
| Complexity          | ❌ Higher    | ✅ Lower           |

**Verdict:** Multi-tenant lebih fleksibel dan scalable untuk hotel management system.
