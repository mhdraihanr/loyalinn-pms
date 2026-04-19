CREATE OR REPLACE FUNCTION public.complete_post_stay_feedback_with_reward(
  p_reservation_id UUID,
  p_tenant_id UUID,
  p_rating INTEGER,
  p_comments TEXT,
  p_reward_points INTEGER DEFAULT 50
)
RETURNS TABLE(rewarded BOOLEAN, points_awarded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  reservation_row reservations%ROWTYPE;
  safe_reward_points INTEGER;
BEGIN
  safe_reward_points := GREATEST(COALESCE(p_reward_points, 0), 0);

  SELECT *
  INTO reservation_row
  FROM reservations
  WHERE id = p_reservation_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF reservation_row.id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found for tenant';
  END IF;

  UPDATE reservations
  SET post_stay_feedback_status = 'completed',
      post_stay_rating = p_rating,
      post_stay_comments = p_comments,
      updated_at = NOW()
  WHERE id = reservation_row.id
    AND tenant_id = reservation_row.tenant_id;

  IF reservation_row.post_stay_feedback_status IS DISTINCT FROM 'completed' THEN
    UPDATE guests
    SET points = COALESCE(points, 0) + safe_reward_points,
        updated_at = NOW()
    WHERE id = reservation_row.guest_id
      AND tenant_id = reservation_row.tenant_id;

    rewarded := true;
    points_awarded := safe_reward_points;
  ELSE
    rewarded := false;
    points_awarded := 0;
  END IF;

  RETURN NEXT;
END;
$$;
