import { createClient } from "../supabase/server";

/**
 * Register a new owner and create their tenant.
 * Only callable if user does NOT already belong to any tenant.
 */
export async function createTenantAsOwner(
  userId: string,
  hotelName: string,
): Promise<string> {
  const supabase = await createClient();

  // Guard: prevent user from creating a second tenant
  const { data: existing } = await supabase
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
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: hotelName, slug })
    .select("id")
    .single();

  if (tenantError) throw tenantError;

  // Assign user as owner
  const { error: memberError } = await supabase.from("tenant_users").insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) throw memberError;

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
