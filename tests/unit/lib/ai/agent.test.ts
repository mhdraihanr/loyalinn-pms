import { describe, expect, it } from "vitest";

import { buildGuestFeedbackSystemPrompt } from "@/lib/ai/agent";

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
});
