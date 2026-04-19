import { describe, expect, it } from "vitest";

import {
  buildFeedbackSavedSystemInfo,
  buildGuestFeedbackSystemPrompt,
  isRetryableProviderRateLimitError,
} from "@/lib/ai/agent";

describe("buildGuestFeedbackSystemPrompt", () => {
  it("injects tenant-configured AI context into the system prompt", () => {
    const prompt = buildGuestFeedbackSystemPrompt({
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      aiSettings: {
        hotel_name: "Hotel Merdeka",
        ai_name: "Ayu",
        tone_of_voice: "Hangat dan profesional",
        custom_instructions:
          "Jika rating 4 atau 5, arahkan tamu ke promo sarapan gratis.",
      },
    });

    expect(prompt).toContain('hotel "Hotel Merdeka"');
    expect(prompt).toContain('nama "Rina"');
    expect(prompt).toContain("Ayu");
    expect(prompt).toContain("Hangat dan profesional");
    expect(prompt).toContain("promo sarapan gratis");
  });

  it("falls back to reservation hotel name when AI settings are empty", () => {
    const prompt = buildGuestFeedbackSystemPrompt({
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      aiSettings: null,
    });

    expect(prompt).toContain('hotel "Hotel Nusantara"');
    expect(prompt).not.toContain("Instruksi tambahan dari hotel");
  });

  it("uses English instructions when preferred language is non-ID", () => {
    const prompt = buildGuestFeedbackSystemPrompt({
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      aiSettings: null,
      preferredLanguage: "en",
    } as unknown as Parameters<typeof buildGuestFeedbackSystemPrompt>[0]);

    expect(prompt).toContain("Use warm, polite, professional English");
    expect(prompt).not.toContain("Gunakan bahasa Indonesia");
  });

  it("instructs AI to request numeric rating first when guest only sends comments", () => {
    const prompt = buildGuestFeedbackSystemPrompt({
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      aiSettings: null,
      preferredLanguage: "id",
    } as unknown as Parameters<typeof buildGuestFeedbackSystemPrompt>[0]);

    expect(prompt).toContain("Jangan panggil tool");
    expect(prompt).toContain("rating berupa angka 1 sampai 5");
  });

  it("instructs English flow to avoid update tool without numeric rating", () => {
    const prompt = buildGuestFeedbackSystemPrompt({
      guestName: "Rina",
      hotelName: "Hotel Nusantara",
      aiSettings: null,
      preferredLanguage: "en",
    } as unknown as Parameters<typeof buildGuestFeedbackSystemPrompt>[0]);

    expect(prompt).toContain("Do not call");
    expect(prompt).toContain("without a numeric rating from 1 to 5");
  });

  it("informs Indonesian guests about reward redemption options after AI follow-up save", () => {
    const info = buildFeedbackSavedSystemInfo({
      language: "id",
      rating: 5,
      comments: "Sangat puas",
      points: 50,
    });

    expect(info).toContain("Poin reward yang ditambahkan: 50");
    expect(info).toContain("welcome drink");
    expect(info).toContain("extra bed");
    expect(info).toContain("potongan harga menginap");
  });

  it("informs English guests about reward redemption options after AI follow-up save", () => {
    const info = buildFeedbackSavedSystemInfo({
      language: "en",
      rating: 5,
      comments: "Very satisfied",
      points: 50,
    });

    expect(info).toContain("Reward points granted: 50");
    expect(info).toContain("welcome drink");
    expect(info).toContain("extra bed");
    expect(info).toContain("room-rate discount");
  });

  it("detects retryable provider rate-limit errors", () => {
    const retryError = {
      reason: "maxRetriesExceeded",
      message: "Provider returned error",
      lastError: {
        statusCode: 429,
        isRetryable: true,
        responseBody: "temporarily rate-limited upstream",
      },
    };

    expect(isRetryableProviderRateLimitError(retryError)).toBe(true);
  });

  it("does not treat non-retryable provider errors as rate-limit", () => {
    const nonRetryableError = {
      reason: "providerError",
      message: "invalid request",
      lastError: {
        statusCode: 400,
        isRetryable: false,
        responseBody: "validation failed",
      },
    };

    expect(isRetryableProviderRateLimitError(nonRetryableError)).toBe(false);
  });
});
