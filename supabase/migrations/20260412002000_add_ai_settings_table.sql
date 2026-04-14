-- Migration: add tenant-scoped AI prompt settings for post-stay feedback assistant

CREATE TABLE IF NOT EXISTS ai_settings (
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

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view AI settings" ON ai_settings;
DROP POLICY IF EXISTS "Owners can manage AI settings" ON ai_settings;

CREATE POLICY "Members can view AI settings" ON ai_settings
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage AI settings" ON ai_settings
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));
