import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function GET() {
  const { tenant } = await getCurrentUserTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await wahaClient.getQR(tenant.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WAHA Get QR Error:", error.message);
    return NextResponse.json(
      { error: "Failed to get WAHA QR code" },
      { status: 500 },
    );
  }
}
