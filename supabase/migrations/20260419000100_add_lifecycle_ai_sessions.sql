-- Migration: add lifecycle AI session tracking and inbound dedupe across lifecycle triggers

CREATE TABLE IF NOT EXISTS lifecycle_ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  lifecycle_stage TEXT NOT NULL CHECK (lifecycle_stage IN ('pre-arrival', 'on-stay', 'post-stay')),
  session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'resolved', 'handoff')),
  needs_human_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
  last_action_type TEXT,
  last_action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_message_at TIMESTAMPTZ,
  last_outbound_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reservation_id, lifecycle_stage)
);

ALTER TABLE lifecycle_ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage lifecycle AI sessions" ON lifecycle_ai_sessions;
CREATE POLICY "Members can manage lifecycle AI sessions" ON lifecycle_ai_sessions
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_lifecycle_ai_sessions_tenant_stage
  ON lifecycle_ai_sessions (tenant_id, lifecycle_stage);

CREATE INDEX IF NOT EXISTS idx_lifecycle_ai_sessions_follow_up
  ON lifecycle_ai_sessions (tenant_id, needs_human_follow_up, session_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_inbound_provider_message_per_trigger_unique
ON message_logs(tenant_id, trigger_type, provider_message_id)
WHERE direction = 'inbound'
  AND provider_message_id IS NOT NULL;
