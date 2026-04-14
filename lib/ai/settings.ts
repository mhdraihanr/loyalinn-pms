import { revalidatePath } from "next/cache";

import { getCurrentUserTenant, requireOwner } from "@/lib/auth/tenant";
import { createClient } from "@/lib/supabase/server";

export type AiSettingsInput = {
  hotel_name: string;
  ai_name: string;
  tone_of_voice: string;
  custom_instructions: string;
};

export type AiSettingsRecord = AiSettingsInput & {
  tenant_id: string;
};

function sanitizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeInput(input: AiSettingsInput) {
  return {
    hotel_name: sanitizeOptionalText(input.hotel_name, 120),
    ai_name: sanitizeOptionalText(input.ai_name, 120),
    tone_of_voice: sanitizeOptionalText(input.tone_of_voice, 240),
    custom_instructions: sanitizeOptionalText(input.custom_instructions, 2000),
  };
}

function isMissingTableError(error: { message?: string } | null) {
  if (!error?.message) {
    return false;
  }

  return /relation\s+"?ai_settings"?\s+does not exist/i.test(error.message);
}

export async function getCurrentTenantAiSettings(): Promise<AiSettingsRecord | null> {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select(
      "tenant_id, hotel_name, ai_name, tone_of_voice, custom_instructions",
    )
    .eq("tenant_id", tenantUser.tenantId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    tenant_id: String(data.tenant_id),
    hotel_name: String(data.hotel_name ?? ""),
    ai_name: String(data.ai_name ?? ""),
    tone_of_voice: String(data.tone_of_voice ?? ""),
    custom_instructions: String(data.custom_instructions ?? ""),
  };
}

export async function upsertCurrentTenantAiSettings(input: AiSettingsInput) {
  const owner = await requireOwner();
  const supabase = await createClient();

  const normalized = normalizeInput(input);

  const { error } = await supabase.from("ai_settings").upsert(
    {
      tenant_id: owner.tenantId,
      ...normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    if (isMissingTableError(error)) {
      return {
        error:
          "Table ai_settings belum tersedia. Jalankan migration terbaru dulu.",
      };
    }

    return { error: error.message };
  }

  revalidatePath("/settings/ai");
  revalidatePath("/");

  return { success: true };
}
