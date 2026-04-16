import { beforeEach, describe, expect, it, vi } from "vitest";

import { escalatePendingFeedbackToAiFollowup } from "@/lib/automation/feedback-escalation";

const mocks = vi.hoisted(() => ({
  reservationSelectLimitMock: vi.fn(),
  reservationSelectLtMock: vi.fn(),
  reservationClaimMaybeSingleMock: vi.fn(),
  reservationRollbackExecMock: vi.fn(),
  templateMaybeSingleMock: vi.fn(),
  messageLogInsertMock: vi.fn(),
  sendMessageMock: vi.fn(),
}));

vi.mock("@/lib/waha/client", () => ({
  wahaClient: {
    sendMessage: mocks.sendMessageMock,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                lt: (...args: unknown[]) => {
                  mocks.reservationSelectLtMock(...args);
                  return {
                    limit: mocks.reservationSelectLimitMock,
                  };
                },
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            if (payload.post_stay_feedback_status === "ai_followup") {
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: () => ({
                        maybeSingle: mocks.reservationClaimMaybeSingleMock,
                      }),
                    }),
                  }),
                }),
              };
            }

            return {
              eq: () => ({
                eq: () => ({
                  eq: mocks.reservationRollbackExecMock,
                }),
              }),
            };
          },
        };
      }

      if (table === "message_templates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mocks.templateMaybeSingleMock,
              }),
            }),
          }),
        };
      }

      if (table === "message_logs") {
        return {
          insert: mocks.messageLogInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("escalatePendingFeedbackToAiFollowup", () => {
  const now = new Date("2026-04-12T12:00:00.000Z");

  beforeEach(() => {
    mocks.reservationSelectLimitMock.mockReset();
    mocks.reservationSelectLtMock.mockReset();
    mocks.reservationClaimMaybeSingleMock.mockReset();
    mocks.reservationRollbackExecMock.mockReset();
    mocks.templateMaybeSingleMock.mockReset();
    mocks.messageLogInsertMock.mockReset();
    mocks.sendMessageMock.mockReset();

    mocks.reservationSelectLimitMock.mockResolvedValue({
      data: [
        {
          id: "reservation-1",
          tenant_id: "tenant-1",
          guest_id: "guest-1",
          guests: { name: "Rina", phone: "+628123456789" },
          tenants: { name: "Hotel Nusantara" },
        },
      ],
      error: null,
    });
    mocks.reservationClaimMaybeSingleMock.mockResolvedValue({
      data: { id: "reservation-1" },
      error: null,
    });
    mocks.templateMaybeSingleMock.mockResolvedValue({
      data: {
        id: "template-followup-1",
        message_template_variants: [
          {
            language_code: "id",
            content: "Halo {{guestName}}, follow-up dari {{hotelName}}.",
          },
        ],
      },
      error: null,
    });
    mocks.messageLogInsertMock.mockResolvedValue({ error: null });
    mocks.reservationRollbackExecMock.mockResolvedValue({ error: null });
    mocks.sendMessageMock.mockResolvedValue({ id: "provider-message-1" });
  });

  it("escalates pending feedback older than 24 hours and sends kickoff message", async () => {
    const result = await escalatePendingFeedbackToAiFollowup(now);

    expect(mocks.reservationSelectLtMock).toHaveBeenCalledWith(
      "updated_at",
      "2026-04-11T12:00:00.000Z",
    );
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "+628123456789",
      "Halo Rina, follow-up dari Hotel Nusantara.",
    );
    expect(mocks.messageLogInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        direction: "outbound",
        trigger_type: "post-stay",
      }),
    );
    expect(result).toBe(1);
  });

  it("rolls back status to pending when WAHA send fails", async () => {
    mocks.sendMessageMock.mockRejectedValueOnce(new Error("WAHA down"));

    const result = await escalatePendingFeedbackToAiFollowup(now);

    expect(mocks.reservationRollbackExecMock).toHaveBeenCalledTimes(1);
    expect(mocks.messageLogInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        direction: "outbound",
        trigger_type: "post-stay",
      }),
    );
    expect(result).toBe(0);
  });

  it("skips escalation when AI follow-up template is not configured", async () => {
    mocks.templateMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await escalatePendingFeedbackToAiFollowup(now);

    expect(mocks.reservationClaimMaybeSingleMock).not.toHaveBeenCalled();
    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("skips escalation when candidate has no guest phone", async () => {
    mocks.reservationSelectLimitMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-1",
          tenant_id: "tenant-1",
          guest_id: "guest-1",
          guests: { name: "Rina", phone: null },
          tenants: { name: "Hotel Nusantara" },
        },
      ],
      error: null,
    });

    const result = await escalatePendingFeedbackToAiFollowup(now);

    expect(mocks.reservationClaimMaybeSingleMock).not.toHaveBeenCalled();
    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("uses English follow-up variant for non-ID phone even when country is Indonesia", async () => {
    mocks.reservationSelectLimitMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-1",
          tenant_id: "tenant-1",
          guest_id: "guest-1",
          guests: {
            name: "Rina",
            phone: "+12025550123",
            country: "Indonesia",
          },
          tenants: { name: "Hotel Nusantara" },
        },
      ],
      error: null,
    });

    mocks.templateMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "template-followup-2",
        message_template_variants: [
          {
            language_code: "id",
            content: "Halo {{guestName}}, follow-up dari {{hotelName}}.",
          },
          {
            language_code: "en",
            content:
              "Hello {{guestName}}, this is a follow-up from {{hotelName}}.",
          },
        ],
      },
      error: null,
    });

    const result = await escalatePendingFeedbackToAiFollowup(now);

    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "+12025550123",
      "Hello Rina, this is a follow-up from Hotel Nusantara.",
    );
    expect(result).toBe(1);
  });
});
