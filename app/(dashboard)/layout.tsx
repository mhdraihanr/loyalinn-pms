import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Box } from "@mantine/core";
import { Sidebar } from "@/components/layout/sidebar";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Fetch tenant membership (service role to avoid RLS false negatives)
  const { data: tenantUser } = await admin
    .from("tenant_users")
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tenantUser) redirect("/onboarding");

  const tenantsRaw = tenantUser.tenants;
  const tenantName = Array.isArray(tenantsRaw)
    ? (tenantsRaw[0] as { name: string } | undefined)?.name
    : (tenantsRaw as { name: string } | null)?.name;
  const hotelName = tenantName ?? "Your Hotel";

  return (
    <Box style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar hotelName={hotelName} />
      <Box
        component="main"
        style={{
          flex: 1,
          background: "var(--mantine-color-gray-0)",
          padding: "var(--mantine-spacing-xl)",
          overflowY: "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
