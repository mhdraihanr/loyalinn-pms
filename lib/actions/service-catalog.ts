"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";
import type {
  ServiceCatalogAvailability,
  ServiceCatalogCategoryType,
  ServiceCatalogFulfillment,
  ServiceCatalogItemType,
} from "@/lib/data/service-catalog";

export type ServiceCatalogCategoryInput = {
  id?: string;
  type: ServiceCatalogCategoryType;
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
};

export type ServiceCatalogItemInput = {
  id?: string;
  category_id: string;
  item_type: ServiceCatalogItemType;
  name: string;
  description?: string;
  price?: number | null;
  currency?: string;
  unit?: string;
  availability_status: ServiceCatalogAvailability;
  available_start_time?: string | null;
  available_end_time?: string | null;
  location?: string;
  preparation_minutes?: number | null;
  fulfillment_type: ServiceCatalogFulfillment;
  guest_notes?: string;
  staff_notes?: string;
  is_active?: boolean;
  sort_order?: number;
  aliases?: string[];
};

const CATEGORY_TYPES = new Set<ServiceCatalogCategoryType>([
  "room_service",
  "facility",
]);
const ITEM_TYPES = new Set<ServiceCatalogItemType>([
  "food",
  "drink",
  "facility",
  "service",
  "amenity",
]);
const AVAILABILITY_STATUSES = new Set<ServiceCatalogAvailability>([
  "available",
  "unavailable",
  "limited",
  "by_request",
]);
const FULFILLMENT_TYPES = new Set<ServiceCatalogFulfillment>([
  "room_service",
  "housekeeping",
  "front_office",
  "concierge",
  "info_only",
]);

function cleanText(value: string | null | undefined, maxLength: number) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanRequiredText(value: string | null | undefined, maxLength: number) {
  const trimmed = cleanText(value, maxLength);
  if (!trimmed) throw new Error("Name is required.");
  return trimmed;
}

function cleanNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value;
}

function normalizeAliases(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 80)),
    ),
  );
}

function revalidateServiceCatalog() {
  revalidatePath("/settings/service-catalog");
  revalidatePath("/operations");
}

export async function saveServiceCatalogCategory(
  input: ServiceCatalogCategoryInput,
) {
  const owner = await requireOwner();
  const supabase = await createClient();

  if (!CATEGORY_TYPES.has(input.type)) {
    return { success: false, error: "Invalid category type." };
  }

  const payload = {
    tenant_id: owner.tenantId,
    type: input.type,
    name: cleanRequiredText(input.name, 120),
    description: cleanText(input.description, 500),
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase
        .from("service_catalog_categories")
        .update(payload)
        .eq("id", input.id)
        .eq("tenant_id", owner.tenantId)
    : supabase.from("service_catalog_categories").insert(payload);

  const { error } = await query;
  if (error) return { success: false, error: error.message };

  revalidateServiceCatalog();
  return { success: true };
}

export async function deleteServiceCatalogCategory(id: string) {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_catalog_categories")
    .delete()
    .eq("id", id)
    .eq("tenant_id", owner.tenantId);

  if (error) return { success: false, error: error.message };

  revalidateServiceCatalog();
  return { success: true };
}

export async function saveServiceCatalogItem(input: ServiceCatalogItemInput) {
  const owner = await requireOwner();
  const supabase = await createClient();

  if (!ITEM_TYPES.has(input.item_type)) {
    return { success: false, error: "Invalid item type." };
  }
  if (!AVAILABILITY_STATUSES.has(input.availability_status)) {
    return { success: false, error: "Invalid availability status." };
  }
  if (!FULFILLMENT_TYPES.has(input.fulfillment_type)) {
    return { success: false, error: "Invalid fulfillment type." };
  }

  const { data: category, error: categoryError } = await supabase
    .from("service_catalog_categories")
    .select("id")
    .eq("id", input.category_id)
    .eq("tenant_id", owner.tenantId)
    .maybeSingle();

  if (categoryError || !category) {
    return {
      success: false,
      error: categoryError?.message ?? "Category not found for this tenant.",
    };
  }

  const payload = {
    tenant_id: owner.tenantId,
    category_id: input.category_id,
    item_type: input.item_type,
    name: cleanRequiredText(input.name, 160),
    description: cleanText(input.description, 1000),
    price: cleanNumber(input.price),
    currency: cleanRequiredText(input.currency || "IDR", 12).toUpperCase(),
    unit: cleanText(input.unit, 40),
    availability_status: input.availability_status,
    available_start_time: input.available_start_time || null,
    available_end_time: input.available_end_time || null,
    location: cleanText(input.location, 160),
    preparation_minutes: cleanNumber(input.preparation_minutes),
    fulfillment_type: input.fulfillment_type,
    guest_notes: cleanText(input.guest_notes, 1000),
    staff_notes: cleanText(input.staff_notes, 1000),
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const itemResult = input.id
    ? await supabase
        .from("service_catalog_items")
        .update(payload)
        .eq("id", input.id)
        .eq("tenant_id", owner.tenantId)
        .select("id")
        .single()
    : await supabase
        .from("service_catalog_items")
        .insert(payload)
        .select("id")
        .single();

  if (itemResult.error || !itemResult.data) {
    return {
      success: false,
      error: itemResult.error?.message ?? "Failed to save catalog item.",
    };
  }

  const itemId = String(itemResult.data.id);
  const aliases = normalizeAliases(input.aliases);

  const { error: deleteAliasError } = await supabase
    .from("service_catalog_item_aliases")
    .delete()
    .eq("tenant_id", owner.tenantId)
    .eq("item_id", itemId);

  if (deleteAliasError) {
    return { success: false, error: deleteAliasError.message };
  }

  if (aliases.length > 0) {
    const { error: aliasError } = await supabase
      .from("service_catalog_item_aliases")
      .insert(
        aliases.map((alias) => ({
          tenant_id: owner.tenantId,
          item_id: itemId,
          alias,
        })),
      );

    if (aliasError) return { success: false, error: aliasError.message };
  }

  revalidateServiceCatalog();
  return { success: true };
}

export async function deleteServiceCatalogItem(id: string) {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_catalog_items")
    .delete()
    .eq("id", id)
    .eq("tenant_id", owner.tenantId);

  if (error) return { success: false, error: error.message };

  revalidateServiceCatalog();
  return { success: true };
}
