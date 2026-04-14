import { createClient } from "@/lib/supabase/server";
import {
  buildFeedbackLink,
  createFeedbackToken,
} from "@/lib/automation/feedback-link";

type GuestRelation = {
  name: string | null;
  phone: string | null;
};

type RawFeedbackReservation = {
  id: string;
  check_out_date: string;
  post_stay_feedback_status:
    | "not-sent"
    | "pending"
    | "ai_followup"
    | "completed"
    | "ignored"
    | null;
  post_stay_rating: number | null;
  post_stay_comments: string | null;
  updated_at: string;
  guests: GuestRelation | GuestRelation[] | null;
};

export type FeedbackMonitorRow = {
  id: string;
  checkOutDate: string;
  feedbackStatus:
    | "not-sent"
    | "pending"
    | "ai_followup"
    | "completed"
    | "ignored";
  rating: number | null;
  comments: string | null;
  updatedAt: string;
  guestName: string;
  guestPhone: string | null;
  feedbackLink: string | null;
};

function getGuest(
  value: GuestRelation | GuestRelation[] | null,
): GuestRelation | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeFeedbackStatus(
  status: RawFeedbackReservation["post_stay_feedback_status"],
): FeedbackMonitorRow["feedbackStatus"] {
  if (
    status === "pending" ||
    status === "ai_followup" ||
    status === "completed" ||
    status === "ignored"
  ) {
    return status;
  }

  return "not-sent";
}

export async function getFeedbackMonitorRows(
  tenantId: string,
): Promise<FeedbackMonitorRow[]> {
  const supabase = await createClient();
  const canBuildFeedbackLink = Boolean(
    process.env.POST_STAY_FEEDBACK_SECRET ?? process.env.PMS_WEBHOOK_SECRET,
  );

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, check_out_date, post_stay_feedback_status, post_stay_rating, post_stay_comments, updated_at, guests(name, phone)",
    )
    .eq("tenant_id", tenantId)
    .eq("status", "checked-out")
    .order("check_out_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching feedback monitor rows:", error);
    return [];
  }

  return ((data ?? []) as RawFeedbackReservation[]).map((reservation) => {
    const guest = getGuest(reservation.guests);
    let feedbackLink: string | null = null;

    if (canBuildFeedbackLink) {
      feedbackLink = buildFeedbackLink(
        createFeedbackToken({
          reservationId: reservation.id,
          tenantId,
        }),
      );
    }

    return {
      id: reservation.id,
      checkOutDate: reservation.check_out_date,
      feedbackStatus: normalizeFeedbackStatus(
        reservation.post_stay_feedback_status,
      ),
      rating: reservation.post_stay_rating,
      comments: reservation.post_stay_comments,
      updatedAt: reservation.updated_at,
      guestName: guest?.name ?? "Unknown Guest",
      guestPhone: guest?.phone ?? null,
      feedbackLink,
    };
  });
}
