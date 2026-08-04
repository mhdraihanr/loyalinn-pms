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
-- INVITATIONS (Staff invite flow)
-- ============================================================
CREATE TABLE invitations (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_email TEXT        NOT NULL,
  invited_by    UUID        NOT NULL REFERENCES auth.users(id),
  token         UUID        NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by   UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PMS CONFIGURATIONS
-- ============================================================
CREATE TABLE pms_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL CHECK (pms_type IN ('cloudbeds', 'mews', 'qloapps', 'custom')),
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
  post_stay_feedback_status TEXT DEFAULT 'not-sent' CHECK (post_stay_feedback_status IN ('not-sent', 'pending', 'ai_followup', 'completed', 'ignored')),
  post_stay_rating INTEGER CHECK (post_stay_rating >= 1 AND post_stay_rating <= 5),
  post_stay_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, pms_reservation_id)
);

-- ============================================================
-- ROOM SERVICE ORDERS
-- ============================================================
CREATE TABLE room_service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  items JSONB NOT NULL,
  total_amount DECIMAL(10, 2),
  currency TEXT NOT NULL DEFAULT 'IDR',
  source_catalog_item_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOUSEKEEPING REQUESTS
-- ============================================================
CREATE TABLE housekeeping_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('cleaning', 'extra_items', 'maintenance', 'other')),
  details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ARRIVAL REQUESTS
-- ============================================================
CREATE TABLE arrival_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('arrival_eta', 'early_checkin')),
  eta TEXT,
  requested_time TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE CATALOG CATEGORIES
-- ============================================================
CREATE TABLE service_catalog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('room_service', 'facility')),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, tenant_id),
  UNIQUE(tenant_id, type, name)
);

-- ============================================================
-- SERVICE CATALOG ITEMS
-- ============================================================
CREATE TABLE service_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('food', 'drink', 'facility', 'service', 'amenity')),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  currency TEXT NOT NULL DEFAULT 'IDR',
  unit TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'limited', 'by_request')),
  available_start_time TIME,
  available_end_time TIME,
  location TEXT,
  preparation_minutes INTEGER CHECK (preparation_minutes IS NULL OR preparation_minutes >= 0),
  fulfillment_type TEXT NOT NULL DEFAULT 'info_only' CHECK (fulfillment_type IN ('room_service', 'housekeeping', 'front_office', 'concierge', 'info_only')),
  guest_notes TEXT,
  staff_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, tenant_id),
  UNIQUE(tenant_id, category_id, name),
  CONSTRAINT service_catalog_items_category_tenant_fkey
    FOREIGN KEY (category_id, tenant_id)
    REFERENCES service_catalog_categories(id, tenant_id)
    ON DELETE RESTRICT
);

-- ============================================================
-- SERVICE CATALOG ITEM ALIASES
-- ============================================================
CREATE TABLE service_catalog_item_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, item_id, alias),
  CONSTRAINT service_catalog_item_aliases_item_tenant_fkey
    FOREIGN KEY (item_id, tenant_id)
    REFERENCES service_catalog_items(id, tenant_id)
    ON DELETE CASCADE
);

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('pre-arrival', 'on-stay', 'post-stay', 'post-stay-ai-followup')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, trigger)
);

-- ============================================================
-- MESSAGE TEMPLATE VARIANTS
-- ============================================================
CREATE TABLE message_template_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, language_code)
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
  trigger_type TEXT,
  template_language_code TEXT,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying', 'received')),
  error_message TEXT,
  automation_job_id UUID,
  provider_message_id TEXT,
  provider_response JSONB,
  provider_session_name TEXT,
  provider_chat_id TEXT,
  provider_phone_chat_id TEXT,
  provider_lid TEXT,
  source TEXT NOT NULL DEFAULT 'automation',
  manual_actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI SETTINGS
-- ============================================================
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hotel_name TEXT,
  ai_name TEXT,
  tone_of_voice TEXT,
  custom_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- LIFECYCLE AI SESSIONS
