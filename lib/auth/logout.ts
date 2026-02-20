"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

/**
 * Server action — sign out the current user and clear session.
 * Called from LogoutButton component after confirmation.
 */
export async function signOutUser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
