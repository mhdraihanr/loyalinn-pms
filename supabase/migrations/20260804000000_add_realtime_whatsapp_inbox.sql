-- Database-backed WhatsApp inbox for the configured WAHA session.
-- Apply this migration manually before deploying the realtime inbox UI.

CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  normalized_phone TEXT,
  display_name TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_message_preview TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
  last_message_at TIMESTAMPTZ,
  last_seen_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, session_name, chat_id)
);

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  provider_message_id TEXT,
  client_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'received')),
  error_message TEXT,
  provider_response JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_message_id)
);

CREATE UNIQUE INDEX idx_whatsapp_messages_provider_message_unique
  ON whatsapp_messages (tenant_id, session_name, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view WhatsApp conversations" ON whatsapp_conversations
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can view WhatsApp messages" ON whatsapp_messages
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_whatsapp_conversations_tenant_last_message
  ON whatsapp_conversations (tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_whatsapp_messages_conversation_time
  ON whatsapp_messages (conversation_id, sent_at ASC NULLS LAST, created_at ASC);
CREATE INDEX idx_whatsapp_messages_tenant_time
  ON whatsapp_messages (tenant_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
