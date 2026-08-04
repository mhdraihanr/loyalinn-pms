import { buildIdempotencyKey } from "@/lib/automation/idempotency";
import type { NormalizedPmsWebhookEvent } from "@/lib/automation/types";
import {
  resolveTenantIdForWebhook,
  type TenantLookupClient,
} from "@/lib/automation/tenant-resolver";
import { enqueueStatusTriggerAutomationJobIfMissing } from "@/lib/automation/queue";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PMSAdapter } from "./adapter";
import { getPMSAdapter } from "./registry";
import { upsertPmsReservation } from "./reservation-upsert-service";
import { resolveStatusAutomationTrigger } from "./status-automation";

type QloAppsNormalizedEvent = NormalizedPmsWebhookEvent & {
  tenantId: string;
  eventId: string;
  eventType: string;
};

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type ProcessQloAppsWebhookEventInput = {
  rawBody: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  normalizedEvent: QloAppsNormalizedEvent;
  adminClient?: SupabaseAdminClient;
  adapterFactory?: (pmsType: string) => PMSAdapter;
};

type ProcessQloAppsWebhookEventResult =
  | {
      ok: true;
      received: true;
      duplicate: boolean;
      job_enqueued?: boolean;
      reservation_id?: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const EVENTS_USING_ADAPTER_STATUS = new Set([
  "booking.created",
  "booking.payment_confirmed",
  "booking.status_changed",
  "booking.order_status_changed",
  "booking.room_status_changed",
]);

function resolveReservationStatus(params: {
  eventType: string;
  normalizedStatus?: string;
  mappedStatus: "pre-arrival" | "on-stay" | "checked-out" | "cancelled";
}) {
  if (EVENTS_USING_ADAPTER_STATUS.has(params.eventType)) {
    return params.mappedStatus;
  }

  return params.normalizedStatus || params.mappedStatus;
}

export function shouldEnqueueRealtimeStatusAutomation(params: {
  status: string;
  previousStatus?: string;
  statusChanged: boolean;
}) {
  return Boolean(
    resolveStatusAutomationTrigger({
      previousStatus: params.previousStatus,
      nextStatus: params.status,
      statusChanged: params.statusChanged,
    }),
  );
}

async function markInboundEventProcessed(params: {
  adminClient: SupabaseAdminClient;
  inboundEventId: string;
}) {
  await params.adminClient
    .from("inbound_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", params.inboundEventId);
}

async function markInboundEventFailed(params: {
  adminClient: SupabaseAdminClient;
  inboundEventId: string;
  error: string;
}) {
  await params.adminClient
    .from("inbound_events")
    .update({ processing_error: params.error })
    .eq("id", params.inboundEventId);
}

async function getActivePmsConfiguration(params: {
  adminClient: SupabaseAdminClient;
  tenantId: string;
}) {
  const { data, error } = await params.adminClient
    .from("pms_configurations")
    .select("pms_type, endpoint, credentials")
    .eq("tenant_id", params.tenantId)
    .eq("pms_type", "qloapps")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    pms_type: string;
    endpoint: string;
    credentials: Record<string, string>;
  } | null;
}

