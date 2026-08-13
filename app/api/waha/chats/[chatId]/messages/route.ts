import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import {
  getWhatsappConversationById,
  getWhatsappMessages,
  insertWhatsappMessage,
  markWhatsappConversationRead,
  updateWhatsappMessageStatus,
} from "@/lib/data/whatsapp-inbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { wahaClient } from "@/lib/waha/client";
import { getCanonicalWahaMessageId } from "@/lib/waha/message-id";
import { resolveDefaultWahaSessionForTenant } from "@/lib/waha/session";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

async function requireConversationId(context: RouteContext) {
  const { chatId } = await context.params;
  return decodeURIComponent(chatId).trim();
}

async function getAuthorizedConversation(context: RouteContext) {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = resolveDefaultWahaSessionForTenant(userTenant.tenantId);
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "WhatsApp inbox is unavailable for this tenant." },
        { status: 403 },
      ),
    };
  }

  const conversationId = await requireConversationId(context);
  if (!conversationId) {
    return { error: NextResponse.json({ error: "Missing conversationId" }, { status: 400 }) };
  }

  const conversation = await getWhatsappConversationById(
    userTenant.tenantId,
    conversationId,
  );

  if (!conversation) {
    return { error: NextResponse.json({ error: "Chat not found" }, { status: 404 }) };
  }

  return { userTenant, session, conversation };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const authorized = await getAuthorizedConversation(context);
    if ("error" in authorized) return authorized.error;

    const limit = clampNumber(req.nextUrl.searchParams.get("limit"), 50, 1, 100);
    const messages = await getWhatsappMessages(
      authorized.userTenant.tenantId,
      authorized.conversation.id,
      limit,
    );

    return NextResponse.json({
      conversation: authorized.conversation,
      messages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp inbox messages error:", message);
    return NextResponse.json(
      { error: "Failed to load WhatsApp messages" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authorized = await getAuthorizedConversation(context);
    if ("error" in authorized) return authorized.error;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const request = body as { action?: unknown; text?: unknown; clientMessageId?: unknown };
    const action = typeof request.action === "string" ? request.action : "send";
    const supabase = createAdminClient();

    if (action === "mark-read") {
      await markWhatsappConversationRead(
        supabase,
        authorized.userTenant.tenantId,
        authorized.conversation.id,
      );
      return NextResponse.json({ markedRead: true });
    }

    const text = typeof request.text === "string" ? request.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "Message text cannot be empty" },
        { status: 400 },
      );
    }

    if (text.length > 4000) {
      return NextResponse.json(
        { error: "Message text cannot exceed 4000 characters" },
        { status: 400 },
      );
    }

    const clientMessageId =
      typeof request.clientMessageId === "string" && request.clientMessageId.trim()
        ? request.clientMessageId.trim()
        : crypto.randomUUID();

    const pending = await insertWhatsappMessage(supabase, authorized.conversation, {
      tenantId: authorized.userTenant.tenantId,
      conversationId: authorized.conversation.id,
      sessionName: authorized.session.sessionName,
      chatId: authorized.conversation.chat_id,
      clientMessageId,
      idempotencyKey: `client:${clientMessageId}`,
      direction: "outbound",
      content: text,
      status: "sending",
      createdBy: authorized.userTenant.userId,
      sentAt: new Date().toISOString(),
    });

    if (pending.duplicate) {
      return NextResponse.json({ error: "Duplicate message request" }, { status: 409 });
    }

    try {
      const result = await wahaClient.sendMessage(
        authorized.session.sessionName,
        authorized.conversation.chat_id,
        text,
      );
      const resultRecord = result && typeof result === "object" ? result as Record<string, unknown> : null;
      const providerMessageId = getCanonicalWahaMessageId(result);
      const message = await updateWhatsappMessageStatus(supabase, {
        tenantId: authorized.userTenant.tenantId,
        messageId: pending.message!.id,
        status: "sent",
        providerMessageId,
        providerResponse: resultRecord,
        sentAt: new Date().toISOString(),
      });

      return NextResponse.json({ sent: true, message });
    } catch (error: unknown) {
      const failureMessage = error instanceof Error ? error.message : "Failed to send WhatsApp message";
      const message = await updateWhatsappMessageStatus(supabase, {
        tenantId: authorized.userTenant.tenantId,
        messageId: pending.message!.id,
        status: "failed",
        errorMessage: failureMessage,
      });

      return NextResponse.json(
        { error: "Failed to send WhatsApp message", message },
        { status: 502 },
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp inbox send error:", message);
    return NextResponse.json(
      { error: "Failed to process WhatsApp message" },
      { status: 500 },
    );
  }
}
