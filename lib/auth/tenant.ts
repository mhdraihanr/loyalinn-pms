import { createClient } from "@/lib/supabase/server";

export type TenantUser = {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "agent";
};

export async function getCurrentTenantUser(): Promise<TenantUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, user_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) return null;

  return {
    tenantId: tenantUser.tenant_id,
    userId: tenantUser.user_id,
    role: tenantUser.role,
  };
}

export async function requireTenantUser(): Promise<TenantUser> {
  const tenantUser = await getCurrentTenantUser();
  if (!tenantUser) {
    throw new Error("User is not associated with any tenant");
  }
  return tenantUser;
}
