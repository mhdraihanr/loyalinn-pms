import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/operations/housekeeping-table", () => ({
  HousekeepingTable: () => <div>Housekeeping table</div>,
}));

vi.mock("@/components/operations/room-service-table", () => ({
  RoomServiceTable: () => <div>Room service table</div>,
}));

vi.mock("@/components/operations/arrival-requests-table", () => ({
  ArrivalRequestsTable: () => <div>Arrival requests table</div>,
}));

import { OperationsTabs } from "@/components/operations/operations-tabs";

describe("OperationsTabs", () => {
  it("renders the arrival requests tab with arrival request data", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <OperationsTabs
          housekeepingData={[]}
          roomServiceData={[]}
          arrivalRequestsData={[
            {
              id: "arrival-1",
              room_number: "301",
              request_type: "early_checkin",
              eta: null,
              requested_time: "11:00",
              details: { reason: "Arriving with children" },
              status: "pending",
              created_at: "2026-04-28T10:00:00.000Z",
              guests: { name: "Rina" },
              reservations: { check_in_date: "2026-04-29" },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain("Arrival Requests");
    expect(html).toContain("Arrival requests table");
  });
});
