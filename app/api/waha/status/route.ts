import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { resolveDefaultWahaSessionForTenant } from "@/lib/waha/session";

type WahaSessionInfo = {
  name: string;
  status: string;
  me?: unknown;
};

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

  const sessionId = configuredSession.sessionName;
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
