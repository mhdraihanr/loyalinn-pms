import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAutoSyncForTenant } from "@/lib/pms/auto-sync-service";

const mocks = vi.hoisted(() => ({
  reservationsEqMock: vi.fn(),
  guestsUpsertSingleMock: vi.fn(),
  reservationsUpsertSingleMock: vi.fn(),
  inboundEventInsertMock: vi.fn(),
  inboundEventSingleMock: vi.fn(),
  automationJobInsertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "reservations") {
        return {
          select: () => ({
            eq: mocks.reservationsEqMock,
          }),
          upsert: () => ({
            select: () => ({
              single: mocks.reservationsUpsertSingleMock,
            }),
          }),
        };
      }

      if (table === "guests") {
        return {
          upsert: () => ({
            select: () => ({
              single: mocks.guestsUpsertSingleMock,
            }),
          }),
        };
      }

      if (table === "inbound_events") {
        return {
          insert: mocks.inboundEventInsertMock,
        };
      }

      if (table === "automation_jobs") {
        return {
          insert: mocks.automationJobInsertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

mocks.inboundEventInsertMock.mockImplementation(() => ({
  select: () => ({
    single: mocks.inboundEventSingleMock,
  }),
}));

const adapter = {
  pullReservations: vi.fn(),
  pullGuest: vi.fn(),
  mapStatus: vi.fn(),
};

describe("runAutoSyncForTenant", () => {
  beforeEach(() => {
    mocks.reservationsEqMock.mockReset();
    mocks.guestsUpsertSingleMock.mockReset();
    mocks.reservationsUpsertSingleMock.mockReset();
    mocks.inboundEventInsertMock.mockClear();
    mocks.inboundEventSingleMock.mockReset();
    mocks.automationJobInsertMock.mockReset();
    adapter.pullReservations.mockReset();
    adapter.pullGuest.mockReset();
    adapter.mapStatus.mockReset();

    mocks.inboundEventInsertMock.mockImplementation(() => ({
      select: () => ({
        single: mocks.inboundEventSingleMock,
      }),
    }));

    adapter.pullGuest.mockResolvedValue({
      pms_guest_id: "guest-1",
      name: "Rina",
      email: "rina@example.com",
      phone: "+628123456789",
      country: "Indonesia",
    });
    mocks.guestsUpsertSingleMock.mockResolvedValue({
      data: { id: "guest-row-1" },
      error: null,
    });
    mocks.reservationsUpsertSingleMock.mockResolvedValue({
      data: { id: "reservation-row-1" },
      error: null,
    });
    mocks.inboundEventSingleMock.mockResolvedValue({
      data: { id: "event-1" },
      error: null,
    });
    mocks.automationJobInsertMock.mockResolvedValue({ error: null });
  });

  it("does not create events when the polled reservation matches the current database state", async () => {
    mocks.reservationsEqMock.mockResolvedValue({
      data: [
        {
          id: "reservation-row-1",
          guest_id: "guest-row-1",
          pms_reservation_id: "O1-R101",
          status: "pre-arrival",
          check_in_date: "2026-03-08",
          check_out_date: "2026-03-10",
          room_number: "101",
          amount: 1500000,
          source: "QloApps Web",
        },
      ],
      error: null,
    });
    adapter.pullReservations.mockResolvedValue([
      {
        pms_reservation_id: "O1-R101",
        pms_guest_id: "guest-1",
        room_number: "101",
        check_in_date: "2026-03-08",
        check_out_date: "2026-03-10",
        pms_status: "1",
        amount: 1500000,
        source: "QloApps Web",
      },
    ]);
    adapter.mapStatus.mockReturnValue("pre-arrival");

    const result = await runAutoSyncForTenant({
      tenantId: "tenant-1",
      adapter,
      startDate: "2026-02-29",
      endDate: "2026-03-14",
    });

    expect(mocks.inboundEventSingleMock).not.toHaveBeenCalled();
    expect(mocks.automationJobInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      reservationsSynced: 1,
      eventsCreated: 0,
      jobsEnqueued: 0,
    });
  });

  it("creates an inbound event and an on-stay job when a reservation transitions to on-stay", async () => {
    mocks.reservationsEqMock.mockResolvedValue({
      data: [
        {
          id: "reservation-row-1",
          guest_id: "guest-row-1",
          pms_reservation_id: "O1-R101",
          status: "pre-arrival",
          check_in_date: "2026-03-08",
          check_out_date: "2026-03-10",
          room_number: "101",
          amount: 1500000,
          source: "QloApps Web",
        },
      ],
      error: null,
    });
    adapter.pullReservations.mockResolvedValue([
      {
        pms_reservation_id: "O1-R101",
        pms_guest_id: "guest-1",
        room_number: "101",
        check_in_date: "2026-03-08",
        check_out_date: "2026-03-10",
        pms_status: "2",
        amount: 1500000,
        source: "QloApps Web",
      },
    ]);
    adapter.mapStatus.mockReturnValue("on-stay");

    const result = await runAutoSyncForTenant({
      tenantId: "tenant-1",
      adapter,
      startDate: "2026-02-29",
      endDate: "2026-03-14",
    });

    expect(mocks.inboundEventSingleMock).toHaveBeenCalled();
    expect(mocks.automationJobInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        reservation_id: "reservation-row-1",
        trigger_type: "on-stay",
      }),
    );
    expect(result).toEqual({
      reservationsSynced: 1,
      eventsCreated: 1,
      jobsEnqueued: 1,
    });
  });

  it("records a checked-out change without enqueueing a duplicate automation job", async () => {
    mocks.reservationsEqMock.mockResolvedValue({
      data: [
        {
          id: "reservation-row-1",
          guest_id: "guest-row-1",
          pms_reservation_id: "O1-R101",
          status: "on-stay",
          check_in_date: "2026-03-08",
          check_out_date: "2026-03-10",
          room_number: "101",
          amount: 1500000,
          source: "QloApps Web",
        },
      ],
      error: null,
    });
    adapter.pullReservations.mockResolvedValue([
      {
        pms_reservation_id: "O1-R101",
        pms_guest_id: "guest-1",
        room_number: "101",
        check_in_date: "2026-03-08",
        check_out_date: "2026-03-10",
        pms_status: "3",
        amount: 1500000,
        source: "QloApps Web",
      },
    ]);
    adapter.mapStatus.mockReturnValue("checked-out");

    const result = await runAutoSyncForTenant({
      tenantId: "tenant-1",
      adapter,
      startDate: "2026-02-29",
      endDate: "2026-03-14",
    });

    expect(mocks.inboundEventSingleMock).toHaveBeenCalled();
    expect(mocks.automationJobInsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      reservationsSynced: 1,
      eventsCreated: 1,
      jobsEnqueued: 0,
    });
  });

  it("uses a stable idempotency key for the same change across polling retries", async () => {
    mocks.reservationsEqMock.mockResolvedValue({
      data: [
        {
          id: "reservation-row-1",
          guest_id: "guest-row-1",
          pms_reservation_id: "O1-R101",
          status: "pre-arrival",
          check_in_date: "2026-03-08",
          check_out_date: "2026-03-10",
          room_number: "101",
          amount: 1500000,
          source: "QloApps Web",
        },
      ],
      error: null,
    });
    adapter.pullReservations.mockResolvedValue([
      {
        pms_reservation_id: "O1-R101",
        pms_guest_id: "guest-1",
        room_number: "101",
        check_in_date: "2026-03-08",
        check_out_date: "2026-03-10",
        pms_status: "2",
        amount: 1500000,
        source: "QloApps Web",
      },
    ]);
    adapter.mapStatus.mockReturnValue("on-stay");

    await runAutoSyncForTenant({
      tenantId: "tenant-1",
      adapter,
      startDate: "2026-02-29",
      endDate: "2026-03-14",
      now: new Date("2026-03-07T10:00:00.000Z"),
    });
    await runAutoSyncForTenant({
      tenantId: "tenant-1",
      adapter,
      startDate: "2026-02-29",
      endDate: "2026-03-14",
      now: new Date("2026-03-07T10:05:00.000Z"),
    });

    const firstInsert = mocks.inboundEventInsertMock.mock.calls[0]?.[0];
    const secondInsert = mocks.inboundEventInsertMock.mock.calls[1]?.[0];

    expect(firstInsert.idempotency_key).toBe(secondInsert.idempotency_key);
  });
});
