"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTenantAsOwner } from "@/lib/auth/onboarding";

export type CreateTenantState = {
  error?: string;
  fieldErrors?: { hotelName?: string };
};

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const hotelName = (formData.get("hotelName") as string)?.trim();

  if (!hotelName || hotelName.length < 3) {
    return {
      fieldErrors: { hotelName: "Hotel name must be at least 3 characters." },
    };
  }
  if (hotelName.length > 100) {
    return {
      fieldErrors: { hotelName: "Hotel name must be 100 characters or less." },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    await createTenantAsOwner(user.id, hotelName);
  } catch (err) {
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership) {
      redirect("/");
    }

    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to create tenant.";

    if (msg.includes("already belongs")) {
      redirect("/");
    }
    return { error: msg };
  }

  redirect("/");
}
