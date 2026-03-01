import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function GET() {
  const { tenant } = await getCurrentUserTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = tenant.id; // UUID as session name
  try {
    const sessions = await wahaClient.getSessions();
    const session = sessions.find((s: any) => s.name === sessionId);

    if (!session) {
      return NextResponse.json({ status: "STOPPED" });
    }

    return NextResponse.json({
      status: session.status,
      me: session.me, // connected phone info
    });
  } catch (error: any) {
    console.error("WAHA API Error:", error.message);
    return NextResponse.json(
      { error: "WAHA connection failed", status: "ERROR" },
      { status: 500 },
    );
  }
}
