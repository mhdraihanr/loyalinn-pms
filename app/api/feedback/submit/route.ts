import { NextResponse } from "next/server";

import { verifyFeedbackToken } from "@/lib/automation/feedback-link";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmitFeedbackPayload = {
  token?: string;
  rating?: number;
  comments?: string;
};

function parseGuestPhone(value: unknown): string {
  if (!value) {
    return "web-form";
  }

  if (Array.isArray(value)) {
    const first = value[0] as { phone?: string } | undefined;
    return first?.phone ?? "web-form";
  }

  return (value as { phone?: string }).phone ?? "web-form";
}

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as SubmitFeedbackPayload | null;

  if (!body?.token) {
    return NextResponse.json(
      { error: "Missing feedback token" },
      { status: 400 },
    );
  }

  const payload = verifyFeedbackToken(body.token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired feedback token" },
      { status: 401 },
    );
  }

  const rating = Number(body.rating);
  const comments = String(body.comments ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be an integer between 1 and 5" },
      { status: 400 },
    );
  }

  if (!comments) {
    return NextResponse.json(
      { error: "Comments are required" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  const { data: reservation, error: reservationError } = await adminClient
    .from("reservations")
    .select("id, tenant_id, guest_id, post_stay_feedback_status, guests(phone)")
    .eq("id", payload.reservationId)
    .eq("tenant_id", payload.tenantId)
    .maybeSingle();

  if (reservationError || !reservation) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    );
  }

  if (reservation.post_stay_feedback_status !== "completed") {
    const { error: updateError } = await adminClient
      .from("reservations")
      .update({
        post_stay_feedback_status: "completed",
        post_stay_rating: rating,
        post_stay_comments: comments,
      })
      .eq("id", reservation.id)
      .eq("tenant_id", reservation.tenant_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  await adminClient.from("message_logs").insert({
    tenant_id: reservation.tenant_id,
    reservation_id: reservation.id,
    guest_id: reservation.guest_id,
    phone: parseGuestPhone(reservation.guests),
    content: `[WebForm Feedback] Rating: ${rating}. Comment: ${comments}`,
    direction: "inbound",
    status: "received",
    trigger_type: "post-stay",
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ submitted: true });
}
