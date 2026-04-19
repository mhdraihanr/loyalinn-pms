import { createAdminClient } from "@/lib/supabase/admin";

export const FEEDBACK_REWARD_POINTS = 50;

type RewardRpcRow = {
  rewarded?: boolean | null;
  points_awarded?: number | null;
};

function getRpcRow(data: RewardRpcRow[] | RewardRpcRow | null): RewardRpcRow {
  if (!data) {
    return {};
  }

  if (Array.isArray(data)) {
    return data[0] ?? {};
  }

  return data;
}

export async function completePostStayFeedbackWithReward(params: {
  supabase: Awaited<ReturnType<typeof createAdminClient>>;
  reservationId: string;
  tenantId: string;
  rating: number;
  comments: string;
  rewardPoints?: number;
}) {
  const {
    supabase,
    reservationId,
    tenantId,
    rating,
    comments,
    rewardPoints = FEEDBACK_REWARD_POINTS,
  } = params;

  const { data, error } = await supabase.rpc(
    "complete_post_stay_feedback_with_reward",
    {
      p_reservation_id: reservationId,
      p_tenant_id: tenantId,
      p_rating: rating,
      p_comments: comments,
      p_reward_points: rewardPoints,
    },
  );

  if (error) {
    throw new Error(
      error.message ?? "Failed to complete feedback and reward guest",
    );
  }

  const row = getRpcRow(data as RewardRpcRow[] | RewardRpcRow | null);
  const pointsAwarded = Number(row.points_awarded ?? 0);

  return {
    rewarded: Boolean(row.rewarded),
    pointsAwarded: Number.isFinite(pointsAwarded) ? pointsAwarded : 0,
  };
}
