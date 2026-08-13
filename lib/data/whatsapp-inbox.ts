import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WhatsappConversation = {
  id: string;
  tenant_id: string;
  session_name: string;
  chat_id: string;
  conversation_key: string;
  normalized_phone: string | null;
  guest_id: string | null;
  reservation_id: string | null;
  display_name: string | null;
  is_archived: boolean;
  unread_count: number;
  last_message_preview: string | null;
  last_message_direction: "inbound" | "outbound" | null;
  last_message_at: string | null;
  last_seen_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  identity_title?: string;
  identity_subtitle?: string;
  room_number?: string | null;
  reservation_status?: string | null;
  lifecycle_stage?: string | null;
  lifecycle_session_status?: string | null;
  needs_human_follow_up?: boolean;
};

export type WhatsappMessage = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  session_name: string;
  chat_id: string;
  provider_message_id: string | null;
  client_message_id: string | null;
  idempotency_key: string | null;
  direction: "inbound" | "outbound";
  content: string;
  status: "sending" | "sent" | "failed" | "received";
  error_message: string | null;
  provider_response: Record<string, unknown> | null;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type InboxAdminClient = ReturnType<typeof createAdminClient>;
type GuestIdentity = { id: string; name: string | null; phone: string | null };
type ReservationIdentity = {
  id: string;
  guest_id: string;
  room_number: string | null;
  status: string | null;
};
type LifecycleIdentity = {
  reservation_id: string;
  lifecycle_stage: string;
  session_status: string;
  needs_human_follow_up: boolean;
};

type UpsertConversationInput = {
  tenantId: string;
  sessionName: string;
  chatId: string;
  conversationKey?: string;
  normalizedPhone?: string | null;
  displayName?: string | null;
  guestId?: string | null;
  reservationId?: string | null;
  metadata?: Record<string, unknown>;
};

type InsertMessageInput = {
  tenantId: string;
  conversationId: string;
  sessionName: string;
  chatId: string;
  providerMessageId?: string | null;
  clientMessageId?: string | null;
  idempotencyKey?: string | null;
  direction: "inbound" | "outbound";
  content: string;
  status: WhatsappMessage["status"];
  sentAt?: string | null;
  createdBy?: string | null;
  providerResponse?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

const CONVERSATION_SELECT = "id, tenant_id, session_name, chat_id, conversation_key, normalized_phone, guest_id, reservation_id, display_name, is_archived, unread_count, last_message_preview, last_message_direction, last_message_at, last_seen_message_at, metadata, created_at, updated_at";

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

function getMessageTime(message: Pick<InsertMessageInput, "sentAt">) {
  return message.sentAt ?? new Date().toISOString();
}

export function buildWhatsappConversationKey(
  normalizedPhone: string | null | undefined,
  chatId: string,
) {
  const phone = (normalizedPhone ?? "").replace(/\D/g, "");
  if (phone.length >= 8) return `phone:${phone}`;
  if (chatId.trim().toLowerCase().endsWith("@lid")) {
    return `lid:${chatId.trim().toLowerCase()}`;
  }
  return `chat:${chatId.trim().toLowerCase()}`;
}

function phoneCandidates(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return [];
  const candidates = new Set([digits]);
  if (digits.startsWith("62")) candidates.add(`0${digits.slice(2)}`);
  if (digits.startsWith("0")) candidates.add(`62${digits.slice(1)}`);
  if (digits.startsWith("8")) {
    candidates.add(`0${digits}`);
    candidates.add(`62${digits}`);
  }
  return [...candidates];
}

export async function resolveWhatsappConversationIdentity(
  supabase: InboxAdminClient,
  params: { tenantId: string; normalizedPhone?: string | null; guestId?: string | null; reservationId?: string | null; displayName?: string | null },
) {
  let guest: GuestIdentity | null = null;
  let reservation: ReservationIdentity | null = null;

  if (params.reservationId) {
    const { data } = await supabase
      .from("reservations")
      .select("id, guest_id, room_number, status, guests ( id, name, phone )")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.reservationId)
      .maybeSingle();
    if (data) {
      reservation = data as ReservationIdentity;
      const relation = (data as unknown as { guests?: GuestIdentity | GuestIdentity[] | null }).guests;
      guest = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
    }
  }

  if (!guest && params.guestId) {
    const { data } = await supabase
      .from("guests")
      .select("id, name, phone")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.guestId)
      .maybeSingle();
    guest = (data as GuestIdentity | null) ?? null;
  }

  if (!guest) {
    const candidates = phoneCandidates(params.normalizedPhone ?? null);
    const matches = new Map<string, GuestIdentity>();
    for (const candidate of candidates) {
      const { data } = await supabase
        .from("guests")
        .select("id, name, phone")
        .eq("tenant_id", params.tenantId)
        .ilike("phone", `%${candidate}%`)
        .limit(3);
      for (const row of (data ?? []) as GuestIdentity[]) matches.set(row.id, row);
    }
    if (matches.size === 1) guest = [...matches.values()][0];
  }

  if (!reservation && guest) {
    for (const status of ["on-stay", "pre-arrival", "checked-out"]) {
      const { data } = await supabase
        .from("reservations")
        .select("id, guest_id, room_number, status")
        .eq("tenant_id", params.tenantId)
        .eq("guest_id", guest.id)
        .eq("status", status)
        .order(status === "checked-out" ? "check_out_date" : "check_in_date", { ascending: status !== "checked-out" })
        .limit(1)
        .maybeSingle();
      if (data) {
        reservation = data as ReservationIdentity;
        break;
      }
    }
  }

  return {
    guestId: guest?.id ?? null,
    reservationId: reservation?.id ?? null,
    displayName: guest?.name?.trim() || params.displayName?.trim() || null,
    roomNumber: reservation?.room_number ?? null,
    reservationStatus: reservation?.status ?? null,
  };
}

