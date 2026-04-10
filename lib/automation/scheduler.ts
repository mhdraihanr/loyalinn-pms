import { createAdminClient } from "@/lib/supabase/admin";

type SchedulerResult = {
  preArrivalEnqueued: number;
  postStayEnqueued: number;
};

type ScheduledReservation = {
  id: string;
  tenant_id: string;
  pms_reservation_id: string | null;
  check_in_date?: string;
  check_out_date?: string;
};

function toIsoDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function addDays(baseTime: Date, days: number) {
  const next = new Date(baseTime);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function isSchedulingWindowOpen(now: Date) {
  return now.getUTCHours() >= 10;
}

async function enqueueIfMissing(
  reservation: ScheduledReservation,
  triggerType: "pre-arrival" | "post-stay",
) {
  const adminClient = createAdminClient();
  const { data: existingJob } = await adminClient
    .from("automation_jobs")
    .select("id")
    .eq("reservation_id", reservation.id)
    .eq("trigger_type", triggerType)
    .maybeSingle();

  if (existingJob) {
    return false;
  }

  const { error } = await adminClient.from("automation_jobs").insert({
    tenant_id: reservation.tenant_id,
    reservation_id: reservation.id,
    job_type: "status-trigger",
    trigger_type: triggerType,
    status: "pending",
    payload: {
      booking_id: reservation.pms_reservation_id,
      status: triggerType,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function enqueueScheduledAutomationJobs(
  now = new Date(),
): Promise<SchedulerResult> {
  if (!isSchedulingWindowOpen(now)) {
    return {
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
    };
  }

  const adminClient = createAdminClient();
  const { data: preArrivalReservations, error: preArrivalError } =
    await adminClient
      .from("reservations")
      .select("id, tenant_id, pms_reservation_id, check_in_date")
      .eq("status", "pre-arrival");

  if (preArrivalError) {
    throw new Error(preArrivalError.message);
  }

  const { data: postStayReservations, error: postStayError } = await adminClient
    .from("reservations")
    .select("id, tenant_id, pms_reservation_id, check_out_date")
    .eq("status", "checked-out");

  if (postStayError) {
    throw new Error(postStayError.message);
  }

  const expectedPreArrivalDate = toIsoDate(addDays(now, 1));
  const expectedPostStayDate = toIsoDate(addDays(now, -1));

  let preArrivalEnqueued = 0;
  for (const reservation of (preArrivalReservations ??
    []) as ScheduledReservation[]) {
    if (reservation.check_in_date !== expectedPreArrivalDate) {
      continue;
    }

    if (await enqueueIfMissing(reservation, "pre-arrival")) {
      preArrivalEnqueued += 1;
    }
  }

  let postStayEnqueued = 0;
  for (const reservation of (postStayReservations ??
    []) as ScheduledReservation[]) {
    if (reservation.check_out_date !== expectedPostStayDate) {
      continue;
    }

    if (await enqueueIfMissing(reservation, "post-stay")) {
      postStayEnqueued += 1;
    }
  }

  return {
    preArrivalEnqueued,
    postStayEnqueued,
  };
}
