import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/pms/route";

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => {
      if (table === "inbound_events") {
        return {
          insert: insertMock,
        };
      }

      if (table === "automation_jobs") {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

function buildSignedRequest(body: string, secret = "test-secret") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  return new Request("http://localhost/api/webhooks/pms", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pms-timestamp": timestamp,
      "x-pms-signature": signature,
    },
    body,
  });
}

describe("POST /api/webhooks/pms", () => {
  beforeEach(() => {
    insertMock.mockReset();
    process.env.PMS_WEBHOOK_SECRET = "test-secret";
  });

  it("persists a valid event and enqueues a single automation job", async () => {
    insertMock
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "event-1" },
            error: null,
          }),
        })),
      })
      .mockResolvedValueOnce({ data: { id: "job-1" }, error: null });

    const payload = JSON.stringify({
      tenant_id: "tenant-1",
      event_id: "evt-1",
      event_type: "reservation.updated",
      booking_id: "BKG-1001",
      status: "on-stay",
      updated_at: "2026-03-07T12:00:00Z",
    });

    const response = await POST(buildSignedRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, duplicate: false });
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("does not enqueue a duplicate job when the idempotency key already exists", async () => {
    insertMock.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "duplicate key value" },
        }),
      })),
    });

    const payload = JSON.stringify({
      tenant_id: "tenant-1",
      event_id: "evt-1",
      event_type: "reservation.updated",
      booking_id: "BKG-1001",
      status: "on-stay",
      updated_at: "2026-03-07T12:00:00Z",
    });

    const response = await POST(buildSignedRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, duplicate: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("rejects requests with an invalid signature", async () => {
    const payload = JSON.stringify({
      tenant_id: "tenant-1",
      booking_id: "BKG-1001",
      status: "on-stay",
      updated_at: "2026-03-07T12:00:00Z",
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/pms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pms-timestamp": String(Math.floor(Date.now() / 1000)),
          "x-pms-signature": "invalid-signature",
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(401);
  });
});
