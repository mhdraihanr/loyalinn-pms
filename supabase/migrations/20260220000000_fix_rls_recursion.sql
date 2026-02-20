-- Migration: 20260220000000_fix_rls_recursion.sql
-- Fixes Infinite Recursion on tenant_users by moving role and tenant verification
-- to SECURITY DEFINER functions, which cleanly bypass RLS and avoid cyclical loops.

-- 1. Create Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND tenant_id = check_tenant_id 
      AND role = 'owner'
  );
$$;

-- 2. Drop Old Recursive Policies
DROP POLICY IF EXISTS "Members can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;

DROP POLICY IF EXISTS "Members can view tenant members" ON tenant_users;
DROP POLICY IF EXISTS "Owners can manage tenant members" ON tenant_users;
DROP POLICY IF EXISTS "Owners can update tenant members" ON tenant_users;
DROP POLICY IF EXISTS "Owners can delete tenant members" ON tenant_users;

DROP POLICY IF EXISTS "Members can view PMS config" ON pms_configurations;
DROP POLICY IF EXISTS "Owners can manage PMS config" ON pms_configurations;

DROP POLICY IF EXISTS "Members can view WAHA config" ON waha_configurations;
DROP POLICY IF EXISTS "Owners can manage WAHA config" ON waha_configurations;

DROP POLICY IF EXISTS "Members can manage guests" ON guests;
DROP POLICY IF EXISTS "Members can manage reservations" ON reservations;
DROP POLICY IF EXISTS "Members can manage templates" ON message_templates;
DROP POLICY IF EXISTS "Members can view message logs" ON message_logs;

DROP POLICY IF EXISTS "Owners can manage invitations" ON invitations;

-- 3. Create Optimized Policies

-- TENANTS
CREATE POLICY "Members can view their tenant" ON tenants
  FOR SELECT USING (id = public.get_user_tenant_id());

CREATE POLICY "Owners can update their tenant" ON tenants
  FOR UPDATE USING (public.is_tenant_owner(id));

-- TENANT_USERS (Note: "Users can join as owner during onboarding" handles new signups)
CREATE POLICY "Members can view tenant members" ON tenant_users
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage tenant members" ON tenant_users
  FOR INSERT WITH CHECK (public.is_tenant_owner(tenant_id));

CREATE POLICY "Owners can update tenant members" ON tenant_users
  FOR UPDATE USING (public.is_tenant_owner(tenant_id));

CREATE POLICY "Owners can delete tenant members" ON tenant_users
  FOR DELETE USING (public.is_tenant_owner(tenant_id));

-- PMS CONFIGURATIONS
CREATE POLICY "Members can view PMS config" ON pms_configurations
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage PMS config" ON pms_configurations
  FOR ALL USING (public.is_tenant_owner(tenant_id));

-- WAHA CONFIGURATIONS
CREATE POLICY "Members can view WAHA config" ON waha_configurations
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage WAHA config" ON waha_configurations
  FOR ALL USING (public.is_tenant_owner(tenant_id));

-- GUESTS
CREATE POLICY "Members can manage guests" ON guests
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- RESERVATIONS
CREATE POLICY "Members can manage reservations" ON reservations
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- MESSAGE TEMPLATES
CREATE POLICY "Members can manage templates" ON message_templates
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- MESSAGE LOGS
CREATE POLICY "Members can view message logs" ON message_logs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- INVITATIONS (If the table exists from the previous migration)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invitations') THEN
    CREATE POLICY "Owners can manage invitations" ON invitations
      FOR ALL USING (public.is_tenant_owner(tenant_id));
  END IF;
END $$;
