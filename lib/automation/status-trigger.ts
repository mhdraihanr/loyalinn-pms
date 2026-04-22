import {
  canSendAutomatedMessage,
  renderTemplate,
  selectTemplateVariant,
} from "@/lib/automation/template-renderer";
import {
  buildFeedbackLink,
  createFeedbackToken,
} from "@/lib/automation/feedback-link";
import {
  completeAutomationJob,
  deadLetterAutomationJob,
} from "@/lib/automation/queue";
import {
  upsertLifecycleAiSession,
  type LifecycleStage,
} from "@/lib/ai/lifecycle-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { wahaClient } from "@/lib/waha/client";

type StatusTriggerJob = {
  id: string;
  tenantId: string;
  triggerType: string;
  payload: {
    booking_id: string;
    status: string;
    previous_status?: string;
    updated_at?: string;
  };
};

type ReservationGuest = {
  id: string | null;
  name: string | null;
  phone: string | null;
  country: string | null;
};

type ReservationTenant = {
  name: string | null;
};

function mapTriggerToLifecycleStage(
  triggerType: string,
): LifecycleStage | null {
  if (
    triggerType === "pre-arrival" ||
    triggerType === "on-stay" ||
    triggerType === "post-stay"
  ) {
    return triggerType;
  }

  return null;
}

