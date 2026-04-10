import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/automation/route";

const mocks = vi.hoisted(() => ({
  enqueueScheduledAutomationJobsMock: vi.fn(),
  claimAutomationJobsMock: vi.fn(),
  processStatusTriggerJobMock: vi.fn(),
  classifyAutomationErrorMock: vi.fn(),
  getNextRetryAtMock: vi.fn(),
  shouldDeadLetterMock: vi.fn(),
  rescheduleAutomationJobMock: vi.fn(),
  deadLetterAutomationJobMock: vi.fn(),
}));

vi.mock("@/lib/automation/scheduler", () => ({
  enqueueScheduledAutomationJobs: mocks.enqueueScheduledAutomationJobsMock,
}));

vi.mock("@/lib/automation/queue", () => ({
  claimAutomationJobs: mocks.claimAutomationJobsMock,
  rescheduleAutomationJob: mocks.rescheduleAutomationJobMock,
  deadLetterAutomationJob: mocks.deadLetterAutomationJobMock,
}));

vi.mock("@/lib/automation/status-trigger", () => ({
  processStatusTriggerJob: mocks.processStatusTriggerJobMock,
}));

vi.mock("@/lib/automation/retry-policy", () => ({
  classifyAutomationError: mocks.classifyAutomationErrorMock,
  getNextRetryAt: mocks.getNextRetryAtMock,
  shouldDeadLetter: mocks.shouldDeadLetterMock,
}));

describe("GET /api/cron/automation", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.enqueueScheduledAutomationJobsMock.mockReset();
    mocks.claimAutomationJobsMock.mockReset();
    mocks.processStatusTriggerJobMock.mockReset();
    mocks.classifyAutomationErrorMock.mockReset();
    mocks.getNextRetryAtMock.mockReset();
    mocks.shouldDeadLetterMock.mockReset();
    mocks.rescheduleAutomationJobMock.mockReset();
    mocks.deadLetterAutomationJobMock.mockReset();

    mocks.enqueueScheduledAutomationJobsMock.mockResolvedValue({
      preArrivalEnqueued: 1,
      postStayEnqueued: 1,
    });
    mocks.claimAutomationJobsMock.mockResolvedValue([
      {
        id: "job-1",
        tenantId: "tenant-1",
        triggerType: "pre-arrival",
        payload: {},
      },
    ]);
    mocks.processStatusTriggerJobMock.mockResolvedValue(undefined);
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/automation", { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  it("enqueues scheduled jobs and processes a claimed batch", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/automation", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.enqueueScheduledAutomationJobsMock).toHaveBeenCalled();
    expect(mocks.claimAutomationJobsMock).toHaveBeenCalledWith(
      10,
      "cron:automation",
    );
    expect(mocks.processStatusTriggerJobMock).toHaveBeenCalledTimes(1);
    expect(json).toEqual({
      processed: 1,
      retried: 0,
      deadLettered: 0,
      preArrivalEnqueued: 1,
      postStayEnqueued: 1,
    });
  });

  it("maps claimed database jobs to the status trigger input shape", async () => {
    mocks.claimAutomationJobsMock.mockResolvedValueOnce([
      {
        id: "job-db-1",
        tenant_id: "tenant-db-1",
        trigger_type: "on-stay",
        retry_count: 0,
        max_retries: 3,
        payload: {
          booking_id: "O3-R1",
          status: "on-stay",
          previous_status: "pre-arrival",
        },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/cron/automation", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processStatusTriggerJobMock).toHaveBeenCalledWith({
      id: "job-db-1",
      tenantId: "tenant-db-1",
      triggerType: "on-stay",
      payload: {
        booking_id: "O3-R1",
        status: "on-stay",
        previous_status: "pre-arrival",
      },
    });
  });

  it("reschedules retryable job failures with the next available time", async () => {
    mocks.processStatusTriggerJobMock.mockRejectedValueOnce(
      new Error("temporary outage"),
    );
    mocks.classifyAutomationErrorMock.mockReturnValue("retryable");
    mocks.getNextRetryAtMock.mockReturnValue(
      new Date("2026-03-07T10:05:00.000Z"),
    );
    mocks.shouldDeadLetterMock.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/automation", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(mocks.rescheduleAutomationJobMock).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        errorCategory: "retryable",
        retryCount: 1,
      }),
    );
    expect(response.status).toBe(200);
    expect(json.retried).toBe(1);
  });
});
