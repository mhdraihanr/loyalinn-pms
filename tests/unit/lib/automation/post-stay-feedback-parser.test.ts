import { describe, expect, it } from "vitest";

import { parseDirectPostStayFeedback } from "@/lib/automation/post-stay-feedback-parser";

describe("parseDirectPostStayFeedback", () => {
  it("extracts an explicit rating and comment from Indonesian WA feedback", () => {
    expect(parseDirectPostStayFeedback("Rate dari saya 5 kamar luas")).toEqual({
      rating: 5,
      comments: "Rate dari saya 5 kamar luas",
    });
  });

  it("extracts rating from common rating phrases", () => {
    expect(parseDirectPostStayFeedback("rating 4, pelayanan ramah")).toEqual({
      rating: 4,
      comments: "rating 4, pelayanan ramah",
    });

    expect(
      parseDirectPostStayFeedback("Saya kasih 5 bintang, bagus sekali"),
    ).toEqual({
      rating: 5,
      comments: "Saya kasih 5 bintang, bagus sekali",
    });
  });

  it("does not parse unrelated numbers as a feedback rating", () => {
    expect(
      parseDirectPostStayFeedback("Saya menginap 5 hari, terima kasih"),
    ).toBeNull();
    expect(
      parseDirectPostStayFeedback("Kamar 5 luas, terima kasih"),
    ).toBeNull();
  });
});
