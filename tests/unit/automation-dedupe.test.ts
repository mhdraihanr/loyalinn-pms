import { hasSuccessfulDeliveryLog } from "@/lib/automation/status-trigger";
import { shouldEnqueueRealtimeStatusAutomation } from "@/lib/pms/qloapps-webhook-processor";

function createMessageLogClient(rows: Array<{ id: string }>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };

  return {
    from: vi.fn(() => chain),
    chain,
  };
}

describe("automation duplicate prevention", () => {
  it("detects existing successful delivery even when historical sent logs contain multiple rows", async () => {
    const client = createMessageLogClient([{ id: "log-1" }, { id: "log-2" }]);

    await expect(
      hasSuccessfulDeliveryLog(client, "reservation-1", "on-stay"),
    ).resolves.toBe(true);

    expect(client.from).toHaveBeenCalledWith("message_logs");
    expect(client.chain.limit).toHaveBeenCalledWith(1);
  });

  it("only enqueues realtime lifecycle automation for an actual status transition", () => {
    expect(
      shouldEnqueueRealtimeStatusAutomation({
        status: "on-stay",
        previousStatus: "pre-arrival",
        statusChanged: true,
      }),
    ).toBe(true);

    expect(
      shouldEnqueueRealtimeStatusAutomation({
        status: "checked-out",
        previousStatus: "on-stay",
        statusChanged: true,
      }),
    ).toBe(true);

    expect(
      shouldEnqueueRealtimeStatusAutomation({
        status: "checked-out",
        previousStatus: "checked-out",
        statusChanged: false,
      }),
    ).toBe(false);

    expect(
      shouldEnqueueRealtimeStatusAutomation({
        status: "checked-out",
        previousStatus: undefined,
        statusChanged: false,
      }),
    ).toBe(false);
  });
});
