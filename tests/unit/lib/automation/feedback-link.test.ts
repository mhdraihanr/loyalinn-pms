import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  buildFeedbackLink,
  createFeedbackToken,
  verifyFeedbackToken,
} from "@/lib/automation/feedback-link";

describe("feedback-link", () => {
  const originalSecret = process.env.POST_STAY_FEEDBACK_SECRET;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.POST_STAY_FEEDBACK_SECRET = "feedback-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env.POST_STAY_FEEDBACK_SECRET = originalSecret;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("creates and verifies a valid token", () => {
    const token = createFeedbackToken({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      expiresInSeconds: 3600,
    });

    const payload = verifyFeedbackToken(token);

    expect(payload).toMatchObject({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
    });
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered token", () => {
    const token = createFeedbackToken({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      expiresInSeconds: 3600,
    });

    const tampered = `${token}x`;
    expect(verifyFeedbackToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createFeedbackToken({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      expiresInSeconds: -10,
    });

    expect(verifyFeedbackToken(token)).toBeNull();
  });

  it("builds a public feedback link path from token", () => {
    const link = buildFeedbackLink("signed-token");
    expect(link).toBe("http://localhost:3000/feedback/signed-token");
  });
});
