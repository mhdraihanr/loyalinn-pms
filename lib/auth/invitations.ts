import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InvitationRecord = {
  id: string;
  tenant_id: string;
  invited_email: string;
  invited_by: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  accepted_by: string | null;
  created_at: string;
};

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Look up an invitation by token using admin client (bypasses RLS).
 * Returns null if not found.
 *
 * SERVER-SIDE ONLY.
 */
export async function getInvitationByToken(
  token: string,
): Promise<InvitationRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  return data as InvitationRecord | null;
}

// ─── Owner: invite staff ──────────────────────────────────────────────────────

/**
 * Owner invites a new staff member via email.
 * Inserts a row into `invitations` table with a UUID token.
 * Sends the invite email with the link: /accept-invite?token=<uuid>
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

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Insert invitation row — token is auto-generated UUID in DB
  const { data: invitation, error: insertError } = await admin
    .from("invitations")
    .insert({
      tenant_id: ownerRecord.tenant_id,
      invited_email: email.toLowerCase().trim(),
      invited_by: ownerUserId,
    })
    .select("token")
    .single();

  if (insertError) throw insertError;

  // Send invite email via Supabase Auth Admin API (magic link pointing to our page)
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${appUrl}/accept-invite?token=${invitation.token}`,
    },
  );

  // If email send fails, clean up the invitation row so it can be retried
  if (emailError) {
    await admin.from("invitations").delete().eq("token", invitation.token);
    throw emailError;
  }
}

// ─── Staff: accept invitation ─────────────────────────────────────────────────

/**
 * Called when a logged-in staff member clicks "Accept" on /accept-invite?token=<uuid>.
 * Validates the token, creates the tenant_users record, marks invitation accepted.
 *
 * SERVER-SIDE ONLY — requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function acceptStaffInvitation(
  userId: string,
  token: string,
): Promise<void> {
  const admin = createAdminClient();

  // Re-fetch invitation inside the accept transaction to guard against races
  const { data: invitation, error: fetchError } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!invitation) {
    throw new Error("Invitation not found.");
  }
  if (invitation.status !== "pending") {
    throw new Error(
      invitation.status === "accepted"
        ? "This invitation has already been accepted."
        : "This invitation has expired.",
    );
  }
  if (new Date(invitation.expires_at) < new Date()) {
    // Mark expired in DB while we're here
    await admin
      .from("invitations")
      .update({ status: "expired" })
      .eq("token", token);
    throw new Error("This invitation has expired.");
  }

  // Create tenant_users record (UNIQUE user_id enforces 1 user = max 1 tenant)
  const { error: insertError } = await admin.from("tenant_users").insert({
    tenant_id: invitation.tenant_id,
    user_id: userId,
    role: "staff",
    invited_by: invitation.invited_by,
  });

  if (insertError) throw insertError;

  // Mark invitation as accepted
  const { error: updateError } = await admin
    .from("invitations")
    .update({ status: "accepted", accepted_by: userId })
    .eq("token", token);

  if (updateError) throw updateError;
}
