import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type UserTenant = {
  tenantId: string;
  userId: string;
  role: "owner" | "staff";
};

/**
 * Get current user's tenant membership.
 * Returns null if user is not a member of any tenant.
 */
export async function getCurrentUserTenant(): Promise<UserTenant | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: tenantUser } = await adminClient
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) return null;

  return {
    tenantId: tenantUser.tenant_id,
    userId: user.id,
    role: tenantUser.role,
  };
}

/**
 * Require tenant membership — throws if user has no tenant.
 * Use in server actions / route handlers that need tenant context.
 */
export async function requireUserTenant(): Promise<UserTenant> {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) {
    throw new Error(
      "User is not a member of any tenant. Please complete onboarding.",
    );
  }
  return userTenant;
}

/**
 * Check if the current user is an owner of their tenant.
 */
export async function requireOwner(): Promise<UserTenant> {
  const userTenant = await requireUserTenant();
  if (userTenant.role !== "owner") {
    throw new Error("Only owners can perform this action.");
  }
  return userTenant;
}
