import {
  canSendAutomatedMessage,
  renderTemplate,
  selectTemplateVariant,
} from "@/lib/automation/template-renderer";
import {
  completeAutomationJob,
  deadLetterAutomationJob,
} from "@/lib/automation/queue";
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
};

type ReservationTenant = {
  name: string | null;
};

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

export async function processStatusTriggerJob(job: StatusTriggerJob) {
  const adminClient = createAdminClient();

  const { data: reservation, error: reservationError } = await adminClient
    .from("reservations")
    .select(
      "id, status, updated_at, room_number, check_in_date, check_out_date, guests(id, name, phone), tenants(name)",
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

  const templateVariant = selectTemplateVariant(
    template?.message_template_variants ?? [],
    "en",
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

  const content = renderTemplate(templateVariant.content, {
    guestName: guest?.name ?? "Guest",
    roomNumber: reservation.room_number ?? "-",
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    hotelName: tenant?.name ?? "Hotel",
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

  await completeAutomationJob(job.id, messageLog.id);
}
