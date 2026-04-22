import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/webhooks/waha/route";

const mocks = vi.hoisted(() => ({
  reservationSingleMock: vi.fn(),
  lifecycleSessionMaybeSingleMock: vi.fn(),
  lifecycleSessionListLimitMock: vi.fn(),
  lifecycleSessionUpsertMock: vi.fn(),
  messageLogInsertMock: vi.fn(),
  messageLogsOrderMock: vi.fn(),
  processLifecycleGuestMessageMock: vi.fn(),
  generatePostStayCompletionHandoffReplyMock: vi.fn(),
  sendMessageMock: vi.fn(),
  getLidMappingMock: vi.fn(),
}));

vi.mock("@/lib/ai/lifecycle-agent", () => ({
  processLifecycleGuestMessage: mocks.processLifecycleGuestMessageMock,
}));

vi.mock("@/lib/ai/agent", () => ({
  generatePostStayCompletionHandoffReply:
    mocks.generatePostStayCompletionHandoffReplyMock,
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
          select: () => {
            const filters: Record<string, string> = {};
            const chain = {
              eq: (column: string, value: unknown) => {
                filters[column] = String(value ?? "");
                return chain;
              },
              neq: (column: string, value: unknown) => {
                filters[`neq:${column}`] = String(value ?? "");
                return chain;
              },
              ilike: (column: string, value: string) => {
                filters[`ilike:${column}`] = value;
                return chain;
              },
              order: () => chain,
              limit: () => chain,
              single: () => mocks.reservationSingleMock({ ...filters }),
            };

            return chain;
          },
        };
      }

      if (table === "lifecycle_ai_sessions") {
        const lifecycleSessionWhereChain = {
          maybeSingle: mocks.lifecycleSessionMaybeSingleMock,
          order: () => ({
            limit: mocks.lifecycleSessionListLimitMock,
          }),
        };

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  ...lifecycleSessionWhereChain,
                }),
              }),
            }),
          }),
          upsert: mocks.lifecycleSessionUpsertMock,
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
    delete process.env.LIFECYCLE_AI_DEBUG;

    mocks.reservationSingleMock.mockReset();
    mocks.lifecycleSessionMaybeSingleMock.mockReset();
    mocks.lifecycleSessionListLimitMock.mockReset();
    mocks.lifecycleSessionUpsertMock.mockReset();
    mocks.messageLogInsertMock.mockReset();
    mocks.messageLogsOrderMock.mockReset();
    mocks.processLifecycleGuestMessageMock.mockReset();
    mocks.generatePostStayCompletionHandoffReplyMock.mockReset();
    mocks.sendMessageMock.mockReset();
    mocks.getLidMappingMock.mockReset();

    mocks.reservationSingleMock.mockResolvedValue({
      data: {
        id: "reservation-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "checked-out",
        room_number: "301",
        post_stay_feedback_status: "ai_followup",
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
    mocks.lifecycleSessionMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.lifecycleSessionListLimitMock.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.lifecycleSessionUpsertMock.mockResolvedValue({ error: null });
    mocks.processLifecycleGuestMessageMock.mockResolvedValue({
      response: "Terima kasih, feedback sudah kami terima.",
    });
    mocks.generatePostStayCompletionHandoffReplyMock.mockResolvedValue({
      response:
        "Terima kasih, feedback Anda sudah selesai. Untuk tindak lanjut berikutnya, tim hotel kami akan membantu Anda secara langsung.",
    });
    mocks.sendMessageMock.mockResolvedValue({ id: "provider-1" });
    mocks.getLidMappingMock.mockResolvedValue(null);
  });

  it("routes on-stay inbound message to lifecycle on-stay agent", async () => {
    process.env.LIFECYCLE_AI_DEBUG = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    mocks.reservationSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-onstay-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "on-stay",
        room_number: "508",
        post_stay_feedback_status: "not-sent",
        guests: [{ name: "Rina", phone: "+628123456789" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.processLifecycleGuestMessageMock.mockResolvedValueOnce({
      response: "Baik, permintaan room service Anda sudah kami teruskan.",
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
            body: "Saya mau room service",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_100_001,
            id: { id: "wamid-onstay-1" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "on-stay",
        reservationId: "reservation-onstay-1",
        tenantId: "tenant-1",
        guestId: "guest-1",
        guestName: "Rina",
        hotelName: "Hotel Nusantara",
        roomNumber: "508",
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[WAHA][Lifecycle AI] Route selected",
      expect.objectContaining({
        reservationId: "reservation-onstay-1",
        lifecycleStage: "on-stay",
        reservationStatus: "on-stay",
      }),
    );
  });

  it("routes pre-arrival inbound message to lifecycle pre-arrival agent", async () => {
    mocks.reservationSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-prearrival-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "pre-arrival",
        room_number: "601",
        post_stay_feedback_status: "not-sent",
        guests: [{ name: "Rina", phone: "+628123456789" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.processLifecycleGuestMessageMock.mockResolvedValueOnce({
      response: "Baik, early check-in Anda kami catat untuk ditinjau staf.",
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
            body: "Bisa early check-in jam 11?",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_100_002,
            id: { id: "wamid-prearrival-1" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "pre-arrival",
        reservationId: "reservation-prearrival-1",
        tenantId: "tenant-1",
        guestId: "guest-1",
        guestName: "Rina",
        hotelName: "Hotel Nusantara",
        roomNumber: "601",
      }),
    );
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "post-stay",
        reservationId: "reservation-1",
        tenantId: "tenant-1",
        guestId: "guest-1",
        guestName: "Rina",
        hotelName: "Hotel Nusantara",
        roomNumber: "301",
        preferredLanguage: "id",
      }),
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalled();
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalled();
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
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
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
          status: "on-stay",
          room_number: "310",
          post_stay_feedback_status: "pending",
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "on-stay",
        reservationId: "reservation-2",
        preferredLanguage: "id",
      }),
    );
  });

  it("uses English and sends AI close+handoff reply when feedback is completed", async () => {
    mocks.reservationSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-3",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "checked-out",
        room_number: "311",
        post_stay_feedback_status: "completed",
        guests: [{ name: "Rina", phone: "+12025550123" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.generatePostStayCompletionHandoffReplyMock.mockResolvedValueOnce({
      response:
        "Thank you Rina. Your feedback is already completed. Our hotel team will continue from here and assist you directly.",
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
            from: "+12025550123@c.us",
            body: "Thanks, all good",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_140,
            id: { id: "wamid-non-id-en" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(
      mocks.generatePostStayCompletionHandoffReplyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        reservationId: "reservation-3",
        guestName: "Rina",
        hotelName: "Hotel Nusantara",
        preferredLanguage: "en",
      }),
    );
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "+12025550123@c.us",
      "Thank you Rina. Your feedback is already completed. Our hotel team will continue from here and assist you directly.",
    );
  });

  it("returns ignored when no active lifecycle reservation matches phone", async () => {
    mocks.reservationSingleMock.mockResolvedValue({
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
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(json).toEqual({
      status: "ignored: no active lifecycle reservation found",
    });
  });

  it("ignores duplicate inbound message on unique conflict", async () => {
    process.env.LIFECYCLE_AI_DEBUG = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

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
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(mocks.messageLogInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalledWith(
      "[WAHA][Lifecycle AI] Route selected",
      expect.any(Object),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[WAHA][Lifecycle AI] Duplicate inbound ignored",
      expect.objectContaining({
        reservationId: "reservation-1",
        lifecycleStage: "post-stay",
      }),
    );
  });

  it("does not auto-reply again when completed handoff was already notified", async () => {
    mocks.reservationSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "checked-out",
        room_number: "301",
        post_stay_feedback_status: "completed",
        guests: [{ name: "Rina", phone: "+628123456789" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.lifecycleSessionMaybeSingleMock.mockResolvedValueOnce({
      data: {
        session_status: "handoff",
        last_action_type: "completed_post_stay_handoff_notified",
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

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(
      mocks.generatePostStayCompletionHandoffReplyMock,
    ).not.toHaveBeenCalled();
    expect(json).toEqual({
      status: "ignored: post-stay completed handoff already active",
    });
  });

  it("sends completed close-out reply for different reservation id when older completed reservation is already handoff-notified", async () => {
    mocks.reservationSingleMock.mockImplementation(async (filters) => {
      if (filters?.status === "on-stay" || filters?.status === "pre-arrival") {
        return {
          data: null,
          error: { message: "not found" },
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "pending"
      ) {
        return {
          data: null,
          error: { message: "not found" },
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "ai_followup"
      ) {
        return {
          data: null,
          error: { message: "not found" },
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "completed" &&
        !filters?.["neq:id"]
      ) {
        return {
          data: {
            id: "reservation-completed-old-notified",
            tenant_id: "tenant-1",
            guest_id: "guest-1",
            status: "checked-out",
            room_number: "201",
            post_stay_feedback_status: "completed",
            guests: [{ name: "Rina", phone: "+628123456789" }],
            tenants: [{ name: "Hotel Nusantara" }],
          },
          error: null,
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "completed" &&
        filters?.["neq:id"] === "reservation-completed-old-notified"
      ) {
        return {
          data: {
            id: "reservation-completed-new-unnotified",
            tenant_id: "tenant-1",
            guest_id: "guest-1",
            status: "checked-out",
            room_number: "507",
            post_stay_feedback_status: "completed",
            guests: [{ name: "Rina", phone: "+628123456789" }],
            tenants: [{ name: "Hotel Nusantara" }],
          },
          error: null,
        };
      }

      return {
        data: null,
        error: { message: "not found" },
      };
    });

    mocks.lifecycleSessionMaybeSingleMock
      .mockResolvedValueOnce({
        data: {
          session_status: "handoff",
          last_action_type: "completed_post_stay_handoff_notified",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          session_status: "active",
          last_action_type: null,
        },
        error: null,
      });

    mocks.generatePostStayCompletionHandoffReplyMock.mockResolvedValueOnce({
      response:
        "Terima kasih, percakapan feedback sudah selesai. Tim hotel kami akan melanjutkan bantuan Anda secara manual.",
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
            body: "Masih ada pertanyaan, bisa dibantu?",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_270,
            id: { id: "wamid-completed-other-reservation" },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "success:completed-handoff",
      ai_reply:
        "Terima kasih, percakapan feedback sudah selesai. Tim hotel kami akan melanjutkan bantuan Anda secara manual.",
      handoff: true,
      fallback: false,
    });
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(
      mocks.generatePostStayCompletionHandoffReplyMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "reservation-completed-new-unnotified",
      }),
    );
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "628123456789@c.us",
      "Terima kasih, percakapan feedback sudah selesai. Tim hotel kami akan melanjutkan bantuan Anda secara manual.",
    );
  });

  it("still sends first completed handoff reply when lifecycle session lookup returns multiple rows", async () => {
    mocks.reservationSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-dup-state",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        status: "checked-out",
        room_number: "309",
        post_stay_feedback_status: "completed",
        guests: [{ name: "Rina", phone: "+628123456789" }],
        tenants: [{ name: "Hotel Nusantara" }],
      },
      error: null,
    });

    mocks.lifecycleSessionMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "JSON object requested, multiple rows returned",
      },
    });

    mocks.lifecycleSessionListLimitMock.mockResolvedValueOnce({
      data: [
        {
          session_status: "active",
          last_action_type: null,
        },
        {
          session_status: "active",
          last_action_type: "provider_fallback_handoff",
        },
      ],
      error: null,
    });

    mocks.generatePostStayCompletionHandoffReplyMock.mockResolvedValueOnce({
      response:
        "Terima kasih, alur feedback sudah selesai. Tim hotel kami akan bantu tindak lanjut Anda secara manual.",
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
            body: "Halo, masih ada pertanyaan tambahan",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_231,
            id: { id: "wamid-completed-first-reply-after-dup-state" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processLifecycleGuestMessageMock).not.toHaveBeenCalled();
    expect(mocks.generatePostStayCompletionHandoffReplyMock).toHaveBeenCalled();
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "628123456789@c.us",
      "Terima kasih, alur feedback sudah selesai. Tim hotel kami akan bantu tindak lanjut Anda secara manual.",
    );
  });

  it("prioritizes pending post-stay reservation over older completed handoff reservation for the same guest", async () => {
    mocks.reservationSingleMock.mockImplementation(async (filters) => {
      if (filters?.status === "on-stay" || filters?.status === "pre-arrival") {
        return {
          data: null,
          error: { message: "not found" },
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "pending"
      ) {
        return {
          data: {
            id: "reservation-pending-new",
            tenant_id: "tenant-1",
            guest_id: "guest-1",
            status: "checked-out",
            room_number: "312",
            post_stay_feedback_status: "pending",
            guests: [{ name: "Rina", phone: "+628123456789" }],
            tenants: [{ name: "Hotel Nusantara" }],
          },
          error: null,
        };
      }

      if (
        filters?.status === "checked-out" &&
        filters?.post_stay_feedback_status === "completed"
      ) {
        return {
          data: {
            id: "reservation-completed-old",
            tenant_id: "tenant-1",
            guest_id: "guest-1",
            status: "checked-out",
            room_number: "205",
            post_stay_feedback_status: "completed",
            guests: [{ name: "Rina", phone: "+628123456789" }],
            tenants: [{ name: "Hotel Nusantara" }],
          },
          error: null,
        };
      }

      if (
        filters?.status === "checked-out" &&
        !filters?.post_stay_feedback_status
      ) {
        return {
          data: {
            id: "reservation-completed-old",
            tenant_id: "tenant-1",
            guest_id: "guest-1",
            status: "checked-out",
            room_number: "205",
            post_stay_feedback_status: "completed",
            guests: [{ name: "Rina", phone: "+628123456789" }],
            tenants: [{ name: "Hotel Nusantara" }],
          },
          error: null,
        };
      }

      return {
        data: null,
        error: { message: "not found" },
      };
    });

    mocks.lifecycleSessionMaybeSingleMock.mockResolvedValueOnce({
      data: {
        session_status: "handoff",
        last_action_type: "completed_post_stay_handoff_notified",
      },
      error: null,
    });

    mocks.processLifecycleGuestMessageMock.mockResolvedValueOnce({
      response: "Terima kasih, rating Anda kami catat.",
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
            body: "Rating saya 5, terima kasih",
            fromMe: false,
            isGroup: false,
            timestamp: 1_775_000_260,
            id: { id: "wamid-priority-pending-over-completed" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(
      mocks.generatePostStayCompletionHandoffReplyMock,
    ).not.toHaveBeenCalled();
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "post-stay",
        reservationId: "reservation-pending-new",
      }),
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
          status: "on-stay",
          room_number: "220",
          post_stay_feedback_status: "pending",
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalled();
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
    expect(mocks.processLifecycleGuestMessageMock).toHaveBeenCalled();
  });

  it("falls back to deterministic reply when AI provider is temporarily rate-limited", async () => {
    const retryError = Object.assign(new Error("Provider returned error"), {
      name: "AI_RetryError",
      reason: "maxRetriesExceeded",
      lastError: {
        statusCode: 429,
        isRetryable: true,
        responseBody: "rate-limited upstream",
      },
    });

    mocks.processLifecycleGuestMessageMock.mockRejectedValueOnce(retryError);

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
            timestamp: 1_775_000_150,
            id: { id: "wamid-rate-limit-fallback" },
          },
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "success:fallback",
      ai_reply:
        "Terima kasih Rina, pesan Anda sudah kami terima. Saat ini asisten otomatis kami sedang sangat sibuk. Tim Hotel Nusantara akan menindaklanjuti Anda secara manual sesegera mungkin.",
      fallback: true,
    });
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "628123456789@c.us",
      "Terima kasih Rina, pesan Anda sudah kami terima. Saat ini asisten otomatis kami sedang sangat sibuk. Tim Hotel Nusantara akan menindaklanjuti Anda secara manual sesegera mungkin.",
    );
    expect(mocks.messageLogInsertMock).toHaveBeenCalledTimes(2);
  });
});
