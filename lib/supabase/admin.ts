import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin client using the service role key.
 * Has full database access — bypasses RLS.
 *
 * SERVER-SIDE ONLY. Never expose to the browser.
 * Use only in:
 *   - API route handlers (app/api/*)
 *   - Server Actions
 *   - lib/auth/invitations.ts
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
