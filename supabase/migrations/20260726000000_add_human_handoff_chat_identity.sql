ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS provider_session_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_phone_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_lid TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'automation',
  ADD COLUMN IF NOT EXISTS manual_actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE lifecycle_ai_sessions
  ADD COLUMN IF NOT EXISTS waha_session_name TEXT,
  ADD COLUMN IF NOT EXISTS waha_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS waha_phone_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS waha_lid TEXT,
  ADD COLUMN IF NOT EXISTS handoff_priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
  ADD COLUMN IF NOT EXISTS handoff_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refresh_error TEXT,
  ADD COLUMN IF NOT EXISTS last_manual_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lifecycle_ai_sessions_active_handoffs
  ON lifecycle_ai_sessions (tenant_id, session_status, needs_human_follow_up, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_handoff_transcript
  ON message_logs (tenant_id, reservation_id, trigger_type, created_at);

CREATE INDEX IF NOT EXISTS idx_message_logs_provider_chat
  ON message_logs (tenant_id, provider_session_name, provider_chat_id, created_at)
  WHERE provider_chat_id IS NOT NULL;
