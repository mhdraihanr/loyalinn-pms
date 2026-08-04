import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { wahaClient } from "@/lib/waha/client";

const SESSION_NAME = "default";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

async function requireChatId(context: RouteContext) {
  const { chatId } = await context.params;
  return decodeURIComponent(chatId).trim();
}

export async function GET(req: NextRequest, context: RouteContext) {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chatId = await requireChatId(context);
  if (!chatId) {
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
  }

  const limit = clampNumber(req.nextUrl.searchParams.get("limit"), 50, 1, 100);

  try {
    const messages = await wahaClient.getChatMessages(SESSION_NAME, chatId, {
      limit,
    });

    return NextResponse.json({ chatId, messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const upstreamStatus = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    const upstreamData = axios.isAxiosError(error)
      ? error.response?.data
      : undefined;

    console.error("WAHA chat messages error:", {
      chatId,
      message,
      upstreamStatus,
      upstreamData,
    });

    return NextResponse.json(
      {
        error:
          "Chat history is unavailable from the current WAHA engine/store configuration.",
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chatId = await requireChatId(context);
  if (!chatId) {
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text =
    body && typeof body === "object" && "text" in body
      ? String((body as { text?: unknown }).text ?? "").trim()
      : "";

  if (!text) {
    return NextResponse.json(
      { error: "Message text cannot be empty" },
      { status: 400 },
    );
  }

  try {
    const result = await wahaClient.sendMessage(SESSION_NAME, chatId, text);
    return NextResponse.json({ sent: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WAHA send message error:", { chatId, message });
    return NextResponse.json(
      { error: "Failed to send WhatsApp message" },
      { status: 502 },
    );
  }
}
