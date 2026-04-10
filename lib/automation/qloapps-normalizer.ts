import type { NormalizedPmsWebhookEvent } from "@/lib/automation/types";

type QloAppsWebhookPayload = {
  tenant_id?: string;
  event_id?: string;
  event_type?: string;
  booking_id?: string | number;
  status?: string | number;
  updated_at?: string;
};

type NormalizedQloAppsWebhookEvent = NormalizedPmsWebhookEvent & {
  tenantId: string;
  eventId: string;
  eventType: string;
};

function mapQloAppsStatus(status: string): string {
  switch (status) {
    case "1":
      return "pre-arrival";
    case "2":
      return "on-stay";
    case "3":
      return "post-stay";
    case "4":
    case "6":
      return "cancelled";
    default:
      return status;
  }
}

export function normalizeQloAppsWebhook(
  payload: QloAppsWebhookPayload,
  rawPayload: string,
  fallbackEventId: string,
): NormalizedQloAppsWebhookEvent {
  if (!payload.tenant_id) {
    throw new Error("tenant_id is required");
  }

  if (!payload.booking_id) {
    throw new Error("booking_id is required");
  }

  if (!payload.status) {
    throw new Error("status is required");
  }

  return {
    tenantId: payload.tenant_id,
    eventId: payload.event_id ?? fallbackEventId,
    eventType: payload.event_type ?? "reservation.updated",
    bookingId: String(payload.booking_id),
    status: mapQloAppsStatus(String(payload.status)),
    updatedAt: payload.updated_at,
    rawPayload,
  };
}
