import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: mocks.createMock,
  },
}));

describe("wahaClient", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getMock.mockReset();
    mocks.postMock.mockReset();
    mocks.createMock.mockReset();
    mocks.createMock.mockReturnValue({
      get: mocks.getMock,
      post: mocks.postMock,
    });
  });

  it("sends text through the documented WAHA endpoint with session in the body", async () => {
    mocks.postMock.mockResolvedValue({ data: { id: "provider-1" } });

    const { wahaClient } = await import("@/lib/waha/client");

    await wahaClient.sendMessage(
      "default",
      "6285281829035@c.us",
      "Automation smoke test",
    );

    expect(mocks.postMock).toHaveBeenCalledWith("/api/sendText", {
      session: "default",
      chatId: "6285281829035@c.us",
      text: "Automation smoke test",
    });
  });

  it("normalizes Indonesian local mobile numbers to WhatsApp chat ids", async () => {
    mocks.postMock.mockResolvedValue({ data: { id: "provider-2" } });

    const { wahaClient } = await import("@/lib/waha/client");

    await wahaClient.sendMessage(
      "default",
      "081219148751",
      "Local number normalization test",
    );

    expect(mocks.postMock).toHaveBeenCalledWith("/api/sendText", {
      session: "default",
      chatId: "6281219148751@c.us",
      text: "Local number normalization test",
    });
  });

  it("normalizes international numbers and legacy s.whatsapp.net ids", async () => {
    mocks.postMock.mockResolvedValue({ data: { id: "provider-3" } });

    const { wahaClient } = await import("@/lib/waha/client");

    await wahaClient.sendMessage(
      "default",
      "+628123456789",
      "Plus format normalization test",
    );

    expect(mocks.postMock).toHaveBeenNthCalledWith(1, "/api/sendText", {
      session: "default",
      chatId: "628123456789@c.us",
      text: "Plus format normalization test",
    });

    await wahaClient.sendMessage(
      "default",
      "628123456789@s.whatsapp.net",
      "Legacy id normalization test",
    );

    expect(mocks.postMock).toHaveBeenNthCalledWith(2, "/api/sendText", {
      session: "default",
      chatId: "628123456789@c.us",
      text: "Legacy id normalization test",
    });
  });

  it("preserves non-user chat identifiers", async () => {
    mocks.postMock.mockResolvedValue({ data: { id: "provider-4" } });

    const { wahaClient } = await import("@/lib/waha/client");

    await wahaClient.sendMessage(
      "default",
      "123456789@g.us",
      "Group id passthrough test",
    );

    expect(mocks.postMock).toHaveBeenCalledWith("/api/sendText", {
      session: "default",
      chatId: "123456789@g.us",
      text: "Group id passthrough test",
    });
  });
});
