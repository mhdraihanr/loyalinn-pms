import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/automation/route";

const mocks = vi.hoisted(() => ({
  runAutomationCronMock: vi.fn(),
}));

vi.mock("@/lib/automation/automation-cron", () => ({
  runAutomationCron: mocks.runAutomationCronMock,
}));

describe("GET /api/cron/automation", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.runAutomationCronMock.mockReset();
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/automation", { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  it("delegates authorized requests to the automation cron runner", async () => {
    mocks.runAutomationCronMock.mockResolvedValue({
      processed: 1,
      retried: 0,
      deadLettered: 0,
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/automation", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runAutomationCronMock).toHaveBeenCalledTimes(1);
    expect(json).toEqual({
      processed: 1,
      retried: 0,
      deadLettered: 0,
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
    });
  });
});
