import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WAHA direct post-stay feedback wiring", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "app/api/webhooks/waha/route.ts"),
    "utf8",
  );

  it("parses explicit post-stay ratings before dispatching to the AI agent", () => {
    expect(routeSource).toContain(
      'import { parseDirectPostStayFeedback } from "@/lib/automation/post-stay-feedback-parser";',
    );
    expect(routeSource).toContain("completePostStayFeedbackWithReward({");
    expect(routeSource).toContain("success:direct-post-stay-feedback");
    expect(routeSource).toContain("DIRECT_POST_STAY_FEEDBACK_ACTION");

    expect(routeSource.indexOf("parseDirectPostStayFeedback(body)")).toBeLessThan(
      routeSource.indexOf("processLifecycleGuestMessage({"),
    );
  });
});
