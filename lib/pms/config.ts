"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserTenant, requireOwner } from "@/lib/auth/tenant";
import { revalidatePath } from "next/cache";

export type PmsConfig = {
  pms_type: string;
  endpoint: string;
  credentials: Record<string, string>;
  is_active: boolean;
};

export async function getPmsConfig(): Promise<PmsConfig | null> {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pms_configurations")
    .select("pms_type, endpoint, credentials, is_active")
    .eq("tenant_id", tenantUser.tenantId)
    .single();

  return data as PmsConfig | null;
}

export async function savePmsConfig(formData: FormData) {
  let adminCheck;
  try {
    adminCheck = await requireOwner();
  } catch (err: unknown) {
    return { error: (err as Error).message || "Unauthorized" };
  }

  const pmsType = formData.get("pms_type") as string;
  const endpoint = formData.get("endpoint") as string;
  const apiKey = formData.get("api_key") as string;
  const isActive = formData.get("is_active") === "on";

  if (!pmsType || !endpoint || !apiKey) {
    return { error: "All fields are required" };
  }

  if (!["cloudbeds", "mews", "custom"].includes(pmsType)) {
    return { error: "Invalid PMS Type" };
  }

  const supabase = await createClient();
  const credentials = { api_key: apiKey };

  const { error } = await supabase.from("pms_configurations").upsert(
    {
      tenant_id: adminCheck.tenantId,
      pms_type: pmsType,
      endpoint,
      credentials,
      is_active: isActive,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    console.error("Save PMS Config Error:", error);
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/pms");

  return { success: true };
}
