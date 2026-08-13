import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { resolveDefaultWahaSessionForTenant } from "@/lib/waha/session";

export async function POST() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configuredSession = resolveDefaultWahaSessionForTenant(
    userTenant.tenantId,
  );
  if (!configuredSession) {
    return NextResponse.json(
      { error: "WhatsApp inbox is unavailable for this tenant." },
      { status: 403 },
    );
  }

  try {
    const result = await wahaClient.logoutSession(configuredSession.sessionName);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WAHA Logout Session Error:", message);
    return NextResponse.json(
      { error: "Failed to logout WAHA session" },
      { status: 500 },
    );
  }
}
