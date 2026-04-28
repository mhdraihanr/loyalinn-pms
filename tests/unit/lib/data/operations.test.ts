import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClientMock,
}));

import { getArrivalRequests } from "@/lib/data/operations";

describe("operations data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches active arrival requests for the current tenant", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ id: "arrival-1", request_type: "early_checkin" }],
      error: null,
    });
    const inMock = vi.fn(() => ({ order: orderMock }));
    const eqMock = vi.fn(() => ({ in: inMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    mocks.createClientMock.mockResolvedValue({ from: fromMock });

    const result = await getArrivalRequests("tenant-1");

    expect(fromMock).toHaveBeenCalledWith("arrival_requests");
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("request_type"));
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("reservations"));
    expect(eqMock).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(inMock).toHaveBeenCalledWith("status", ["pending", "in-progress"]);
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([{ id: "arrival-1", request_type: "early_checkin" }]);
  });
});
