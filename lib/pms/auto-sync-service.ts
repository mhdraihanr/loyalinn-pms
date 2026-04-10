import { buildPayloadHash } from "@/lib/automation/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";

import type { AdapterReservation, PMSAdapter } from "./adapter";

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

type ExistingReservation = {
  id: string;
  guest_id: string | null;
  pms_reservation_id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  room_number: string | null;
  amount: number | null;
  source: string | null;
};

type UpsertedReservation = {
  id: string;
};

function hasReservationChanged(
  existing: ExistingReservation | undefined,
  nextReservation: {
    status: string;
    checkInDate: string;
    checkOutDate: string;
    roomNumber: string | null;
    amount: number | null;
    source: string | null;
  },
) {
  if (!existing) {
    return true;
  }

  return (
    existing.status !== nextReservation.status ||
    existing.check_in_date !== nextReservation.checkInDate ||
    existing.check_out_date !== nextReservation.checkOutDate ||
    (existing.room_number ?? null) !== nextReservation.roomNumber ||
    (existing.amount ?? null) !== nextReservation.amount ||
    (existing.source ?? null) !== nextReservation.source
  );
}

function shouldEnqueueImmediateAutomation(
  previousStatus: string | undefined,
  nextStatus: string,
) {
  return nextStatus === "on-stay" && previousStatus !== "on-stay";
}

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
}) {
  const adminClient = createAdminClient();
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

async function enqueueImmediateAutomationJob(params: {
  tenantId: string;
  reservationId: string;
  bookingId: string;
  inboundEventId: string;
  previousStatus?: string;
  nextStatus: string;
  occurredAt: string;
}) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("automation_jobs").insert({
    tenant_id: params.tenantId,
    reservation_id: params.reservationId,
    job_type: "status-trigger",
    trigger_type: params.nextStatus,
    status: "pending",
    payload: {
      inbound_event_id: params.inboundEventId,
      booking_id: params.bookingId,
      status: params.nextStatus,
      previous_status: params.previousStatus ?? null,
      updated_at: params.occurredAt,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertGuest(params: {
  tenantId: string;
  reservation: AdapterReservation;
  adapter: PMSAdapter;
}) {
  const adminClient = createAdminClient();
  const guestDetails = await params.adapter.pullGuest(
    params.reservation.pms_guest_id,
  );

  if (!guestDetails) {
    return null;
  }

  const { data, error } = await adminClient
    .from("guests")
    .upsert(
      {
        tenant_id: params.tenantId,
        pms_guest_id: guestDetails.pms_guest_id,
        name: guestDetails.name,
        email: guestDetails.email,
        phone: guestDetails.phone,
        country: guestDetails.country,
      },
      { onConflict: "tenant_id,pms_guest_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string };
}

async function upsertReservation(params: {
  id?: string;
  tenantId: string;
  guestId: string;
  reservation: AdapterReservation;
  status: string;
}) {
  const adminClient = createAdminClient();

  const payload = {
    ...(params.id ? { id: params.id } : {}),
    tenant_id: params.tenantId,
    guest_id: params.guestId,
    pms_reservation_id: params.reservation.pms_reservation_id,
    room_number: params.reservation.room_number ?? null,
    check_in_date: params.reservation.check_in_date,
    check_out_date: params.reservation.check_out_date,
    status: params.status,
    amount: params.reservation.amount ?? null,
    source: params.reservation.source ?? null,
  };

  const { data, error } = await adminClient
    .from("reservations")
    .upsert(payload, {
      onConflict: params.id ? "id" : "tenant_id,pms_reservation_id",
      ignoreDuplicates: false,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as UpsertedReservation;
}

export async function runAutoSyncForTenant({
  tenantId,
  adapter,
  startDate,
  endDate,
  now = new Date(),
}: AutoSyncInput): Promise<AutoSyncResult> {
  const adminClient = createAdminClient();
  const { data: existingReservations, error } = await adminClient
    .from("reservations")
    .select(
      "id, guest_id, pms_reservation_id, status, check_in_date, check_out_date, room_number, amount, source",
    )
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(error.message);
  }

  const existingByBookingId = new Map(
    ((existingReservations ?? []) as ExistingReservation[]).map(
      (reservation) => [reservation.pms_reservation_id, reservation],
    ),
  );

  const pulledReservations = await adapter.pullReservations(startDate, endDate);

  let reservationsSynced = 0;
  let eventsCreated = 0;
  let jobsEnqueued = 0;

  for (const reservation of pulledReservations) {
    const guest = await upsertGuest({ tenantId, reservation, adapter });
    if (!guest) {
      continue;
    }

    const status = adapter.mapStatus(reservation.pms_status);
    const existing = existingByBookingId.get(reservation.pms_reservation_id);

    // MENGHINDARI TARIK ULANG RESERVASI LAMA YANG SUDAH DIDELETE (KEEP WEB CLEAN):
    // Jika reservasi ini belum ada di tabel 'reservations' (karena dihapus manual oleh admin)
    // DAN ternyata status aslinya sudah selesai (checked-out/cancelled) di PMS QloApps,
    // maka sistem abaikan saja agar tidak "fetch kembali yang udah selesai".
    if (!existing && (status === "checked-out" || status === "cancelled")) {
      continue;
    }

    const changed = hasReservationChanged(existing, {
      status,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      roomNumber: reservation.room_number ?? null,
      amount: reservation.amount ?? null,
      source: reservation.source ?? null,
    });

    const upsertedReservation = await upsertReservation({
      id: existing?.id,
      tenantId,
      guestId: guest.id,
      reservation,
      status,
    });

    reservationsSynced += 1;

    if (!changed) {
      continue;
    }

    const occurredAt = now.toISOString();
    const eventType = existing ? "reservation.updated" : "reservation.created";
    const inboundEvent = await insertInboundEvent({
      tenantId,
      reservationId: upsertedReservation.id,
      bookingId: reservation.pms_reservation_id,
      previousStatus: existing?.status,
      nextStatus: status,
      eventType,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      roomNumber: reservation.room_number ?? null,
      amount: reservation.amount ?? null,
      source: reservation.source ?? null,
      occurredAt,
    });

    if (!inboundEvent) {
      continue;
    }

    eventsCreated += 1;

    if (!shouldEnqueueImmediateAutomation(existing?.status, status)) {
      continue;
    }

    await enqueueImmediateAutomationJob({
      tenantId,
      reservationId: upsertedReservation.id,
      bookingId: reservation.pms_reservation_id,
      inboundEventId: inboundEvent.id,
      previousStatus: existing?.status,
      nextStatus: status,
      occurredAt,
    });
    jobsEnqueued += 1;
  }

  return {
    reservationsSynced,
    eventsCreated,
    jobsEnqueued,
  };
}
