"use server";

import { requireOwner } from "@/lib/auth/tenant";
import { syncReservations } from "./sync-service";
import { MockAdapter } from "./mock-adapter";
import { getPmsConfig } from "./config";
import { revalidatePath } from "next/cache";

export async function triggerManualSync() {
  try {
    const adminCheck = await requireOwner();

    // In a real scenario, we'd check config to pick the right adapter
    const config = await getPmsConfig();

    if (!config || !config.is_active) {
      return { error: "PMS Sync is not configured or is inactive." };
    }

    const { getPMSAdapter } = await import("./registry");
    const adapter = getPMSAdapter(config.pms_type);
    adapter.init(config.credentials, config.endpoint);

    // Sync from 7 days ago to 7 days in the future
    // to capture ongoing stays that checked in before today.
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const startDate = lastWeek.toISOString().split("T")[0];
    const endDate = nextWeek.toISOString().split("T")[0];

    const result = await syncReservations(
      adminCheck.tenantId,
      adapter,
      startDate,
      endDate,
    );

    if (result.success) {
      // Refresh page data
      revalidatePath("/reservations");
      return { success: true, message: result.message };
    } else {
      return { error: result.error || "Failed to synchronize reservations." };
    }
  } catch (err: unknown) {
    return { error: (err as Error).message || "An unexpected error occurred." };
  }
}
