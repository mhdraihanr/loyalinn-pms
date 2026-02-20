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

    const adapter = new MockAdapter();
    adapter.init(config.credentials, config.endpoint);

    // Sync for the current week as a demonstration
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const startDate = today.toISOString().split("T")[0];
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
