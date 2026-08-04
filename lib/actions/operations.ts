"use server";

import { revalidatePath } from "next/cache";
import { requireUserTenant } from "@/lib/auth/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LifecycleStage } from "@/lib/ai/lifecycle-session";
import { upsertLifecycleAiSession } from "@/lib/ai/lifecycle-session";
import { wahaClient } from "@/lib/waha/client";

function extractProviderMessageId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

async function getHandoffForAction(handoffId: string) {
  const userTenant = await requireUserTenant();
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("lifecycle_ai_sessions")
    .select("id, tenant_id, reservation_id, guest_id, lifecycle_stage, session_status, needs_human_follow_up, handoff_version, waha_session_name, waha_chat_id, waha_phone_chat_id, waha_lid, guests(phone)")
    .eq("id", handoffId)
    .eq("tenant_id", userTenant.tenantId)
    .maybeSingle();

  if (error || !data) {
    return { userTenant, adminClient, handoff: null, error: "Handoff tidak ditemukan." };
  }

  return { userTenant, adminClient, handoff: data, error: null };
}

function resolveChatIdentity(handoff: {
  waha_session_name?: string | null;
  waha_chat_id?: string | null;
  waha_phone_chat_id?: string | null;
  waha_lid?: string | null;
  guests?: { phone?: string | null } | Array<{ phone?: string | null }> | null;
}) {
  const guest = Array.isArray(handoff.guests) ? handoff.guests[0] : handoff.guests;
  return {
    session: handoff.waha_session_name || "default",
    chatId:
      handoff.waha_chat_id ||
      handoff.waha_phone_chat_id ||
      handoff.waha_lid ||
      guest?.phone ||
      null,
  };
}

export type OperationChatType = "housekeeping" | "room-service" | "arrival-requests";

export type OperationChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  source: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
};

export type OperationChatDetail = {
  operationType: OperationChatType;
  operationId: string;
  reservationId: string | null;
  guestId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  roomNumber: string | null;
  status: string | null;
  lifecycleStage: LifecycleStage;
  summary: Array<{ label: string; value: string }>;
  messages: OperationChatMessage[];
  usedFallbackTranscript: boolean;
  canReply: boolean;
  replyDisabledReason: string | null;
};

type Relation<T> = T | T[] | null | undefined;

type OperationRow = Record<string, unknown> & {
  id: string;
  reservation_id?: string | null;
  guest_id?: string | null;
  room_number?: string | null;
  status?: string | null;
  guests?: Relation<{ name?: string | null; phone?: string | null }>;
  reservations?: Relation<{ check_in_date?: string | null }>;
};

function getRelation<T>(relation: Relation<T>): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function stringifyAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value)
    : null;
}

function getOperationStage(operationType: OperationChatType): LifecycleStage {
  return operationType === "arrival-requests" ? "pre-arrival" : "on-stay";
}

function getOperationLabel(operationType: OperationChatType) {
  if (operationType === "housekeeping") return "Housekeeping";
  if (operationType === "room-service") return "Room Service";
  return "Arrival Request";
}

