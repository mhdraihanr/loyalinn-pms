import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import type { ModelMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePostStayCompletionHandoffReply } from "@/lib/ai/agent";
import { processLifecycleGuestMessage } from "@/lib/ai/lifecycle-agent";
import {
  type LifecycleLanguage,
  type LifecycleStage,
  upsertLifecycleAiSession,
} from "@/lib/ai/lifecycle-session";
import { wahaClient } from "@/lib/waha/client";

const RESERVATION_LOOKUP_SELECT = `
  id,
  tenant_id,
  pms_reservation_id,
  guest_id,
  status,
  room_number,
  post_stay_feedback_status,
  guests!inner(name, phone),
  tenants!inner(name)
`;

const SUPPORTED_HMAC_ALGORITHMS = new Set(["sha256", "sha512"]);

const AI_PROVIDER_FAILURE_REPLY_TEMPLATES: Record<LifecycleLanguage, string> = {
  id: "Terima kasih {{guestName}}, pesan Anda sudah kami terima. Saat ini asisten otomatis kami sedang sangat sibuk. Tim {{hotelName}} akan menindaklanjuti Anda secara manual sesegera mungkin.",
  en: "Thank you {{guestName}}, we received your message. Our automated assistant is currently overloaded. The {{hotelName}} team will follow up with you manually as soon as possible.",
};

const POST_STAY_ELIGIBLE_FEEDBACK_STATUSES = new Set([
  "pending",
  "ai_followup",
  "completed",
]);

const COMPLETED_POST_STAY_HANDOFF_ACTION =
  "completed_post_stay_handoff_notified";

const RESERVATION_STATUS_LOOKUP_ORDER = [
  "on-stay",
  "pre-arrival",
  "checked-out",
] as const;

const CHECKED_OUT_FEEDBACK_STATUS_LOOKUP_ORDER = [
  "pending",
  "ai_followup",
  "completed",
] as const;

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

function detectLifecycleLanguageByPhone(
  phone: string | null | undefined,
): LifecycleLanguage {
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

function isMissingLifecycleSessionTableError(
  error: {
    message?: string;
  } | null,
) {
  if (!error?.message) {
    return false;
  }

  return /relation\s+"?lifecycle_ai_sessions"?\s+does not exist/i.test(
    error.message,
  );
}

function isMultipleRowsError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /multiple rows|more than one row|result contains \d+ rows/i.test(
    message,
  );
}

function isCompletedPostStayHandoffRecord(record: unknown) {
  const parsed = toRecord(record);
  return (
    parsed?.session_status === "handoff" &&
    parsed?.last_action_type === COMPLETED_POST_STAY_HANDOFF_ACTION
  );
}

async function hasCompletedPostStayHandoffBeenNotified(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  tenantId: string,
  reservationId: string,
) {
  const { data, error } = await supabase
    .from("lifecycle_ai_sessions")
    .select("session_status, last_action_type")
    .eq("tenant_id", tenantId)
    .eq("reservation_id", reservationId)
    .eq("lifecycle_stage", "post-stay")
    .maybeSingle();

  if (error) {
    if (isMultipleRowsError(error)) {
      const { data: rows, error: rowsError } = await supabase
        .from("lifecycle_ai_sessions")
        .select("session_status, last_action_type")
        .eq("tenant_id", tenantId)
        .eq("reservation_id", reservationId)
        .eq("lifecycle_stage", "post-stay")
        .order("updated_at", { ascending: false })
        .limit(25);

      if (rowsError) {
        if (
          isNotFoundError(rowsError) ||
          isMissingLifecycleSessionTableError(rowsError)
        ) {
          return false;
        }

        throw new Error(
          rowsError.message ||
            "Failed to read lifecycle_ai_sessions handoff state",
        );
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return false;
      }

      return rows.some((row) => isCompletedPostStayHandoffRecord(row));
    }

    if (isNotFoundError(error) || isMissingLifecycleSessionTableError(error)) {
      return false;
    }

    throw new Error(
      error.message || "Failed to read lifecycle_ai_sessions handoff state",
    );
  }

  return isCompletedPostStayHandoffRecord(data);
}

