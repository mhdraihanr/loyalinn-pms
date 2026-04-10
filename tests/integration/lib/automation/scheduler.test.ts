import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueScheduledAutomationJobs } from "@/lib/automation/scheduler";

const reservationSelectEqMock = vi.fn();
const reservationUpdateEqMock = vi.fn();
const automationJobMaybeSingleMock = vi.fn();
const automationJobInsertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: () => ({
            eq: reservationSelectEqMock,
          }),
          update: () => ({
            eq: reservationUpdateEqMock,
          }),
        };
      }

      if (table === "automation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: automationJobMaybeSingleMock,
              }),
            }),
          }),
          insert: automationJobInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("enqueueScheduledAutomationJobs", () => {
  beforeEach(() => {
    reservationSelectEqMock.mockReset();
    reservationUpdateEqMock.mockReset();
    automationJobMaybeSingleMock.mockReset();
    automationJobInsertMock.mockReset();

    automationJobMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    automationJobInsertMock.mockResolvedValue({ error: null });
    reservationUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("does not enqueue scheduled jobs before the 10:00 scheduling window", async () => {
    reservationSelectEqMock.mockResolvedValueOnce({
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
    reservationSelectEqMock.mockResolvedValueOnce({
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
      new Date("2026-03-07T09:59:00.000Z"),
    );

    expect(automationJobInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      preArrivalEnqueued: 0,
      postStayEnqueued: 0,
    });
  });

  it("enqueues pre-arrival jobs once for reservations checking in tomorrow", async () => {
    reservationSelectEqMock.mockResolvedValueOnce({
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

    reservationSelectEqMock.mockResolvedValueOnce({ data: [], error: null });

    const result = await enqueueScheduledAutomationJobs(
      new Date("2026-03-07T10:00:00.000Z"),
    );

    expect(automationJobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: "pre-arrival",
        reservation_id: "reservation-1",
      }),
    );
    expect(result.preArrivalEnqueued).toBe(1);
  });

  it("enqueues post-stay jobs once and marks feedback as pending", async () => {
    reservationSelectEqMock.mockResolvedValueOnce({ data: [], error: null });
    reservationSelectEqMock.mockResolvedValueOnce({
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

    expect(automationJobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: "post-stay",
        reservation_id: "reservation-2",
      }),
    );
    expect(reservationUpdateEqMock).toHaveBeenCalledWith("id", "reservation-2");
    expect(result.postStayEnqueued).toBe(1);
  });

  it("only enqueues reservations in the expected H-1 and H+1 date windows", async () => {
    reservationSelectEqMock.mockResolvedValueOnce({
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
    reservationSelectEqMock.mockResolvedValueOnce({
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

    expect(automationJobInsertMock).toHaveBeenCalledTimes(2);
    expect(automationJobInsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        trigger_type: "pre-arrival",
        reservation_id: "reservation-1",
      }),
    );
    expect(automationJobInsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        trigger_type: "post-stay",
        reservation_id: "reservation-2",
      }),
    );
    expect(result).toEqual({
      preArrivalEnqueued: 1,
      postStayEnqueued: 1,
    });
  });
});
