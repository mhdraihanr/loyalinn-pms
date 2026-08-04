import { createClient } from "@/lib/supabase/server";

export type HumanHandoff = {
  id: string;
  reservation_id: string;
  guest_id: string | null;
  lifecycle_stage: "pre-arrival" | "on-stay" | "post-stay";
  session_status: "active" | "resolved" | "handoff";
  needs_human_follow_up: boolean;
  handoff_priority: "normal" | "high";
  handoff_reason: string | null;
  handoff_version: number;
  last_action_type: string | null;
  last_action_payload: Record<string, unknown> | null;
  last_inbound_message_at: string | null;
  last_outbound_message_at: string | null;
  last_manual_reply_at: string | null;
  last_refreshed_at: string | null;
  last_refresh_error: string | null;
  waha_session_name: string | null;
  waha_chat_id: string | null;
  waha_phone_chat_id: string | null;
  waha_lid: string | null;
  updated_at: string;
  guests: { name: string | null; phone: string | null } | null;
  reservations: { room_number: string | null; status: string | null } | null;
};

export type HandoffTranscriptMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  source: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
};

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
      guest_id,
      guests ( name, phone )
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
      guest_id,
      guests ( name, phone )
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
      guest_id,
      guests ( name, phone ),
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

export async function getHumanHandoffs(tenantId: string): Promise<HumanHandoff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lifecycle_ai_sessions")
    .select(`
      id,
      reservation_id,
      guest_id,
      lifecycle_stage,
      session_status,
      needs_human_follow_up,
      handoff_priority,
      handoff_reason,
      handoff_version,
      last_action_type,
      last_action_payload,
      last_inbound_message_at,
      last_outbound_message_at,
      last_manual_reply_at,
      last_refreshed_at,
      last_refresh_error,
      waha_session_name,
      waha_chat_id,
      waha_phone_chat_id,
      waha_lid,
      updated_at,
      guests ( name, phone ),
      reservations ( room_number, status )
    `)
    .eq("tenant_id", tenantId)
    .eq("session_status", "handoff")
    .eq("needs_human_follow_up", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching human handoffs:", error);
    return [];
  }

  return (data ?? []) as unknown as HumanHandoff[];
}

export async function getHumanHandoffTranscript(
  tenantId: string,
  handoffId: string,
) {
  const supabase = await createClient();
  const { data: handoff, error: handoffError } = await supabase
    .from("lifecycle_ai_sessions")
    .select("id, reservation_id, lifecycle_stage")
    .eq("tenant_id", tenantId)
    .eq("id", handoffId)
    .maybeSingle();

  if (handoffError || !handoff) {
    return [] as HandoffTranscriptMessage[];
  }

  const { data, error } = await supabase
    .from("message_logs")
    .select("id, direction, content, status, source, sent_at, created_at, error_message")
    .eq("tenant_id", tenantId)
    .eq("reservation_id", handoff.reservation_id)
    .eq("trigger_type", handoff.lifecycle_stage)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching human handoff transcript:", error);
    return [] as HandoffTranscriptMessage[];
  }

  return (data ?? []) as HandoffTranscriptMessage[];
}
