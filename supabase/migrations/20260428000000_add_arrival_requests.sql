-- Migration: Add Arrival Requests Operations Queue
-- Description: Stores pre-arrival ETA and early check-in requests captured by AI tools

-- ============================================================
-- ARRIVAL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS arrival_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('arrival_eta', 'early_checkin')),
  eta TEXT,
  requested_time TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE arrival_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage arrival requests" ON arrival_requests
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_arrival_requests_tenant_id ON arrival_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_arrival_requests_status ON arrival_requests(status);
CREATE INDEX IF NOT EXISTS idx_arrival_requests_reservation_id ON arrival_requests(reservation_id);

ALTER PUBLICATION supabase_realtime ADD TABLE arrival_requests;