export async function processQloAppsWebhookEvent({
  rawBody,
  payload,
  payloadHash,
  normalizedEvent,
  adminClient = createAdminClient(),
  adapterFactory = getPMSAdapter,
}: ProcessQloAppsWebhookEventInput): Promise<ProcessQloAppsWebhookEventResult> {
  const tenantLookupClient = {
    from: adminClient.from.bind(adminClient),
  } as TenantLookupClient;

  let tenantId: string;
  try {
    tenantId = await resolveTenantIdForWebhook(
      tenantLookupClient,
      normalizedEvent.tenantId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid tenant";
    return {
      ok: false,
      status: message.startsWith("Unknown tenant_key") ? 404 : 500,
      error: message,
    };
  }

  const idempotencyKey = buildIdempotencyKey({
    bookingId: normalizedEvent.bookingId,
    status: normalizedEvent.status,
    updatedAt: normalizedEvent.updatedAt,
    rawPayload: rawBody,
  });

  const { data: inboundEvent, error: inboundError } = await adminClient
    .from("inbound_events")
    .insert({
      tenant_id: tenantId,
      event_id: normalizedEvent.eventId,
      idempotency_key: idempotencyKey,
      event_type: normalizedEvent.eventType,
      source: "qloapps",
      signature_valid: true,
      payload,
      payload_hash: payloadHash,
    })
    .select("id")
    .single();

  if (inboundError?.code === "23505") {
    return { ok: true, received: true, duplicate: true };
  }

  if (inboundError) {
    return { ok: false, status: 500, error: inboundError.message };
  }

  const inboundEventId = inboundEvent?.id as string | undefined;

  try {
    const pmsConfiguration = await getActivePmsConfiguration({
      adminClient,
      tenantId,
    });

    if (!pmsConfiguration) {
      throw new Error("Active QloApps PMS configuration not found");
    }

    const adapter = adapterFactory(pmsConfiguration.pms_type);
    adapter.init(pmsConfiguration.credentials, pmsConfiguration.endpoint);

    if (normalizedEvent.eventType === "booking.test") {
      if (inboundEventId) {
        await markInboundEventProcessed({ adminClient, inboundEventId });
      }

      return {
        ok: true,
        received: true,
        duplicate: false,
        job_enqueued: false,
        reservation_id: null,
      };
    }

    if (!adapter.pullReservationById) {
      throw new Error(
        "QloApps adapter does not support targeted reservation fetch",
      );
    }

    const reservation = await adapter.pullReservationById(
      normalizedEvent.bookingId,
    );

    if (!reservation) {
      throw new Error(
        `QloApps reservation ${normalizedEvent.bookingId} not found`,
      );
    }

    const mappedStatus = adapter.mapStatus(reservation.pms_status);
    const status = resolveReservationStatus({
      eventType: normalizedEvent.eventType,
      normalizedStatus: normalizedEvent.status,
      mappedStatus,
    });
    const upsertResult = await upsertPmsReservation({
      tenantId,
      adapter,
      reservation,
      status,
      adminClient,
    });

    if (inboundEventId) {
      const { error: eventUpdateError } = await adminClient
        .from("inbound_events")
        .update({
          payload: {
            ...payload,
            reservation_id: upsertResult.reservationId,
            booking_id: normalizedEvent.bookingId,
            previous_status: upsertResult.previousStatus ?? null,
            status: upsertResult.nextStatus,
            occurred_at: normalizedEvent.updatedAt ?? null,
          },
        })
        .eq("id", inboundEventId);

      if (eventUpdateError) {
        throw new Error(eventUpdateError.message);
      }

      await markInboundEventProcessed({ adminClient, inboundEventId });
    }

    const triggerType = resolveStatusAutomationTrigger({
      previousStatus: upsertResult.previousStatus,
      nextStatus: upsertResult.nextStatus,
      statusChanged: upsertResult.statusChanged,
    });

    let jobEnqueued = false;
    if (upsertResult.reservationId && triggerType) {
      const result = await enqueueStatusTriggerAutomationJobIfMissing({
        tenantId,
        reservationId: upsertResult.reservationId,
        triggerType,
        payload: {
          inbound_event_id: inboundEventId,
          event_type: normalizedEvent.eventType,
          booking_id: normalizedEvent.bookingId,
          status: upsertResult.nextStatus,
          previous_status: upsertResult.previousStatus ?? null,
          updated_at: normalizedEvent.updatedAt ?? null,
        },
        adminClient,
      });
      jobEnqueued = result.enqueued;
    }

    return {
      ok: true,
      received: true,
      duplicate: false,
      job_enqueued: jobEnqueued,
      reservation_id: upsertResult.reservationId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";

    if (inboundEventId) {
      await markInboundEventFailed({
        adminClient,
        inboundEventId,
        error: message,
      });
    }

    return { ok: false, status: 502, error: message };
  }
}
