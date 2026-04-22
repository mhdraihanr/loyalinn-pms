import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetDevelopmentAutomationSchedulerForTests,
  startDevelopmentAutomationScheduler,
} from "@/lib/automation/dev-automation-scheduler";

describe("startDevelopmentAutomationScheduler", () => {
  const defaultIntervalMs = 10_000;
  const originalDevAutomationIntervalMs =
    process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS;

  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS;
    resetDevelopmentAutomationSchedulerForTests();
  });

  afterEach(() => {
    resetDevelopmentAutomationSchedulerForTests();
    if (originalDevAutomationIntervalMs) {
      process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS =
        originalDevAutomationIntervalMs;
    } else {
      delete process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS;
    }
    vi.useRealTimers();
  });

  it("starts once in development, runs immediately, and repeats every 10 seconds by default", async () => {
    const runWorker = vi.fn().mockResolvedValue(undefined);

    const result = startDevelopmentAutomationScheduler({
      runWorker,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });

    await vi.runAllTicks();

    expect(result.started).toBe(true);
    expect(result.intervalMs).toBe(defaultIntervalMs);
    expect(runWorker).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(runWorker).toHaveBeenCalledTimes(2);
  });

  it("does not create a second interval when already started", async () => {
    const firstRunner = vi.fn().mockResolvedValue(undefined);
    const secondRunner = vi.fn().mockResolvedValue(undefined);

    startDevelopmentAutomationScheduler({
      runWorker: firstRunner,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });
    await vi.runAllTicks();

    const secondStart = startDevelopmentAutomationScheduler({
      runWorker: secondRunner,
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
    const runWorker = vi.fn().mockResolvedValue(undefined);

    const result = startDevelopmentAutomationScheduler({
      runWorker,
      environment: {
        nodeEnv: "production",
        nextRuntime: "nodejs",
      },
    });

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(result.started).toBe(false);
    expect(runWorker).not.toHaveBeenCalled();
  });

  it("skips overlapping ticks while a previous run is still active", async () => {
    let releaseRun: (() => void) | undefined;
    const runWorker = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseRun = resolve;
        }),
    );

    startDevelopmentAutomationScheduler({
      runWorker,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });
    await vi.runAllTicks();

    expect(runWorker).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(runWorker).toHaveBeenCalledTimes(1);

    releaseRun?.();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(runWorker).toHaveBeenCalledTimes(2);
  });

  it("emits overlap warning only once while waiting for long-running worker", async () => {
    let releaseRun: (() => void) | undefined;
    const runWorker = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseRun = resolve;
        }),
    );
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    startDevelopmentAutomationScheduler({
      runWorker,
      logger,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });
    await vi.runAllTicks();

    await vi.advanceTimersByTimeAsync(defaultIntervalMs * 3);

    expect(logger.warn).toHaveBeenCalledTimes(1);

    releaseRun?.();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(defaultIntervalMs);

    expect(runWorker).toHaveBeenCalledTimes(2);
  });

  it("uses DEV_AUTOMATION_SYNC_INTERVAL_MS when provided", async () => {
    process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS = "5000";
    const runWorker = vi.fn().mockResolvedValue(undefined);

    const result = startDevelopmentAutomationScheduler({
      runWorker,
      environment: {
        nodeEnv: "development",
        nextRuntime: "nodejs",
      },
    });

    expect(result.intervalMs).toBe(5000);
  });
});
