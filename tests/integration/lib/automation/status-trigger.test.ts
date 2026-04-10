import { beforeEach, describe, expect, it, vi } from "vitest";

import { processStatusTriggerJob } from "@/lib/automation/status-trigger";

const mocks = vi.hoisted(() => ({
  reservationMaybeSingleMock: vi.fn(),
  templateMaybeSingleMock: vi.fn(),
  existingLogMaybeSingleMock: vi.fn(),
  messageLogSingleMock: vi.fn(),
  messageLogUpdateEqMock: vi.fn(),
  sendMessageMock: vi.fn(),
  completeAutomationJobMock: vi.fn(),
  deadLetterAutomationJobMock: vi.fn(),
}));

vi.mock("@/lib/waha/client", () => ({
  wahaClient: {
    sendMessage: mocks.sendMessageMock,
  },
}));

vi.mock("@/lib/automation/queue", () => ({
  completeAutomationJob: mocks.completeAutomationJobMock,
  deadLetterAutomationJob: mocks.deadLetterAutomationJobMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
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
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: mocks.existingLogMaybeSingleMock,
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: mocks.messageLogSingleMock,
            }),
          }),
          update: () => ({
            eq: mocks.messageLogUpdateEqMock,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

const baseReservation = {
  id: "reservation-1",
  status: "on-stay",
  updated_at: "2026-03-07T11:00:00Z",
  room_number: "301",
  check_in_date: "2026-03-07",
  check_out_date: "2026-03-10",
  guests: {
    id: "guest-1",
    name: "Rina",
    phone: "+628123456789",
  },
  tenants: {
    name: "Hotel Nusantara",
  },
};

const baseTemplate = {
  id: "template-1",
  message_template_variants: [
    {
      language_code: "en",
      content:
        "Hello {{guestName}}, room {{roomNumber}} is ready at {{hotelName}}.",
    },
  ],
};

describe("processStatusTriggerJob", () => {
  beforeEach(() => {
    mocks.reservationMaybeSingleMock.mockReset();
    mocks.templateMaybeSingleMock.mockReset();
    mocks.existingLogMaybeSingleMock.mockReset();
    mocks.messageLogSingleMock.mockReset();
    mocks.messageLogUpdateEqMock.mockReset();
    mocks.sendMessageMock.mockReset();
    mocks.completeAutomationJobMock.mockReset();
    mocks.deadLetterAutomationJobMock.mockReset();

    mocks.reservationMaybeSingleMock.mockResolvedValue({
      data: baseReservation,
      error: null,
    });
    mocks.templateMaybeSingleMock.mockResolvedValue({
      data: baseTemplate,
      error: null,
    });
    mocks.existingLogMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.messageLogSingleMock.mockResolvedValue({
      data: { id: "log-1" },
      error: null,
    });
    mocks.messageLogUpdateEqMock.mockResolvedValue({ error: null });
    mocks.sendMessageMock.mockResolvedValue({ id: "provider-1" });
  });

  it("sends an on-stay message on the first valid transition", async () => {
    await processStatusTriggerJob({
      id: "job-1",
      tenantId: "tenant-1",
      triggerType: "on-stay",
      payload: {
        booking_id: "BKG-1001",
        status: "on-stay",
        previous_status: "pre-arrival",
        updated_at: "2026-03-07T12:00:00Z",
      },
    });

    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      "default",
      "+628123456789",
      "Hello Rina, room 301 is ready at Hotel Nusantara.",
    );
    expect(mocks.completeAutomationJobMock).toHaveBeenCalledWith(
      "job-1",
      "log-1",
    );
  });

  it("skips out-of-order events without sending a message", async () => {
    await processStatusTriggerJob({
      id: "job-2",
      tenantId: "tenant-1",
      triggerType: "on-stay",
      payload: {
        booking_id: "BKG-1001",
        status: "on-stay",
        previous_status: "pre-arrival",
        updated_at: "2026-03-07T10:00:00Z",
      },
    });

    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(mocks.completeAutomationJobMock).toHaveBeenCalledWith(
      "job-2",
      undefined,
    );
  });

  it("dead-letters the job when the guest phone number is missing", async () => {
    mocks.reservationMaybeSingleMock.mockResolvedValue({
      data: {
        ...baseReservation,
        guests: { ...baseReservation.guests, phone: null },
      },
      error: null,
    });

    await processStatusTriggerJob({
      id: "job-3",
      tenantId: "tenant-1",
      triggerType: "on-stay",
      payload: {
        booking_id: "BKG-1001",
        status: "on-stay",
        updated_at: "2026-03-07T12:00:00Z",
      },
    });

    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(mocks.deadLetterAutomationJobMock).toHaveBeenCalledWith(
      "job-3",
      "validation",
      "Guest phone number is missing",
    );
  });

  it("dead-letters the job when no template is available for the trigger", async () => {
    mocks.templateMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    await processStatusTriggerJob({
      id: "job-4",
      tenantId: "tenant-1",
      triggerType: "on-stay",
      payload: {
        booking_id: "BKG-1001",
        status: "on-stay",
        updated_at: "2026-03-07T12:00:00Z",
      },
    });

    expect(mocks.sendMessageMock).not.toHaveBeenCalled();
    expect(mocks.deadLetterAutomationJobMock).toHaveBeenCalledWith(
      "job-4",
      "validation",
      "No template variant available for trigger",
    );
  });
});
