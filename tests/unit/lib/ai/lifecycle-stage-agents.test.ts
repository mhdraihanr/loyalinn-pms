import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  stepCountIsMock: vi.fn(),
  aiProviderMock: vi.fn(),
  createPreArrivalToolsMock: vi.fn(),
  createOnStayToolsMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateTextMock,
  stepCountIs: mocks.stepCountIsMock,
}));

vi.mock("@/lib/ai/provider", () => ({
  aiProvider: mocks.aiProviderMock,
  AI_MODEL: "test-model",
}));

vi.mock("@/lib/ai/tools", () => ({
  createPreArrivalTools: mocks.createPreArrivalToolsMock,
  createOnStayTools: mocks.createOnStayToolsMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClientMock,
}));

import { processOnStayConversation } from "@/lib/ai/on-stay-agent";
import { processPreArrivalConversation } from "@/lib/ai/pre-arrival-agent";

describe("lifecycle stage agent observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIFECYCLE_AI_DEBUG;
    delete process.env.AI_FEEDBACK_DEBUG;

    mocks.stepCountIsMock.mockReturnValue("stop-4");
    mocks.aiProviderMock.mockReturnValue("provider-model");
    mocks.createAdminClientMock.mockReturnValue({});
    mocks.createPreArrivalToolsMock.mockReturnValue({});
    mocks.createOnStayToolsMock.mockReturnValue({});
    mocks.generateTextMock.mockResolvedValue({
      text: "Acknowledged",
      steps: [
        {
          toolCalls: [],
          content: [],
        },
      ],
    });
  });

  it("logs pre-arrival step and summary when lifecycle debug is enabled", async () => {
    process.env.LIFECYCLE_AI_DEBUG = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await processPreArrivalConversation({
      reservationId: "reservation-pre-1",
      tenantId: "tenant-1",
      guestId: "guest-1",
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      roomNumber: "310",
      messageHistory: [{ role: "user", content: "Saya datang jam 10" }],
      preferredLanguage: "id",
    });

    expect(mocks.generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onStepFinish: expect.any(Function),
      }),
    );

    const onStepFinish = mocks.generateTextMock.mock.calls[0]?.[0]
      ?.onStepFinish as (event: {
      stepNumber: number;
      finishReason: string;
      toolCalls: unknown[];
      toolResults: unknown[];
    }) => void;

    onStepFinish({
      stepNumber: 1,
      finishReason: "tool-calls",
      toolCalls: [{ toolName: "capture_arrival_eta" }],
      toolResults: [{ success: true }],
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "[Lifecycle AI][Pre-arrival] Step",
      expect.objectContaining({
        reservationId: "reservation-pre-1",
        stepNumber: 1,
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[Lifecycle AI][Pre-arrival] Summary",
      expect.objectContaining({
        reservationId: "reservation-pre-1",
      }),
    );
  });

  it("logs on-stay step and summary when lifecycle debug is enabled", async () => {
    process.env.LIFECYCLE_AI_DEBUG = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await processOnStayConversation({
      reservationId: "reservation-stay-1",
      tenantId: "tenant-1",
      guestId: "guest-2",
      guestName: "Bagas",
      hotelName: "Hotel Nusantara",
      roomNumber: "510",
      messageHistory: [{ role: "user", content: "Tolong housekeeping" }],
      preferredLanguage: "id",
    });

    expect(mocks.generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onStepFinish: expect.any(Function),
      }),
    );

    const onStepFinish = mocks.generateTextMock.mock.calls[0]?.[0]
      ?.onStepFinish as (event: {
      stepNumber: number;
      finishReason: string;
      toolCalls: unknown[];
      toolResults: unknown[];
    }) => void;

    onStepFinish({
      stepNumber: 2,
      finishReason: "stop",
      toolCalls: [{ toolName: "request_housekeeping" }],
      toolResults: [{ success: true }],
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "[Lifecycle AI][On-stay] Step",
      expect.objectContaining({
        reservationId: "reservation-stay-1",
        stepNumber: 2,
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[Lifecycle AI][On-stay] Summary",
      expect.objectContaining({
        reservationId: "reservation-stay-1",
      }),
    );
  });
});
