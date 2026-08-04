import type { SupabaseClient } from "@supabase/supabase-js";

export type LifecycleStage = "pre-arrival" | "on-stay" | "post-stay";
export type LifecycleSessionStatus = "active" | "resolved" | "handoff";
export type LifecycleLanguage = "id" | "en";

type LifecycleSessionUpsertParams = {
  tenantId: string;
  reservationId: string;
  guestId: string | null;
  stage: LifecycleStage;
  sessionStatus?: LifecycleSessionStatus;
  needsHumanFollowUp?: boolean;
  clarificationCount?: number;
  wahaSessionName?: string | null;
  wahaChatId?: string | null;
  wahaPhoneChatId?: string | null;
  wahaLid?: string | null;
  handoffPriority?: "normal" | "high";
  handoffReason?: string | null;
  lastActionType?: string | null;
  lastActionPayload?: Record<string, unknown> | null;
  touchInboundAt?: boolean;
  touchOutboundAt?: boolean;
};

export type LifecycleSessionState = {
  sessionStatus: LifecycleSessionStatus;
  clarificationCount: number;
};

function isMissingLifecycleSessionTableError(
  error: {
    message?: string;
  } | null,
) {
  if (!error?.message) {
    return false;
  }

  return /relation\s+"?lifecycle_ai_sessions"?\s+does not exist/i.test(
    error.message,
  );
}

export async function getLifecycleAiSessionState(
  supabase: SupabaseClient,
  params: Pick<LifecycleSessionUpsertParams, "tenantId" | "reservationId" | "stage">,
): Promise<LifecycleSessionState | null> {
  const { data, error } = await supabase
    .from("lifecycle_ai_sessions")
    .select("session_status, clarification_count")
    .eq("tenant_id", params.tenantId)
    .eq("reservation_id", params.reservationId)
    .eq("lifecycle_stage", params.stage)
    .maybeSingle();

  if (!error) {
    if (!data) {
      return null;
    }

    return {
      sessionStatus: data.session_status as LifecycleSessionStatus,
      clarificationCount: Number(data.clarification_count ?? 0),
    };
  }

  if (isMissingLifecycleSessionTableError(error) || /no rows|not found/i.test(error.message ?? "")) {
    return null;
  }

  throw new Error(error.message || "Failed to read lifecycle AI session");
}

export async function upsertLifecycleAiSession(
  supabase: SupabaseClient,
  params: LifecycleSessionUpsertParams,
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    tenant_id: params.tenantId,
    reservation_id: params.reservationId,
    guest_id: params.guestId,
    lifecycle_stage: params.stage,
    session_status: params.sessionStatus ?? "active",
    updated_at: now,
  };

  if ("needsHumanFollowUp" in params) {
    payload.needs_human_follow_up = params.needsHumanFollowUp ?? false;
  }

  if ("clarificationCount" in params) {
    payload.clarification_count = params.clarificationCount ?? 0;
  }

  if ("wahaSessionName" in params) {
    payload.waha_session_name = params.wahaSessionName ?? null;
  }

  if ("wahaChatId" in params) {
    payload.waha_chat_id = params.wahaChatId ?? null;
  }

  if ("wahaPhoneChatId" in params) {
    payload.waha_phone_chat_id = params.wahaPhoneChatId ?? null;
  }

  if ("wahaLid" in params) {
    payload.waha_lid = params.wahaLid ?? null;
  }

  if ("handoffPriority" in params) {
    payload.handoff_priority = params.handoffPriority ?? "normal";
  }

  if ("handoffReason" in params) {
    payload.handoff_reason = params.handoffReason ?? null;
  }

  if ("lastActionType" in params) {
    payload.last_action_type = params.lastActionType ?? null;
  }

  if ("lastActionPayload" in params) {
    payload.last_action_payload = params.lastActionPayload ?? {};
  }

  if (params.touchInboundAt) {
    payload.last_inbound_message_at = now;
  }

  if (params.touchOutboundAt) {
    payload.last_outbound_message_at = now;
  }

  const { error } = await supabase
    .from("lifecycle_ai_sessions")
    .upsert(payload, {
      onConflict: "tenant_id,reservation_id,lifecycle_stage",
    });

  if (!error || isMissingLifecycleSessionTableError(error)) {
    return;
  }

  throw new Error(error.message || "Failed to upsert lifecycle AI session");
}