function formatHousekeepingTypeLabel(requestType: string) {
  const labels: Record<string, string> = {
    cleaning: "Cleaning",
    towels: "Fresh Towels",
    amenities: "Amenities",
    laundry: "Laundry",
    turndown: "Turndown",
    maintenance: "Maintenance",
  };

  return (
    labels[requestType] ??
    requestType
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function buildOperationSummary(operationType: OperationChatType, row: OperationRow) {
  if (operationType === "housekeeping") {
    const details = toRecord(row.details);
    const extraItems = Array.isArray(details?.extra_items)
      ? details.extra_items.filter((item) => typeof item === "string").join(", ")
      : null;

    return [
      { label: "Queue", value: getOperationLabel(operationType) },
      {
        label: "Type",
        value: formatHousekeepingTypeLabel(getString(row.request_type) ?? "housekeeping"),
      },
      { label: "Details", value: getString(details?.details) ?? "-" },
      ...(extraItems ? [{ label: "Extra items", value: extraItems }] : []),
    ];
  }

  if (operationType === "room-service") {
    const items = Array.isArray(row.items)
      ? row.items
          .map((item) => {
            const record = toRecord(item);
            if (!record) return null;
            const name = getString(record.name) ?? "Item";
            const quantity = Number(record.quantity ?? 1);
            const notes = getString(record.notes);
            return `${Number.isFinite(quantity) ? quantity : 1}x ${name}${notes ? ` (${notes})` : ""}`;
          })
          .filter(Boolean)
          .join("; ")
      : null;

    return [
      { label: "Queue", value: getOperationLabel(operationType) },
      { label: "Items", value: items || "-" },
      { label: "Total", value: stringifyAmount(row.total_amount) ?? "-" },
    ];
  }

  const details = toRecord(row.details);
  const reservation = getRelation(row.reservations);
  return [
    { label: "Queue", value: getOperationLabel(operationType) },
    {
      label: "Request",
      value: getString(row.request_type) === "early_checkin" ? "Early Check-in" : "Arrival ETA",
    },
    { label: "ETA", value: getString(row.eta) ?? "-" },
    { label: "Requested", value: getString(row.requested_time) ?? "-" },
    { label: "Check-in", value: getString(reservation?.check_in_date) ?? "-" },
    { label: "Details", value: getString(details?.notes) ?? getString(details?.reason) ?? "-" },
  ];
}

function isMissingLifecycleSessionTableError(error: { message?: string } | null) {
  return /relation\s+"?lifecycle_ai_sessions"?\s+does not exist/i.test(
    error?.message ?? "",
  );
}

async function getOperationRow(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  operationType: OperationChatType,
  operationId: string,
): Promise<OperationRow | null> {
  if (operationType === "housekeeping") {
    const { data, error } = await adminClient
      .from("housekeeping_requests")
      .select("id, reservation_id, guest_id, room_number, request_type, details, status, guests(name, phone)")
      .eq("id", operationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message || "Gagal membaca housekeeping request.");
    return (data as OperationRow | null) ?? null;
  }

  if (operationType === "room-service") {
    const { data, error } = await adminClient
      .from("room_service_orders")
      .select("id, reservation_id, guest_id, room_number, items, total_amount, status, guests(name, phone)")
      .eq("id", operationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message || "Gagal membaca room service order.");
    return (data as OperationRow | null) ?? null;
  }

  const { data, error } = await adminClient
    .from("arrival_requests")
    .select("id, reservation_id, guest_id, room_number, request_type, eta, requested_time, details, status, guests(name, phone), reservations(check_in_date)")
    .eq("id", operationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Gagal membaca arrival request.");
  return (data as OperationRow | null) ?? null;
}

async function getOperationLifecycleSession(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  reservationId: string | null,
  stage: LifecycleStage,
) {
  if (!reservationId) return null;

  const { data, error } = await adminClient
    .from("lifecycle_ai_sessions")
    .select("id, waha_session_name, waha_chat_id, waha_phone_chat_id, waha_lid")
    .eq("tenant_id", tenantId)
    .eq("reservation_id", reservationId)
    .eq("lifecycle_stage", stage)
    .maybeSingle();

  if (!error) return data;
  if (isMissingLifecycleSessionTableError(error)) return null;
  throw new Error(error.message || "Gagal membaca lifecycle chat identity.");
}

async function getOperationTranscript(
  adminClient: ReturnType<typeof createAdminClient>,
  tenantId: string,
  reservationId: string | null,
  stage: LifecycleStage,
) {
  if (!reservationId) {
    return { messages: [] as OperationChatMessage[], usedFallbackTranscript: false };
  }

  const select = "id, direction, content, status, source, sent_at, created_at, error_message";
  const { data: stageMessages, error: stageError } = await adminClient
    .from("message_logs")
    .select(select)
    .eq("tenant_id", tenantId)
    .eq("reservation_id", reservationId)
    .eq("trigger_type", stage)
    .order("created_at", { ascending: true });

  if (stageError) throw new Error(stageError.message || "Gagal membaca transcript chat.");
  if ((stageMessages ?? []).length > 0) {
    return {
      messages: (stageMessages ?? []) as OperationChatMessage[],
      usedFallbackTranscript: false,
    };
  }

  const { data: fallbackMessages, error: fallbackError } = await adminClient
    .from("message_logs")
    .select(select)
    .eq("tenant_id", tenantId)
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true });

  if (fallbackError) throw new Error(fallbackError.message || "Gagal membaca transcript chat.");
  return {
    messages: (fallbackMessages ?? []) as OperationChatMessage[],
    usedFallbackTranscript: (fallbackMessages ?? []).length > 0,
  };
}

async function getOperationChatContext(operationType: OperationChatType, operationId: string) {
  const userTenant = await requireUserTenant();
  const adminClient = createAdminClient();
  const stage = getOperationStage(operationType);
  const row = await getOperationRow(
    adminClient,
    userTenant.tenantId,
    operationType,
    operationId,
  );

  if (!row) {
    return {
      userTenant,
      adminClient,
      stage,
      row: null,
      lifecycleSession: null,
      guest: null,
      error: "Operasi tidak ditemukan.",
    };
  }

  const guest = getRelation(row.guests);
  const lifecycleSession = await getOperationLifecycleSession(
    adminClient,
    userTenant.tenantId,
    row.reservation_id ?? null,
    stage,
  );

  return {
    userTenant,
    adminClient,
    stage,
    row,
    lifecycleSession,
    guest,
    error: null,
  };
}

export async function updateHousekeepingStatus(
  id: string,
  status: "pending" | "in-progress" | "completed" | "cancelled",
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();
  const { error } = await supabase
    .from("housekeeping_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/operations");
  return { success: true };
}

export async function updateRoomServiceStatus(
  id: string,
  status: "pending" | "in-progress" | "completed" | "cancelled",
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_service_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/operations");
  return { success: true };
}

export async function updateArrivalRequestStatus(
  id: string,
  status: "pending" | "in-progress" | "resolved" | "cancelled",
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();
  const { error } = await supabase
    .from("arrival_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/operations");
  return { success: true };
}

function isOperationChatType(value: string): value is OperationChatType {
  return value === "housekeeping" || value === "room-service" || value === "arrival-requests";
}

export async function getOperationChatDetail(params: {
  operationType: OperationChatType;
  operationId: string;
}): Promise<{ success: true; detail: OperationChatDetail } | { success: false; error: string }> {
  if (!isOperationChatType(params.operationType)) {
    return { success: false, error: "Tipe operasi tidak valid." };
  }

  const { userTenant, adminClient, stage, row, lifecycleSession, guest, error } =
    await getOperationChatContext(params.operationType, params.operationId);

  if (!row) return { success: false, error: error ?? "Operasi tidak ditemukan." };

  const { messages, usedFallbackTranscript } = await getOperationTranscript(
    adminClient,
    userTenant.tenantId,
    row.reservation_id ?? null,
    stage,
  );
  const identity = resolveChatIdentity({
    waha_session_name: lifecycleSession?.waha_session_name ?? null,
    waha_chat_id: lifecycleSession?.waha_chat_id ?? null,
    waha_phone_chat_id: lifecycleSession?.waha_phone_chat_id ?? null,
    waha_lid: lifecycleSession?.waha_lid ?? null,
    guests: guest,
  });

  const canReply = Boolean(row.reservation_id && identity.chatId);
  const replyDisabledReason = !row.reservation_id
    ? "Reservasi untuk operasi ini tidak tersedia."
    : !identity.chatId
      ? "Identitas chat WhatsApp belum tersedia."
      : null;

  return {
    success: true,
    detail: {
      operationType: params.operationType,
      operationId: row.id,
      reservationId: row.reservation_id ?? null,
      guestId: row.guest_id ?? null,
      guestName: guest?.name ?? null,
      guestPhone: guest?.phone ?? null,
      roomNumber: row.room_number ?? null,
      status: row.status ?? null,
      lifecycleStage: stage,
      summary: buildOperationSummary(params.operationType, row),
      messages,
      usedFallbackTranscript,
      canReply,
      replyDisabledReason,
    },
  };
}

export async function sendOperationChatReply(params: {
  operationType: OperationChatType;
  operationId: string;
  content: string;
}) {
  if (!isOperationChatType(params.operationType)) {
    return { success: false, error: "Tipe operasi tidak valid." };
  }

  const trimmed = params.content.trim();
  if (!trimmed || trimmed.length > 4000) {
    return { success: false, error: "Pesan harus berisi 1 sampai 4000 karakter." };
  }

  const { userTenant, adminClient, stage, row, lifecycleSession, guest, error } =
    await getOperationChatContext(params.operationType, params.operationId);

  if (!row) return { success: false, error: error ?? "Operasi tidak ditemukan." };
  if (!row.reservation_id) {
    return { success: false, error: "Reservasi untuk operasi ini tidak tersedia." };
  }

  const identity = resolveChatIdentity({
    waha_session_name: lifecycleSession?.waha_session_name ?? null,
    waha_chat_id: lifecycleSession?.waha_chat_id ?? null,
    waha_phone_chat_id: lifecycleSession?.waha_phone_chat_id ?? null,
    waha_lid: lifecycleSession?.waha_lid ?? null,
    guests: guest,
  });

  if (!identity.chatId) {
    return { success: false, error: "Identitas chat WhatsApp belum tersedia." };
  }

  const now = new Date().toISOString();
  const { data: pendingLog, error: pendingError } = await adminClient
    .from("message_logs")
    .insert({
      tenant_id: userTenant.tenantId,
      reservation_id: row.reservation_id,
      guest_id: row.guest_id ?? null,
      phone: identity.chatId,
      content: trimmed,
      direction: "outbound",
      status: "pending",
      trigger_type: stage,
      provider_session_name: identity.session,
      provider_chat_id: identity.chatId,
      source: "human",
      manual_actor_user_id: userTenant.userId,
    })
    .select("id")
    .single();

  if (pendingError || !pendingLog) {
    return { success: false, error: pendingError?.message || "Gagal membuat log pesan manual." };
  }

  try {
    const providerResponse = await wahaClient.sendMessage(
      identity.session,
      identity.chatId,
      trimmed,
    );
    const { data: sentLog, error: sentError } = await adminClient
      .from("message_logs")
      .update({
        status: "sent",
        sent_at: now,
        provider_message_id: extractProviderMessageId(providerResponse),
        provider_response: providerResponse,
      })
      .eq("id", pendingLog.id)
      .eq("tenant_id", userTenant.tenantId)
      .select("id, direction, content, status, source, sent_at, created_at, error_message")
      .single();
    if (sentError) throw sentError;

    await upsertLifecycleAiSession(adminClient, {
      tenantId: userTenant.tenantId,
      reservationId: row.reservation_id,
      guestId: row.guest_id ?? null,
      stage,
      wahaSessionName: identity.session,
      wahaChatId: identity.chatId,
      sessionStatus: "handoff",
      needsHumanFollowUp: true,
      lastActionType: "manual_operation_reply_sent",
      lastActionPayload: {
        operationType: params.operationType,
        operationId: row.id,
      },
      touchOutboundAt: true,
    });

    const { error: sessionUpdateError } = await adminClient
      .from("lifecycle_ai_sessions")
      .update({
        last_manual_reply_at: now,
        updated_at: now,
      })
      .eq("tenant_id", userTenant.tenantId)
      .eq("reservation_id", row.reservation_id)
      .eq("lifecycle_stage", stage);

    if (sessionUpdateError && !isMissingLifecycleSessionTableError(sessionUpdateError)) {
      throw sessionUpdateError;
    }

    revalidatePath("/operations");
    return { success: true, message: sentLog as OperationChatMessage };
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "Gagal mengirim pesan WhatsApp.";
    await adminClient
      .from("message_logs")
      .update({ status: "failed", error_message: message })
      .eq("id", pendingLog.id)
      .eq("tenant_id", userTenant.tenantId);
    return { success: false, error: message };
  }
}

export async function refreshHandoffChat(handoffId: string) {
  const { adminClient, handoff, error } = await getHandoffForAction(handoffId);
  if (!handoff) return { success: false, fallback: true, error };

  const { session, chatId } = resolveChatIdentity(handoff);
  if (!chatId) {
    return { success: false, fallback: true, error: "Identitas chat WhatsApp belum tersedia." };
  }

  try {
    const messages = await wahaClient.getChatMessages(session, chatId, {
      limit: 50,
      downloadMedia: false,
    });
    const now = new Date().toISOString();
    await adminClient
      .from("lifecycle_ai_sessions")
      .update({ last_refreshed_at: now, last_refresh_error: null, updated_at: now })
      .eq("id", handoff.id)
      .eq("tenant_id", handoff.tenant_id);
    revalidatePath("/operations");
    return { success: true, fallback: false, messageCount: messages.length };
  } catch (refreshError) {
    const message = refreshError instanceof Error ? refreshError.message : "WAHA chat refresh gagal.";
    await adminClient
      .from("lifecycle_ai_sessions")
      .update({ last_refresh_error: message, updated_at: new Date().toISOString() })
      .eq("id", handoff.id)
      .eq("tenant_id", handoff.tenant_id);
    revalidatePath("/operations");
    return { success: false, fallback: true, error: "WAHA tidak tersedia; menampilkan transcript database." };
  }
}

export async function sendManualHandoffReply(
  handoffId: string,
  content: string,
  expectedVersion: number,
) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 4000) {
    return { success: false, error: "Pesan harus berisi 1 sampai 4000 karakter." };
  }

  const { userTenant, adminClient, handoff, error } = await getHandoffForAction(handoffId);
  if (!handoff) return { success: false, error };
  if (handoff.session_status !== "handoff" || !handoff.needs_human_follow_up) {
    return { success: false, error: "Handoff ini sudah tidak aktif." };
  }
  if (Number(handoff.handoff_version ?? 0) !== expectedVersion) {
    return { success: false, error: "Handoff telah berubah. Refresh terlebih dahulu." };
  }

  const { session, chatId } = resolveChatIdentity(handoff);
  if (!chatId) return { success: false, error: "Identitas chat WhatsApp belum tersedia." };

  const now = new Date().toISOString();
  const { data: pendingLog, error: pendingError } = await adminClient
    .from("message_logs")
    .insert({
      tenant_id: userTenant.tenantId,
      reservation_id: handoff.reservation_id,
      guest_id: handoff.guest_id,
      phone: chatId,
      content: trimmed,
      direction: "outbound",
      status: "pending",
      trigger_type: handoff.lifecycle_stage,
      provider_session_name: session,
      provider_chat_id: chatId,
      source: "human",
      manual_actor_user_id: userTenant.userId,
    })
    .select("id")
    .single();

  if (pendingError || !pendingLog) {
    return { success: false, error: pendingError?.message || "Gagal membuat log pesan manual." };
  }

  try {
    const providerResponse = await wahaClient.sendMessage(session, chatId, trimmed);
    const { error: sentError } = await adminClient
      .from("message_logs")
      .update({
        status: "sent",
        sent_at: now,
        provider_message_id: extractProviderMessageId(providerResponse),
        provider_response: providerResponse,
      })
      .eq("id", pendingLog.id)
      .eq("tenant_id", userTenant.tenantId);
    if (sentError) throw sentError;

    const { data: updated, error: updateError } = await adminClient
      .from("lifecycle_ai_sessions")
      .update({
        last_manual_reply_at: now,
        last_outbound_message_at: now,
        last_action_type: "manual_handoff_reply_sent",
        handoff_version: expectedVersion + 1,
        updated_at: now,
      })
      .eq("id", handoff.id)
      .eq("tenant_id", userTenant.tenantId)
      .eq("session_status", "handoff")
      .eq("handoff_version", expectedVersion)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      return { success: false, error: "Pesan terkirim, tetapi handoff telah berubah. Refresh status handoff." };
    }
    revalidatePath("/operations");
    return { success: true };
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "Gagal mengirim pesan WhatsApp.";
    await adminClient
      .from("message_logs")
      .update({ status: "failed", error_message: message })
      .eq("id", pendingLog.id)
      .eq("tenant_id", userTenant.tenantId);
    return { success: false, error: message };
  }
}

export async function resolveHumanHandoff(handoffId: string, expectedVersion: number) {
  const { userTenant, adminClient, handoff, error } = await getHandoffForAction(handoffId);
  if (!handoff) return { success: false, error };

  const now = new Date().toISOString();
  const { data, error: updateError } = await adminClient
    .from("lifecycle_ai_sessions")
    .update({
      session_status: "resolved",
      needs_human_follow_up: false,
      resolved_at: now,
      resolved_by: userTenant.userId,
      last_action_type: "manual_handoff_resolved",
      handoff_version: expectedVersion + 1,
      updated_at: now,
    })
    .eq("id", handoff.id)
    .eq("tenant_id", userTenant.tenantId)
    .eq("session_status", "handoff")
    .eq("handoff_version", expectedVersion)
    .select("id")
    .maybeSingle();

  if (updateError || !data) {
    return { success: false, error: "Handoff telah berubah atau diselesaikan operator lain." };
  }
  revalidatePath("/operations");
  return { success: true };
}
