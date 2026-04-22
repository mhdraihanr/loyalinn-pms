import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/waha/start/route";

const mocks = vi.hoisted(() => ({
  getCurrentUserTenantMock: vi.fn(),
  startSessionMock: vi.fn(),
  updateSessionConfigMock: vi.fn(),
}));

vi.mock("@/lib/auth/tenant", () => ({
  getCurrentUserTenant: mocks.getCurrentUserTenantMock,
}));

vi.mock("@/lib/waha/client", () => ({
  wahaClient: {
    startSession: mocks.startSessionMock,
    updateSessionConfig: mocks.updateSessionConfigMock,
  },
}));

describe("POST /api/waha/start", () => {
  const originalEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    WAHA_WEBHOOK_URL: process.env.WAHA_WEBHOOK_URL,
    WAHA_WEBHOOK_EVENTS: process.env.WAHA_WEBHOOK_EVENTS,
    WAHA_WEBHOOK_SECRET: process.env.WAHA_WEBHOOK_SECRET,
    WHATSAPP_HOOK_URL: process.env.WHATSAPP_HOOK_URL,
    WHATSAPP_HOOK_EVENTS: process.env.WHATSAPP_HOOK_EVENTS,
    WAHA_AUTO_CONFIGURE_WEBHOOKS: process.env.WAHA_AUTO_CONFIGURE_WEBHOOKS,
  };

  beforeEach(() => {
    mocks.getCurrentUserTenantMock.mockReset();
    mocks.startSessionMock.mockReset();
    mocks.updateSessionConfigMock.mockReset();

    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.WAHA_WEBHOOK_SECRET = "waha-secret";
    delete process.env.WAHA_WEBHOOK_URL;
    delete process.env.WAHA_WEBHOOK_EVENTS;
    delete process.env.WHATSAPP_HOOK_URL;
    delete process.env.WHATSAPP_HOOK_EVENTS;
    delete process.env.WAHA_AUTO_CONFIGURE_WEBHOOKS;

    mocks.getCurrentUserTenantMock.mockResolvedValue({
      tenantId: "tenant-1",
      role: "owner",
    });
    mocks.startSessionMock.mockResolvedValue({ status: "STARTING" });
    mocks.updateSessionConfigMock.mockResolvedValue({
      message: "Session updated successfully",
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    process.env.WAHA_WEBHOOK_URL = originalEnv.WAHA_WEBHOOK_URL;
    process.env.WAHA_WEBHOOK_EVENTS = originalEnv.WAHA_WEBHOOK_EVENTS;
    process.env.WAHA_WEBHOOK_SECRET = originalEnv.WAHA_WEBHOOK_SECRET;
    process.env.WHATSAPP_HOOK_URL = originalEnv.WHATSAPP_HOOK_URL;
    process.env.WHATSAPP_HOOK_EVENTS = originalEnv.WHATSAPP_HOOK_EVENTS;
    process.env.WAHA_AUTO_CONFIGURE_WEBHOOKS =
      originalEnv.WAHA_AUTO_CONFIGURE_WEBHOOKS;
  });

  it("returns unauthorized when user tenant is missing", async () => {
    mocks.getCurrentUserTenantMock.mockResolvedValueOnce(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mocks.startSessionMock).not.toHaveBeenCalled();
    expect(mocks.updateSessionConfigMock).not.toHaveBeenCalled();
  });

  it("starts default session and auto-registers webhook config", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.startSessionMock).toHaveBeenCalledWith("default");
    expect(mocks.updateSessionConfigMock).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        webhooks: [
          expect.objectContaining({
            url: "http://host.docker.internal:3000/api/webhooks/waha",
            events: ["message.any"],
            hmac: { key: "waha-secret" },
          }),
        ],
      }),
    );
  });

  it("uses explicit webhook URL and custom event list when provided", async () => {
    process.env.WAHA_WEBHOOK_URL = "https://example.com/api/webhooks/waha";
    process.env.WAHA_WEBHOOK_EVENTS = "message,state.change";

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.updateSessionConfigMock).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        webhooks: [
          expect.objectContaining({
            url: "https://example.com/api/webhooks/waha",
            events: ["message", "state.change"],
          }),
        ],
      }),
    );
  });

  it("returns 500 when webhook auto-registration fails", async () => {
    mocks.updateSessionConfigMock.mockRejectedValueOnce(
      new Error("failed to update session config"),
    );

    const response = await POST();

    expect(response.status).toBe(500);
    expect(mocks.startSessionMock).toHaveBeenCalledWith("default");
  });

  it("drops redundant message event when message.any is present", async () => {
    process.env.WAHA_WEBHOOK_EVENTS = "message,message.any,state.change";

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.updateSessionConfigMock).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        webhooks: [
          expect.objectContaining({
            events: ["message.any", "state.change"],
          }),
        ],
      }),
    );
  });

  it("skips session webhook registration when matching global webhook is already configured", async () => {
    process.env.WHATSAPP_HOOK_URL =
      "http://host.docker.internal:3000/api/webhooks/waha";
    process.env.WHATSAPP_HOOK_EVENTS = "message.any";

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateSessionConfigMock).not.toHaveBeenCalled();
    expect(json).toEqual(
      expect.objectContaining({
        webhooksConfigured: false,
        webhooksSkipReason: "global-webhook-configured",
      }),
    );
  });
});
