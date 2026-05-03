import { createClient } from "@/lib/supabase/server";

type RecentReservationRow = {
  id: string;
  room_number: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string;
  guests: {
    name: string | null;
  } | null;
};

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
      .in("status", ["pre-arrival", "on-stay"]),
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
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      room_number,
      check_in_date,
      check_out_date,
      status,
      guests (
        name
      )
      `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Error fetching recent reservations:", error);
  }

  const formattedData = ((data as RecentReservationRow[] | null) || []).map(
    (r) => ({
      ...r,
      guest_name: r.guests?.name || "Unknown Guest",
    }),
  );

  return formattedData;
}
