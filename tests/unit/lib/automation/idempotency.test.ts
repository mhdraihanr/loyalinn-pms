import { describe, expect, it } from "vitest";

import { buildIdempotencyKey, buildPayloadHash } from "@/lib/automation/idempotency";

describe("buildIdempotencyKey", () => {
  it("creates a stable key from booking id, status, and updated_at", () => {
    const keyA = buildIdempotencyKey({
      bookingId: "BKG-1001",
      status: "on-stay",
      updatedAt: "2026-03-07T10:00:00Z",
    });

    const keyB = buildIdempotencyKey({
      bookingId: "BKG-1001",
      status: "on-stay",
      updatedAt: "2026-03-07T10:00:00Z",
    });

    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("falls back to hashing the raw payload when updated_at is absent", () => {
    const payload = JSON.stringify({
      booking_id: "BKG-2002",
      status: "pre-arrival",
      guest_phone: "+628123456789",
    });

    const key = buildIdempotencyKey({
      bookingId: "BKG-2002",
      status: "pre-arrival",
      rawPayload: payload,
    });

    expect(key).toBe(buildPayloadHash(payload));
  });
});

describe("buildPayloadHash", () => {
  it("returns the same hash for identical payload strings", () => {
    const payload = JSON.stringify({
      booking_id: "BKG-3003",
      status: "checked-out",
      updated_at: "2026-03-07T11:30:00Z",
    });

    expect(buildPayloadHash(payload)).toBe(buildPayloadHash(payload));
    expect(buildPayloadHash(payload)).toMatch(/^[a-f0-9]{64}$/);
  });
});