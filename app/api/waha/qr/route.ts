import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { resolveDefaultWahaSessionForTenant } from "@/lib/waha/session";

export async function GET() {
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
    const result = await wahaClient.getQR(configuredSession.sessionName);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WAHA Get QR Error:", message);
    return NextResponse.json(
      { error: "Failed to get WAHA QR code" },
      { status: 500 },
    );
  }
}
