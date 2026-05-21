import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startPageAutoRefresh } from "@/components/layout/page-auto-refresh";

describe("startPageAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start browser interval refresh by default", async () => {
    const refresh = vi.fn();
    const stop = startPageAutoRefresh({ refresh });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(refresh).not.toHaveBeenCalled();

    stop();
  });

  it("cleanup is safe when no refresh interval is active", async () => {
    const refresh = vi.fn();
    const stop = startPageAutoRefresh({ refresh });

    await vi.advanceTimersByTimeAsync(10_000);
    stop();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
