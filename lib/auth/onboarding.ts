import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

/**
 * Register a new owner and create their tenant.
 * Only callable if user does NOT already belong to any tenant.
 */
export async function createTenantAsOwner(
  userId: string,
  hotelName: string,
): Promise<string> {
  const admin = createAdminClient();

  // Guard: prevent user from creating a second tenant
  const { data: existing } = await admin
    .from("tenant_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    throw new Error("User already belongs to a tenant.");
  }

  // Generate URL-safe slug from hotel name
  const slug = hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create the tenant
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ name: hotelName, slug })
    .select("id")
    .single();

  if (tenantError) {
    if (tenantError.code === "23505" && tenantError.message.includes("slug")) {
      throw new Error("Hotel name is already used. Please choose another name.");
    }
    throw new Error(tenantError.message || "Failed to create tenant.");
  }

  // Assign user as owner
  const { error: memberError } = await admin.from("tenant_users").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await admin.from("tenants").delete().eq("id", tenant.id);

    if (memberError.code === "23505" && memberError.message.includes("user_id")) {
      throw new Error("User already belongs to a tenant.");
    }

    throw new Error(memberError.message || "Failed to create tenant membership.");
  }

  return tenant.id;
}

/**
 * Check if a user already belongs to any tenant.
 */
export async function userHasTenant(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
