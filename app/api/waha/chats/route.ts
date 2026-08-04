import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { wahaClient } from "@/lib/waha/client";

const SESSION_NAME = "default";

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

  const limit = clampNumber(req.nextUrl.searchParams.get("limit"), 20, 1, 50);
  const offset = clampNumber(req.nextUrl.searchParams.get("offset"), 0, 0, 10_000);

  try {
    const chats = await wahaClient.getChatsOverview(SESSION_NAME, {
      limit,
      offset,
    });

    return NextResponse.json({
      chats,
      pagination: { limit, offset },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WAHA chats overview error:", message);
    return NextResponse.json(
      { error: "Failed to load WhatsApp chats" },
      { status: 502 },
    );
  }
}
