-- Migration: 20260307123000_add_phase4_automation_metadata.sql
-- Description: Adds Phase 4 metadata needed for idempotent webhook ingestion,
-- queue scheduling, delivery tracing, and retry/dead-letter handling.
--
-- Rollback (manual, if needed):
-- DROP INDEX IF EXISTS idx_automation_jobs_tenant_status_available_at;
-- DROP INDEX IF EXISTS idx_automation_jobs_status_available_at;
-- DROP INDEX IF EXISTS idx_message_logs_status;
-- DROP INDEX IF EXISTS idx_message_logs_automation_job_id;
-- DROP INDEX IF EXISTS idx_message_logs_trigger_type;
-- DROP INDEX IF EXISTS idx_inbound_events_tenant_idempotency_key;
-- ALTER TABLE message_logs DROP COLUMN IF EXISTS provider_response;
-- ALTER TABLE message_logs DROP COLUMN IF EXISTS provider_message_id;
-- ALTER TABLE message_logs DROP COLUMN IF EXISTS automation_job_id;
-- ALTER TABLE message_logs DROP COLUMN IF EXISTS template_language_code;
-- ALTER TABLE message_logs DROP COLUMN IF EXISTS trigger_type;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS message_log_id;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS last_error_category;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS locked_by;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS locked_at;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS available_at;
-- ALTER TABLE automation_jobs DROP COLUMN IF EXISTS trigger_type;
-- ALTER TABLE inbound_events DROP CONSTRAINT IF EXISTS inbound_events_tenant_id_idempotency_key_key;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS processing_error;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS processed_at;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS received_at;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS payload_hash;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS signature_valid;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS source;
-- ALTER TABLE inbound_events DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE inbound_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'qloapps',
  ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

UPDATE inbound_events
SET idempotency_key = event_id
WHERE idempotency_key IS NULL;

UPDATE inbound_events
SET payload_hash = md5(payload::text)
WHERE payload_hash IS NULL;

UPDATE inbound_events
SET received_at = created_at
WHERE received_at IS NULL;

UPDATE inbound_events
SET processed_at = created_at
WHERE processed = TRUE AND processed_at IS NULL;

ALTER TABLE inbound_events
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL,
  ALTER COLUMN received_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inbound_events_tenant_id_idempotency_key_key'
  ) THEN
    ALTER TABLE inbound_events
      ADD CONSTRAINT inbound_events_tenant_id_idempotency_key_key UNIQUE (tenant_id, idempotency_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbound_events_tenant_idempotency_key
  ON inbound_events(tenant_id, idempotency_key);

ALTER TABLE automation_jobs
  ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS last_error_category TEXT,
  ADD COLUMN IF NOT EXISTS message_log_id UUID REFERENCES message_logs(id) ON DELETE SET NULL;

UPDATE automation_jobs
SET available_at = COALESCE(scheduled_at, created_at)
WHERE available_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_available_at
  ON automation_jobs(status, available_at);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_tenant_status_available_at
  ON automation_jobs(tenant_id, status, available_at);

ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS trigger_type TEXT,
  ADD COLUMN IF NOT EXISTS template_language_code TEXT,
  ADD COLUMN IF NOT EXISTS automation_job_id UUID REFERENCES automation_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_response JSONB;

CREATE INDEX IF NOT EXISTS idx_message_logs_trigger_type
  ON message_logs(trigger_type);

CREATE INDEX IF NOT EXISTS idx_message_logs_automation_job_id
  ON message_logs(automation_job_id);

CREATE INDEX IF NOT EXISTS idx_message_logs_status
  ON message_logs(status);