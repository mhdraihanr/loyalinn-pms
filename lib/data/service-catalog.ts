import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUserTenant } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";

export type ServiceCatalogCategoryType = "room_service" | "facility";
export type ServiceCatalogItemType =
  | "food"
  | "drink"
  | "facility"
  | "service"
  | "amenity";
export type ServiceCatalogAvailability =
  | "available"
  | "unavailable"
  | "limited"
  | "by_request";
export type ServiceCatalogFulfillment =
  | "room_service"
  | "housekeeping"
  | "front_office"
  | "concierge"
  | "info_only";

export type ServiceCatalogCategory = {
  id: string;
  tenant_id: string;
  type: ServiceCatalogCategoryType;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ServiceCatalogItem = {
  id: string;
  tenant_id: string;
  category_id: string;
  item_type: ServiceCatalogItemType;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  unit: string | null;
  availability_status: ServiceCatalogAvailability;
  available_start_time: string | null;
  available_end_time: string | null;
  location: string | null;
  preparation_minutes: number | null;
  fulfillment_type: ServiceCatalogFulfillment;
  guest_notes: string | null;
  staff_notes: string | null;
  is_active: boolean;
  sort_order: number;
  aliases: string[];
  category?: Pick<ServiceCatalogCategory, "id" | "name" | "type"> | null;
};

export type ServiceCatalogData = {
  categories: ServiceCatalogCategory[];
  items: ServiceCatalogItem[];
};

type CatalogClient = SupabaseClient | Awaited<ReturnType<typeof createClient>>;

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeItem(row: Record<string, unknown>): ServiceCatalogItem {
  const aliases = row.service_catalog_item_aliases;
  const category = row.service_catalog_categories;
  const categoryRow = Array.isArray(category) ? category[0] : category;

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    category_id: String(row.category_id),
    item_type: row.item_type as ServiceCatalogItemType,
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    price: toNumberOrNull(row.price),
    currency: String(row.currency ?? "IDR"),
    unit: row.unit ? String(row.unit) : null,
    availability_status: row.availability_status as ServiceCatalogAvailability,
    available_start_time: row.available_start_time
      ? String(row.available_start_time)
      : null,
    available_end_time: row.available_end_time
      ? String(row.available_end_time)
      : null,
    location: row.location ? String(row.location) : null,
    preparation_minutes: toNumberOrNull(row.preparation_minutes),
    fulfillment_type: row.fulfillment_type as ServiceCatalogFulfillment,
    guest_notes: row.guest_notes ? String(row.guest_notes) : null,
    staff_notes: row.staff_notes ? String(row.staff_notes) : null,
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    aliases: Array.isArray(aliases)
      ? aliases
          .map((aliasRow) =>
            aliasRow && typeof aliasRow === "object"
              ? String((aliasRow as { alias?: unknown }).alias ?? "").trim()
              : "",
          )
          .filter(Boolean)
      : [],
    category:
      categoryRow && typeof categoryRow === "object"
        ? {
            id: String((categoryRow as { id?: unknown }).id ?? ""),
            name: String((categoryRow as { name?: unknown }).name ?? ""),
            type: (categoryRow as { type?: ServiceCatalogCategoryType }).type!,
          }
        : null,
  };
}

export async function getCurrentTenantServiceCatalog(): Promise<ServiceCatalogData> {
  const { tenantId } = await requireUserTenant();
  return getServiceCatalogForTenant(tenantId);
}

export async function getServiceCatalogForTenant(
  tenantId: string,
  client?: CatalogClient,
): Promise<ServiceCatalogData> {
  const supabase = client ?? (await createClient());

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("service_catalog_categories")
      .select("id, tenant_id, type, name, description, sort_order, is_active")
      .eq("tenant_id", tenantId)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("service_catalog_items")
      .select(
        `
        id,
        tenant_id,
        category_id,
        item_type,
        name,
        description,
        price,
        currency,
        unit,
        availability_status,
        available_start_time,
        available_end_time,
        location,
        preparation_minutes,
        fulfillment_type,
        guest_notes,
        staff_notes,
        is_active,
        sort_order,
        service_catalog_categories ( id, name, type ),
        service_catalog_item_aliases ( alias )
      `,
      )
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (categoriesResult.error) {
    if (/service_catalog_categories/i.test(categoriesResult.error.message)) {
      return { categories: [], items: [] };
    }
    throw new Error(categoriesResult.error.message);
  }

  if (itemsResult.error) {
    if (/service_catalog_items/i.test(itemsResult.error.message)) {
      return { categories: [], items: [] };
    }
    throw new Error(itemsResult.error.message);
  }

  return {
    categories: (categoriesResult.data ?? []) as ServiceCatalogCategory[],
    items: ((itemsResult.data ?? []) as unknown as Record<string, unknown>[]).map(
      normalizeItem,
    ),
  };
}

export async function getActiveServiceCatalogForTenant(
  tenantId: string,
  client: CatalogClient,
): Promise<ServiceCatalogData> {
  const data = await getServiceCatalogForTenant(tenantId, client);
  const activeCategoryIds = new Set(
    data.categories.filter((category) => category.is_active).map((category) => category.id),
  );

  return {
    categories: data.categories.filter((category) => category.is_active),
    items: data.items.filter(
      (item) => item.is_active && activeCategoryIds.has(item.category_id),
    ),
  };
}

export function formatServiceCatalogForPrompt(data: ServiceCatalogData) {
  const activeItems = data.items.filter((item) => item.is_active);

  if (activeItems.length === 0) {
    return "No room-service menu or facility catalog has been configured for this tenant yet.";
  }

  const categoriesById = new Map(data.categories.map((category) => [category.id, category]));
  const lines = activeItems.map((item) => {
    const category = categoriesById.get(item.category_id);
    const price = item.price === null ? "price not listed" : `${item.currency} ${item.price}`;
    const availability = item.availability_status.replace("_", " ");
    const hours = item.available_start_time || item.available_end_time
      ? `, hours ${item.available_start_time ?? "?"}-${item.available_end_time ?? "?"}`
      : "";
    const aliases = item.aliases.length > 0 ? `, aliases: ${item.aliases.join(", ")}` : "";
    const preparation = item.preparation_minutes !== null
      ? `, preparation: ${item.preparation_minutes} minutes`
      : "";
    const notes = item.guest_notes ? `, guest note: ${item.guest_notes}` : "";

    return `- ID ${item.id}: ${item.name} (${item.item_type}, category: ${category?.name ?? "uncategorized"}, status: ${availability}, fulfillment: ${item.fulfillment_type}, ${price}${hours}${preparation}${aliases}${notes})`;
  });

  return lines.join("\n");
}
