import { NextResponse } from "next/server";

import {
  type ClaimedAutomationJob,
  claimAutomationJobs,
  deadLetterAutomationJob,
  rescheduleAutomationJob,
} from "@/lib/automation/queue";
import {
  classifyAutomationError,
  getNextRetryAt,
  shouldDeadLetter,
} from "@/lib/automation/retry-policy";
import { enqueueScheduledAutomationJobs } from "@/lib/automation/scheduler";
import { processStatusTriggerJob } from "@/lib/automation/status-trigger";

const WORKER_ID = "cron:automation";
const BATCH_SIZE = 10;

function toStatusTriggerJob(job: ClaimedAutomationJob) {
  return {
    id: job.id,
    tenantId: job.tenantId ?? job.tenant_id ?? "",
    triggerType: job.triggerType ?? job.trigger_type ?? "",
    payload: job.payload ?? {
      booking_id: "",
      status: "",
    },
  };
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduled = await enqueueScheduledAutomationJobs(new Date());
  const jobs = await claimAutomationJobs(BATCH_SIZE, WORKER_ID);

  let processed = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      await processStatusTriggerJob(toStatusTriggerJob(job));
      processed += 1;
    } catch (error) {
      const category = classifyAutomationError(error);
      const retryCount = (job.retry_count ?? 0) + 1;
      const maxRetries = job.max_retries ?? 3;

      if (shouldDeadLetter(category, retryCount, maxRetries)) {
        await deadLetterAutomationJob(
          job.id,
          category,
          error instanceof Error ? error.message : "Automation job failed",
        );
        deadLettered += 1;
        continue;
      }

      await rescheduleAutomationJob(job.id, {
        retryCount,
        nextRetryAt: getNextRetryAt(retryCount),
        errorCategory: category,
        errorMessage:
          error instanceof Error ? error.message : "Automation job failed",
      });
      retried += 1;
    }
  }

  return NextResponse.json({
    processed,
    retried,
    deadLettered,
    preArrivalEnqueued: scheduled.preArrivalEnqueued,
    postStayEnqueued: scheduled.postStayEnqueued,
  });
}
