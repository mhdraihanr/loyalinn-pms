import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startPageAutoRefresh } from "@/components/layout/page-auto-refresh";

describe("startPageAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes every 10 seconds by default", async () => {
    const refresh = vi.fn();
    const stop = startPageAutoRefresh({ refresh });

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("stops refreshing after cleanup", async () => {
    const refresh = vi.fn();
    const stop = startPageAutoRefresh({ refresh });

    await vi.advanceTimersByTimeAsync(10_000);
    stop();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
