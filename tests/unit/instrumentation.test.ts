import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startDevelopmentPmsSyncSchedulerMock: vi.fn(),
  startDevelopmentAutomationSchedulerMock: vi.fn(),
}));

vi.mock("@/lib/pms/dev-sync-scheduler", () => ({
  startDevelopmentPmsSyncScheduler: mocks.startDevelopmentPmsSyncSchedulerMock,
}));

vi.mock("@/lib/automation/dev-automation-scheduler", () => ({
  startDevelopmentAutomationScheduler:
    mocks.startDevelopmentAutomationSchedulerMock,
}));

describe("register", () => {
  beforeEach(() => {
    mocks.startDevelopmentPmsSyncSchedulerMock.mockReset();
    mocks.startDevelopmentAutomationSchedulerMock.mockReset();
  });

  it("starts both development schedulers in node runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    const { register } = await import("@/instrumentation");

    await register();

    expect(mocks.startDevelopmentPmsSyncSchedulerMock).toHaveBeenCalledTimes(1);
    expect(mocks.startDevelopmentAutomationSchedulerMock).toHaveBeenCalledTimes(
      1,
    );
  });

  it("does not start development schedulers outside node runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";

    const { register } = await import("@/instrumentation");

    await register();

    expect(mocks.startDevelopmentPmsSyncSchedulerMock).not.toHaveBeenCalled();
    expect(
      mocks.startDevelopmentAutomationSchedulerMock,
    ).not.toHaveBeenCalled();
  });
});
