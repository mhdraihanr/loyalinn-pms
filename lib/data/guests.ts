import { createClient } from "@/lib/supabase/server";

export async function getGuests(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select(
      "id, full_name, phone, email, country, tier, loyalty_points, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
