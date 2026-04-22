import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { aiProvider, AI_FALLBACK_MODEL, AI_MODEL } from "./provider";
import { createAdminClient } from "../supabase/admin";
import {
  completePostStayFeedbackWithReward,
  FEEDBACK_REWARD_POINTS,
} from "../automation/feedback-reward";

const ENABLE_LIFECYCLE_AI_DEBUG =
  process.env.LIFECYCLE_AI_DEBUG === "true" ||
  process.env.AI_FEEDBACK_DEBUG === "true";

type AiSettingsPromptContext = {
  hotel_name: string | null;
  ai_name: string | null;
  tone_of_voice: string | null;
  custom_instructions: string | null;
};

type PostStayLanguage = "id" | "en";

type GeneratePostStayCompletionHandoffReplyParams = {
  reservationId: string;
  tenantId: string;
  guestName: string;
  hotelName: string;
  messageHistory: ModelMessage[];
  preferredLanguage?: PostStayLanguage;
};

function getLatestUserText(messageHistory: ModelMessage[]) {
  for (let i = messageHistory.length - 1; i >= 0; i -= 1) {
    const message = messageHistory[i];
    if (message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      return message.content;
    }
  }

  return "";
}

function normalizePromptText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePostStayLanguage(
  value: string | undefined,
): PostStayLanguage {
  return value === "en" ? "en" : "id";
}

export function isRetryableProviderRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  const lastError =
    errorRecord.lastError && typeof errorRecord.lastError === "object"
      ? (errorRecord.lastError as Record<string, unknown>)
      : null;

  const statusCodeCandidates = [errorRecord.statusCode, lastError?.statusCode]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (statusCodeCandidates.includes(429)) {
    return true;
  }

  const isRetryable =
    lastError?.isRetryable === true ||
    String(errorRecord.reason ?? "").toLowerCase() === "maxretriesexceeded";

  if (!isRetryable) {
    return false;
  }

  const evidence = [
    String(errorRecord.message ?? ""),
    String(errorRecord.reason ?? ""),
    String(lastError?.message ?? ""),
    String(lastError?.responseBody ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  return /rate\s*limit|too many requests|temporar|provider returned error|retry/.test(
    evidence,
  );
}

export function buildPostStaySaveSystemInfo(params: {
  language: PostStayLanguage;
  rating: number;
  comments: string;
  points: number;
}) {
  const { language, rating, comments, points } = params;

  if (language === "en") {
    if (points > 0) {
      return `SYSTEM_INFO: Feedback saved successfully (Rating: ${rating}, Comments: \"${comments}\"). Reward points granted: ${points}. Inform the guest that these points can be redeemed for services such as a free drink, extra bed, or room-rate discount, then close with a short thank-you message.`;
    }

    return `SYSTEM_INFO: Feedback saved successfully (Rating: ${rating}, Comments: \"${comments}\"). No additional reward points were granted because feedback was already completed. Please close with a short thank-you message.`;
  }

  if (points > 0) {
    return `INFO_SISTEM: Berhasil menyimpan feedback (Rating: ${rating}, Komentar: \"${comments}\"). Poin reward yang ditambahkan: ${points}. Beritahu tamu bahwa poin bisa ditukar untuk servis seperti minuman gratis, extra bed, atau potongan harga menginap, lalu tutup dengan ucapan terima kasih singkat.`;
  }

  return `INFO_SISTEM: Berhasil menyimpan feedback (Rating: ${rating}, Komentar: \"${comments}\"). Tidak ada penambahan poin karena feedback sudah berstatus completed sebelumnya. Silakan beri pesan penutup dan terima kasih kepada tamu.`;
}

async function getTenantAiSettingsPromptContext(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from("ai_settings")
    .select("hotel_name, ai_name, tone_of_voice, custom_instructions")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    const message = error.message ?? "Unknown error";

    // Keep webhook flow resilient while migration is rolling out.
    if (/relation\s+"?ai_settings"?\s+does not exist/i.test(message)) {
      return null;
    }

    console.error("Lifecycle AI: failed to load AI settings prompt context", {
      tenantId,
      error: message,
    });
    return null;
  }

  return (data as AiSettingsPromptContext | null) ?? null;
}

