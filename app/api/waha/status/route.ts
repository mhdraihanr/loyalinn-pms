import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

type WahaSessionInfo = {
  name: string;
  status: string;
  me?: unknown;
};

export async function GET() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // WAHA Core free version only supports 1 session, typically named "default"
  // In a multi-tenant paid setup, this would be userTenant.tenantId
  const sessionId = "default";
  try {
    const sessions = (await wahaClient.getSessions()) as WahaSessionInfo[];
    const session = sessions.find((s) => s.name === sessionId);

    if (!session) {
      return NextResponse.json({ status: "STOPPED" });
    }

    return NextResponse.json({
      status: session.status,
      me: session.me, // connected phone info
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WAHA API Error:", message);
    return NextResponse.json(
      { error: "WAHA connection failed", status: "ERROR" },
      { status: 500 },
    );
  }
}
