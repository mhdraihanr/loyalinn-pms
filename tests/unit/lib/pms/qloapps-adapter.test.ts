import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QloAppsAdapter } from "@/lib/pms/qloapps-adapter";

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    statusText: ok ? "OK" : "ERROR",
    async json() {
      return payload;
    },
  } as Response;
}

describe("QloAppsAdapter.pullGuest", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("prefers the latest phone from customers resource when address phone is stale", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        customer: {
          firstname: "Rina",
          lastname: "Putri",
          email: "rina@example.com",
          phone: "081299999999",
        },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: [
          {
            id_customer: "42",
            phone_mobile: "081200000000",
            phone: "081200000000",
            id_country: "110",
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        country: {
          name: [{ id: "1", value: "Indonesia" }],
        },
      }),
    );

    const adapter = new QloAppsAdapter();
    adapter.init({ api_key: "secret" }, "http://localhost:8080");

    const guest = await adapter.pullGuest("42");

    expect(guest).toEqual(
      expect.objectContaining({
        pms_guest_id: "42",
        phone: "081299999999",
        country: "Indonesia",
      }),
    );
  });

  it("falls back to address phone when customer phone is empty", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        customer: {
          firstname: "Ayu",
          lastname: "Lestari",
          email: "ayu@example.com",
          phone: "",
        },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        addresses: {
          id_customer: "7",
          phone_mobile: "081355577788",
          id_country: "110",
        },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        country: {
          name: [{ id: "1", value: "Indonesia" }],
        },
      }),
    );

    const adapter = new QloAppsAdapter();
    adapter.init({ api_key: "secret" }, "http://localhost:8080");

    const guest = await adapter.pullGuest("7");

    expect(guest).toEqual(
      expect.objectContaining({
        pms_guest_id: "7",
        phone: "081355577788",
      }),
    );
  });
});
