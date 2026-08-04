import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorCategory } from "@/lib/observability/types";

export type ClaimedAutomationJob = {
  id: string;
  status?: string;
  tenant_id?: string;
  tenantId?: string;
  trigger_type?: string;
  triggerType?: string;
  retry_count?: number;
  max_retries?: number;
  payload?: {
    booking_id: string;
    status: string;
    previous_status?: string;
    updated_at?: string;
  };
};

type RescheduleOptions = {
  retryCount: number;
  nextRetryAt: Date;
  errorCategory: ErrorCategory;
  errorMessage: string;
};

type AutomationAdminClient = ReturnType<typeof createAdminClient>;

type EnqueueStatusTriggerAutomationJobInput = {
  tenantId: string;
  reservationId: string;
  triggerType: "pre-arrival" | "on-stay" | "post-stay" | "cancelled";
  payload: Record<string, unknown>;
  adminClient?: AutomationAdminClient;
};

export async function enqueueStatusTriggerAutomationJobIfMissing({
  tenantId,
  reservationId,
  triggerType,
  payload,
  adminClient = createAdminClient(),
}: EnqueueStatusTriggerAutomationJobInput) {
  const { data: existingJob, error: existingJobError } = await adminClient
    .from("automation_jobs")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("trigger_type", triggerType)
    .maybeSingle();

  if (existingJobError) {
    const message = existingJobError.message ?? "";

    if (/multiple rows|more than one row|json object requested/i.test(message)) {
      return { enqueued: false, reason: "existing-job" as const };
    }

    throw new Error(message || "Failed to lookup existing automation job");
  }

  if (existingJob) {
    return { enqueued: false, reason: "existing-job" as const };
  }

  const { data: sentLogs, error: sentLogError } = await adminClient
    .from("message_logs")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("trigger_type", triggerType)
    .eq("status", "sent")
    .limit(1);

  if (sentLogError) {
    throw new Error(sentLogError.message);
  }

  if (sentLogs?.length) {
    return { enqueued: false, reason: "already-sent" as const };
  }

  const { error } = await adminClient.from("automation_jobs").insert({
    tenant_id: tenantId,
    reservation_id: reservationId,
    job_type: "status-trigger",
    trigger_type: triggerType,
    status: "pending",
    payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { enqueued: true, reason: null };
}

async function updateAutomationJob(
  jobId: string,
  payload: Record<string, string | number | null>,
) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("automation_jobs")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function claimAutomationJobs(
  batchSize: number,
  workerId: string,
): Promise<ClaimedAutomationJob[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("claim_automation_jobs", {
    p_batch_size: batchSize,
    p_worker_id: workerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClaimedAutomationJob[];
}

export async function completeAutomationJob(
  jobId: string,
  messageLogId?: string,
) {
  await updateAutomationJob(jobId, {
    status: "completed",
    message_log_id: messageLogId ?? null,
    processed_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  });
}

export async function rescheduleAutomationJob(
  jobId: string,
  { retryCount, nextRetryAt, errorCategory, errorMessage }: RescheduleOptions,
) {
  await updateAutomationJob(jobId, {
    status: "pending",
    retry_count: retryCount,
    available_at: nextRetryAt.toISOString(),
    last_error_category: errorCategory,
    error_message: errorMessage,
    locked_at: null,
    locked_by: null,
  });
}

export async function deadLetterAutomationJob(
  jobId: string,
  errorCategory: ErrorCategory,
  errorMessage: string,
) {
  await updateAutomationJob(jobId, {
    status: "dead-letter",
    last_error_category: errorCategory,
    error_message: errorMessage,
    processed_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  });
}
