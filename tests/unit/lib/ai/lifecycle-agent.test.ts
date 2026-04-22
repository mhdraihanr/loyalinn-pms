import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processPreArrivalConversationMock: vi.fn(),
  processOnStayConversationMock: vi.fn(),
  processPostStayLifecycleConversationMock: vi.fn(),
}));

vi.mock("@/lib/ai/pre-arrival-agent", () => ({
  processPreArrivalConversation: mocks.processPreArrivalConversationMock,
}));

vi.mock("@/lib/ai/on-stay-agent", () => ({
  processOnStayConversation: mocks.processOnStayConversationMock,
}));

vi.mock("@/lib/ai/agent", () => ({
  processPostStayLifecycleConversation:
    mocks.processPostStayLifecycleConversationMock,
}));

import { processLifecycleGuestMessage } from "@/lib/ai/lifecycle-agent";

describe("processLifecycleGuestMessage", () => {
  beforeEach(() => {
    mocks.processPreArrivalConversationMock.mockReset();
    mocks.processOnStayConversationMock.mockReset();
    mocks.processPostStayLifecycleConversationMock.mockReset();
  });

  it("routes pre-arrival stage to pre-arrival agent", async () => {
    mocks.processPreArrivalConversationMock.mockResolvedValueOnce({
      response: "Pre-arrival handled",
    });

    const result = await processLifecycleGuestMessage({
      stage: "pre-arrival",
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      guestId: "guest-1",
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      roomNumber: "301",
      messageHistory: [{ role: "user", content: "Saya datang jam 10" }],
      preferredLanguage: "id",
    });

    expect(result).toEqual({ response: "Pre-arrival handled" });
    expect(mocks.processPreArrivalConversationMock).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      tenantId: "tenant-1",
      guestId: "guest-1",
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      roomNumber: "301",
      messageHistory: [{ role: "user", content: "Saya datang jam 10" }],
      preferredLanguage: "id",
    });
    expect(mocks.processOnStayConversationMock).not.toHaveBeenCalled();
    expect(
      mocks.processPostStayLifecycleConversationMock,
    ).not.toHaveBeenCalled();
  });

  it("routes on-stay stage to on-stay agent", async () => {
    mocks.processOnStayConversationMock.mockResolvedValueOnce({
      response: "On-stay handled",
    });

    const result = await processLifecycleGuestMessage({
      stage: "on-stay",
      reservationId: "reservation-2",
      tenantId: "tenant-1",
      guestId: "guest-2",
      guestName: "Bagas",
      hotelName: "Hotel Nusantara",
      roomNumber: "302",
      messageHistory: [{ role: "user", content: "Tolong room service" }],
      preferredLanguage: "id",
    });

    expect(result).toEqual({ response: "On-stay handled" });
    expect(mocks.processOnStayConversationMock).toHaveBeenCalledWith({
      reservationId: "reservation-2",
      tenantId: "tenant-1",
      guestId: "guest-2",
      guestName: "Bagas",
      hotelName: "Hotel Nusantara",
      roomNumber: "302",
      messageHistory: [{ role: "user", content: "Tolong room service" }],
      preferredLanguage: "id",
    });
    expect(mocks.processPreArrivalConversationMock).not.toHaveBeenCalled();
    expect(
      mocks.processPostStayLifecycleConversationMock,
    ).not.toHaveBeenCalled();
  });

  it("routes post-stay stage to existing post-stay agent", async () => {
    mocks.processPostStayLifecycleConversationMock.mockResolvedValueOnce({
      response: "Post-stay handled",
    });

    const result = await processLifecycleGuestMessage({
      stage: "post-stay",
      reservationId: "reservation-3",
      tenantId: "tenant-1",
      guestId: "guest-3",
      guestName: "Kevin",
      hotelName: "Hotel Nusantara",
      roomNumber: "303",
      messageHistory: [{ role: "user", content: "Saya mau kasih feedback" }],
      preferredLanguage: "en",
    });

    expect(result).toEqual({ response: "Post-stay handled" });
    expect(mocks.processPostStayLifecycleConversationMock).toHaveBeenCalledWith(
      "reservation-3",
      "tenant-1",
      "Kevin",
      "Hotel Nusantara",
      [{ role: "user", content: "Saya mau kasih feedback" }],
      "en",
    );
    expect(mocks.processPreArrivalConversationMock).not.toHaveBeenCalled();
    expect(mocks.processOnStayConversationMock).not.toHaveBeenCalled();
  });
});
