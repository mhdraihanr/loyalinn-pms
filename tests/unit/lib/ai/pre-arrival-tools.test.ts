import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

import { createPreArrivalTools } from "@/lib/ai/tools";

type ToolDefinition = {
  execute: (input: Record<string, unknown>) => Promise<string>;
};

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn((table: string) => {
    if (table === "arrival_requests") {
      return { insert: insertMock };
    }

    if (table === "lifecycle_ai_sessions") {
      return { upsert: upsertMock };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from: fromMock },
    fromMock,
    insertMock,
    upsertMock,
  };
}

describe("pre-arrival tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores arrival ETA in the operational arrival request queue", async () => {
    const { supabase, fromMock, insertMock } = createSupabaseMock();
    const tools = createPreArrivalTools({
      supabase: supabase as never,
      tenantId: "tenant-1",
      reservationId: "reservation-1",
      guestId: "guest-1",
      roomNumber: "301",
      language: "en",
      stage: "pre-arrival",
    });

    await (tools.capture_arrival_eta as unknown as ToolDefinition).execute({
      eta: "14:30",
      notes: "Flight lands at 13:45",
    });

    expect(fromMock).toHaveBeenCalledWith("arrival_requests");
    expect(insertMock).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      reservation_id: "reservation-1",
      guest_id: "guest-1",
      room_number: "301",
      request_type: "arrival_eta",
      eta: "14:30",
      requested_time: null,
      details: { notes: "Flight lands at 13:45" },
      status: "pending",
    });
  });

  it("stores early check-in requests as pending arrival requests", async () => {
    const { supabase, insertMock } = createSupabaseMock();
    const tools = createPreArrivalTools({
      supabase: supabase as never,
      tenantId: "tenant-1",
      reservationId: "reservation-1",
      guestId: "guest-1",
      roomNumber: "301",
      language: "en",
      stage: "pre-arrival",
    });

    await (tools.request_early_checkin as unknown as ToolDefinition).execute({
      requested_time: "11:00",
      reason: "Arriving with children",
    });

    expect(insertMock).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      reservation_id: "reservation-1",
      guest_id: "guest-1",
      room_number: "301",
      request_type: "early_checkin",
      eta: null,
      requested_time: "11:00",
      details: { reason: "Arriving with children" },
      status: "pending",
    });
  });
});