async function enrichConversationRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversations: WhatsappConversation[],
) {
  const guestIds = conversations.flatMap((row) => row.guest_id ? [row.guest_id] : []);
  const reservationIds = conversations.flatMap((row) => row.reservation_id ? [row.reservation_id] : []);
  const [guestsResult, reservationsResult, sessionsResult] = await Promise.all([
    guestIds.length ? supabase.from("guests").select("id, name, phone").in("id", guestIds) : Promise.resolve({ data: [] }),
    reservationIds.length ? supabase.from("reservations").select("id, room_number, status").in("id", reservationIds) : Promise.resolve({ data: [] }),
    reservationIds.length ? supabase.from("lifecycle_ai_sessions").select("reservation_id, lifecycle_stage, session_status, needs_human_follow_up, updated_at").in("reservation_id", reservationIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const guests = new Map(((guestsResult.data ?? []) as GuestIdentity[]).map((row) => [row.id, row]));
  const reservations = new Map(((reservationsResult.data ?? []) as ReservationIdentity[]).map((row) => [row.id, row]));
  const sessions = new Map<string, LifecycleIdentity>();
  for (const row of (sessionsResult.data ?? []) as LifecycleIdentity[]) {
    if (!sessions.has(row.reservation_id)) sessions.set(row.reservation_id, row);
  }

  return conversations.map((conversation) => {
    const guest = conversation.guest_id ? guests.get(conversation.guest_id) : null;
    const reservation = conversation.reservation_id ? reservations.get(conversation.reservation_id) : null;
    const lifecycle = conversation.reservation_id ? sessions.get(conversation.reservation_id) : null;
    const title = guest?.name?.trim() || conversation.display_name?.trim() || conversation.normalized_phone || conversation.chat_id.split("@")[0];
    const subtitle = [
      conversation.normalized_phone,
      reservation?.room_number ? `Room ${reservation.room_number}` : null,
      reservation?.status ?? null,
      lifecycle?.session_status === "handoff" ? "Human handoff" : null,
    ].filter(Boolean).join(" · ");
    return { ...conversation, identity_title: title, identity_subtitle: subtitle || conversation.chat_id, room_number: reservation?.room_number ?? null, reservation_status: reservation?.status ?? null, lifecycle_stage: lifecycle?.lifecycle_stage ?? null, lifecycle_session_status: lifecycle?.session_status ?? null, needs_human_follow_up: lifecycle?.needs_human_follow_up ?? false };
  });
}

async function reconcileWhatsappConversationIdentity(
  conversation: WhatsappConversation,
) {
  if (
    conversation.guest_id ||
    conversation.reservation_id ||
    !conversation.normalized_phone
  ) {
    return conversation;
  }

  const admin = createAdminClient();
  const identity = await resolveWhatsappConversationIdentity(admin, {
    tenantId: conversation.tenant_id,
    normalizedPhone: conversation.normalized_phone,
    displayName: conversation.display_name,
  });

  if (!identity.guestId && !identity.reservationId && !identity.displayName) {
    return conversation;
  }

  return upsertWhatsappConversation(admin, {
    tenantId: conversation.tenant_id,
    sessionName: conversation.session_name,
    chatId: conversation.chat_id,
    normalizedPhone: conversation.normalized_phone,
    guestId: identity.guestId,
    reservationId: identity.reservationId,
    displayName: identity.displayName,
    metadata: { identity_source: "lazy_guest_phone_reconciliation" },
  });
}

export async function getWhatsappConversations(tenantId: string, limit = 50): Promise<WhatsappConversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_conversations").select(CONVERSATION_SELECT).eq("tenant_id", tenantId).eq("is_archived", false).order("last_message_at", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message || "Failed to load WhatsApp conversations");
  const reconciled = await Promise.all(
    ((data ?? []) as WhatsappConversation[]).map(reconcileWhatsappConversationIdentity),
  );
  return enrichConversationRows(supabase, reconciled);
}

export async function getWhatsappConversationById(tenantId: string, conversationId: string): Promise<WhatsappConversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_conversations").select(CONVERSATION_SELECT).eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (error) throw new Error(error.message || "Failed to load WhatsApp conversation");
  if (!data) return null;
  const reconciled = await reconcileWhatsappConversationIdentity(data as WhatsappConversation);
  return (await enrichConversationRows(supabase, [reconciled]))[0];
}

export async function getWhatsappMessages(tenantId: string, conversationId: string, limit = 50): Promise<WhatsappMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_messages").select("id, tenant_id, conversation_id, session_name, chat_id, provider_message_id, client_message_id, idempotency_key, direction, content, status, error_message, provider_response, created_by, sent_at, created_at, updated_at").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("sent_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message || "Failed to load WhatsApp messages");
  return (data ?? []) as WhatsappMessage[];
}

