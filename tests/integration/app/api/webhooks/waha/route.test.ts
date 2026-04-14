import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/webhooks/waha/route";

const mocks = vi.hoisted(() => ({
  reservationSingleMock: vi.fn(),
  reservationStatusMaybeSingleMock: vi.fn(),
  messageLogInsertMock: vi.fn(),
  messageLogsOrderMock: vi.fn(),
  processGuestFeedbackMock: vi.fn(),
  sendMessageMock: vi.fn(),
  getLidMappingMock: vi.fn(),
}));

vi.mock("@/lib/ai/agent", () => ({
  processGuestFeedback: mocks.processGuestFeedbackMock,
}));

vi.mock("@/lib/waha/client", () => ({
  wahaClient: {
    sendMessage: mocks.sendMessageMock,
    getLidMapping: mocks.getLidMappingMock,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: (columns?: string) => {
            if (
              typeof columns === "string" &&
              columns.includes("post_stay_feedback_status")
            ) {
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: mocks.reservationStatusMaybeSingleMock,
                  }),
                }),
              };
            }

            return {
              eq: () => ({
                ilike: () => ({
                  order: () => ({
                    limit: () => ({
                      single: mocks.reservationSingleMock,
                    }),
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === "message_logs") {
        return {
          insert: mocks.messageLogInsertMock,
          select: () => {
            return {
              eq: () => ({
                eq: () => ({
                  order: mocks.messageLogsOrderMock,
                }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("POST /api/webhooks/waha", () => {
  beforeEach(() => {
    process.env.WAHA_WEBHOOK_SECRET = "waha-secret";

    mocks.reservationSingleMock.mockReset();
    mocks.reservationStatusMaybeSingleMock.mockReset();
    mocks.messageLogInsertMock.mockReset();
    mocks.messageLogsOrderMock.mockReset();
    mocks.processGuestFeedbackMock.mockReset();
    mocks.sendMessageMock.mockReset();
    mocks.getLidMappingMock.mockReset();

    mocks.reservationSingleMock.mockResolvedValue({
      data: {
        id: "reservation-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        guests: [{ name: "Rina", phone: "+628123456789" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.messageLogsOrderMock.mockResolvedValue({
      data: [
        {
          direction: "inbound",
          content: "Halo, saya mau kasih rating",
        },
      ],
      error: null,
    });

    mocks.messageLogInsertMock.mockResolvedValue({ error: null });
    mocks.reservationStatusMaybeSingleMock.mockResolvedValue({
      data: {
        post_stay_feedback_status: "ai_followup",
      },
      error: null,
    });
    mocks.processGuestFeedbackMock.mockResolvedValue({
      response: "Terima kasih, feedback sudah kami terima.",
    });
    mocks.sendMessageMock.mockResolvedValue({ id: "provider-1" });
    mocks.getLidMappingMock.mockResolvedValue(null);
  });

  it("processes inbound ai_followup message with agentic AI and persists outbound reply", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo, saya mau kasih rating",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_000,
            id: { id: "wamid-1" },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalledWith(
      "reservation-1",
      "tenant-1",
      "Rina",
      "Hotel Nusantara",
      [
        {
          role: "user",
          content: "Halo, saya mau kasih rating",
        },
      ],
    );
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "628123456789@c.us",
      "Terima kasih, feedback sudah kami terima.",
    );
    expect(mocks.messageLogInsertMock).toHaveBeenCalledTimes(2);
    expect(json).toEqual({
      status: "success",
      ai_reply: "Terima kasih, feedback sudah kami terima.",
    });
  });

  it("accepts webhook auth via x-api-key header", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo dari x-api-key",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_010,
            id: { id: "wamid-x-api-key" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalled();
  });

  it("accepts webhook auth via WAHA HMAC headers", async () => {
    const rawBody = JSON.stringify({
      event: "message.any",
      payload: {
        from: "628123456789@c.us",
        body: "Halo dari hmac",
        fromMe: false,
        isGroup: false,
        timestamp: 1_775_000_011,
        id: { id: "wamid-hmac" },
      },
    });

    const hmac = createHmac("sha512", "waha-secret")
      .update(rawBody)
      .digest("hex");

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-hmac": hmac,
          "x-webhook-hmac-algorithm": "sha512",
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalled();
  });

  it("rejects request when webhook secret is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_000,
            id: { id: "wamid-auth-missing" },
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.processGuestFeedbackMock).not.toHaveBeenCalled();
  });

  it("falls back to local format when matching guest phone", async () => {
    mocks.reservationSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      })
      .mockResolvedValueOnce({
        data: {
          id: "reservation-2",
          tenant_id: "tenant-1",
          guest_id: "guest-1",
          guests: [{ name: "Rina", phone: "08123456789" }],
          tenants: [{ name: "Hotel Nusantara" }],
        },
        error: null,
      });

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo, saya respon follow-up",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_001,
            id: { id: "wamid-3" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reservationSingleMock).toHaveBeenCalledTimes(2);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalledWith(
      "reservation-2",
      "tenant-1",
      "Rina",
      "Hotel Nusantara",
      expect.any(Array),
    );
  });

  it("returns ignored when no active ai_followup reservation matches phone", async () => {
    mocks.reservationSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      });

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_000,
            id: { id: "wamid-2" },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).not.toHaveBeenCalled();
    expect(json).toEqual({
      status: "ignored: no active ai_followup reservation found",
    });
  });

  it("ignores duplicate inbound message on unique conflict", async () => {
    mocks.messageLogInsertMock.mockResolvedValueOnce({
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo duplikat",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_122,
            id: {
              id: "duplicate-msg-id",
            },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: "ignored: duplicate message" });
    expect(mocks.processGuestFeedbackMock).not.toHaveBeenCalled();
    expect(mocks.messageLogInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
  });

  it("uses completed-feedback handoff template when reservation is completed", async () => {
    process.env.AI_FEEDBACK_COMPLETED_HANDOFF_TEMPLATE =
      "Terima kasih {{guestName}}, feedback Anda sudah kami teruskan ke tim {{hotelName}}. Untuk tindak lanjut, tim hotel akan menghubungi manual.";

    mocks.reservationStatusMaybeSingleMock.mockResolvedValueOnce({
      data: {
        post_stay_feedback_status: "completed",
      },
      error: null,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "rating saya 5",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_130,
            id: { id: "wamid-completed-template" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "628123456789@c.us",
      "Terima kasih Rina, feedback Anda sudah kami teruskan ke tim Hotel Nusantara. Untuk tindak lanjut, tim hotel akan menghubungi manual.",
    );
  });

  it("maps LID sender to phone number before reservation lookup", async () => {
    mocks.getLidMappingMock.mockResolvedValue({
      lid: "335074578666@lid",
      pn: "6281219148751@c.us",
    });

    mocks.reservationSingleMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      })
      .mockResolvedValueOnce({
        data: {
          id: "reservation-lid",
          tenant_id: "tenant-1",
          guest_id: "guest-1",
          guests: [{ name: "Rina", phone: "081219148751" }],
          tenants: [{ name: "Hotel Nusantara" }],
        },
        error: null,
      });

    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          session: "default",
          payload: {
            from: {
              server: "lid",
              user: "335074578666",
              _serialized: "335074578666@lid",
            },
            body: "rating 5 kamarnya bagus mewah",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_125,
            id: {
              fromMe: false,
              remote: "335074578666@lid",
              id: "ACB371799468A67E22763D16CE6E5DB9",
              _serialized:
                "false_335074578666@lid_ACB371799468A67E22763D16CE6E5DB9",
            },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "success",
      ai_reply: "Terima kasih, feedback sudah kami terima.",
    });
    expect(mocks.getLidMappingMock).toHaveBeenCalledWith(
      "default",
      "335074578666@lid",
    );
    expect(mocks.reservationSingleMock).toHaveBeenCalledTimes(2);
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "335074578666@lid",
      "Terima kasih, feedback sudah kami terima.",
    );
  });

  it("treats string boolean flags as false and still processes inbound message", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            body: "Halo dari boolean string",
            fromMe: "false",
            isGroup: "false",
            timestamp: 1_775_000_123,
            id: { id: "wamid-string-bool" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalled();
  });

  it("accepts text fallback when body field is empty", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/waha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-waha-secret": "waha-secret",
        },
        body: JSON.stringify({
          event: "message.any",
          payload: {
            from: "628123456789@c.us",
            text: "Halo dari text fallback",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_124,
            id: { id: "wamid-text-fallback" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processGuestFeedbackMock).toHaveBeenCalled();
  });
});