export function buildPostStayLifecycleSystemPrompt({
  guestName,
  hotelName,
  aiSettings,
  preferredLanguage = "id",
}: {
  guestName: string;
  hotelName: string;
  aiSettings: AiSettingsPromptContext | null;
  preferredLanguage?: PostStayLanguage;
}) {
  const resolvedLanguage = normalizePostStayLanguage(preferredLanguage);
  const resolvedHotelName =
    normalizePromptText(aiSettings?.hotel_name) ??
    normalizePromptText(hotelName) ??
    "Hotel";
  const resolvedAiName =
    normalizePromptText(aiSettings?.ai_name) ?? "Resepsionis AI";
  const preferredTone = normalizePromptText(aiSettings?.tone_of_voice);
  const customInstructions = normalizePromptText(
    aiSettings?.custom_instructions,
  );

  const optionalContext: string[] = [];

  if (preferredTone) {
    optionalContext.push(
      resolvedLanguage === "en"
        ? `Preferred tone: ${preferredTone}.`
        : `Preferensi tone: ${preferredTone}.`,
    );
  }

  if (customInstructions) {
    optionalContext.push(
      resolvedLanguage === "en"
        ? `Additional hotel instructions:\n${customInstructions}`
        : `Instruksi tambahan dari hotel:\n${customInstructions}`,
    );
  }

  const optionalBlock =
    optionalContext.length > 0 ? `\n\n${optionalContext.join("\n")}` : "";

  if (resolvedLanguage === "en") {
    return `You are ${resolvedAiName}, the Front Desk and Guest Relations AI for hotel "${resolvedHotelName}".
You are assisting a guest named "${guestName}".
Your main task is to ask about the guest's post-stay experience and collect feedback that includes:
1. A numeric rating from 1 to 5.
2. A text comment explaining the rating.

AI rules:
- Use warm, polite, professional English.
- Keep responses concise. If the guest has not provided a rating, ask directly for a 1-5 score.
- Do not call \`update_guest_feedback\` without a numeric rating from 1 to 5.
- If the guest sends comments first without rating, ask only for the numeric rating.
- Once numeric rating is available, combine it with the latest comment context and call \`update_guest_feedback\`.
- If the guest refuses to provide feedback or asks to stop follow-up, call the \`ignore_feedback\` tool.
- After a successful tool call, end the conversation with a brief thank-you message.${optionalBlock}`;
  }

  return `Anda adalah ${resolvedAiName}, resepsionis dan Guest Relation AI untuk hotel "${resolvedHotelName}".
Anda sedang menangani tamu dengan nama "${guestName}".
Tugas utama Anda adalah menanyakan bagaimana pengalaman menginap tamu setelah mereka check-out, serta mengumpulkan feedback yang terdiri dari:
1. Rating berskala (angka) dari 1 sampai 5.
2. Alasan / komentar teks dari tamu atas score tersebut.

Aturan AI:
- Gunakan bahasa Indonesia yang ramah, sopan, dan hangat.
- Jangan bertele-tele. Langsung tanyakan angka rating jika tamu belum menyebutkannya (misal: tamu hanya membalas "Bagus, saya suka pelayanannya").
- Jangan panggil tool \`update_guest_feedback\` jika belum ada rating berupa angka 1 sampai 5.
- Jika tamu mengirim komentar dulu tanpa rating, minta rating angkanya secara singkat.
- Jika rating angka sudah tersedia, gabungkan dengan komentar terbaru dari konteks percakapan lalu panggil tool \`update_guest_feedback\`.
- Khusus jika pengguna menolak memberikan feedback atau marah (menolak untuk di-follow up), gunakan tool \`ignore_feedback\` agar sistem berhenti mengganggu tamu.
- Jika tool sudah berhasil dipanggil (berhasil mencatat feedback), akhiri percakapan dengan mengucapkan terima kasih atas waktunya.${optionalBlock}`;
}

