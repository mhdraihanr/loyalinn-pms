"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { getInvitationByToken } from "./invitations";

export type SignupState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
};

/**
 * Server action — create user account (email + password only).
 *
 * Two modes:
 *  - Normal signup: no invite_token — redirect /login after account creation
 *  - Invited signup: invite_token present — email is locked to invited_email,
 *    redirect back to /accept-invite?token=<token> after account creation
 *    so the accept flow can finalise the tenant_users record.
 */
export async function signupUser(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const inviteToken = (formData.get("invite_token") as string) || null;
  const lockedEmail = (formData.get("locked_email") as string) || "";

  // When invited, use the locked email from the hidden field — not the user input
  const email = inviteToken ? lockedEmail : (formData.get("email") as string);

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const fieldErrors: SignupState["fieldErrors"] = {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }
  if (!password || password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // If there's an invite token, validate it server-side before creating the account
  if (inviteToken) {
    const invitation = await getInvitationByToken(inviteToken);
    if (!invitation) {
      return {
        error:
          "This invite link is invalid or has expired. Ask your hotel owner to re-invite you.",
      };
    }
    if (invitation.status !== "pending") {
      return {
        error: "This invite link has already been used or has expired.",
      };
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return {
        error:
          "This invite link has expired (7-day limit). Ask your hotel owner to re-invite you.",
      };
    }
    // Double-check email matches
    if (invitation.invited_email.toLowerCase() !== email.toLowerCase()) {
      return {
        fieldErrors: {
          email:
            "Email does not match the invited address. It cannot be changed.",
        },
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (error.message.includes("already registered")) {
      return {
        fieldErrors: {
          email: "An account with this email already exists. Try logging in.",
        },
      };
    }
    return { error: error.message };
  }

  // After signup, user must log in to get a session.
  // If invited: redirect to /accept-invite after login so the accept flow completes.
  if (inviteToken) {
    redirect(`/login?invite_token=${inviteToken}&registered=1`);
  }

  redirect("/login?registered=1");
}
