-- Migration: Add post-stay feedback fields to reservations
-- Description: Adds fields to track the status and content of post-stay feedback

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS post_stay_feedback_status TEXT DEFAULT 'not-sent' CHECK (post_stay_feedback_status IN ('not-sent', 'pending', 'completed')),
ADD COLUMN IF NOT EXISTS post_stay_rating INTEGER CHECK (post_stay_rating >= 1 AND post_stay_rating <= 5),
ADD COLUMN IF NOT EXISTS post_stay_comments TEXT;
