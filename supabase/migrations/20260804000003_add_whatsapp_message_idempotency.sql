-- Apply after 20260804000000, 20260804000001, and 20260804000002.
-- Use a brief webhook write pause when reconciling existing outbound echoes.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_tenant_id_client_message_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_client_message_unique
  ON whatsapp_messages (tenant_id, session_name, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_idempotency_unique
  ON whatsapp_messages (tenant_id, session_name, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Preflight duplicate check before deploying writer changes:
-- SELECT tenant_id, session_name, provider_message_id, count(*)
-- FROM whatsapp_messages WHERE provider_message_id IS NOT NULL
-- GROUP BY 1,2,3 HAVING count(*) > 1;
-- SELECT tenant_id, session_name, client_message_id, count(*)
-- FROM whatsapp_messages WHERE client_message_id IS NOT NULL
-- GROUP BY 1,2,3 HAVING count(*) > 1;
