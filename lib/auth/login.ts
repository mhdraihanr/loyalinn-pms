"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

export type LoginState = {
  error?: string;
};

/**
 * Server action — sign in with email + password.
 *
 * If `invite_token` is present in the form data (passed from the login page
 * when the user arrived via an invite link), redirect to
 * /accept-invite?token=<token> after login instead of the default /.
 * Middleware will handle the tenant check from there.
 */
export async function loginUser(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const inviteToken = (formData.get("invite_token") as string) || null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Email or password is incorrect." };
    }
    if (error.message.includes("Too many requests")) {
      return { error: "Too many login attempts. Please try again later." };
    }
    return { error: error.message };
  }

  if (inviteToken) {
    redirect(`/accept-invite?token=${inviteToken}`);
  }

  redirect("/");
}
