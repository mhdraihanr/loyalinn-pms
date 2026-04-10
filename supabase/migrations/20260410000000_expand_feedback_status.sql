-- Migration: Expand post-stay feedback statuses
-- Description: Adds 'ai_followup' and 'ignored' to the allowed statuses for post_stay_feedback_status

-- Drop the implicit constraint added previously
DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  -- Find the name of the check constraint for the post_stay_feedback_status column
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
  WHERE rel.relname = 'reservations'
    AND attr.attname = 'post_stay_feedback_status'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE reservations DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Add the new constraint with expanded statuses
ALTER TABLE reservations 
ADD CONSTRAINT reservations_post_stay_feedback_status_check 
CHECK (post_stay_feedback_status IN ('not-sent', 'pending', 'ai_followup', 'completed', 'ignored'));
