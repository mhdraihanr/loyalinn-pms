import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import type { ModelMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { processGuestFeedback } from "@/lib/ai/agent";
import { wahaClient } from "@/lib/waha/client";

const RESERVATION_LOOKUP_SELECT = `
  id,
  tenant_id,
  pms_reservation_id,
  guest_id,
  guests!inner(name, phone),
  tenants!inner(name)
`;

const SUPPORTED_HMAC_ALGORITHMS = new Set(["sha256", "sha512"]);

type FeedbackLanguage = "id" | "en";

const HANDOFF_REPLY_TEMPLATES: Record<
  FeedbackLanguage,
  {
    completed: string;
    ignored: string;
  }
> = {
  id: {
    completed:
      "Terima kasih {{guestName}}, feedback Anda sudah kami teruskan ke tim {{hotelName}}. Untuk tindak lanjut, tim hotel akan menghubungi Anda secara manual jika diperlukan.",
    ignored:
      "Baik {{guestName}}, kami tidak akan melanjutkan follow-up otomatis. Jika Anda membutuhkan bantuan, silakan hubungi tim {{hotelName}}.",
  },
  en: {
    completed:
      "Thank you {{guestName}}, your feedback has been forwarded to the {{hotelName}} team. For any follow-up, our hotel staff will contact you manually if needed.",
    ignored:
      "Understood {{guestName}}, we will stop this automated follow-up. If you need anything, please contact the {{hotelName}} team.",
  },
};

function parseBooleanLike(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return false;
}

function getFirstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function toSerializedChatId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const asObject = toRecord(value);
  if (!asObject) {
    return "";
  }

  return getFirstNonEmptyString([
    asObject._serialized,
    asObject.serialized,
    asObject.remote,
    asObject.id,
    typeof asObject.user === "string" && typeof asObject.server === "string"
      ? `${asObject.user}@${asObject.server}`
      : "",
  ]);
}

function extractChatId(message: Record<string, unknown>) {
  const dataObject = toRecord(message._data);
  const dataIdObject = toRecord(dataObject?.id);

  return getFirstNonEmptyString([
    toSerializedChatId(message.from),
    toSerializedChatId(message.chatId),
    toSerializedChatId(message.chat_id),
    toSerializedChatId(message.author),
    toSerializedChatId(dataObject?.from),
    toSerializedChatId(dataObject?.author),
    toSerializedChatId(dataIdObject?.remote),
  ]);
}

function extractMessageText(message: Record<string, unknown>) {
  const directText = getFirstNonEmptyString([
    message.body,
    message.text,
    message.caption,
    message.content,
  ]);

  if (directText) {
    return directText;
  }

  const bodyValue = message.body;
  if (bodyValue && typeof bodyValue === "object") {
    const bodyObject = bodyValue as Record<string, unknown>;
    const nestedBodyText = getFirstNonEmptyString([
      bodyObject.text,
      bodyObject.body,
      bodyObject.caption,
      bodyObject.content,
    ]);

    if (nestedBodyText) {
      return nestedBodyText;
    }
  }

  const data = message._data;
  if (data && typeof data === "object") {
    const dataObject = data as Record<string, unknown>;
    return getFirstNonEmptyString([
      dataObject.body,
      dataObject.text,
      dataObject.caption,
      dataObject.content,
    ]);
  }

  return "";
}

function cleanPhone(chatId: string) {
  return chatId.split("@")[0].trim();
}

