ALTER TABLE lifecycle_ai_sessions
  ADD COLUMN IF NOT EXISTS clarification_count INTEGER NOT NULL DEFAULT 0
  CHECK (clarification_count >= 0);
