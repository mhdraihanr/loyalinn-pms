-- Migration: enforce atomic dedupe for inbound post-stay WAHA messages

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_inbound_post_stay_provider_message_unique
ON message_logs(tenant_id, provider_message_id)
WHERE direction = 'inbound'
  AND trigger_type = 'post-stay'
  AND provider_message_id IS NOT NULL;
