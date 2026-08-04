import { buildPayloadHash } from "@/lib/automation/idempotency";
import { enqueueStatusTriggerAutomationJobIfMissing } from "@/lib/automation/queue";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PMSAdapter } from "./adapter";
import { upsertPmsReservation } from "./reservation-upsert-service";
import { resolveStatusAutomationTrigger } from "./status-automation";

type AutoSyncInput = {
  tenantId: string;
  adapter: PMSAdapter;
  startDate: string;
  endDate: string;
  now?: Date;
};

type AutoSyncResult = {
  reservationsSynced: number;
  eventsCreated: number;
  jobsEnqueued: number;
};


async function insertInboundEvent(params: {
  tenantId: string;
  reservationId: string;
  bookingId: string;
  previousStatus?: string;
  nextStatus: string;
  eventType: "reservation.created" | "reservation.updated";
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string | null;
  amount: number | null;
  source: string | null;
  occurredAt: string;
  adminClient?: ReturnType<typeof createAdminClient>;
}) {
  const adminClient = params.adminClient ?? createAdminClient();
  const idempotencyKey = buildPayloadHash(
    JSON.stringify({
      booking_id: params.bookingId,
      previous_status: params.previousStatus ?? null,
      status: params.nextStatus,
      check_in_date: params.checkInDate,
      check_out_date: params.checkOutDate,
      room_number: params.roomNumber,
      amount: params.amount,
      source: params.source,
      event_type: params.eventType,
    }),
  );
  const payload = {
    reservation_id: params.reservationId,
    booking_id: params.bookingId,
    previous_status: params.previousStatus ?? null,
    status: params.nextStatus,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    room_number: params.roomNumber,
    amount: params.amount,
    source: params.source,
    occurred_at: params.occurredAt,
  };
  const eventId = `poll:${params.tenantId}:${params.bookingId}:${idempotencyKey}`;

  const { data, error } = await adminClient
    .from("inbound_events")
    .insert({
      tenant_id: params.tenantId,
      event_id: eventId,
      idempotency_key: idempotencyKey,
      event_type: params.eventType,
      source: "qloapps-poll",
      signature_valid: true,
      payload,
      payload_hash: idempotencyKey,
    })
    .select("id")
    .single();

  if ((error as { code?: string } | null)?.code === "23505") {
    return null;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string } | null;
}


export async function runAutoSyncForTenant({
  tenantId,
  adapter,
  startDate,
  endDate,
  now = new Date(),
}: AutoSyncInput): Promise<AutoSyncResult> {
  const pulledReservations = await adapter.pullReservations(startDate, endDate);

  let reservationsSynced = 0;
  let eventsCreated = 0;
  let jobsEnqueued = 0;

  for (const reservation of pulledReservations) {
    const status = adapter.mapStatus(reservation.pms_status);
    const upsertResult = await upsertPmsReservation({
      tenantId,
      adapter,
      reservation,
      status,
      // Polling reconciliation tetap boleh menghindari tarik ulang reservasi terminal
      // yang sudah dihapus manual dari web agar tampilan lokal tetap bersih.
      skipTerminalNewReservations: true,
    });

    if (upsertResult.skipped || !upsertResult.reservationId) {
      continue;
    }

    reservationsSynced += 1;

    if (!upsertResult.changed) {
      continue;
    }

    const occurredAt = now.toISOString();
    const eventType = upsertResult.previousStatus
      ? "reservation.updated"
      : "reservation.created";
    const adminClient = createAdminClient();
    const inboundEvent = await insertInboundEvent({
      tenantId,
      reservationId: upsertResult.reservationId,
      bookingId: reservation.pms_reservation_id,
      previousStatus: upsertResult.previousStatus,
      nextStatus: upsertResult.nextStatus,
      eventType,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      roomNumber: reservation.room_number ?? null,
      amount: reservation.amount ?? null,
      source: reservation.source ?? null,
      occurredAt,
      adminClient,
    });

    if (!inboundEvent) {
      continue;
    }

    eventsCreated += 1;

    const triggerType = resolveStatusAutomationTrigger({
      previousStatus: upsertResult.previousStatus,
      nextStatus: upsertResult.nextStatus,
      statusChanged: upsertResult.statusChanged,
    });

    if (!triggerType) {
      continue;
    }

    const enqueueResult = await enqueueStatusTriggerAutomationJobIfMissing({
      tenantId,
      reservationId: upsertResult.reservationId,
      triggerType,
      payload: {
        inbound_event_id: inboundEvent.id,
        booking_id: reservation.pms_reservation_id,
        status: upsertResult.nextStatus,
        previous_status: upsertResult.previousStatus ?? null,
        updated_at: occurredAt,
      },
      adminClient,
    });

    if (enqueueResult.enqueued) {
      jobsEnqueued += 1;
    }
  }

  return {
    reservationsSynced,
    eventsCreated,
    jobsEnqueued,
  };
}
