import { createClient } from "@/lib/supabase/server";

export async function getReservations(tenantId: string, status?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(
      `
      id,
      pms_reservation_id,
      room_number,
      check_in_date,
      check_out_date,
      status,
      amount,
      source,
      created_at,
      guests (
        name,
        email,
        phone
      )
    `,
    )
    .eq("tenant_id", tenantId)
    .order("check_in_date", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching reservations:", error);
    return [];
  }

  // Define a proper type since we populated guests
  type ReservationWithGuest = {
    id: string;
    pms_reservation_id: string | null;
    room_number: string | null;
    check_in_date: string;
    check_out_date: string;
    status: string;
    amount: number | null;
    source: string | null;
    created_at: string;
    guests: {
      name: string;
      email: string | null;
      phone: string | null;
    } | null;
  };

  return data as unknown as ReservationWithGuest[];
}
