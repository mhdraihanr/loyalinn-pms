import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/pms-sync/route";

const mocks = vi.hoisted(() => ({
  pmsConfigEqMock: vi.fn(),
  getPMSAdapterMock: vi.fn(),
  runAutoSyncForTenantMock: vi.fn(),
  adapterInitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "pms_configurations") {
        return {
          select: () => ({
            eq: mocks.pmsConfigEqMock,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/pms/registry", () => ({
  getPMSAdapter: mocks.getPMSAdapterMock,
}));

vi.mock("@/lib/pms/auto-sync-service", () => ({
  runAutoSyncForTenant: mocks.runAutoSyncForTenantMock,
}));

describe("GET /api/cron/pms-sync", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T10:00:00.000Z"));
    mocks.pmsConfigEqMock.mockReset();
    mocks.getPMSAdapterMock.mockReset();
    mocks.runAutoSyncForTenantMock.mockReset();
    mocks.adapterInitMock.mockReset();

    mocks.getPMSAdapterMock.mockReturnValue({
      init: mocks.adapterInitMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/pms-sync", { method: "GET" }),
    );

    expect(response.status).toBe(401);
  });

  it("processes all active PMS configurations and aggregates the sync result", async () => {
    mocks.pmsConfigEqMock.mockResolvedValue({
      data: [
        {
          tenant_id: "tenant-1",
          pms_type: "qloapps",
          endpoint: "https://qloapps-1.test",
          credentials: { api_key: "key-1" },
        },
        {
          tenant_id: "tenant-2",
          pms_type: "qloapps",
          endpoint: "https://qloapps-2.test",
          credentials: { api_key: "key-2" },
        },
      ],
      error: null,
    });
    mocks.runAutoSyncForTenantMock
      .mockResolvedValueOnce({
        reservationsSynced: 2,
        eventsCreated: 1,
        jobsEnqueued: 1,
      })
      .mockResolvedValueOnce({
        reservationsSynced: 3,
        eventsCreated: 0,
        jobsEnqueued: 0,
      });

    const response = await GET(
      new Request("http://localhost/api/cron/pms-sync", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.adapterInitMock).toHaveBeenCalledTimes(2);
    expect(mocks.runAutoSyncForTenantMock).toHaveBeenCalledTimes(2);
    expect(mocks.runAutoSyncForTenantMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        startDate: "2026-02-05",
        endDate: "2026-04-06",
      }),
    );
    expect(json).toEqual({
      tenantsProcessed: 2,
      tenantsFailed: 0,
      reservationsSynced: 5,
      eventsCreated: 1,
      jobsEnqueued: 1,
    });
  });

  it("continues processing other tenants when one sync fails", async () => {
    mocks.pmsConfigEqMock.mockResolvedValue({
      data: [
        {
          tenant_id: "tenant-1",
          pms_type: "qloapps",
          endpoint: "https://qloapps-1.test",
          credentials: { api_key: "key-1" },
        },
        {
          tenant_id: "tenant-2",
          pms_type: "qloapps",
          endpoint: "https://qloapps-2.test",
          credentials: { api_key: "key-2" },
        },
      ],
      error: null,
    });
    mocks.runAutoSyncForTenantMock
      .mockRejectedValueOnce(new Error("tenant 1 failed"))
      .mockResolvedValueOnce({
        reservationsSynced: 1,
        eventsCreated: 1,
        jobsEnqueued: 0,
      });

    const response = await GET(
      new Request("http://localhost/api/cron/pms-sync", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      tenantsProcessed: 1,
      tenantsFailed: 1,
      reservationsSynced: 1,
      eventsCreated: 1,
      jobsEnqueued: 0,
    });
  });
});
