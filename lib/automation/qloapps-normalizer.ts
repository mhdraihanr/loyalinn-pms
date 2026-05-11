import type { NormalizedPmsWebhookEvent } from "@/lib/automation/types";

type QloAppsWebhookPayload = {
  tenant_id?: string;
  tenant_key?: string;
  event_id?: string;
  event_type?: string;
  booking_id?: string | number;
  id_order?: string | number;
  id_customer?: string | number;
  status?: string | number;
  status_code?: string | number;
  order_status_code?: string | number;
  room_status_code?: string | number;
  updated_at?: string;
  occurred_at?: string;
};

type NormalizedQloAppsWebhookEvent = NormalizedPmsWebhookEvent & {
  tenantId: string;
  eventId: string;
  eventType: string;
};

function mapQloAppsStatus(status: string, eventType?: string): string {
  if (eventType === "booking.created") {
    return "pre-arrival";
  }

  if (eventType === "booking.payment_confirmed") {
    return "pre-arrival";
  }

  if (eventType === "booking.order_status_changed") {
    return `order-status-${status}`;
  }

  switch (status) {
    case "1":
      return "pre-arrival";
    case "2":
      return "on-stay";
    case "3":
      return "checked-out";
    case "4":
    case "6":
      return "cancelled";
    default:
      return status;
  }
}

function normalizeBookingId(
  bookingId: string | number | undefined,
  eventType: string,
) {
  if (bookingId != null && String(bookingId).trim().length > 0) {
    return String(bookingId);
  }

  if (eventType === "booking.test") {
    return "0";
  }

  throw new Error("id_order or booking_id is required");
}

export function normalizeQloAppsWebhook(
  payload: QloAppsWebhookPayload,
  rawPayload: string,
  fallbackEventId: string,
): NormalizedQloAppsWebhookEvent {
  const tenantId = payload.tenant_key ?? payload.tenant_id;
  const bookingId = payload.id_order ?? payload.booking_id;
  const updatedAt = payload.occurred_at ?? payload.updated_at;
  const eventType = payload.event_type ?? "reservation.updated";
  const rawStatus =
    eventType === "booking.room_status_changed"
      ? (payload.room_status_code ?? payload.status_code ?? payload.status)
      : eventType === "booking.order_status_changed"
        ? (payload.order_status_code ?? payload.status_code ?? payload.status)
        : (payload.status_code ?? payload.status);

  if (!tenantId) {
    throw new Error("tenant_key or tenant_id is required");
  }

  const normalizedBookingId = normalizeBookingId(bookingId, eventType);

  if (rawStatus == null && eventType !== "booking.test") {
    throw new Error(
      "room_status_code, order_status_code, status_code, or status is required",
    );
  }

  return {
    tenantId: String(tenantId),
    eventId: payload.event_id ?? fallbackEventId,
    eventType,
    bookingId: normalizedBookingId,
    status: mapQloAppsStatus(String(rawStatus ?? "test"), eventType),
    updatedAt,
    rawPayload,
  };
}
