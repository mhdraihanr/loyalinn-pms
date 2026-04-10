import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetDevelopmentPmsSyncSchedulerForTests,
  startDevelopmentPmsSyncScheduler,
} from "@/lib/pms/dev-sync-scheduler";

describe("startDevelopmentPmsSyncScheduler", () => {
  const defaultIntervalMs = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    resetDevelopmentPmsSyncSchedulerForTests();
  });

  afterEach(() => {
    resetDevelopmentPmsSyncSchedulerForTests();
    vi.useRealTimers();
  });

  it("starts once in development, runs immediately, and repeats every 10 seconds by default", async () => {
    const runSync = vi.fn().mockResolvedValue(undefined);

    const result = startDevelopmentPmsSyncScheduler({
      runSync,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });

    await vi.runAllTicks();

    expect(result.started).toBe(true);
    expect(result.intervalMs).toBe(defaultIntervalMs);
    expect(runSync).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(runSync).toHaveBeenCalledTimes(2);
  });

  it("does not create a second interval when already started", async () => {
    const firstRunner = vi.fn().mockResolvedValue(undefined);
    const secondRunner = vi.fn().mockResolvedValue(undefined);

    startDevelopmentPmsSyncScheduler({
      runSync: firstRunner,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });
    await vi.runAllTicks();

    const secondStart = startDevelopmentPmsSyncScheduler({
      runSync: secondRunner,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(secondStart.started).toBe(false);
    expect(firstRunner).toHaveBeenCalledTimes(2);
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("stays disabled outside development node runtime", async () => {
    const runSync = vi.fn().mockResolvedValue(undefined);

    const result = startDevelopmentPmsSyncScheduler({
      runSync,
      environment: {
        nodeEnv: "production",
        nextRuntime: "nodejs",
      },
    });

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(result.started).toBe(false);
    expect(runSync).not.toHaveBeenCalled();
  });
});
