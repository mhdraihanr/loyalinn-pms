-- Migration: Add support for ai conversational chat logs
-- Description: Adds 'direction' to message_logs and expends 'status' to include 'received'

-- Add direction column
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound'));

-- Drop the old constraint for status and add the new one
DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  -- Find the name of the check constraint for the status column
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
  WHERE rel.relname = 'message_logs'
    AND attr.attname = 'status'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE message_logs DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Add the new constraint with expanded statuses
ALTER TABLE message_logs 
ADD CONSTRAINT message_logs_status_check 
CHECK (status IN ('pending', 'sent', 'failed', 'retrying', 'received'));