async function findActiveLifecycleReservationByPhone(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  phoneCandidates: string[],
) {
  for (const status of RESERVATION_STATUS_LOOKUP_ORDER) {
    for (const candidate of phoneCandidates) {
      const orderColumn =
        status === "checked-out" ? "check_out_date" : "check_in_date";
      const orderAscending = status !== "checked-out";

      const checkedOutStatusesToProbe =
        status === "checked-out"
          ? CHECKED_OUT_FEEDBACK_STATUS_LOOKUP_ORDER
          : [null];

      for (const checkedOutFeedbackStatus of checkedOutStatusesToProbe) {
        let reservationQuery = supabase
          .from("reservations")
          .select(RESERVATION_LOOKUP_SELECT)
          .eq("status", status)
          .ilike("guests.phone", `%${candidate}%`);

        if (status === "checked-out" && checkedOutFeedbackStatus) {
          reservationQuery = reservationQuery.eq(
            "post_stay_feedback_status",
            checkedOutFeedbackStatus,
          );
        }

        const { data: reservation, error } = await reservationQuery
          .order(orderColumn, { ascending: orderAscending })
          .limit(1)
          .single();

        if (reservation) {
          if (
            status === "checked-out" &&
            checkedOutFeedbackStatus === "completed"
          ) {
            const completedHandoffAlreadyNotified =
              await hasCompletedPostStayHandoffBeenNotified(
                supabase,
                reservation.tenant_id,
                reservation.id,
              );

            if (completedHandoffAlreadyNotified) {
              const {
                data: alternativeCompletedReservation,
                error: alternativeError,
              } = await supabase
                .from("reservations")
                .select(RESERVATION_LOOKUP_SELECT)
                .eq("status", "checked-out")
                .eq("post_stay_feedback_status", "completed")
                .neq("id", reservation.id)
                .ilike("guests.phone", `%${candidate}%`)
                .order("check_out_date", { ascending: false })
                .limit(1)
                .single();

              if (alternativeError && !isNotFoundError(alternativeError)) {
                throw new Error(
                  alternativeError.message ||
                    "Failed to lookup alternative completed reservation",
                );
              }

              if (alternativeCompletedReservation) {
                const alternativeAlreadyNotified =
                  await hasCompletedPostStayHandoffBeenNotified(
                    supabase,
                    alternativeCompletedReservation.tenant_id,
                    alternativeCompletedReservation.id,
                  );

                if (!alternativeAlreadyNotified) {
                  const lifecycleStage = deriveLifecycleStage(
                    alternativeCompletedReservation,
                  );

                  if (lifecycleStage) {
                    return {
                      reservation: alternativeCompletedReservation,
                      lifecycleStage,
                    };
                  }
                }
              }
            }
          }

          const lifecycleStage = deriveLifecycleStage(reservation);

          if (lifecycleStage) {
            return {
              reservation,
              lifecycleStage,
            };
          }
        }

        if (error && !isNotFoundError(error)) {
          throw new Error(error.message || "Failed to lookup reservation");
        }
      }
    }
  }

  return null;
}