export function buildPostStayCompletionHandoffSystemPrompt({
  guestName,
  hotelName,
  aiSettings,
  preferredLanguage = "id",
}: {
  guestName: string;
  hotelName: string;
  aiSettings: AiSettingsPromptContext | null;
  preferredLanguage?: PostStayLanguage;
}) {
  const resolvedLanguage = normalizePostStayLanguage(preferredLanguage);
  const resolvedHotelName =
    normalizePromptText(aiSettings?.hotel_name) ??
    normalizePromptText(hotelName) ??
    "Hotel";
  const resolvedAiName =
    normalizePromptText(aiSettings?.ai_name) ?? "Resepsionis AI";
  const preferredTone = normalizePromptText(aiSettings?.tone_of_voice);
  const customInstructions = normalizePromptText(
    aiSettings?.custom_instructions,
  );

  const optionalContext: string[] = [];

  if (preferredTone) {
    optionalContext.push(
      resolvedLanguage === "en"
        ? `Preferred tone: ${preferredTone}.`
        : `Preferensi tone: ${preferredTone}.`,
    );
  }

  if (customInstructions) {
    optionalContext.push(
      resolvedLanguage === "en"
        ? `Additional hotel instructions:\n${customInstructions}`
        : `Instruksi tambahan dari hotel:\n${customInstructions}`,
    );
  }

  const optionalBlock =
    optionalContext.length > 0 ? `\n\n${optionalContext.join("\n")}` : "";

  if (resolvedLanguage === "en") {
    return `You are ${resolvedAiName}, the Front Desk AI for hotel "${resolvedHotelName}".
The guest "${guestName}" has already completed their post-stay feedback.

Write exactly one short closing message (1-2 sentences) that:
- thanks the guest,
- confirms the feedback flow is already completed,
- hands over any further follow-up to the human hotel team.

Hard constraints:
- Do not ask any new questions.
- Do not request additional rating/comments.
- Do not mention internal systems or tools.
- Keep it natural and professional in English only.${optionalBlock}`;
  }

  return `Anda adalah ${resolvedAiName}, resepsionis AI untuk hotel "${resolvedHotelName}".
Tamu bernama "${guestName}" sudah menyelesaikan feedback post-stay.

Tulis tepat satu pesan penutup singkat (1-2 kalimat) yang:
- berterima kasih kepada tamu,
- menegaskan bahwa alur feedback sudah selesai,
- mengarahkan tindak lanjut berikutnya ke tim hotel manusia.

Aturan wajib:
- Jangan ajukan pertanyaan baru.
- Jangan minta rating/komentar tambahan.
- Jangan menyebut sistem atau tool internal.
- Gunakan bahasa Indonesia yang natural dan profesional.${optionalBlock}`;
}

export async function generatePostStayCompletionHandoffReply(
  params: GeneratePostStayCompletionHandoffReplyParams,
) {
  const supabase = await createAdminClient();
  const resolvedLanguage = normalizePostStayLanguage(params.preferredLanguage);
  const aiSettings = await getTenantAiSettingsPromptContext(
    supabase,
    params.tenantId,
  );

  const systemPrompt = buildPostStayCompletionHandoffSystemPrompt({
    guestName: params.guestName,
    hotelName: params.hotelName,
    aiSettings,
    preferredLanguage: resolvedLanguage,
  });

  const runGenerateText = async (modelId: string) => {
    return generateText({
      model: aiProvider(modelId),
      system: systemPrompt,
      messages: params.messageHistory,
      stopWhen: stepCountIs(1),
    });
  };

  let result;

  try {
    result = await runGenerateText(AI_MODEL);
  } catch (error: unknown) {
    const fallbackModel = AI_FALLBACK_MODEL.trim();
    const canFallback = fallbackModel.length > 0 && fallbackModel !== AI_MODEL;

    if (!canFallback || !isRetryableProviderRateLimitError(error)) {
      throw error;
    }

    result = await runGenerateText(fallbackModel);
  }

  return {
    response: result.text,
  };
}

