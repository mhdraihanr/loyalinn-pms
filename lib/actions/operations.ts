"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserTenant } from "@/lib/auth/tenant";
import { revalidatePath } from "next/cache";

export async function updateHousekeepingStatus(
  id: string,
  status: "pending" | "in-progress" | "completed" | "cancelled"
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();

  const { error } = await supabase
    .from("housekeeping_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to update housekeeping status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/operations");
  return { success: true };
}

export async function updateRoomServiceStatus(
  id: string,
  status: "pending" | "in-progress" | "completed" | "cancelled"
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();

  const { error } = await supabase
    .from("room_service_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to update room service status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/operations");
  return { success: true };
}

export async function updateArrivalRequestStatus(
  id: string,
  status: "pending" | "in-progress" | "resolved" | "cancelled"
) {
  const { tenantId } = await requireUserTenant();
  const supabase = await createClient();

  const { error } = await supabase
    .from("arrival_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Failed to update arrival request status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/operations");
  return { success: true };
}
