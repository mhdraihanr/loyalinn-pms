-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TENANTS
-- 1 tenant = 1 hotel. Users join via tenant_users.
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TENANT USERS
-- Junction table: 1 user can only belong to 1 tenant (UNIQUE user_id).
-- Roles: owner (creates tenant, manages members) | staff (invited by owner)
-- ============================================================
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PMS CONFIGURATIONS
-- ============================================================
CREATE TABLE pms_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL CHECK (pms_type IN ('cloudbeds', 'mews', 'custom')),
  endpoint TEXT NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted credentials
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- WAHA CONFIGURATIONS
-- ============================================================
CREATE TABLE waha_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_connected BOOLEAN DEFAULT false,
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- GUESTS
-- ============================================================
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pms_guest_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  tier TEXT DEFAULT 'standard',
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, pms_guest_id)
);

-- ============================================================
-- RESERVATIONS
-- ============================================================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  pms_reservation_id TEXT,
  room_number TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pre-arrival', 'on-stay', 'checked-out', 'cancelled')),
  amount DECIMAL(10, 2),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, pms_reservation_id)
);

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('pre-arrival', 'on-stay', 'post-stay')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGE LOGS
-- ============================================================
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INBOUND EVENTS (dedupe / idempotency)
-- ============================================================
CREATE TABLE inbound_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, event_id)
);

-- ============================================================
-- AUTOMATION JOBS (queue state)
-- ============================================================
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead-letter')),
  payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waha_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_jobs ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's tenant_id
-- SECURITY DEFINER bypasses RLS on tenant_users preventing infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: check if current user is owner of the given tenant
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

-- TENANTS: any member can view, only owner can update/delete
CREATE POLICY "Members can view their tenant" ON tenants
  FOR SELECT USING (id = public.get_user_tenant_id());

CREATE POLICY "Owners can update their tenant" ON tenants
  FOR UPDATE USING (public.is_tenant_owner(id));

-- TENANT_USERS: members can view, only owner can insert/update/delete
CREATE POLICY "Members can view tenant members" ON tenant_users
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage tenant members" ON tenant_users
  FOR INSERT WITH CHECK (public.is_tenant_owner(tenant_id));

CREATE POLICY "Owners can update tenant members" ON tenant_users
  FOR UPDATE USING (public.is_tenant_owner(tenant_id));

CREATE POLICY "Owners can delete tenant members" ON tenant_users
  FOR DELETE USING (public.is_tenant_owner(tenant_id));

-- Allow new owner to insert themselves (during onboarding)
CREATE POLICY "Users can join as owner during onboarding" ON tenant_users
  FOR INSERT WITH CHECK (user_id = auth.uid() AND role = 'owner');

-- PMS CONFIGURATIONS: all members can view, only owner can manage
CREATE POLICY "Members can view PMS config" ON pms_configurations
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage PMS config" ON pms_configurations
  FOR ALL USING (public.is_tenant_owner(tenant_id));

-- WAHA CONFIGURATIONS: all members can view, only owner can manage
CREATE POLICY "Members can view WAHA config" ON waha_configurations
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage WAHA config" ON waha_configurations
  FOR ALL USING (public.is_tenant_owner(tenant_id));

-- GUESTS: all members can manage
CREATE POLICY "Members can manage guests" ON guests
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- RESERVATIONS: all members can manage
CREATE POLICY "Members can manage reservations" ON reservations
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- MESSAGE TEMPLATES: all members can manage
CREATE POLICY "Members can manage templates" ON message_templates
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- MESSAGE LOGS: all members can view
CREATE POLICY "Members can view message logs" ON message_logs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- INBOUND EVENTS: service role only (webhooks)
CREATE POLICY "Service role manages inbound events" ON inbound_events
  FOR ALL USING (true);

-- AUTOMATION JOBS: service role only
CREATE POLICY "Service role manages automation jobs" ON automation_jobs
  FOR ALL USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
-- idx_tenant_users_user_id is implicit from UNIQUE constraint
CREATE INDEX idx_guests_tenant_id ON guests(tenant_id);
CREATE INDEX idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_message_logs_tenant_id ON message_logs(tenant_id);
CREATE INDEX idx_inbound_events_event_id ON inbound_events(event_id);
CREATE INDEX idx_automation_jobs_status ON automation_jobs(status);
