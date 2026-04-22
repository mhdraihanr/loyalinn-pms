import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderTemplate,
  selectTemplateVariant,
} from "@/lib/automation/template-renderer";
import { wahaClient } from "@/lib/waha/client";

type GuestRelation = {
  name: string | null;
  phone: string | null;
  country: string | null;
};

type TenantRelation = {
  name: string | null;
};

type EscalationCandidate = {
  id: string;
  tenant_id: string;
  guest_id: string | null;
  room_number: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  guests: GuestRelation | GuestRelation[] | null;
  tenants: TenantRelation | TenantRelation[] | null;
};

const FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000;
const AI_FOLLOWUP_TRIGGER = "post-stay-ai-followup";

function getRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function detectPreferredLanguage(
  phone: string | null,
  country: string | null,
): string {
  if (phone) {
    const normalizedPhone = phone.trim();
    const cleaned = normalizedPhone.replace(/\D/g, "");
    const isIndonesianNumber =
      normalizedPhone.startsWith("+62") ||
      normalizedPhone.startsWith("08") ||
      cleaned.startsWith("62") ||
      cleaned.startsWith("08");

    return isIndonesianNumber ? "id" : "en";
  }

  if (country) {
    const c = country.toLowerCase().trim();
    if (c === "indonesia" || c === "id") {
      return "id";
    }
  }

  return "en";
}

function extractProviderMessageId(providerResponse: unknown): string | null {
  if (!providerResponse || typeof providerResponse !== "object") {
    return null;
  }

  const id = (providerResponse as { id?: unknown }).id;
  if (typeof id !== "string" && typeof id !== "number") {
    return null;
  }

  return String(id);
}

export async function escalatePendingFeedbackToAiFollowup(
  now = new Date(),
): Promise<number> {
  const adminClient = createAdminClient();
  const cutoffIso = new Date(now.getTime() - FOLLOWUP_DELAY_MS).toISOString();

  const { data: candidates, error: candidatesError } = await adminClient
    .from("reservations")
    .select(
      "id, tenant_id, guest_id, room_number, check_in_date, check_out_date, guests(name, phone, country), tenants(name)",
    )
    .eq("status", "checked-out")
    .eq("post_stay_feedback_status", "pending")
    .lt("updated_at", cutoffIso)
    .limit(100);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  let escalated = 0;
  const sendAt = now.toISOString();

  for (const candidate of (candidates ?? []) as EscalationCandidate[]) {
    const guest = getRelation(candidate.guests);
    const tenant = getRelation(candidate.tenants);
    const guestPhone = guest?.phone?.trim();

    if (!guestPhone) {
      continue;
    }

    const { data: template, error: templateError } = await adminClient
      .from("message_templates")
      .select("id, message_template_variants(language_code, content)")
      .eq("tenant_id", candidate.tenant_id)
      .eq("trigger", AI_FOLLOWUP_TRIGGER)
      .maybeSingle();

    if (templateError) {
      throw new Error(templateError.message);
    }

    const preferredLanguage = detectPreferredLanguage(
      guest?.phone ?? null,
      guest?.country ?? null,
    );
    const templateVariant = selectTemplateVariant(
      template?.message_template_variants ?? [],
      preferredLanguage,
    );

    if (!templateVariant) {
      continue;
    }

    // Claim candidate atomically by flipping pending -> ai_followup first.
    const { data: claimed, error: claimError } = await adminClient
      .from("reservations")
      .update({ post_stay_feedback_status: "ai_followup" })
      .eq("id", candidate.id)
      .eq("tenant_id", candidate.tenant_id)
      .eq("post_stay_feedback_status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError) {
      throw new Error(claimError.message);
    }

    if (!claimed) {
      continue;
    }

    const kickoffMessage = renderTemplate(templateVariant.content, {
      guestName: guest?.name ?? "Guest",
      roomNumber: candidate.room_number ?? "-",
      checkInDate: candidate.check_in_date ?? "-",
      checkOutDate: candidate.check_out_date ?? "-",
      hotelName: tenant?.name ?? "Hotel",
      feedbackLink: "",
    });

    try {
      const providerResponse = await wahaClient.sendMessage(
        "default",
        guestPhone,
        kickoffMessage,
      );

      const { error: logError } = await adminClient
        .from("message_logs")
        .insert({
          tenant_id: candidate.tenant_id,
          reservation_id: candidate.id,
          guest_id: candidate.guest_id,
          template_id: template?.id ?? null,
          template_language_code: templateVariant.language_code,
          phone: guestPhone,
          content: kickoffMessage,
          direction: "outbound",
          status: "sent",
          trigger_type: "post-stay",
          sent_at: sendAt,
          provider_message_id: extractProviderMessageId(providerResponse),
        });

      if (logError) {
        console.error(
          "Failed to log lifecycle post-stay kickoff message:",
          logError,
        );
      }

      escalated += 1;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown WAHA send error";

      const { error: rollbackError } = await adminClient
        .from("reservations")
        .update({ post_stay_feedback_status: "pending" })
        .eq("id", candidate.id)
        .eq("tenant_id", candidate.tenant_id)
        .eq("post_stay_feedback_status", "ai_followup");

      if (rollbackError) {
        console.error(
          "Failed to rollback lifecycle post-stay follow-up status:",
          rollbackError,
        );
      }

      await adminClient.from("message_logs").insert({
        tenant_id: candidate.tenant_id,
        reservation_id: candidate.id,
        guest_id: candidate.guest_id,
        template_id: template?.id ?? null,
        template_language_code: templateVariant.language_code,
        phone: guestPhone,
        content: kickoffMessage,
        direction: "outbound",
        status: "failed",
        error_message: `Lifecycle post-stay kickoff failed: ${reason}`,
        trigger_type: "post-stay",
        sent_at: sendAt,
      });
    }
  }

  return escalated;
}
