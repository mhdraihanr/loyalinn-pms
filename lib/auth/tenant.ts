import { createClient } from "../supabase/server";

export type UserTenant = {
  tenantId: string;
  userId: string;
};

export async function getCurrentUserTenant(): Promise<UserTenant | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tenant) return null;

  return {
    tenantId: tenant.id,
    userId: user.id,
  };
}

export async function requireUserTenant(): Promise<UserTenant> {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) {
    throw new Error("User must have a tenant. Please complete onboarding.");
  }

  return userTenant;
}
