-- Migration: allow dedicated template trigger for post-stay AI follow-up messages

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
  WHERE rel.relname = 'message_templates'
    AND attr.attname = 'trigger'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE message_templates DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE message_templates
ADD CONSTRAINT message_templates_trigger_check
CHECK (trigger IN ('pre-arrival', 'on-stay', 'post-stay', 'post-stay-ai-followup'));
