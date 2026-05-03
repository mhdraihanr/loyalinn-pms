import { describe, expect, it, vi } from "vitest";

import { upsertLifecycleAiSession } from "@/lib/ai/lifecycle-session";

describe("upsertLifecycleAiSession", () => {
  it("does not clear last action fields when only touching session timestamps", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn(() => ({ upsert: upsertMock }));

    await upsertLifecycleAiSession(
      { from: fromMock } as never,
      {
        tenantId: "tenant-1",
        reservationId: "reservation-1",
        guestId: "guest-1",
        stage: "pre-arrival",
        sessionStatus: "active",
        touchOutboundAt: true,
      },
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        last_action_type: null,
        last_action_payload: {},
      }),
      { onConflict: "tenant_id,reservation_id,lifecycle_stage" },
    );
  });
});
