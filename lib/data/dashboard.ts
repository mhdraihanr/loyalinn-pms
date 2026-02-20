import { createClient } from "@/lib/supabase/server";

export async function getDashboardStats(tenantId: string) {
  const supabase = await createClient();

  const [
    { count: guestCount },
    { count: reservationCount },
    { count: messageCount },
  ] = await Promise.all([
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "checked_in"]),
    supabase
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "sent"),
  ]);

  return {
    guests: guestCount ?? 0,
    activeReservations: reservationCount ?? 0,
    messagesSent: messageCount ?? 0,
  };
}

export async function getRecentReservations(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(
      "id, guest_name, room_number, check_in_date, check_out_date, status",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}
