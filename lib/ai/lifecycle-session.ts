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
  lastActionType?: string | null;
  lastActionPayload?: Record<string, unknown> | null;
  touchInboundAt?: boolean;
  touchOutboundAt?: boolean;
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
    needs_human_follow_up: params.needsHumanFollowUp ?? false,
    last_action_type: params.lastActionType ?? null,
    last_action_payload: params.lastActionPayload ?? {},
    updated_at: now,
  };

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
