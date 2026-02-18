import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";

/**
 * Owner invites a new staff member via email.
 * Uses Supabase Auth Admin API to send a magic-link invite.
 * The invited user's tenant assignment is stored in user_metadata
 * and applied via acceptStaffInvitation() after they accept.
 *
 * SERVER-SIDE ONLY — requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function inviteStaffMember(
  ownerUserId: string,
  email: string,
): Promise<void> {
  const supabase = await createClient();

  // Verify caller is an owner
  const { data: ownerRecord } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", ownerUserId)
    .single();

  if (!ownerRecord || ownerRecord.role !== "owner") {
    throw new Error("Only owners can invite staff members.");
  }

  // Send invite email via Supabase Auth Admin API
  // Stores pending_tenant_id in user_metadata for use after signup
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      pending_tenant_id: ownerRecord.tenant_id,
      invited_by: ownerUserId,
      role: "staff",
    },
  });

  if (error) throw error;
}

/**
 * Called after an invited staff member accepts their invite and completes signup.
 * Reads pending_tenant_id from user_metadata and creates the tenant_users record.
 *
 * SERVER-SIDE ONLY — requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function acceptStaffInvitation(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Get user metadata set during invite
  const {
    data: { user },
    error: userError,
  } = await admin.auth.admin.getUserById(userId);
  if (userError || !user) throw new Error("User not found.");

  const { pending_tenant_id, invited_by, role } = user.user_metadata ?? {};

  if (!pending_tenant_id || role !== "staff") {
    throw new Error("No pending staff invitation found for this user.");
  }

  // Create tenant_users record (UNIQUE user_id enforces 1 user = max 1 tenant)
  const { error } = await admin.from("tenant_users").insert({
    tenant_id: pending_tenant_id,
    user_id: userId,
    role: "staff",
    invited_by: invited_by ?? null,
  });

  if (error) throw error;

  // Clear metadata after use
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      pending_tenant_id: null,
      invited_by: null,
      role: null,
    },
  });
}