export async function processPostStayLifecycleConversation(
  reservationId: string,
  tenantId: string,
  guestName: string,
  hotelName: string,
  messageHistory: ModelMessage[],
  preferredLanguage: PostStayLanguage = "id",
) {
  const supabase = await createAdminClient();
  const resolvedLanguage = normalizePostStayLanguage(preferredLanguage);
  const aiSettings = await getTenantAiSettingsPromptContext(supabase, tenantId);
  const systemPrompt = buildPostStayLifecycleSystemPrompt({
    guestName,
    hotelName,
    aiSettings,
    preferredLanguage: resolvedLanguage,
  });

  const copy =
    resolvedLanguage === "en"
      ? {
          updateDescription:
            "Store guest feedback with a numeric rating (1 to 5) and free-text comments extracted from the conversation.",
          ratingDescription:
            "Numeric score from 1 to 5 for guest satisfaction.",
          commentsDescription:
            "Guest's free-text comments, explanation, or suggestions.",
          updateSuccess: (rating: number, comments: string, points: number) =>
            buildPostStaySaveSystemInfo({
              language: "en",
              rating,
              comments,
              points,
            }),
          updateFailed: (reason: string) =>
            `SYSTEM_INFO: Failed to save feedback in database. Reason: ${reason}`,
          ignoreDescription:
            "Close the follow-up when the guest refuses feedback or asks to stop being contacted.",
          ignoreReasonDescription:
            "Specific reason why the guest declined to provide feedback.",
          ignoreStoredReasonPrefix: "[Declined Feedback] Reason:",
          ignoreSuccess:
            "SYSTEM_INFO: Status updated to 'ignored'. Please apologize briefly for the interruption and close politely.",
          ignoreFailed: (reason: string) =>
            `SYSTEM_INFO: Failed to update ignored status. Reason: ${reason}`,
        }
      : {
          updateDescription:
            "Menyimpan hasil rating (wajib berupa angka 1 sampai 5) dan komentar feedback dari tamu yang sudah didapatkan dari percakapan.",
          ratingDescription:
            "Angka numerik (1, 2, 3, 4, atau 5) sebagai point kepuasan dari sang tamu.",
          commentsDescription:
            "Teks komentar, opini, atau saran bebas yang dituliskan oleh tamu.",
          updateSuccess: (rating: number, comments: string, points: number) =>
            buildPostStaySaveSystemInfo({
              language: "id",
              rating,
              comments,
              points,
            }),
          updateFailed: (reason: string) =>
            `INFO_SISTEM: Gagal menyimpan data di database. Alasan: ${reason}`,
          ignoreDescription:
            "Menutup percakapan jika tamu menolak di-follow up, risih, atau eksplisit meminta kita berhenti bertanya.",
          ignoreReasonDescription:
            'Alasan spesifik kenapa tamu menolak untuk memberikan feedback (misalnya "Sedang sibuk", "Saya tidak mau diganggu")',
          ignoreStoredReasonPrefix: "[Declined Feedback] Alasan:",
          ignoreSuccess:
            "INFO_SISTEM: Sukses update status menjadi 'ignored'. Mohon ucapkan permohonan maaf telah mengganggu dan ucapan selamat beraktivitas kembali kepada tamu!",
          ignoreFailed: (reason: string) =>
            `INFO_SISTEM: Gagal eksekusi. Alasan: ${reason}`,
        };

  const runGenerateText = async (modelId: string) => {
    return generateText({
      model: aiProvider(modelId),
      system: systemPrompt,
      messages: messageHistory,
      stopWhen: stepCountIs(3),
      onStepFinish: ENABLE_LIFECYCLE_AI_DEBUG
        ? ({ stepNumber, finishReason, toolCalls, toolResults }) => {
            console.info("[Lifecycle AI][Post-stay] Step", {
              reservationId,
              model: modelId,
              stepNumber,
              finishReason,
              toolCalls: toolCalls.length,
              toolResults: toolResults.length,
            });
          }
        : undefined,
      tools: {
        // 1. Tool untuk mengumpulkan feedback
        update_guest_feedback: tool({
          description: copy.updateDescription,
          inputSchema: z.object({
            rating: z.coerce
              .number()
              .min(1)
              .max(5)
              .describe(copy.ratingDescription),
            comments: z.string().describe(copy.commentsDescription),
          }),
          execute: async ({ rating, comments }) => {
            try {
              const rewardResult = await completePostStayFeedbackWithReward({
                supabase,
                reservationId,
                tenantId,
                rating,
                comments,
                rewardPoints: FEEDBACK_REWARD_POINTS,
              });

              return copy.updateSuccess(
                rating,
                comments,
                rewardResult.pointsAwarded,
              );
            } catch (e: unknown) {
              console.error(
                "Lifecycle AI post-stay tool error while saving feedback:",
                e,
              );
              const reason = e instanceof Error ? e.message : "Unknown error";
              return copy.updateFailed(reason);
            }
          },
        }),

        // 2. Tool jika tamu menolak direngkuh
        ignore_feedback: tool({
          description: copy.ignoreDescription,
          inputSchema: z.object({
            reason: z.string().describe(copy.ignoreReasonDescription),
          }),
          execute: async ({ reason }) => {
            try {
              const { error } = await supabase
                .from("reservations")
                .update({
                  post_stay_feedback_status: "ignored",
                  post_stay_comments: `${copy.ignoreStoredReasonPrefix} ${reason}`,
                })
                .eq("id", reservationId);

              if (error) throw error;
              return copy.ignoreSuccess;
            } catch (e: unknown) {
              console.error(
                "Lifecycle AI post-stay tool error while ignoring feedback:",
                e,
              );
              const reason = e instanceof Error ? e.message : "Unknown error";
              return copy.ignoreFailed(reason);
            }
          },
        }),
      },
    });
  };

  let usedModel = AI_MODEL;
  let result;

  try {
    result = await runGenerateText(AI_MODEL);
  } catch (error: unknown) {
    const fallbackModel = AI_FALLBACK_MODEL.trim();
    const canFallback = fallbackModel.length > 0 && fallbackModel !== AI_MODEL;

    if (!canFallback || !isRetryableProviderRateLimitError(error)) {
      throw error;
    }

    console.warn(
      "Lifecycle AI provider rate-limit detected, retrying with fallback model",
      {
        reservationId,
        primaryModel: AI_MODEL,
        fallbackModel,
      },
    );

    usedModel = fallbackModel;
    result = await runGenerateText(fallbackModel);
  }

  if (ENABLE_LIFECYCLE_AI_DEBUG) {
    const allToolCalls = (result.steps ?? []).flatMap(
      (step) => step.toolCalls ?? [],
    );
    const toolErrors = (result.steps ?? []).flatMap((step) =>
      (step.content ?? [])
        .filter((part) => part.type === "tool-error")
        .map((part) => ({
          toolName: "toolName" in part ? part.toolName : "unknown",
          error: "error" in part ? String(part.error) : "unknown",
        })),
    );

    const latestUserText = getLatestUserText(messageHistory);
    const looksLikeDirectPostStayFeedback =
      /(?:^|\D)([1-5])(?:\D|$)/.test(latestUserText) &&
      latestUserText.trim().length >= 8;

    console.info("[Lifecycle AI][Post-stay] Summary", {
      reservationId,
      model: usedModel,
      steps: result.steps?.length ?? 0,
      toolCalls: allToolCalls.length,
      toolErrors,
    });

    if (allToolCalls.length === 0 && looksLikeDirectPostStayFeedback) {
      console.warn("[Lifecycle AI][Post-stay] Warning", {
        reservationId,
        reason:
          "No tool call despite user message looking like direct post-stay feedback",
      });
    }
  }

  return {
    response: result.text,
  };
}
