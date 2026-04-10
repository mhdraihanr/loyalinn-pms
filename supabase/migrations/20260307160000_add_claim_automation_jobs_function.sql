-- Migration: 20260307160000_add_claim_automation_jobs_function.sql
-- Description: Adds a Postgres helper function for atomically claiming
-- automation jobs with FOR UPDATE SKIP LOCKED.
--
-- Rollback (manual, if needed):
-- DROP FUNCTION IF EXISTS public.claim_automation_jobs(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.claim_automation_jobs(
  p_batch_size INTEGER,
  p_worker_id TEXT
)
RETURNS SETOF automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_jobs AS (
    SELECT id
    FROM automation_jobs
    WHERE status = 'pending'
      AND available_at <= NOW()
    ORDER BY available_at ASC, created_at ASC
    LIMIT GREATEST(COALESCE(p_batch_size, 0), 0)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE automation_jobs AS jobs
  SET status = 'processing',
      locked_at = NOW(),
      locked_by = p_worker_id,
      updated_at = NOW()
  FROM next_jobs
  WHERE jobs.id = next_jobs.id
  RETURNING jobs.*;
END;
$$;