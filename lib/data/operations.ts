import { createClient } from "@/lib/supabase/server";

export async function getHousekeepingRequests(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("housekeeping_requests")
    .select(`
      id,
      room_number,
      request_type,
      details,
      status,
      created_at,
      updated_at,
      reservation_id,
      guests ( name )
    `)
    .eq("tenant_id", tenantId)
    .or(`status.in.(pending,in-progress),and(status.eq.completed,updated_at.gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()})`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching housekeeping requests:", error);
    return [];
  }

  return data;
}

export async function getRoomServiceOrders(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("room_service_orders")
    .select(`
      id,
      room_number,
      items,
      total_amount,
      status,
      created_at,
      updated_at,
      reservation_id,
      guests ( name )
    `)
    .eq("tenant_id", tenantId)
    .or(`status.in.(pending,in-progress),and(status.eq.completed,updated_at.gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()})`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching room service orders:", error);
    return [];
  }

  return data;
}

export async function getArrivalRequests(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("arrival_requests")
    .select(`
      id,
      room_number,
      request_type,
      eta,
      requested_time,
      details,
      status,
      created_at,
      updated_at,
      reservation_id,
      guests ( name ),
      reservations ( check_in_date )
    `)
    .eq("tenant_id", tenantId)
    .or(`status.in.(pending,in-progress),and(status.eq.resolved,updated_at.gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()})`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching arrival requests:", error);
    return [];
  }

  return data;
}
