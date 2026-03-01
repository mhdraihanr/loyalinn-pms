import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function POST() {
  const { tenant } = await getCurrentUserTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await wahaClient.startSession(tenant.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WAHA Start Session Error:", error.message);
    return NextResponse.json(
      { error: "Failed to start WAHA session" },
      { status: 500 },
    );
  }
}
