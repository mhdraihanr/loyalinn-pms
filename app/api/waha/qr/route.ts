import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function GET() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // WAHA Core free version only supports 1 session, typically named "default"
    const result = await wahaClient.getQR("default");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WAHA Get QR Error:", error.message);
    return NextResponse.json(
      { error: "Failed to get WAHA QR code" },
      { status: 500 },
    );
  }
}