-- ============================================================
CREATE TABLE lifecycle_ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  lifecycle_stage TEXT NOT NULL CHECK (lifecycle_stage IN ('pre-arrival', 'on-stay', 'post-stay')),
  session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'resolved', 'handoff')),
  needs_human_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
  clarification_count INTEGER NOT NULL DEFAULT 0 CHECK (clarification_count >= 0),
  waha_session_name TEXT,
  waha_chat_id TEXT,
  waha_phone_chat_id TEXT,
  waha_lid TEXT,
  handoff_priority TEXT NOT NULL DEFAULT 'normal',
  handoff_reason TEXT,
  handoff_version BIGINT NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  last_refresh_error TEXT,
  last_manual_reply_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_action_type TEXT,
  last_action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_message_at TIMESTAMPTZ,
  last_outbound_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reservation_id, lifecycle_stage)
);

-- ============================================================
-- INBOUND EVENTS (dedupe / idempotency)
-- ============================================================
CREATE TABLE inbound_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'qloapps',
  signature_valid BOOLEAN,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, event_id),
  UNIQUE(tenant_id, idempotency_key)
);

-- ============================================================
-- AUTOMATION JOBS (queue state)
-- ============================================================
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead-letter')),
  payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error_category TEXT,
  message_log_id UUID REFERENCES message_logs(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_logs
  ADD CONSTRAINT message_logs_automation_job_id_fkey
  FOREIGN KEY (automation_job_id) REFERENCES automation_jobs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.claim_automation_jobs(
  p_batch_size INTEGER,
  p_worker_id TEXT
)
RETURNS SETOF automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_jobs AS (
    SELECT id
    FROM automation_jobs
    WHERE status = 'pending'
      AND available_at <= NOW()
    ORDER BY available_at ASC, created_at ASC
    LIMIT GREATEST(COALESCE(p_batch_size, 0), 0)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE automation_jobs AS jobs
  SET status = 'processing',
      locked_at = NOW(),
      locked_by = p_worker_id,
      updated_at = NOW()
  FROM next_jobs
  WHERE jobs.id = next_jobs.id
  RETURNING jobs.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_post_stay_feedback_with_reward(
  p_reservation_id UUID,
  p_tenant_id UUID,
  p_rating INTEGER,
  p_comments TEXT,
  p_reward_points INTEGER DEFAULT 50
)
RETURNS TABLE(rewarded BOOLEAN, points_awarded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  reservation_row reservations%ROWTYPE;
  safe_reward_points INTEGER;
BEGIN
  safe_reward_points := GREATEST(COALESCE(p_reward_points, 0), 0);

  SELECT *
  INTO reservation_row
  FROM reservations
  WHERE id = p_reservation_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF reservation_row.id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found for tenant';
  END IF;

  UPDATE reservations
  SET post_stay_feedback_status = 'completed',
      post_stay_rating = p_rating,
      post_stay_comments = p_comments,
      updated_at = NOW()
  WHERE id = reservation_row.id
    AND tenant_id = reservation_row.tenant_id;

  IF reservation_row.post_stay_feedback_status IS DISTINCT FROM 'completed' THEN
    UPDATE guests
    SET points = COALESCE(points, 0) + safe_reward_points,
        updated_at = NOW()
    WHERE id = reservation_row.guest_id
      AND tenant_id = reservation_row.tenant_id;

    rewarded := true;
    points_awarded := safe_reward_points;
  ELSE
    rewarded := false;
    points_awarded := 0;
  END IF;

  RETURN NEXT;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waha_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrival_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_template_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifecycle_ai_sessions ENABLE ROW LEVEL SECURITY;
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

-- INVITATIONS: owners can manage their tenant's invitations
CREATE POLICY "Owners can manage invitations" ON invitations
  FOR ALL USING (public.is_tenant_owner(tenant_id));

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

-- ROOM SERVICE ORDERS: all members can manage
CREATE POLICY "Members can manage room service orders" ON room_service_orders
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- HOUSEKEEPING REQUESTS: all members can manage
CREATE POLICY "Members can manage housekeeping requests" ON housekeeping_requests
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- ARRIVAL REQUESTS: all members can manage
CREATE POLICY "Members can manage arrival requests" ON arrival_requests
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- SERVICE CATALOG: members can view, only owners can manage
CREATE POLICY "Members can view service catalog categories" ON service_catalog_categories
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage service catalog categories" ON service_catalog_categories
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

CREATE POLICY "Members can view service catalog items" ON service_catalog_items
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage service catalog items" ON service_catalog_items
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

CREATE POLICY "Members can view service catalog item aliases" ON service_catalog_item_aliases
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage service catalog item aliases" ON service_catalog_item_aliases
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

-- MESSAGE TEMPLATES: all members can manage
CREATE POLICY "Members can manage templates" ON message_templates
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- MESSAGE TEMPLATE VARIANTS: all members can manage
CREATE POLICY "Members can manage template variants" ON message_template_variants
  FOR ALL USING (
    template_id IN (
      SELECT id FROM message_templates WHERE tenant_id = public.get_user_tenant_id()
    )
  );

-- MESSAGE LOGS: all members can view
CREATE POLICY "Members can view message logs" ON message_logs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- AI SETTINGS: members can view, only owner can manage
CREATE POLICY "Members can view AI settings" ON ai_settings
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage AI settings" ON ai_settings
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

-- LIFECYCLE AI SESSIONS: all members can manage
CREATE POLICY "Members can manage lifecycle AI sessions" ON lifecycle_ai_sessions
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

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
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX idx_guests_tenant_id ON guests(tenant_id);
CREATE INDEX idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_room_service_tenant_id ON room_service_orders(tenant_id);
CREATE INDEX idx_room_service_status ON room_service_orders(status);
CREATE INDEX idx_housekeeping_tenant_id ON housekeeping_requests(tenant_id);
CREATE INDEX idx_housekeeping_status ON housekeeping_requests(status);
CREATE INDEX idx_arrival_requests_tenant_id ON arrival_requests(tenant_id);
CREATE INDEX idx_arrival_requests_status ON arrival_requests(status);
CREATE INDEX idx_arrival_requests_reservation_id ON arrival_requests(reservation_id);
CREATE INDEX idx_service_catalog_categories_tenant_type ON service_catalog_categories(tenant_id, type, is_active, sort_order);
CREATE INDEX idx_service_catalog_items_tenant_type ON service_catalog_items(tenant_id, item_type, is_active, availability_status, sort_order);
CREATE INDEX idx_service_catalog_items_category ON service_catalog_items(category_id);
CREATE INDEX idx_service_catalog_item_aliases_tenant_item ON service_catalog_item_aliases(tenant_id, item_id);
CREATE UNIQUE INDEX idx_service_catalog_item_aliases_lower_unique ON service_catalog_item_aliases(tenant_id, item_id, lower(alias));
CREATE INDEX idx_message_template_variants_template_id ON message_template_variants(template_id);
CREATE INDEX idx_message_logs_tenant_id ON message_logs(tenant_id);
CREATE INDEX idx_message_logs_trigger_type ON message_logs(trigger_type);
CREATE INDEX idx_message_logs_automation_job_id ON message_logs(automation_job_id);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE UNIQUE INDEX idx_message_logs_inbound_post_stay_provider_message_unique ON message_logs(tenant_id, provider_message_id) WHERE direction = 'inbound' AND trigger_type = 'post-stay' AND provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX idx_message_logs_inbound_provider_message_per_trigger_unique ON message_logs(tenant_id, trigger_type, provider_message_id) WHERE direction = 'inbound' AND provider_message_id IS NOT NULL;
CREATE INDEX idx_lifecycle_ai_sessions_tenant_stage ON lifecycle_ai_sessions(tenant_id, lifecycle_stage);
CREATE INDEX idx_lifecycle_ai_sessions_follow_up ON lifecycle_ai_sessions(tenant_id, needs_human_follow_up, session_status);
CREATE INDEX idx_inbound_events_event_id ON inbound_events(event_id);
CREATE INDEX idx_inbound_events_tenant_idempotency_key ON inbound_events(tenant_id, idempotency_key);
CREATE INDEX idx_automation_jobs_status ON automation_jobs(status);
CREATE INDEX idx_automation_jobs_status_available_at ON automation_jobs(status, available_at);
CREATE INDEX idx_automation_jobs_tenant_status_available_at ON automation_jobs(tenant_id, status, available_at);
