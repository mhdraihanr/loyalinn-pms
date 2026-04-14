import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/dev/scheduler/route";

const mocks = vi.hoisted(() => ({
  runAutomationCronMock: vi.fn(),
}));

vi.mock("@/lib/automation/automation-cron", () => ({
  runAutomationCron: mocks.runAutomationCronMock,
}));

describe("POST /api/dev/scheduler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mocks.runAutomationCronMock.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("rejects requests outside development environment", async () => {
    process.env.NODE_ENV = "production";

    const response = await POST(
      new Request("http://localhost/api/dev/scheduler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ simulatedDateIso: "2026-04-12T12:00:00.000Z" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns scheduler summary including aiFollowupEscalated", async () => {
    process.env.NODE_ENV = "development";
    mocks.runAutomationCronMock.mockResolvedValue({
      preArrivalEnqueued: 1,
      postStayEnqueued: 2,
      aiFollowupEscalated: 3,
      processed: 4,
      deadLettered: 0,
      retried: 0,
    });

    const requestIso = "2026-04-12T12:00:00.000Z";
    const response = await POST(
      new Request("http://localhost/api/dev/scheduler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ simulatedDateIso: requestIso }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.runAutomationCronMock).toHaveBeenCalledWith(
      new Date(requestIso),
      {
        forceSchedule: true,
      },
    );
    expect(json).toEqual({
      preArrivalEnqueued: 1,
      postStayEnqueued: 2,
      aiFollowupEscalated: 3,
      processed: 4,
      deadLettered: 0,
      success: true,
      simulatedTime: requestIso,
    });
  });
});
