import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { getWhatsappConversations } from "@/lib/data/whatsapp-inbox";
import { resolveDefaultWahaSessionForTenant } from "@/lib/waha/session";

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function GET(req: NextRequest) {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!resolveDefaultWahaSessionForTenant(userTenant.tenantId)) {
    return NextResponse.json(
      { error: "WhatsApp inbox is unavailable for this tenant." },
      { status: 403 },
    );
  }

  const limit = clampNumber(req.nextUrl.searchParams.get("limit"), 50, 1, 100);

  try {
    const conversations = await getWhatsappConversations(userTenant.tenantId, limit);
    return NextResponse.json({ conversations, tenantId: userTenant.tenantId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp inbox conversations error:", message);
    return NextResponse.json(
      { error: "Failed to load WhatsApp conversations" },
      { status: 500 },
    );
  }
}
