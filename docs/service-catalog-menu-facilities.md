# Menu & Facilities Service Catalog

## Overview

The Menu & Facilities service catalog stores tenant-managed room-service menu and facility/service data that the on-stay lifecycle AI can safely answer from. It prevents the AI from inventing menu items, prices, opening hours, or availability when guests ask questions such as:

- "Menu apa aja?"
- "Ada minuman apa?"
- "Bisa pesan nasi goreng?"
- "Kolam renang buka sampai jam berapa?"
- "Laundry tersedia?"

The catalog is configuration data, not a fulfillment queue. Staff still fulfill guest requests in the Operations dashboard after AI tools create operational rows.

## Navigation

Owners and staff can open:

```text
Operations → Menu & Facilities
/settings/service-catalog
```

- Owners can create, update, and delete catalog categories/items.
- Staff can read the catalog for operational awareness.
- On-stay AI reads active tenant catalog rows at runtime through the service-role/admin client.

## Data model

Migration:

```text
supabase/migrations/20260727000000_add_service_catalog.sql
```

Tables:

| Table | Purpose |
| --- | --- |
| `service_catalog_categories` | Tenant-scoped groups for room service and facilities. |
| `service_catalog_items` | Food, drink, facility, service, and amenity rows with availability, pricing, notes, and fulfillment type. |
| `service_catalog_item_aliases` | Guest phrase aliases used for matching, such as `nasgor`, `teh es`, or `kolam`. |

`room_service_orders` also stores `currency` and `source_catalog_item_ids` so operational history keeps a snapshot of what the guest ordered even if catalog data later changes.

## Catalog fields that affect AI behavior

| Field | AI behavior |
| --- | --- |
| `is_active` | Inactive categories/items are hidden from AI. |
| `availability_status` | Only `available` and `limited` room-service items can be auto-ordered. `unavailable` and `by_request` require alternatives or staff handoff. |
| `fulfillment_type` | `room_service` items may become `room_service_orders`; `info_only` is answered as information; other types should be handed off or routed to the relevant operational tool later. |
| `price` / `currency` | Used in AI answers and persisted into order snapshots. |
| `available_start_time` / `available_end_time` | Used when answering service hours. |
| `preparation_minutes` | Used as the guest-facing preparation estimate for food/drink answers and successful room-service order confirmations. When multiple ordered items include estimates, the reply uses the largest preparation time as the order estimate. |
| `guest_notes` | Guest-safe detail AI may include in replies. |
| `staff_notes` | Internal operations context; do not promise this text to guests as completed work. |
| aliases | Helps match natural-language guest requests to exact catalog rows. |

## On-stay AI flow

1. Guest asks about menu, drinks, facilities, services, or availability.
2. On-stay AI calls `search_service_catalog` before answering.
3. AI answers only from matching active catalog rows.
4. If the guest orders food/drink, AI must use exact catalog item IDs from search results.
5. `order_in_room_dining` validates every requested item:
   - item exists in the tenant catalog;
   - item is active;
   - `fulfillment_type = 'room_service'`;
   - `availability_status` is `available` or `limited`.
6. The tool inserts a catalog-backed `room_service_orders` row with item snapshots, source catalog IDs, and per-item `preparationMinutes` snapshots.
7. The AI confirmation includes the preparation estimate when catalog data provides `preparation_minutes`.
8. Staff fulfill the order from Operations → Room Service.

If no item matches, AI must not invent data. It should say the item is not listed and offer available choices or staff handoff.

## Recommended setup sequence

1. Create room-service categories:
   - Makanan Utama
   - Minuman
   - Dessert
2. Create facility categories:
   - Fasilitas Hotel
   - Layanan Tambahan
3. Add active items with prices, availability, aliases, and `preparation_minutes` for food/drink items where the kitchen estimate is known.
4. Use `by_request` for anything that requires staff confirmation, such as spa booking, paid transport, or meeting rooms.
5. Test with an on-stay reservation by asking WhatsApp: "Menu apa aja?" and then ordering a configured item. The guest reply should mention the preparation estimate when the item has `preparation_minutes`.

## Troubleshooting

See [Operational Runbook](./runbook.md) → "Menu & Facilities Catalog Not Used by On-Stay AI" for triage steps.
