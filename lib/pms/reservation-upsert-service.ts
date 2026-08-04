import { createAdminClient } from "@/lib/supabase/admin";

import type { AdapterReservation, PMSAdapter } from "./adapter";

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

type UpsertPmsReservationInput = {
  tenantId: string;
  adapter: PMSAdapter;
  reservation: AdapterReservation;
  status: string;
  skipTerminalNewReservations?: boolean;
  adminClient?: ReturnType<typeof createAdminClient>;
};

type UpsertPmsReservationResult = {
  reservationId: string | null;
  guestId: string | null;
  previousStatus?: string;
  nextStatus: string;
  changed: boolean;
  statusChanged: boolean;
  skipped: boolean;
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

async function findExistingReservation(params: {
  tenantId: string;
  reservation: AdapterReservation;
  adminClient?: ReturnType<typeof createAdminClient>;
}) {
  const adminClient = params.adminClient ?? createAdminClient();
  const { data, error } = await adminClient
    .from("reservations")
    .select(
      "id, guest_id, pms_reservation_id, status, check_in_date, check_out_date, room_number, amount, source",
    )
    .eq("tenant_id", params.tenantId)
    .eq("pms_reservation_id", params.reservation.pms_reservation_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ExistingReservation | null;
}

async function upsertGuest(params: {
  tenantId: string;
  reservation: AdapterReservation;
  adapter: PMSAdapter;
  adminClient?: ReturnType<typeof createAdminClient>;
}) {
  const adminClient = params.adminClient ?? createAdminClient();
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
  adminClient?: ReturnType<typeof createAdminClient>;
}) {
  const adminClient = params.adminClient ?? createAdminClient();

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
  return data as { id: string };
}

export async function upsertPmsReservation({
  tenantId,
  adapter,
  reservation,
  status,
  skipTerminalNewReservations = false,
  adminClient,
}: UpsertPmsReservationInput): Promise<UpsertPmsReservationResult> {
  const existing = (await findExistingReservation({
    tenantId,
    reservation,
    adminClient,
  })) as ExistingReservation | null;

  if (
    !existing &&
    skipTerminalNewReservations &&
    (status === "checked-out" || status === "cancelled")
  ) {
    return {
      reservationId: null,
      guestId: null,
      previousStatus: undefined,
      nextStatus: status,
      changed: false,
      statusChanged: false,
      skipped: true,
    };
  }

  const guest = await upsertGuest({
    tenantId,
    reservation,
    adapter,
    adminClient,
  });
  if (!guest) {
    return {
      reservationId: null,
      guestId: null,
      previousStatus: existing?.status,
      nextStatus: status,
      changed: false,
      statusChanged: false,
      skipped: true,
    };
  }

  const changed = hasReservationChanged(existing ?? undefined, {
    status,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    roomNumber: reservation.room_number ?? null,
    amount: reservation.amount ?? null,
    source: reservation.source ?? null,
  });
  const statusChanged = Boolean(existing && existing.status !== status);

  const upsertedReservation = await upsertReservation({
    id: existing?.id,
    tenantId,
    guestId: guest.id,
    reservation,
    status,
    adminClient,
  });

  return {
    reservationId: upsertedReservation.id,
    guestId: guest.id,
    previousStatus: existing?.status,
    nextStatus: status,
    changed,
    statusChanged,
    skipped: false,
  };
}
