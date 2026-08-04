import { enqueueStatusTriggerAutomationJobIfMissing } from "@/lib/automation/queue";
import { escalatePendingFeedbackToAiFollowup } from "@/lib/automation/feedback-escalation";
import { createAdminClient } from "@/lib/supabase/admin";

type SchedulerResult = {
  preArrivalEnqueued: number;
  postStayEnqueued: number;
  aiFollowupEscalated: number;
};

type ScheduledReservation = {
  id: string;
  tenant_id: string;
  pms_reservation_id: string | null;
  check_in_date?: string;
};

type PostStayRecoveryEvent = {
  id: string;
  tenant_id: string;
  event_type: string;
  source: string;
  payload: {
    reservation_id?: string;
    booking_id?: string;
    previous_status?: string | null;
    status?: string;
    occurred_at?: string | null;
  };
};

const POST_STAY_RECOVERY_LOOKBACK_HOURS = 48;

function toIsoDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function addDays(baseTime: Date, days: number) {
  const next = new Date(baseTime);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function isPostStayTransition(event: PostStayRecoveryEvent) {
  return (
    Boolean(event.payload.reservation_id) &&
    Boolean(event.payload.booking_id) &&
    Boolean(event.payload.previous_status) &&
    event.payload.previous_status !== "checked-out" &&
    event.payload.status === "checked-out"
  );
}

type SchedulerOptions = {
  force?: boolean;
  adminClient?: ReturnType<typeof createAdminClient>;
  escalatePendingFeedback?: (now: Date) => Promise<number>;
};

export async function enqueueScheduledAutomationJobs(
  now = new Date(),
  options: SchedulerOptions = {},
): Promise<SchedulerResult> {
  const aiFollowupEscalated = await (
    options.escalatePendingFeedback ?? escalatePendingFeedbackToAiFollowup
  )(now);
  const adminClient = options.adminClient ?? createAdminClient();
  const { data: preArrivalReservations, error: preArrivalError } =
    await adminClient
      .from("reservations")
      .select("id, tenant_id, pms_reservation_id, check_in_date")
      .eq("status", "pre-arrival");

  if (preArrivalError) {
    throw new Error(preArrivalError.message);
  }

  const expectedPreArrivalDate = toIsoDate(addDays(now, 1));
  let preArrivalEnqueued = 0;

  for (const reservation of (preArrivalReservations ??
    []) as ScheduledReservation[]) {
    if (reservation.check_in_date !== expectedPreArrivalDate) {
      continue;
    }

    const result = await enqueueStatusTriggerAutomationJobIfMissing({
      tenantId: reservation.tenant_id,
      reservationId: reservation.id,
      triggerType: "pre-arrival",
      payload: {
        booking_id: reservation.pms_reservation_id ?? "",
        status: "pre-arrival",
      },
      adminClient,
    });

    if (result.enqueued) {
      preArrivalEnqueued += 1;
    }
  }

  const recoverySince = new Date(
    now.getTime() - POST_STAY_RECOVERY_LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data: recoveryEvents, error: recoveryError } = await adminClient
    .from("inbound_events")
    .select("id, tenant_id, event_type, source, payload")
    .in("source", ["qloapps", "qloapps-poll"])
    .gte("received_at", recoverySince);

  if (recoveryError) {
    throw new Error(recoveryError.message);
  }

  let postStayEnqueued = 0;
  for (const event of (recoveryEvents ?? []) as PostStayRecoveryEvent[]) {
    if (!isPostStayTransition(event)) {
      continue;
    }

    const result = await enqueueStatusTriggerAutomationJobIfMissing({
      tenantId: event.tenant_id,
      reservationId: event.payload.reservation_id as string,
      triggerType: "post-stay",
      payload: {
        inbound_event_id: event.id,
        event_type: event.event_type,
        booking_id: event.payload.booking_id,
        status: "checked-out",
        previous_status: event.payload.previous_status ?? null,
        updated_at: event.payload.occurred_at ?? null,
      },
      adminClient,
    });

    if (result.enqueued) {
      postStayEnqueued += 1;
    }
  }

  return {
    preArrivalEnqueued,
    postStayEnqueued,
    aiFollowupEscalated,
  };
}