function isOutOfOrderEvent(
  reservationUpdatedAt: string,
  eventUpdatedAt?: string,
) {
  if (!eventUpdatedAt) {
    return false;
  }

  return new Date(eventUpdatedAt) < new Date(reservationUpdatedAt);
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
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

    if (isIndonesianNumber) return "id";
    if (normalizedPhone.startsWith("+86") || cleaned.startsWith("86"))
      return "zh";
    if (normalizedPhone.startsWith("+81") || cleaned.startsWith("81"))
      return "ja";

    // Explicitly avoid Indonesian fallback for non-08/+62 numbers.
    return "en";
  }

  if (country) {
    const c = country.toLowerCase().trim();
    if (c === "indonesia" || c === "id") return "id";
    if (c === "china" || c === "zh") return "zh";
    if (c === "japan" || c === "jp") return "ja";
  }

  return "en";
}
export async function processStatusTriggerJob(job: StatusTriggerJob) {
  const adminClient = createAdminClient();

  const { data: reservation, error: reservationError } = await adminClient
    .from("reservations")
    .select(
      "id, status, updated_at, room_number, check_in_date, check_out_date, guests(id, name, phone, country), tenants(name)",
    )
    .eq("tenant_id", job.tenantId)
    .eq("pms_reservation_id", job.payload.booking_id)
    .maybeSingle();

  if (reservationError || !reservation) {
    await deadLetterAutomationJob(
      job.id,
      "validation",
      "Reservation context could not be loaded",
    );
    return;
  }

  const guest = getSingleRelation(
    reservation.guests,
  ) as ReservationGuest | null;
  const tenant = getSingleRelation(
    reservation.tenants,
  ) as ReservationTenant | null;

  console.log(
    `[STATUS-TRIGGER] job=${job.id} trigger=${job.triggerType} guestPhone=${guest?.phone} guestCountry=${guest?.country}`,
  );

  if (isOutOfOrderEvent(reservation.updated_at, job.payload.updated_at)) {
    await completeAutomationJob(job.id, undefined);
    return;
  }

  const { data: template, error: templateError } = await adminClient
    .from("message_templates")
    .select("id, message_template_variants(language_code, content)")
    .eq("tenant_id", job.tenantId)
    .eq("trigger", job.triggerType)
    .maybeSingle();

  if (templateError) {
    await deadLetterAutomationJob(job.id, "integration", templateError.message);
    return;
  }

  const preferredLanguage = detectPreferredLanguage(
    guest?.phone ?? null,
    guest?.country ?? null,
  );

  const templateVariant = selectTemplateVariant(
    template?.message_template_variants ?? [],
    preferredLanguage,
  );

  console.log(
    `[STATUS-TRIGGER-SELECT] preferred=${preferredLanguage} variantLang=${templateVariant?.language_code}`,
  );

  const { data: existingSentLog } = await adminClient
    .from("message_logs")
    .select("id")
    .eq("reservation_id", reservation.id)
    .eq("trigger_type", job.triggerType)
    .eq("status", "sent")
    .maybeSingle();

  const sendGuard = canSendAutomatedMessage({
    guestPhone: guest?.phone ?? null,
    templateVariant,
    hasSuccessfulDelivery: Boolean(existingSentLog),
  });

  if (!sendGuard.allowed) {
    const reasonMessage =
      sendGuard.reason === "missing-phone"
        ? "Guest phone number is missing"
        : sendGuard.reason === "missing-template"
          ? "No template variant available for trigger"
          : "Message already sent for trigger";

    await deadLetterAutomationJob(job.id, "validation", reasonMessage);
    return;
  }

  if (!templateVariant) {
    await deadLetterAutomationJob(
      job.id,
      "validation",
      "No template variant available for trigger",
    );
    return;
  }

  const guestPhone = guest?.phone;
  if (!guestPhone) {
    await deadLetterAutomationJob(
      job.id,
      "validation",
      "Guest phone number is missing",
    );
    return;
  }

  const feedbackLink =
    job.triggerType === "post-stay"
      ? buildFeedbackLink(
          createFeedbackToken({
            reservationId: reservation.id,
            tenantId: job.tenantId,
          }),
        )
      : "";

  const content = renderTemplate(templateVariant.content, {
    guestName: guest?.name ?? "Guest",
    roomNumber: reservation.room_number ?? "-",
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    hotelName: tenant?.name ?? "Hotel",
    feedbackLink,
  });

  const { data: messageLog, error: messageLogError } = await adminClient
    .from("message_logs")
    .insert({
      tenant_id: job.tenantId,
      reservation_id: reservation.id,
      guest_id: guest?.id ?? null,
      template_id: template?.id ?? null,
      trigger_type: job.triggerType,
      template_language_code: templateVariant.language_code,
      phone: guestPhone,
      content,
      status: "pending",
    })
    .select("id")
    .single();

  if (messageLogError || !messageLog) {
    await deadLetterAutomationJob(
      job.id,
      "integration",
      messageLogError?.message ?? "Unable to create message log",
    );
    return;
  }

  const providerResponse = await wahaClient.sendMessage(
    "default",
    guestPhone,
    content,
  );

  const { error: updateLogError } = await adminClient
    .from("message_logs")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: providerResponse?.id ?? null,
      provider_response: providerResponse,
    })
    .eq("id", messageLog.id);

  if (updateLogError) {
    await deadLetterAutomationJob(
      job.id,
      "integration",
      updateLogError.message,
    );
    return;
  }

  if (job.triggerType === "post-stay") {
    const { error: feedbackStatusError } = await adminClient
      .from("reservations")
      .update({
        post_stay_feedback_status: "pending",
      })
      .eq("id", reservation.id)
      .eq("tenant_id", job.tenantId)
      .neq("post_stay_feedback_status", "completed")
      .neq("post_stay_feedback_status", "ignored");

    if (feedbackStatusError) {
      await deadLetterAutomationJob(
        job.id,
        "integration",
        feedbackStatusError.message,
      );
      return;
    }
  }

  const lifecycleStage = mapTriggerToLifecycleStage(job.triggerType);
  if (lifecycleStage) {
    const guestId = guest?.id ?? null;
    await upsertLifecycleAiSession(adminClient, {
      tenantId: job.tenantId,
      reservationId: reservation.id,
      guestId,
      stage: lifecycleStage,
      sessionStatus: "active",
      touchOutboundAt: true,
    });
  }

  await completeAutomationJob(job.id, messageLog.id);
}
