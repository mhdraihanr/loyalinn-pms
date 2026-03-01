import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function POST() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // WAHA Core free version only supports 1 session, typically named "default"
    // In a multi-tenant paid setup, this would be userTenant.tenantId
    const result = await wahaClient.startSession("default");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WAHA Start Session Error:", error.message);
    return NextResponse.json(
      { error: "Failed to start WAHA session" },
      { status: 500 },
    );
  }
}
