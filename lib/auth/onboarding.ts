import { createClient } from "../supabase/server";

/**
 * Auto-create tenant for new user during onboarding
 */
export async function createTenantForUser(
  userId: string,
  hotelName: string,
): Promise<string> {
  const supabase = await createClient();

  // Generate slug from hotel name
  const slug = hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      user_id: userId,
      name: hotelName,
      slug: slug,
    })
    .select("id")
    .single();

  if (error) throw error;
  return tenant.id;
}

/**
 * Check if user already has a tenant
 */
export async function userHasTenant(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !!data;
}
