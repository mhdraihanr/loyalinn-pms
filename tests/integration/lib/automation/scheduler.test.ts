import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueScheduledAutomationJobs } from "@/lib/automation/scheduler";

const mocks = vi.hoisted(() => ({
  reservationSelectEqMock: vi.fn(),
  automationJobMaybeSingleMock: vi.fn(),
  automationJobInsertMock: vi.fn(),
  escalationMock: vi.fn(),
}));

vi.mock("@/lib/automation/feedback-escalation", () => ({
  escalatePendingFeedbackToAiFollowup: mocks.escalationMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: () => ({
            eq: mocks.reservationSelectEqMock,
          }),
        };
      }

      if (table === "automation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mocks.automationJobMaybeSingleMock,
              }),
            }),
          }),
          insert: mocks.automationJobInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("enqueueScheduledAutomationJobs", () => {
  beforeEach(() => {
    mocks.reservationSelectEqMock.mockReset();
    mocks.automationJobMaybeSingleMock.mockReset();
    mocks.automationJobInsertMock.mockReset();
    mocks.escalationMock.mockReset();

    mocks.automationJobMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.automationJobInsertMock.mockResolvedValue({ error: null });
    mocks.escalationMock.mockResolvedValue(0);
  });

  it("does not enqueue scheduled jobs before the 10:00 scheduling window", async () => {
    mocks.escalationMock.mockResolvedValueOnce(2);

    const result = await enqueueScheduledAutomationJobs(
      new Date("2026-03-07T09:59:00.000Z"),
    );

    expect(mocks.escalationMock).toHaveBeenCalledTimes(1);
    expect(mocks.reservationSelectEqMock).not.toHaveBeenCalled();
    expect(mocks.automationJobInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
      aiFollowupEscalated: 2,
    });
  });

  it("enqueues pre-arrival jobs once for reservations checking in tomorrow", async () => {
    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-1",
          tenant_id: "tenant-1",
          pms_reservation_id: "BKG-1001",
          check_in_date: "2026-03-08",
        },
      ],
      error: null,
    });

    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await enqueueScheduledAutomationJobs(
      new Date("2026-03-07T10:00:00.000Z"),
    );

    expect(mocks.automationJobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: "pre-arrival",
        reservation_id: "reservation-1",
      }),
    );
    expect(result.preArrivalEnqueued).toBe(1);
    expect(result.aiFollowupEscalated).toBe(0);
  });

  it("enqueues post-stay jobs once", async () => {
    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-2",
          tenant_id: "tenant-2",
          pms_reservation_id: "BKG-2002",
          check_out_date: "2026-03-06",
        },
      ],
      error: null,
    });

    const result = await enqueueScheduledAutomationJobs(
      new Date("2026-03-07T10:00:00.000Z"),
    );

    expect(mocks.automationJobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: "post-stay",
        reservation_id: "reservation-2",
      }),
    );
    expect(result.postStayEnqueued).toBe(1);
    expect(result.aiFollowupEscalated).toBe(0);
  });

  it("only enqueues reservations in the expected H-1 and H+1 date windows", async () => {
    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-1",
          tenant_id: "tenant-1",
          pms_reservation_id: "BKG-1001",
          check_in_date: "2026-03-08",
        },
        {
          id: "reservation-3",
          tenant_id: "tenant-1",
          pms_reservation_id: "BKG-1003",
          check_in_date: "2026-03-09",
        },
      ],
      error: null,
    });
    mocks.reservationSelectEqMock.mockResolvedValueOnce({
      data: [
        {
          id: "reservation-2",
          tenant_id: "tenant-2",
          pms_reservation_id: "BKG-2002",
          check_out_date: "2026-03-06",
        },
        {
          id: "reservation-4",
          tenant_id: "tenant-2",
          pms_reservation_id: "BKG-2004",
          check_out_date: "2026-03-05",
        },
      ],
      error: null,
    });

    const result = await enqueueScheduledAutomationJobs(
      new Date("2026-03-07T10:00:00.000Z"),
    );

    expect(mocks.automationJobInsertMock).toHaveBeenCalledTimes(2);
    expect(mocks.automationJobInsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        trigger_type: "pre-arrival",
        reservation_id: "reservation-1",
      }),
    );
    expect(mocks.automationJobInsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        trigger_type: "post-stay",
        reservation_id: "reservation-2",
      }),
    );
    expect(result).toEqual({
      preArrivalEnqueued: 1,
      postStayEnqueued: 1,
      aiFollowupEscalated: 0,
    });
  });
});
