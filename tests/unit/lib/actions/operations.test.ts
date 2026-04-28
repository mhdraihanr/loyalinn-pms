import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireUserTenantMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClientMock,
}));

vi.mock("@/lib/auth/tenant", () => ({
  requireUserTenant: mocks.requireUserTenantMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePathMock,
}));

import { updateArrivalRequestStatus } from "@/lib/actions/operations";

describe("operations actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserTenantMock.mockResolvedValue({ tenantId: "tenant-1" });
  });

  it("updates arrival request status within the current tenant", async () => {
    const eqTenantMock = vi.fn().mockResolvedValue({ error: null });
    const eqIdMock = vi.fn(() => ({ eq: eqTenantMock }));
    const updateMock = vi.fn(() => ({ eq: eqIdMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));

    mocks.createClientMock.mockResolvedValue({ from: fromMock });

    const result = await updateArrivalRequestStatus("arrival-1", "resolved");

    expect(fromMock).toHaveBeenCalledWith("arrival_requests");
    expect(updateMock).toHaveBeenCalledWith({
      status: "resolved",
      updated_at: expect.any(String),
    });
    expect(eqIdMock).toHaveBeenCalledWith("id", "arrival-1");
    expect(eqTenantMock).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(mocks.revalidatePathMock).toHaveBeenCalledWith("/operations");
    expect(result).toEqual({ success: true });
  });
});
