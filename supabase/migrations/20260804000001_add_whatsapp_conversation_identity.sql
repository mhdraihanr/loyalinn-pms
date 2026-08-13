-- Apply after 20260804000000_add_realtime_whatsapp_inbox.sql.
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_guest
  ON whatsapp_conversations (tenant_id, guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_reservation
  ON whatsapp_conversations (tenant_id, reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_phone
  ON whatsapp_conversations (tenant_id, normalized_phone) WHERE normalized_phone IS NOT NULL;
