import { PMSAdapter, AdapterReservation, AdapterGuest } from "./adapter";

/**
 * A mock PMS Adapter for MVP testing and demonstration.
 * It ignores the credentials and returns static dummy data.
 */
export class MockAdapter implements PMSAdapter {
  private endpoint: string = "";

  init(credentials: Record<string, string>, endpoint: string): void {
    this.endpoint = endpoint || "mock://api";
    console.log("MockAdapter initialized with endpoint:", this.endpoint);
  }

  async pullReservations(
    startDate: string,
    endDate: string,
  ): Promise<AdapterReservation[]> {
    // Generate some dummy reservations based on the dates provided
    return [
      {
        pms_reservation_id: `MOCK-RES-001`,
        pms_guest_id: "MOCK-GUEST-A",
        room_number: "101",
        check_in_date: startDate,
        check_out_date: endDate,
        pms_status: "confirmed", // will map to pre-arrival or on-stay depending on logic
        amount: 1500.0,
        source: "Booking.com",
      },
      {
        pms_reservation_id: `MOCK-RES-002`,
        pms_guest_id: "MOCK-GUEST-B",
        room_number: "204",
        check_in_date: startDate,
        check_out_date: endDate,
        pms_status: "inhouse", // maps to on-stay
        amount: 850.5,
        source: "Direct",
      },
    ];
  }

  async pullGuest(pmsGuestId: string): Promise<AdapterGuest | null> {
    if (pmsGuestId === "MOCK-GUEST-A") {
      return {
        pms_guest_id: pmsGuestId,
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        country: "US",
      };
    }

    if (pmsGuestId === "MOCK-GUEST-B") {
      return {
        pms_guest_id: pmsGuestId,
        name: "Jane Smith",
        email: "jane.smith@example.com",
        phone: "+0987654321",
        country: "UK",
      };
    }

    return null;
  }

  mapStatus(
    pmsStatus: string,
  ): "pre-arrival" | "on-stay" | "checked-out" | "cancelled" {
    const statusMap: Record<
      string,
      "pre-arrival" | "on-stay" | "checked-out" | "cancelled"
    > = {
      confirmed: "pre-arrival",
      inhouse: "on-stay",
      checkedout: "checked-out",
      canceled: "cancelled",
    };

    return statusMap[pmsStatus.toLowerCase()] || "pre-arrival";
  }
}
