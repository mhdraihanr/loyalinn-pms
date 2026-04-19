import { describe, expect, it } from "vitest";

import { getFeedbackSubmissionCopy } from "@/components/feedback/post-stay-feedback-form";

describe("getFeedbackSubmissionCopy", () => {
  it("includes rewarded points and redemption examples when points are granted", () => {
    const copy = getFeedbackSubmissionCopy(50);

    expect(copy.pointsMessage).toContain("50 poin");
    expect(copy.redeemMessage).toMatch(/free drink|minuman gratis/i);
    expect(copy.redeemMessage).toContain("extra bed");
    expect(copy.redeemMessage).toContain("potongan harga menginap");
  });

  it("avoids claiming points when feedback was already rewarded", () => {
    const copy = getFeedbackSubmissionCopy(0);

    expect(copy.pointsMessage).toContain("sudah kami terima");
    expect(copy.pointsMessage).toContain("satu kali");
    expect(copy.pointsMessage).not.toContain("0 poin");
  });
});
