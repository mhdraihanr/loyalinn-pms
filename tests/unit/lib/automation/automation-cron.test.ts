import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAutomationCron } from "@/lib/automation/automation-cron";

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

describe("runAutomationCron", () => {
  const now = new Date("2026-03-12T00:00:00.000Z");

  beforeEach(() => {
    mocks.enqueueScheduledAutomationJobsMock.mockReset();
    mocks.claimAutomationJobsMock.mockReset();
    mocks.processStatusTriggerJobMock.mockReset();
    mocks.classifyAutomationErrorMock.mockReset();
    mocks.getNextRetryAtMock.mockReset();
    mocks.shouldDeadLetterMock.mockReset();
    mocks.rescheduleAutomationJobMock.mockReset();
    mocks.deadLetterAutomationJobMock.mockReset();

    mocks.enqueueScheduledAutomationJobsMock.mockResolvedValue({
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
      aiFollowupEscalated: 0,
    });
    mocks.claimAutomationJobsMock.mockResolvedValue([]);
    mocks.processStatusTriggerJobMock.mockResolvedValue(undefined);
  });

  it("counts successful processed jobs", async () => {
    mocks.claimAutomationJobsMock.mockResolvedValue([
      {
        id: "job-1",
        payload: {},
        tenantId: "tenant-1",
        triggerType: "on-stay",
      },
    ]);

    const result = await runAutomationCron(now);

    expect(mocks.enqueueScheduledAutomationJobsMock).toHaveBeenCalledWith(now, {
      force: undefined,
    });
    expect(mocks.claimAutomationJobsMock).toHaveBeenCalledWith(
      10,
      "cron:automation",
    );
    expect(mocks.processStatusTriggerJobMock).toHaveBeenCalledWith({
      id: "job-1",
      tenantId: "tenant-1",
      triggerType: "on-stay",
      payload: {},
    });
    expect(result).toEqual({
      processed: 1,
      retried: 0,
      deadLettered: 0,
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
      aiFollowupEscalated: 0,
    });
  });

  it("reschedules retryable failures using the supplied clock", async () => {
    mocks.claimAutomationJobsMock.mockResolvedValue([
      {
        id: "job-2",
        retry_count: 0,
        max_retries: 3,
        payload: {},
        tenant_id: "tenant-2",
        trigger_type: "on-stay",
      },
    ]);
    mocks.processStatusTriggerJobMock.mockRejectedValueOnce(
      new Error("temporary outage"),
    );
    mocks.classifyAutomationErrorMock.mockReturnValue("retryable");
    mocks.shouldDeadLetterMock.mockReturnValue(false);
    mocks.getNextRetryAtMock.mockReturnValue(
      new Date("2026-03-12T00:01:00.000Z"),
    );

    const result = await runAutomationCron(now);

    expect(mocks.getNextRetryAtMock).toHaveBeenCalledWith(1, now);
    expect(mocks.rescheduleAutomationJobMock).toHaveBeenCalledWith(
      "job-2",
      expect.objectContaining({
        retryCount: 1,
        errorCategory: "retryable",
      }),
    );
    expect(result.retried).toBe(1);
  });

  it("dead-letters terminal failures", async () => {
    mocks.claimAutomationJobsMock.mockResolvedValue([
      {
        id: "job-3",
        retry_count: 2,
        max_retries: 3,
        payload: {},
        tenant_id: "tenant-3",
        trigger_type: "post-stay",
      },
    ]);
    mocks.processStatusTriggerJobMock.mockRejectedValueOnce(
      new Error("template missing"),
    );
    mocks.classifyAutomationErrorMock.mockReturnValue("validation");
    mocks.shouldDeadLetterMock.mockReturnValue(true);

    const result = await runAutomationCron(now);

    expect(mocks.deadLetterAutomationJobMock).toHaveBeenCalledWith(
      "job-3",
      "validation",
      "template missing",
    );
    expect(result.deadLettered).toBe(1);
  });
});
