import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimAutomationJobs,
  completeAutomationJob,
  deadLetterAutomationJob,
  rescheduleAutomationJob,
} from "@/lib/automation/queue";

const rpcMock = vi.fn();
const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

describe("claimAutomationJobs", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
  });

  it("claims eligible jobs through the queue RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "job-1", status: "processing" }],
      error: null,
    });

    const jobs = await claimAutomationJobs(5, "worker-a");

    expect(rpcMock).toHaveBeenCalledWith("claim_automation_jobs", {
      p_batch_size: 5,
      p_worker_id: "worker-a",
    });
    expect(jobs).toEqual([{ id: "job-1", status: "processing" }]);
  });
});

describe("completeAutomationJob", () => {
  it("marks a job completed with its processed timestamp and message log", async () => {
    eqMock.mockResolvedValue({ error: null });

    await completeAutomationJob("job-2", "log-2");

    expect(fromMock).toHaveBeenCalledWith("automation_jobs");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        message_log_id: "log-2",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "job-2");
  });
});

describe("rescheduleAutomationJob", () => {
  it("marks retryable jobs failed and assigns the next available time", async () => {
    eqMock.mockResolvedValue({ error: null });
    const nextRetryAt = new Date("2026-03-07T12:05:00.000Z");

    await rescheduleAutomationJob("job-3", {
      retryCount: 2,
      nextRetryAt,
      errorCategory: "retryable",
      errorMessage: "temporary WAHA outage",
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        retry_count: 2,
        available_at: nextRetryAt.toISOString(),
        last_error_category: "retryable",
        error_message: "temporary WAHA outage",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "job-3");
  });
});

describe("deadLetterAutomationJob", () => {
  it("marks terminal jobs as dead-letter", async () => {
    eqMock.mockResolvedValue({ error: null });

    await deadLetterAutomationJob("job-4", "fatal", "template missing");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dead-letter",
        last_error_category: "fatal",
        error_message: "template missing",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "job-4");
  });
});
