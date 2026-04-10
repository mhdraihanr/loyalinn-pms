import { describe, expect, it } from "vitest";

import {
  canSendAutomatedMessage,
  renderTemplate,
  selectTemplateVariant,
} from "@/lib/automation/template-renderer";

describe("renderTemplate", () => {
  it("interpolates supported reservation variables into the message", () => {
    const message = renderTemplate(
      "Hello {{guestName}}, room {{roomNumber}} is ready from {{checkInDate}} until {{checkOutDate}} at {{hotelName}}.",
      {
        guestName: "Rina",
        roomNumber: "301",
        checkInDate: "2026-03-08",
        checkOutDate: "2026-03-10",
        hotelName: "Hotel Nusantara",
      },
    );

    expect(message).toBe(
      "Hello Rina, room 301 is ready from 2026-03-08 until 2026-03-10 at Hotel Nusantara.",
    );
  });
});

describe("selectTemplateVariant", () => {
  const variants = [
    { language_code: "en", content: "Welcome {{guestName}}" },
    { language_code: "id", content: "Selamat datang {{guestName}}" },
  ];

  it("selects the preferred language when available", () => {
    expect(selectTemplateVariant(variants, "id")?.content).toBe(
      "Selamat datang {{guestName}}",
    );
  });

  it("falls back to English when the preferred language is unavailable", () => {
    expect(selectTemplateVariant(variants, "ja")?.content).toBe(
      "Welcome {{guestName}}",
    );
  });
});

describe("canSendAutomatedMessage", () => {
  it("rejects delivery when the guest phone number is missing", () => {
    expect(
      canSendAutomatedMessage({
        guestPhone: null,
        templateVariant: { language_code: "en", content: "Hi" },
        hasSuccessfulDelivery: false,
      }),
    ).toEqual({ allowed: false, reason: "missing-phone" });
  });

  it("rejects delivery when no template variant can be resolved", () => {
    expect(
      canSendAutomatedMessage({
        guestPhone: "+628123456789",
        templateVariant: null,
        hasSuccessfulDelivery: false,
      }),
    ).toEqual({ allowed: false, reason: "missing-template" });
  });

  it("rejects delivery when a successful message already exists for the trigger", () => {
    expect(
      canSendAutomatedMessage({
        guestPhone: "+628123456789",
        templateVariant: { language_code: "en", content: "Hi" },
        hasSuccessfulDelivery: true,
      }),
    ).toEqual({ allowed: false, reason: "already-sent" });
  });

  it("allows delivery when all guards pass", () => {
    expect(
      canSendAutomatedMessage({
        guestPhone: "+628123456789",
        templateVariant: { language_code: "en", content: "Hi" },
        hasSuccessfulDelivery: false,
      }),
    ).toEqual({ allowed: true });
  });
});
