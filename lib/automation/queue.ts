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
    status: "failed",
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