function safeCompareSecret(expected: string, actual: string | null) {
  if (!actual || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function normalizeSecret(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Ignore obvious placeholders from local examples.
  if (trimmed.startsWith("your-")) {
    return null;
  }

  return trimmed;
}

function getConfiguredWebhookSecrets() {
  const candidates = [
    normalizeSecret(process.env.WAHA_WEBHOOK_SECRET),
    normalizeSecret(process.env.PMS_WEBHOOK_SECRET),
    normalizeSecret(process.env.WAHA_API_KEY),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

function hasAnySecretMatch(secrets: string[], value: string | null) {
  return secrets.some((secret) => safeCompareSecret(secret, value));
}

function verifyWebhookHmac(
  secrets: string[],
  algorithm: string | null,
  hmacHeader: string | null,
  rawBody: string,
) {
  if (!hmacHeader) {
    return {
      ok: false,
      reason: "no hmac header",
    };
  }

  const resolvedAlgorithm = (algorithm ?? "sha512").toLowerCase();
  if (!SUPPORTED_HMAC_ALGORITHMS.has(resolvedAlgorithm)) {
    return {
      ok: false,
      reason: `unsupported hmac algorithm: ${resolvedAlgorithm}`,
    };
  }

  const matches = secrets.some((secret) => {
    const expected = createHmac(resolvedAlgorithm, secret)
      .update(rawBody)
      .digest("hex");
    return safeCompareSecret(expected, hmacHeader);
  });

  return {
    ok: matches,
    reason: matches ? "hmac match" : "hmac mismatch",
  };
}

function verifyWebhookAuth(req: NextRequest, rawBody: string) {
  if (process.env.WAHA_WEBHOOK_AUTH_DISABLED === "true") {
    return {
      isAuthorized: true,
      missingSecret: false,
      reason: "auth disabled via WAHA_WEBHOOK_AUTH_DISABLED=true",
    };
  }

  const configuredSecrets = getConfiguredWebhookSecrets();

  if (configuredSecrets.length === 0) {
    return {
      isAuthorized: false,
      missingSecret: true,
      reason: "No valid WAHA webhook secret configured",
    };
  }

  const headerSecret = req.headers.get("x-waha-secret")?.trim() ?? null;
  const bearerToken = getBearerToken(req.headers.get("authorization"));
  const apiKeyHeader = req.headers.get("x-api-key")?.trim() ?? null;
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim() ?? null;

  if (
    hasAnySecretMatch(configuredSecrets, headerSecret) ||
    hasAnySecretMatch(configuredSecrets, bearerToken) ||
    hasAnySecretMatch(configuredSecrets, apiKeyHeader) ||
    hasAnySecretMatch(configuredSecrets, querySecret)
  ) {
    return {
      isAuthorized: true,
      missingSecret: false,
      reason: "matched shared secret",
    };
  }

  const hmacVerification = verifyWebhookHmac(
    configuredSecrets,
    req.headers.get("x-webhook-hmac-algorithm"),
    req.headers.get("x-webhook-hmac")?.trim() ?? null,
    rawBody,
  );

  if (hmacVerification.ok) {
    return {
      isAuthorized: true,
      missingSecret: false,
      reason: "matched webhook hmac",
    };
  }

  return {
    isAuthorized: false,
    missingSecret: false,
    reason: hmacVerification.reason,
  };
}

function parsePayload(rawBody: string) {
  try {
    return {
      payload: JSON.parse(rawBody) as {
        event?: string;
        session?: string;
        payload?: unknown;
      },
      error: null,
    };
  } catch {
    return {
      payload: null,
      error: "Invalid JSON payload",
    };
  }
}

function isLikelyMessagePayload(message: Record<string, unknown>) {
  return Boolean(
    extractChatId(message) ||
    extractMessageText(message) ||
    message.fromMe !== undefined ||
    message.from_me !== undefined,
  );
}

function resolveMessagePayload(payload: unknown) {
  const directMessage = toRecord(payload);
  if (!directMessage) {
    return null;
  }

  const nestedPayload = toRecord(directMessage.payload);
  if (nestedPayload && isLikelyMessagePayload(nestedPayload)) {
    return nestedPayload;
  }

  const nestedData = toRecord(directMessage.data);
  if (nestedData && isLikelyMessagePayload(nestedData)) {
    return nestedData;
  }

  return directMessage;
}

function isLidChatId(chatId: string) {
  return chatId.trim().toLowerCase().endsWith("@lid");
}

async function resolvePhoneLookupFromChatId(session: string, chatId: string) {
  if (!isLidChatId(chatId)) {
    return {
      resolvedPhoneChatId: chatId,
      phoneCandidates: buildPhoneLookupCandidates(chatId),
    };
  }

  try {
    const lidMapping = await wahaClient.getLidMapping(session, chatId);
    const mappedPhoneChatId =
      typeof lidMapping?.pn === "string" ? lidMapping.pn.trim() : "";

    if (!mappedPhoneChatId) {
      return {
        resolvedPhoneChatId: chatId,
        phoneCandidates: buildPhoneLookupCandidates(chatId),
      };
    }

    return {
      resolvedPhoneChatId: mappedPhoneChatId,
      phoneCandidates: buildPhoneLookupCandidates(mappedPhoneChatId),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("WAHA lid mapping lookup failed", {
      session,
      chatId,
      error: message,
    });

    return {
      resolvedPhoneChatId: chatId,
      phoneCandidates: buildPhoneLookupCandidates(chatId),
    };
  }
}

function getProviderMessageId(message: Record<string, unknown>) {
  const id = message.id;
  if (typeof id === "string") {
    const normalized = id.trim();
    return normalized || null;
  }

  if (id && typeof id === "object") {
    const idObject = id as Record<string, unknown>;
    const nestedId = getFirstNonEmptyString([
      idObject.id,
      idObject._serialized,
      idObject.serialized,
    ]);

    if (nestedId) {
      return nestedId;
    }
  }

  const dataObject = toRecord(message._data);
  const dataIdObject = toRecord(dataObject?.id);
  const fallbackId = getFirstNonEmptyString([
    dataObject?.id,
    dataObject?._serialized,
    dataIdObject?.id,
    dataIdObject?._serialized,
  ]);

  if (fallbackId) {
    return fallbackId;
  }

  return null;
}

function buildFallbackInboundMessageId(rawBody: string) {
  return `payload:${createHash("sha256").update(rawBody).digest("hex")}`;
}

function buildPhoneLookupCandidates(chatId: string) {
  const baseNumber = cleanPhone(chatId);
  const digitsOnly = baseNumber.replace(/\D/g, "");

  if (!digitsOnly) {
    return [];
  }

  const candidates = new Set<string>([digitsOnly]);

  if (digitsOnly.startsWith("62") && digitsOnly.length > 2) {
    candidates.add(`0${digitsOnly.slice(2)}`);
  } else if (digitsOnly.startsWith("0") && digitsOnly.length > 1) {
    candidates.add(`62${digitsOnly.slice(1)}`);
  } else if (digitsOnly.startsWith("8")) {
    candidates.add(`62${digitsOnly}`);
    candidates.add(`0${digitsOnly}`);
  }

  return Array.from(candidates).filter((candidate) => candidate.length >= 8);
}

function isIndonesianPhoneNumber(phone: string | null | undefined) {
  if (!phone) {
    return false;
  }

  const normalized = phone.trim();
  if (!normalized) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");
  return (
    normalized.startsWith("+62") ||
    normalized.startsWith("08") ||
    digits.startsWith("62") ||
    digits.startsWith("08")
  );
}

function detectFeedbackLanguageByPhone(
  phone: string | null | undefined,
): FeedbackLanguage {
  return isIndonesianPhoneNumber(phone) ? "id" : "en";
}

function isNotFoundError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST116") {
    return true;
  }

  return /not found|no rows/i.test(error.message ?? "");
}

async function findAiFollowupReservationByPhone(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  phoneCandidates: string[],
) {
  for (const candidate of phoneCandidates) {
    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(RESERVATION_LOOKUP_SELECT)
      .eq("post_stay_feedback_status", "ai_followup")
      .ilike("guests.phone", `%${candidate}%`)
      .order("check_out_date", { ascending: false })
      .limit(1)
      .single();

    if (reservation) {
      return reservation;
    }

    if (error && !isNotFoundError(error)) {
      throw new Error(error.message || "Failed to lookup reservation");
    }
  }

  return null;
}

function isUniqueViolationError(
  error: { code?: string; message?: string } | null,
) {
  if (!error) {
    return false;
  }

  return error.code === "23505";
}

function renderHandoffTemplate(
  template: string,
  params: {
    guestName: string;
    hotelName: string;
  },
) {
  return template
    .replace(/{{\s*guestName\s*}}/gi, params.guestName)
    .replace(/{{\s*hotelName\s*}}/gi, params.hotelName);
}

function resolveCompletedFeedbackReply(params: {
  feedbackStatus: string | null;
  guestName: string;
  hotelName: string;
  preferredLanguage: FeedbackLanguage;
}) {
  const { feedbackStatus, guestName, hotelName, preferredLanguage } = params;
  const selectedTemplates = HANDOFF_REPLY_TEMPLATES[preferredLanguage];

  if (feedbackStatus === "completed") {
    const template = selectedTemplates.completed;

    return renderHandoffTemplate(template, { guestName, hotelName });
  }

  if (feedbackStatus === "ignored") {
    const template = selectedTemplates.ignored;

    return renderHandoffTemplate(template, { guestName, hotelName });
  }

  return null;
}

async function getReservationFeedbackStatus(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  reservationId: string,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("post_stay_feedback_status")
    .eq("id", reservationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error && !isNotFoundError(error)) {
    throw new Error(
      error.message || "Failed to read reservation feedback status",
    );
  }

  if (!data) {
    return null;
  }

  const rawStatus = data.post_stay_feedback_status;
  return typeof rawStatus === "string" ? rawStatus : null;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const auth = verifyWebhookAuth(req, rawBody);

    if (auth.missingSecret) {
      console.error("WAHA webhook auth configuration error", {
        reason: auth.reason,
      });
      return NextResponse.json(
        { error: "Missing WAHA_WEBHOOK_SECRET or PMS_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    if (!auth.isAuthorized) {
      console.warn("WAHA webhook rejected", {
        reason: auth.reason,
        requestId: req.headers.get("x-webhook-request-id"),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parsePayload(rawBody);
    if (parsed.error || !parsed.payload) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = parsed.payload;

    // 1. Ekstrak data dari WAHA webhook payload
    const event = payload.event;
    if (event !== "message.any" && event !== "message") {
      return NextResponse.json(
        { status: "ignored: not a message" },
        { status: 200 },
      );
    }

    const message = resolveMessagePayload(payload.payload);
    const session =
      typeof payload.session === "string" && payload.session.trim() !== ""
        ? payload.session.trim()
        : "default";
    const fromMe = parseBooleanLike(message?.fromMe ?? message?.from_me);
    const isGroup = parseBooleanLike(message?.isGroup ?? message?.is_group);

    if (!message || fromMe || isGroup) {
      return NextResponse.json(
        { status: "ignored: fromMe or group" },
        { status: 200 },
      );
    }

    const chatId = extractChatId(message);
    const body = extractMessageText(message);
    const { resolvedPhoneChatId, phoneCandidates } =
      await resolvePhoneLookupFromChatId(session, chatId);
    const phone =
      phoneCandidates[0] ?? cleanPhone(resolvedPhoneChatId || chatId);

    if (phoneCandidates.length === 0) {
      return NextResponse.json(
        { status: "ignored: invalid phone format" },
        { status: 200 },
      );
    }

    if (!body || body.trim() === "") {
      return NextResponse.json(
        { status: "ignored: empty text" },
        { status: 200 },
      );
    }

    const supabase = await createAdminClient();
    const providerMessageId =
      getProviderMessageId(message) ?? buildFallbackInboundMessageId(rawBody);

    const reservation = await findAiFollowupReservationByPhone(
      supabase,
      phoneCandidates,
    );

    if (!reservation) {
      // Tidak ada reservasi yang sedang di-follow up oleh AI untuk nomor ini
      return NextResponse.json(
        { status: "ignored: no active ai_followup reservation found" },
        { status: 200 },
      );
    }

    // 3. Simpan pesan masuk (inbound) dari tamu ke tabel message_logs
    const { error: inboundInsertError } = await supabase
      .from("message_logs")
      .insert({
        tenant_id: reservation.tenant_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        phone: phone,
        content: body,
        direction: "inbound",
        status: "received",
        trigger_type: "post-stay", // Mengambil logic AI Chat
        provider_message_id: providerMessageId,
        sent_at: new Date(
          Number(message.timestamp ?? Date.now() / 1000) * 1000,
        ).toISOString(),
      });

    if (isUniqueViolationError(inboundInsertError)) {
      return NextResponse.json(
        { status: "ignored: duplicate message" },
        { status: 200 },
      );
    }

    if (inboundInsertError) {
      throw new Error(
        inboundInsertError.message || "Failed to insert inbound message",
      );
    }

    // 4. Tarik riwayat pesan dari tamu ini terkait reservasi (inbound & outbound)
    const { data: rawLogs } = await supabase
      .from("message_logs")
      .select("direction, content")
      .eq("reservation_id", reservation.id)
      .eq("trigger_type", "post-stay")
      .order("created_at", { ascending: true });

    const guestName = reservation.guests?.[0]?.name ?? "Guest";
    const hotelName = reservation.tenants?.[0]?.name ?? "Hotel";
    const preferredLanguage = detectFeedbackLanguageByPhone(
      reservation.guests?.[0]?.phone ?? phone,
    );

    // Konversi logs dari database ke format CoreMessage AI SDK
    const messageHistory: ModelMessage[] = (rawLogs || []).map((log) => ({
      role: log.direction === "inbound" ? "user" : "assistant",
      content: String(log.content ?? ""),
    }));

    // 5. Panggil AI Agent (Vercel AI SDK)
    const aiResponse = await processGuestFeedback(
      reservation.id,
      reservation.tenant_id,
      guestName,
      hotelName,
      messageHistory,
      preferredLanguage,
    );

    const latestFeedbackStatus = await getReservationFeedbackStatus(
      supabase,
      reservation.id,
      reservation.tenant_id,
    );
    const handoffReply = resolveCompletedFeedbackReply({
      feedbackStatus: latestFeedbackStatus,
      guestName,
      hotelName,
      preferredLanguage,
    });
    const replyText = handoffReply ?? aiResponse.response;

    if (replyText) {
      // 6. Tanggapi via WhatsApp (Kirim Pesan Keluar)
      // Ambil session conf dari tenant ini if any, else use 'default'
      // Untuk limitasi MVP: 'default' session name digunakan.
      await wahaClient.sendMessage(session, chatId, replyText);

      // 7. Simpan balasan AI (outbound) ke message_logs
      await supabase.from("message_logs").insert({
        tenant_id: reservation.tenant_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        phone: phone,
        content: replyText,
        direction: "outbound",
        status: "sent",
        trigger_type: "post-stay",
      });
    }

    return NextResponse.json({ status: "success", ai_reply: replyText });
  } catch (error: unknown) {
    console.error("WAHA Webhook AI Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
