-- Migration: 20260301130600_add_multilingual_message_templates.sql

-- 1. Create message_template_variants table
CREATE TABLE message_template_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL, -- 'id', 'en', etc.
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, language_code)
);

-- 2. Migrate existing content to a default 'en' variant
INSERT INTO message_template_variants (template_id, language_code, content, created_at, updated_at)
SELECT id, 'en', content, created_at, updated_at FROM message_templates;

-- 3. Drop old content column from message_templates
ALTER TABLE message_templates DROP COLUMN content;

-- Add UNIQUE constraints to prevent duplicate templates per tenant & trigger
ALTER TABLE message_templates ADD CONSTRAINT unique_tenant_trigger UNIQUE(tenant_id, trigger);

-- 4. Set up RLS for new table
ALTER TABLE message_template_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage template variants" ON message_template_variants
  FOR ALL USING (
    template_id IN (
      SELECT id FROM message_templates WHERE tenant_id = public.get_user_tenant_id()
    )
  );

-- Indexes
CREATE INDEX idx_message_template_variants_template_id ON message_template_variants(template_id);
