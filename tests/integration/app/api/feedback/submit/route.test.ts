import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/feedback/submit/route";

const mocks = vi.hoisted(() => ({
  verifyFeedbackTokenMock: vi.fn(),
  reservationMaybeSingleMock: vi.fn(),
  reservationUpdateEqTenantMock: vi.fn(),
  feedbackRewardRpcMock: vi.fn(),
  messageLogInsertMock: vi.fn(),
}));

vi.mock("@/lib/automation/feedback-link", () => ({
  verifyFeedbackToken: mocks.verifyFeedbackTokenMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.feedbackRewardRpcMock,
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mocks.reservationMaybeSingleMock,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: mocks.reservationUpdateEqTenantMock,
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

describe("POST /api/feedback/submit", () => {
  beforeEach(() => {
    mocks.verifyFeedbackTokenMock.mockReset();
    mocks.reservationMaybeSingleMock.mockReset();
    mocks.reservationUpdateEqTenantMock.mockReset();
    mocks.feedbackRewardRpcMock.mockReset();
    mocks.messageLogInsertMock.mockReset();

    mocks.verifyFeedbackTokenMock.mockReturnValue({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    mocks.reservationMaybeSingleMock.mockResolvedValue({
      data: {
        id: "reservation-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        post_stay_feedback_status: "pending",
        guests: [{ phone: "+628111111111" }],
      },
      error: null,
    });

    mocks.reservationUpdateEqTenantMock.mockResolvedValue({ error: null });
    mocks.feedbackRewardRpcMock.mockResolvedValue({
      data: [{ rewarded: true, points_awarded: 50 }],
      error: null,
    });
    mocks.messageLogInsertMock.mockResolvedValue({ error: null });
  });

  it("returns unauthorized when token is invalid", async () => {
    mocks.verifyFeedbackTokenMock.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/feedback/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "invalid",
          rating: 5,
          comments: "Mantap",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("stores completed feedback and grants 50 reward points", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "valid-token",
          rating: 4,
          comments: "Pelayanan bagus",
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ submitted: true, rewardPoints: 50 });
    expect(mocks.feedbackRewardRpcMock).toHaveBeenCalledWith(
      "complete_post_stay_feedback_with_reward",
      {
        p_reservation_id: "reservation-1",
        p_tenant_id: "tenant-1",
        p_rating: 4,
        p_comments: "Pelayanan bagus",
        p_reward_points: 50,
      },
    );
    expect(mocks.messageLogInsertMock).toHaveBeenCalledTimes(1);
  });

  it("does not grant duplicate points when feedback was already completed", async () => {
    mocks.reservationMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "reservation-1",
        tenant_id: "tenant-1",
        guest_id: "guest-1",
        post_stay_feedback_status: "completed",
        guests: [{ phone: "+628111111111" }],
      },
      error: null,
    });

    mocks.feedbackRewardRpcMock.mockResolvedValueOnce({
      data: [{ rewarded: false, points_awarded: 0 }],
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/feedback/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "valid-token",
          rating: 4,
          comments: "Pelayanan bagus",
        }),
      }),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ submitted: true, rewardPoints: 0 });
    expect(mocks.feedbackRewardRpcMock).toHaveBeenCalledTimes(1);
  });

  it("returns bad request for invalid rating", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "valid-token",
          rating: 6,
          comments: "Tidak valid",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
