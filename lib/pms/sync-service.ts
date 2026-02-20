import { createAdminClient } from "@/lib/supabase/admin";
import { PMSAdapter, AdapterReservation, AdapterGuest } from "./adapter";

export async function syncReservations(
  tenantId: string,
  adapter: PMSAdapter,
  startDate: string,
  endDate: string,
) {
  try {
    const adminClient = createAdminClient();

    // 1. Pull reservations from PMS
    const reservations: AdapterReservation[] = await adapter.pullReservations(
      startDate,
      endDate,
    );

    if (!reservations || reservations.length === 0) {
      return { success: true, count: 0, message: "No reservations found" };
    }

    let syncedCount = 0;

    // 2. Process each reservation
    for (const res of reservations) {
      // 2a. Sync Guest Profile first
      let guestIdToUse: string | null = null;

      const guestDetails: AdapterGuest | null = await adapter.pullGuest(
        res.pms_guest_id,
      );

      if (guestDetails) {
        // Upsert guest based on UNIQUE(tenant_id, pms_guest_id)
        const { data: upsertedGuest, error: guestError } = await adminClient
          .from("guests")
          .upsert(
            {
              tenant_id: tenantId,
              pms_guest_id: guestDetails.pms_guest_id,
              name: guestDetails.name,
              email: guestDetails.email,
              phone: guestDetails.phone,
              country: guestDetails.country,
            },
            { onConflict: "tenant_id,pms_guest_id", ignoreDuplicates: false },
          )
          .select("id")
          .single();

        if (guestError) {
          console.error("Guest Sync Error:", guestError);
          continue; // Skip this reservation if guest fails
        }

        if (upsertedGuest) {
          guestIdToUse = upsertedGuest.id;
        }
      }

      if (!guestIdToUse) continue;

      // 2b. Map status and Upsert Reservation based on UNIQUE(tenant_id, pms_reservation_id)
      const internalStatus = adapter.mapStatus(res.pms_status);

      const { error: resError } = await adminClient.from("reservations").upsert(
        {
          tenant_id: tenantId,
          guest_id: guestIdToUse,
          pms_reservation_id: res.pms_reservation_id,
          room_number: res.room_number,
          check_in_date: res.check_in_date,
          check_out_date: res.check_out_date,
          status: internalStatus,
          amount: res.amount,
          source: res.source,
        },
        { onConflict: "tenant_id,pms_reservation_id", ignoreDuplicates: false },
      );

      if (resError) {
        console.error("Reservation Sync Error:", resError);
      } else {
        syncedCount++;
      }
    }

    return {
      success: true,
      count: syncedCount,
      message: `Successfully synced ${syncedCount} reservations.`,
    };
  } catch (error: unknown) {
    console.error("Sync Service Error:", error);
    return { success: false, error: (error as Error).message };
  }
}