export async function upsertWhatsappConversation(supabase: InboxAdminClient, input: UpsertConversationInput): Promise<WhatsappConversation> {
  const conversationKey = input.conversationKey ?? buildWhatsappConversationKey(
    input.normalizedPhone,
    input.chatId,
  );
  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_conversations")
    .select(CONVERSATION_SELECT)
    .eq("tenant_id", input.tenantId)
    .eq("session_name", input.sessionName)
    .eq("conversation_key", conversationKey)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message || "Failed to read WhatsApp conversation");

  const previous = existing as WhatsappConversation | null;
  const previousAliases = Array.isArray(previous?.metadata?.provider_chat_ids)
    ? previous.metadata.provider_chat_ids.filter((value): value is string => typeof value === "string")
    : [];
  const preferredSendChatId = input.chatId.trim().toLowerCase().endsWith("@lid")
    ? input.chatId
    : typeof previous?.metadata?.preferred_send_chat_id === "string"
      ? previous.metadata.preferred_send_chat_id
      : input.chatId;
  const payload = {
    tenant_id: input.tenantId,
    session_name: input.sessionName,
    chat_id: preferredSendChatId,
    conversation_key: conversationKey,
    normalized_phone: input.normalizedPhone || previous?.normalized_phone || null,
    guest_id: input.guestId || previous?.guest_id || null,
    reservation_id: input.reservationId || previous?.reservation_id || null,
    display_name: input.displayName || previous?.display_name || null,
    metadata: {
      ...(previous?.metadata ?? {}),
      ...(input.metadata ?? {}),
      provider_chat_ids: Array.from(new Set([...previousAliases, input.chatId])),
      preferred_send_chat_id: preferredSendChatId,
    },
    updated_at: new Date().toISOString(),
  };
  const query = previous
    ? supabase.from("whatsapp_conversations").update(payload).eq("id", previous.id)
    : supabase.from("whatsapp_conversations").insert(payload);
  const { data, error } = await query.select(CONVERSATION_SELECT).single();

  if (isUniqueViolation(error) && !previous) {
    const { data: winner, error: winnerError } = await supabase
      .from("whatsapp_conversations")
      .select(CONVERSATION_SELECT)
      .eq("tenant_id", input.tenantId)
      .eq("session_name", input.sessionName)
      .eq("conversation_key", conversationKey)
      .single();
    if (winnerError || !winner) {
      throw new Error(winnerError?.message || "Failed to resolve WhatsApp conversation conflict");
    }
    const { data: updated, error: updateError } = await supabase
      .from("whatsapp_conversations")
      .update(payload)
      .eq("id", winner.id)
      .select(CONVERSATION_SELECT)
      .single();
    if (updateError || !updated) {
      throw new Error(updateError?.message || "Failed to update WhatsApp conversation conflict winner");
    }
    return updated as WhatsappConversation;
  }

  if (error || !data) throw new Error(error?.message || "Failed to save WhatsApp conversation");
  return data as WhatsappConversation;
}

