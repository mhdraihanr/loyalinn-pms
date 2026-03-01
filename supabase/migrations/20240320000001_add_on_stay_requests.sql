-- Migration: Add tables for On-Stay AI Agent Requests
-- Description: Creates room_service_orders and housekeeping_requests to store output from AI Function Calls

-- ============================================================
-- ROOM SERVICE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS room_service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of items: [{ name: 'Nasi Goreng', quantity: 1, notes: 'Pedas' }]
  total_amount DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOUSEKEEPING REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS housekeeping_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('cleaning', 'extra_items', 'maintenance', 'other')),
  details JSONB NOT NULL, -- e.g., { extra_items: ['towel', 'pillow'], notes: '...' }
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE room_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_requests ENABLE ROW LEVEL SECURITY;

-- ROOM SERVICE ORDERS: all members can manage
CREATE POLICY "Members can manage room service orders" ON room_service_orders
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- HOUSEKEEPING REQUESTS: all members can manage
CREATE POLICY "Members can manage housekeeping requests" ON housekeeping_requests
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_room_service_tenant_id ON room_service_orders(tenant_id);
CREATE INDEX idx_room_service_status ON room_service_orders(status);
CREATE INDEX idx_housekeeping_tenant_id ON housekeeping_requests(tenant_id);
CREATE INDEX idx_housekeeping_status ON housekeeping_requests(status);
