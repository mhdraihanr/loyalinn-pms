import { AdapterGuest, AdapterReservation, PMSAdapter } from "./adapter";

export class QloAppsAdapter implements PMSAdapter {
  private endpoint: string = "";
  private apiKey: string = "";

  init(credentials: Record<string, string>, endpoint: string): void {
    // Basic validation
    if (!endpoint) throw new Error("QloApps API endpoint is required.");
    if (!credentials.api_key) throw new Error("QloApps API key is required.");

    // Remove trailing slash if present
    this.endpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    this.apiKey = credentials.api_key;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
    };
  }

  async pullReservations(
    startDate: string,
    endDate: string,
  ): Promise<AdapterReservation[]> {
    // 1. Fetch ALL Room Bookings, then filter in-memory.
    // The QloApps API does not support standard PrestaShop `filter[date_from]` ranges reliably
    // for this custom module without breaking the JSON return structure.
    const url = `${this.endpoint}/api/room_bookings?output_format=JSON&display=full`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch room bookings: ${response.statusText}`);
    }

    const data = await response.json();

    // If no bookings, QloApps might return empty array or nothing
    if (!data || !data.bookings) {
      return [];
    }

    const reservations: AdapterReservation[] = [];
    let rooms = Array.isArray(data.bookings) ? data.bookings : [data.bookings];

    // Filter in-memory to ensure the reservation overlaps with our requested date range.
    // We check if the room's check_in date is before our endDate
    // AND check_out date is after our startDate.
    // To avoid timezone offsets (where "2026-02-22" locally becomes "2026-02-21 17:00:00Z"
    // and causes valid reservations to be dropped), we compare the strict YYYY-MM-DD string values.

    // YYYY-MM-DD
    const startRangeStr = startDate.split("T")[0];
    const endRangeStr = endDate.split("T")[0];

    rooms = rooms.filter((room: any) => {
      const roomCheckInStr =
        room.check_in && room.check_in !== "0000-00-00 00:00:00"
          ? room.check_in
          : room.date_from;
      const roomCheckOutStr =
        room.check_out && room.check_out !== "0000-00-00 00:00:00"
          ? room.check_out
          : room.date_to;

      // Extract just the YYYY-MM-DD part from QloApps "YYYY-MM-DD HH:MM:SS"
      const roomInStr = roomCheckInStr.split(" ")[0];
      const roomOutStr = roomCheckOutStr.split(" ")[0];

      // Lexicographical string comparison is safe for YYYY-MM-DD
      return roomInStr <= endRangeStr && roomOutStr >= startRangeStr;
    });

    for (const room of rooms) {
      // 2. Map the total financial value from the parent order and verify payment status
      let amount = 0;
      let source = "Unknown";
      let isPaymentComplete = false;

      try {
        const orderRes = await fetch(
          `${this.endpoint}/api/orders/${room.id_order}?output_format=JSON`,
          { headers: this.headers },
        );
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          if (orderData && orderData.order) {
            amount = parseFloat(orderData.order.total_paid_tax_incl);
            source = orderData.order.module || "QloApps Web";

            // In QloApps/PrestaShop, current_state = 2 means "Payment accepted"
            isPaymentComplete =
              orderData.order.current_state === "2" ||
              orderData.order.current_state === 2;
          }
        }
      } catch (e) {
        console.warn(
          `Could not fetch order ${room.id_order} for room booking ${room.id}`,
          e,
        );
      }

      // Skip this room if the payment is not complete
      if (!isPaymentComplete) {
        continue;
      }

      // We explicitly map the actual check_in from room_bookings
      // QloApps returns full datetime strings like "2026-02-20 12:00:00"
      const checkInDate =
        room.check_in && room.check_in !== "0000-00-00 00:00:00"
          ? room.check_in.split(" ")[0]
          : room.date_from.split(" ")[0]; // Fallback to planned date
      const checkOutDate =
        room.check_out && room.check_out !== "0000-00-00 00:00:00"
          ? room.check_out.split(" ")[0]
          : room.date_to.split(" ")[0]; // Fallback to planned date

      reservations.push({
        pms_reservation_id: `O${room.id_order}-R${room.id_room}`, // Composite key
        pms_guest_id: room.id_customer.toString(),
        room_number: room.room_num,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        pms_status: room.id_status.toString(),
        amount: amount,
        source: source,
        // Country is optionally handled based on our mapping,
        // passing it through via a temporary hack if we extend the interface later
      });
    }

    return reservations;
  }

  async pullGuest(pmsGuestId: string): Promise<AdapterGuest | null> {
    // 1. Fetch Customer Identity. Do not use display=full for singular resource request.
    const custRes = await fetch(
      `${this.endpoint}/api/customers/${pmsGuestId}?output_format=JSON`,
      { headers: this.headers },
    );
    if (!custRes.ok) {
      return null;
    }
    const custData = await custRes.json();
    if (!custData || !custData.customer) {
      // Single objects use singular key
      return null;
    }

    const customer = custData.customer;

    // 2. Fetch Customer Addresses for Country (Phone is already in the Customer object)
    let phone: string | undefined = customer.phone;
    let countryName: string | undefined = undefined;

    try {
      const addrRes = await fetch(
        `${this.endpoint}/api/addresses?output_format=JSON&display=full&filter[id_customer]=[${pmsGuestId}]`,
        { headers: this.headers },
      );
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (addrData && addrData.addresses) {
          const address = Array.isArray(addrData.addresses)
            ? addrData.addresses[0]
            : addrData.addresses;
          phone = address.phone_mobile || address.phone;

          const countryId = address.id_country;
          if (countryId) {
            // 3. Resolve Country ID to Name
            try {
              const countryRes = await fetch(
                `${this.endpoint}/api/countries/${countryId}?output_format=JSON`,
                { headers: this.headers },
              );
              if (countryRes.ok) {
                const countryData = await countryRes.json();
                if (
                  countryData &&
                  countryData.country &&
                  countryData.country.name
                ) {
                  // The name might be an array of localized names or a single string
                  const nameObj = countryData.country.name;
                  if (Array.isArray(nameObj)) {
                    countryName =
                      nameObj.find((n: any) => n.id === "1")?.value ||
                      nameObj[0]?.value;
                  } else if (typeof nameObj === "string") {
                    countryName = nameObj;
                  } else if (typeof nameObj === "object" && nameObj.language) {
                    // PrestaShop XML-to-JSON often formats it like: { language: [{ id: "1", value: "Indonesia" }] }
                    const langs = Array.isArray(nameObj.language)
                      ? nameObj.language
                      : [nameObj.language];
                    countryName =
                      langs.find((l: any) => l?.id === "1")?.value ||
                      langs[0]?.value;
                  } else {
                    // Safe fallback just stringify
                    countryName = String(nameObj);
                  }
                }
              }
            } catch (ce) {
              console.warn(
                `Could not resolve country ${countryId} for customer ${pmsGuestId}`,
                ce,
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Could not fetch address for customer ${pmsGuestId}`, e);
    }

    return {
      pms_guest_id: pmsGuestId,
      name: `${customer.firstname} ${customer.lastname}`.trim(),
      email: customer.email,
      phone: phone,
      country: countryName,
    };
  }

  mapStatus(
    pmsStatus: string,
  ): "pre-arrival" | "on-stay" | "checked-out" | "cancelled" {
    // Based on QloApps assessment:
    // 1: Awaiting Check-in
    // 2: Checked In / In House
    // 3: Checked Out
    // 4 / 6: Canceled / Invalid

    switch (pmsStatus) {
      case "1":
        return "pre-arrival";
      case "2":
        return "on-stay";
      case "3":
        return "checked-out";
      case "4":
      case "6":
      case "canceled": // Fallback if they pass string format
        return "cancelled";
      default:
        return "pre-arrival"; // Safe fallback
    }
  }
}