function deriveLifecycleStage(reservation: {
  status?: string | null;
  post_stay_feedback_status?: string | null;
}): LifecycleStage | null {
  if (reservation.status === "on-stay") {
    return "on-stay";
  }

  if (reservation.status === "pre-arrival") {
    return "pre-arrival";
  }

  if (
    reservation.status === "checked-out" &&
    POST_STAY_ELIGIBLE_FEEDBACK_STATUSES.has(
      reservation.post_stay_feedback_status ?? "",
    )
  ) {
    return "post-stay";
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

function isRetryableAiProviderError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  const lastError = toRecord(errorRecord.lastError);
  const statusCodeCandidates = [errorRecord.statusCode, lastError?.statusCode]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (statusCodeCandidates.includes(429)) {
    return true;
  }

  const isRetryable = parseBooleanLike(lastError?.isRetryable);
  if (!isRetryable) {
    return false;
  }

  const evidence = [
    getFirstNonEmptyString([
      errorRecord.reason,
      errorRecord.message,
      lastError?.message,
      lastError?.code,
    ]),
    getFirstNonEmptyString([lastError?.responseBody, errorRecord.responseBody]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /rate\s*limit|retry|temporar|too many requests|provider returned error/i.test(
    evidence,
  );
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

function resolveAiProviderFailureReply(params: {
  guestName: string;
  hotelName: string;
  preferredLanguage: LifecycleLanguage;
}) {
  const { guestName, hotelName, preferredLanguage } = params;
  const template = AI_PROVIDER_FAILURE_REPLY_TEMPLATES[preferredLanguage];

  return renderHandoffTemplate(template, { guestName, hotelName });
}

function isLifecycleAiDebugEnabled() {
  return (
    process.env.LIFECYCLE_AI_DEBUG === "true" ||
    process.env.AI_FEEDBACK_DEBUG === "true"
  );
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
    const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();
    const providerMessageId =
      getProviderMessageId(message) ?? buildFallbackInboundMessageId(rawBody);

    const reservationMatch = await findActiveLifecycleReservationByPhone(
      supabase,
      phoneCandidates,
    );

    if (!reservationMatch) {
      // Tidak ada reservasi lifecycle aktif untuk nomor ini
      return NextResponse.json(
        { status: "ignored: no active lifecycle reservation found" },
        { status: 200 },
      );
    }

    const { reservation, lifecycleStage } = reservationMatch;
    const triggerType = lifecycleStage;

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
        trigger_type: triggerType,
        provider_message_id: providerMessageId,
        sent_at: new Date(
          Number(message.timestamp ?? Date.now() / 1000) * 1000,
        ).toISOString(),
      });

    if (isUniqueViolationError(inboundInsertError)) {
      if (lifecycleDebugEnabled) {
        console.info("[WAHA][Lifecycle AI] Duplicate inbound ignored", {
          tenantId: reservation.tenant_id,
          reservationId: reservation.id,
          lifecycleStage,
          providerMessageId,
        });
      }

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

    if (lifecycleDebugEnabled) {
      console.info("[WAHA][Lifecycle AI] Route selected", {
        tenantId: reservation.tenant_id,
        reservationId: reservation.id,
        lifecycleStage,
        reservationStatus: reservation.status,
        postStayFeedbackStatus: reservation.post_stay_feedback_status,
        providerMessageId,
      });
    }

    // 4. Tarik riwayat pesan dari tamu ini terkait reservasi (inbound & outbound)
    const { data: rawLogs } = await supabase
      .from("message_logs")
      .select("direction, content")
      .eq("reservation_id", reservation.id)
      .eq("trigger_type", triggerType)
      .order("created_at", { ascending: true });

    const guestName = reservation.guests?.[0]?.name ?? "Guest";
    const hotelName = reservation.tenants?.[0]?.name ?? "Hotel";
    const preferredLanguage = detectLifecycleLanguageByPhone(
      reservation.guests?.[0]?.phone ?? phone,
    );

    // Konversi logs dari database ke format CoreMessage AI SDK
    const messageHistory: ModelMessage[] = (rawLogs || []).map((log) => ({
      role: log.direction === "inbound" ? "user" : "assistant",
      content: String(log.content ?? ""),
    }));

    const isCompletedPostStayConversation =
      lifecycleStage === "post-stay" &&
      reservation.post_stay_feedback_status === "completed";

    if (isCompletedPostStayConversation) {
      const alreadyNotified = await hasCompletedPostStayHandoffBeenNotified(
        supabase,
        reservation.tenant_id,
        reservation.id,
      );

      if (lifecycleDebugEnabled) {
        console.info("[WAHA][Lifecycle AI] Completed handoff gate", {
          tenantId: reservation.tenant_id,
          reservationId: reservation.id,
          alreadyNotified,
        });
      }

      if (alreadyNotified) {
        if (lifecycleDebugEnabled) {
          console.info("[WAHA][Lifecycle AI] Completed handoff unchanged", {
            tenantId: reservation.tenant_id,
            reservationId: reservation.id,
          });
        }

        await upsertLifecycleAiSession(supabase, {
          tenantId: reservation.tenant_id,
          reservationId: reservation.id,
          guestId: reservation.guest_id,
          stage: lifecycleStage,
          sessionStatus: "handoff",
          needsHumanFollowUp: true,
          lastActionType: COMPLETED_POST_STAY_HANDOFF_ACTION,
          touchInboundAt: true,
        });

        return NextResponse.json(
          { status: "ignored: post-stay completed handoff already active" },
          { status: 200 },
        );
      }

      let handoffReply = "";
      let fallbackUsed = false;

      try {
        const aiResponse = await generatePostStayCompletionHandoffReply({
          reservationId: reservation.id,
          tenantId: reservation.tenant_id,
          guestName,
          hotelName,
          messageHistory,
          preferredLanguage,
        });

        handoffReply = aiResponse.response.trim();
      } catch (error: unknown) {
        if (!isRetryableAiProviderError(error)) {
          throw error;
        }

        fallbackUsed = true;
        handoffReply = resolveAiProviderFailureReply({
          guestName,
          hotelName,
          preferredLanguage,
        });

        const detail = error instanceof Error ? error.message : String(error);
        console.warn(
          "WAHA completed post-stay handoff AI retryable provider error, sending fallback reply",
          {
            reservationId: reservation.id,
            tenantId: reservation.tenant_id,
            detail,
          },
        );
      }

      const replyText = handoffReply.trim();

      if (!replyText) {
        throw new Error(
          "Completed post-stay handoff reply is empty and cannot be sent",
        );
      }

      await wahaClient.sendMessage(session, chatId, replyText);
      await supabase.from("message_logs").insert({
        tenant_id: reservation.tenant_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        phone,
        content: replyText,
        direction: "outbound",
        status: "sent",
        trigger_type: triggerType,
      });

      await upsertLifecycleAiSession(supabase, {
        tenantId: reservation.tenant_id,
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        stage: lifecycleStage,
        sessionStatus: "handoff",
        needsHumanFollowUp: true,
        lastActionType: COMPLETED_POST_STAY_HANDOFF_ACTION,
        touchInboundAt: true,
        touchOutboundAt: true,
      });

      if (lifecycleDebugEnabled) {
        console.info("[WAHA][Lifecycle AI] Completed handoff sent", {
          tenantId: reservation.tenant_id,
          reservationId: reservation.id,
          fallbackUsed,
          replyLength: replyText.length,
        });
      }

      return NextResponse.json({
        status: fallbackUsed
          ? "success:completed-handoff:fallback"
          : "success:completed-handoff",
        ai_reply: replyText,
        handoff: true,
        fallback: fallbackUsed,
      });
    }

    await upsertLifecycleAiSession(supabase, {
      tenantId: reservation.tenant_id,
      reservationId: reservation.id,
      guestId: reservation.guest_id,
      stage: lifecycleStage,
      sessionStatus: "active",
      touchInboundAt: true,
    });

    // 5. Panggil AI Agent (Vercel AI SDK)
    let aiResponse: { response: string };

    try {
      if (lifecycleDebugEnabled) {
        console.info("[WAHA][Lifecycle AI] Dispatching stage agent", {
          tenantId: reservation.tenant_id,
          reservationId: reservation.id,
          lifecycleStage,
        });
      }

      aiResponse = await processLifecycleGuestMessage({
        stage: lifecycleStage,
        reservationId: reservation.id,
        tenantId: reservation.tenant_id,
        guestId: reservation.guest_id,
        guestName,
        hotelName,
        roomNumber: reservation.room_number ?? "-",
        messageHistory,
        preferredLanguage,
      });
    } catch (error: unknown) {
      if (!isRetryableAiProviderError(error)) {
        throw error;
      }

      const fallbackReply = resolveAiProviderFailureReply({
        guestName,
        hotelName,
        preferredLanguage,
      });

      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        "WAHA lifecycle AI retryable provider error, sending fallback reply",
        {
          reservationId: reservation.id,
          tenantId: reservation.tenant_id,
          detail,
        },
      );

      await wahaClient.sendMessage(session, chatId, fallbackReply);
      await supabase.from("message_logs").insert({
        tenant_id: reservation.tenant_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        phone,
        content: fallbackReply,
        direction: "outbound",
        status: "sent",
        trigger_type: triggerType,
      });

      await upsertLifecycleAiSession(supabase, {
        tenantId: reservation.tenant_id,
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        stage: lifecycleStage,
        sessionStatus: "handoff",
        needsHumanFollowUp: true,
        lastActionType: "provider_fallback_handoff",
        lastActionPayload: {
          detail,
        },
        touchOutboundAt: true,
      });

      return NextResponse.json({
        status: "success:fallback",
        ai_reply: fallbackReply,
        fallback: true,
      });
    }

    const replyText = aiResponse.response;

    if (lifecycleDebugEnabled) {
      console.info("[WAHA][Lifecycle AI] Stage agent responded", {
        tenantId: reservation.tenant_id,
        reservationId: reservation.id,
        lifecycleStage,
        replyLength: replyText.length,
      });
    }

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
        trigger_type: triggerType,
      });

      await upsertLifecycleAiSession(supabase, {
        tenantId: reservation.tenant_id,
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        stage: lifecycleStage,
        sessionStatus: "active",
        touchOutboundAt: true,
      });
    }

    return NextResponse.json({ status: "success", ai_reply: replyText });
  } catch (error: unknown) {
    console.error("WAHA webhook lifecycle AI error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
