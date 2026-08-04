-- Migration: Add tenant service catalog for room service menu and facilities
-- Description: Stores owner-managed food, drink, facility, and service data used by on-stay AI.

-- ============================================================
-- SERVICE CATALOG CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS service_catalog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('room_service', 'facility')),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, tenant_id),
  UNIQUE(tenant_id, type, name)
);

-- ============================================================
-- SERVICE CATALOG ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS service_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('food', 'drink', 'facility', 'service', 'amenity')),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  currency TEXT NOT NULL DEFAULT 'IDR',
  unit TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'limited', 'by_request')),
  available_start_time TIME,
  available_end_time TIME,
  location TEXT,
  preparation_minutes INTEGER CHECK (preparation_minutes IS NULL OR preparation_minutes >= 0),
  fulfillment_type TEXT NOT NULL DEFAULT 'info_only' CHECK (fulfillment_type IN ('room_service', 'housekeeping', 'front_office', 'concierge', 'info_only')),
  guest_notes TEXT,
  staff_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, tenant_id),
  UNIQUE(tenant_id, category_id, name),
  CONSTRAINT service_catalog_items_category_tenant_fkey
    FOREIGN KEY (category_id, tenant_id)
    REFERENCES service_catalog_categories(id, tenant_id)
    ON DELETE RESTRICT
);

-- ============================================================
-- SERVICE CATALOG ITEM ALIASES
-- ============================================================
CREATE TABLE IF NOT EXISTS service_catalog_item_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, item_id, alias),
  CONSTRAINT service_catalog_item_aliases_item_tenant_fkey
    FOREIGN KEY (item_id, tenant_id)
    REFERENCES service_catalog_items(id, tenant_id)
    ON DELETE CASCADE
);

-- ============================================================
-- ROOM SERVICE ORDER CATALOG SNAPSHOT LINKS
-- ============================================================
ALTER TABLE room_service_orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS source_catalog_item_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE service_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog_item_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view service catalog categories" ON service_catalog_categories;
CREATE POLICY "Members can view service catalog categories" ON service_catalog_categories
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Owners can manage service catalog categories" ON service_catalog_categories;
CREATE POLICY "Owners can manage service catalog categories" ON service_catalog_categories
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

DROP POLICY IF EXISTS "Members can view service catalog items" ON service_catalog_items;
CREATE POLICY "Members can view service catalog items" ON service_catalog_items
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Owners can manage service catalog items" ON service_catalog_items;
CREATE POLICY "Owners can manage service catalog items" ON service_catalog_items
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

DROP POLICY IF EXISTS "Members can view service catalog item aliases" ON service_catalog_item_aliases;
CREATE POLICY "Members can view service catalog item aliases" ON service_catalog_item_aliases
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Owners can manage service catalog item aliases" ON service_catalog_item_aliases;
CREATE POLICY "Owners can manage service catalog item aliases" ON service_catalog_item_aliases
  FOR ALL USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_catalog_categories_tenant_type ON service_catalog_categories(tenant_id, type, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_tenant_type ON service_catalog_items(tenant_id, item_type, is_active, availability_status, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_category ON service_catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_item_aliases_tenant_item ON service_catalog_item_aliases(tenant_id, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_catalog_item_aliases_lower_unique ON service_catalog_item_aliases(tenant_id, item_id, lower(alias));
