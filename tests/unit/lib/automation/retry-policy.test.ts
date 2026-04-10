import { describe, expect, it } from "vitest";

import {
  classifyAutomationError,
  getNextRetryAt,
  shouldDeadLetter,
} from "@/lib/automation/retry-policy";

describe("getNextRetryAt", () => {
  const baseTime = new Date("2026-03-07T12:00:00.000Z");

  it("returns the expected retry schedule for attempts 1 through 4", () => {
    expect(getNextRetryAt(1, baseTime).toISOString()).toBe(
      "2026-03-07T12:01:00.000Z",
    );
    expect(getNextRetryAt(2, baseTime).toISOString()).toBe(
      "2026-03-07T12:05:00.000Z",
    );
    expect(getNextRetryAt(3, baseTime).toISOString()).toBe(
      "2026-03-07T12:15:00.000Z",
    );
    expect(getNextRetryAt(4, baseTime).toISOString()).toBe(
      "2026-03-07T13:00:00.000Z",
    );
  });
});

describe("shouldDeadLetter", () => {
  it("dead-letters validation and fatal failures immediately", () => {
    expect(shouldDeadLetter("validation", 1, 3)).toBe(true);
    expect(shouldDeadLetter("fatal", 1, 3)).toBe(true);
  });

  it("keeps retryable failures active until max retries is reached", () => {
    expect(shouldDeadLetter("retryable", 2, 3)).toBe(false);
    expect(shouldDeadLetter("retryable", 3, 3)).toBe(true);
  });
});

describe("classifyAutomationError", () => {
  it("uses an explicit error category when present", () => {
    expect(
      classifyAutomationError({ message: "temporary", category: "retryable" }),
    ).toBe("retryable");
  });

  it("classifies syntax-like failures as validation errors", () => {
    expect(classifyAutomationError(new SyntaxError("invalid payload"))).toBe(
      "validation",
    );
  });

  it("classifies unknown failures as integration errors", () => {
    expect(classifyAutomationError(new Error("provider failed"))).toBe(
      "integration",
    );
  });
});