export async function insertWhatsappMessage(supabase: InboxAdminClient, conversation: WhatsappConversation, input: InsertMessageInput): Promise<{ message: WhatsappMessage | null; duplicate: boolean }> {
  const idempotencyKey = input.idempotencyKey ?? (input.clientMessageId ? `client:${input.clientMessageId}` : input.providerMessageId ? `provider:${input.providerMessageId}` : null);
  const select = "id, tenant_id, conversation_id, session_name, chat_id, provider_message_id, client_message_id, idempotency_key, direction, content, status, error_message, provider_response, created_by, sent_at, created_at, updated_at";
  let existing: WhatsappMessage | null = null;
  if (input.providerMessageId) {
    const { data } = await supabase.from("whatsapp_messages").select(select).eq("tenant_id", input.tenantId).eq("session_name", input.sessionName).eq("provider_message_id", input.providerMessageId).maybeSingle();
    existing = data as WhatsappMessage | null;
  } else if (input.clientMessageId) {
    const { data } = await supabase.from("whatsapp_messages").select(select).eq("tenant_id", input.tenantId).eq("session_name", input.sessionName).eq("client_message_id", input.clientMessageId).maybeSingle();
    existing = data as WhatsappMessage | null;
  }

  // WAHA can echo fromMe before the send route has stored its provider ID.
  // Merge only a pending/sending same-content row in the same conversation.
  if (!existing && input.providerMessageId && input.direction === "outbound") {
    const { data } = await supabase.from("whatsapp_messages").select(select).eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).eq("direction", "outbound").eq("content", input.content).is("provider_message_id", null).in("status", ["sending", "sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    existing = data as WhatsappMessage | null;
  }

  if (existing) {
    const { data, error } = await supabase.from("whatsapp_messages").update({
      provider_message_id: input.providerMessageId ?? existing.provider_message_id,
      client_message_id: input.clientMessageId ?? existing.client_message_id,
      idempotency_key: idempotencyKey ?? existing.idempotency_key,
      status: input.status === "received" || input.status === "sent" ? input.status : existing.status,
      provider_response: input.providerResponse ?? existing.provider_response,
      sent_at: input.sentAt ?? existing.sent_at,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id).select(select).single();
    if (error || !data) throw new Error(error?.message || "Failed to reconcile WhatsApp message");
    return { message: data as WhatsappMessage, duplicate: true };
  }

  const { data, error } = await supabase.from("whatsapp_messages").insert({ tenant_id: input.tenantId, conversation_id: input.conversationId, session_name: input.sessionName, chat_id: input.chatId, provider_message_id: input.providerMessageId ?? null, client_message_id: input.clientMessageId ?? null, idempotency_key: idempotencyKey, direction: input.direction, content: input.content, status: input.status, sent_at: input.sentAt ?? null, created_by: input.createdBy ?? null, provider_response: input.providerResponse ?? null, error_message: input.errorMessage ?? null }).select(select).single();
  if (isUniqueViolation(error)) return { message: null, duplicate: true };
  if (error || !data) throw new Error(error?.message || "Failed to insert WhatsApp message");
  const message = data as WhatsappMessage;
  const time = getMessageTime(input);
  const messageTimestamp = new Date(time).getTime();
  const replacePreview = messageTimestamp >= (conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : 0);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (replacePreview) Object.assign(patch, { last_message_preview: input.content.slice(0, 500), last_message_direction: input.direction, last_message_at: time });
  if (input.direction === "inbound") patch.unread_count = conversation.unread_count + 1;
  const { error: conversationError } = await supabase.from("whatsapp_conversations").update(patch).eq("id", conversation.id).eq("tenant_id", conversation.tenant_id);
  if (conversationError) throw new Error(conversationError.message || "Failed to update WhatsApp conversation");
  return { message, duplicate: false };
}

export async function updateWhatsappMessageStatus(supabase: InboxAdminClient, params: { tenantId: string; messageId: string; status: "sent" | "failed"; providerMessageId?: string | null; providerResponse?: Record<string, unknown> | null; errorMessage?: string | null; sentAt?: string | null }): Promise<WhatsappMessage> {
  const { data, error } = await supabase.from("whatsapp_messages").update({ status: params.status, provider_message_id: params.providerMessageId ?? null, provider_response: params.providerResponse ?? null, error_message: params.errorMessage ?? null, sent_at: params.sentAt ?? null, updated_at: new Date().toISOString() }).eq("id", params.messageId).eq("tenant_id", params.tenantId).select("id, tenant_id, conversation_id, session_name, chat_id, provider_message_id, client_message_id, idempotency_key, direction, content, status, error_message, provider_response, created_by, sent_at, created_at, updated_at").single();
  if (error || !data) throw new Error(error?.message || "Failed to update WhatsApp message");
  return data as WhatsappMessage;
}

export async function markWhatsappConversationRead(supabase: InboxAdminClient, tenantId: string, conversationId: string) {
  const { error } = await supabase.from("whatsapp_conversations").update({ unread_count: 0, last_seen_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversationId).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message || "Failed to mark WhatsApp conversation read");
}
