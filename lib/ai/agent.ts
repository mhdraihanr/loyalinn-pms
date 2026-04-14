import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { openrouter, AI_MODEL } from "./openrouter";
import { createAdminClient } from "../supabase/admin";

const ENABLE_AI_FEEDBACK_DEBUG = process.env.AI_FEEDBACK_DEBUG === "true";

type AiSettingsPromptContext = {
  hotel_name: string | null;
  ai_name: string | null;
  tone_of_voice: string | null;
  custom_instructions: string | null;
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

    console.error("Error loading AI settings prompt context", {
      tenantId,
      error: message,
    });
    return null;
  }

  return (data as AiSettingsPromptContext | null) ?? null;
}

export function buildGuestFeedbackSystemPrompt({
  guestName,
  hotelName,
  aiSettings,
}: {
  guestName: string;
  hotelName: string;
  aiSettings: AiSettingsPromptContext | null;
}) {
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
    optionalContext.push(`Preferensi tone: ${preferredTone}.`);
  }

  if (customInstructions) {
    optionalContext.push(
      `Instruksi tambahan dari hotel:\n${customInstructions}`,
    );
  }

  const optionalBlock =
    optionalContext.length > 0 ? `\n\n${optionalContext.join("\n")}` : "";

  return `Anda adalah ${resolvedAiName}, resepsionis dan Guest Relation AI untuk hotel "${resolvedHotelName}".
Anda sedang menangani tamu dengan nama "${guestName}".
Tugas utama Anda adalah menanyakan bagaimana pengalaman menginap tamu setelah mereka check-out, serta mengumpulkan feedback yang terdiri dari:
1. Rating berskala (angka) dari 1 sampai 5.
2. Alasan / komentar teks dari tamu atas score tersebut.

Aturan AI:
- Gunakan bahasa Indonesia yang ramah, sopan, dan hangat.
- Jangan bertele-tele. Langsung tanyakan angka rating jika tamu belum menyebutkannya (misal: tamu hanya membalas "Bagus, saya suka pelayanannya").
- Jika tamu memberikan rating berupa angka (1, 2, 3, 4, 5) ATAU menyebutkan komentar secara utuh, SEGERA gunakan tool \`update_guest_feedback\` untuk menyimpannya.
- Khusus jika pengguna menolak memberikan feedback atau marah (menolak untuk di-follow up), gunakan tool \`ignore_feedback\` agar sistem berhenti mengganggu tamu.
- Jika tool sudah berhasil dipanggil (berhasil mencatat feedback), akhiri percakapan dengan mengucapkan terima kasih atas waktunya.${optionalBlock}`;
}

export async function processGuestFeedback(
  reservationId: string,
  tenantId: string,
  guestName: string,
  hotelName: string,
  messageHistory: ModelMessage[],
) {
  const supabase = await createAdminClient();
  const aiSettings = await getTenantAiSettingsPromptContext(supabase, tenantId);
  const systemPrompt = buildGuestFeedbackSystemPrompt({
    guestName,
    hotelName,
    aiSettings,
  });

  const result = await generateText({
    // OpenRouter + AI SDK v6 default model route can use Responses API.
    // We explicitly use chat() to keep payload compatible for this tool-calling flow.
    model: openrouter.chat(AI_MODEL),
    system: systemPrompt,
    messages: messageHistory,
    stopWhen: stepCountIs(3),
    onStepFinish: ENABLE_AI_FEEDBACK_DEBUG
      ? ({ stepNumber, finishReason, toolCalls, toolResults }) => {
          console.info("[AI Feedback Step]", {
            reservationId,
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
        description:
          "Menyimpan hasil rating (wajib berupa angka 1 sampai 5) dan komentar feedback dari tamu yang sudah didapatkan dari percakapan.",
        inputSchema: z.object({
          rating: z.coerce
            .number()
            .min(1)
            .max(5)
            .describe(
              "Angka numerik (1, 2, 3, 4, atau 5) sebagai point kepuasan dari sang tamu.",
            ),
          comments: z
            .string()
            .describe(
              "Teks komentar, opini, atau saran bebas yang dituliskan oleh tamu.",
            ),
        }),
        execute: async ({ rating, comments }) => {
          try {
            const { error } = await supabase
              .from("reservations")
              .update({
                post_stay_feedback_status: "completed",
                post_stay_rating: rating,
                post_stay_comments: comments,
              })
              .eq("id", reservationId);

            if (error) throw error;
            return `INFO_SISTEM: Berhasil menyimpan feedback (Rating: ${rating}, Komentar: "${comments}"). Silakan beri pesan penutup dan terima kasih kepada tamu.`;
          } catch (e: unknown) {
            console.error("Error saving feedback via AI Tool:", e);
            const reason = e instanceof Error ? e.message : "Unknown error";
            return `INFO_SISTEM: Gagal menyimpan data di database. Alasan: ${reason}`;
          }
        },
      }),

      // 2. Tool jika tamu menolak direngkuh
      ignore_feedback: tool({
        description:
          "Menutup percakapan jika tamu menolak di-follow up, risih, atau eksplisit meminta kita berhenti bertanya.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe(
              'Alasan spesifik kenapa tamu menolak untuk memberikan feedback (misalnya "Sedang sibuk", "Saya tidak mau diganggu")',
            ),
        }),
        execute: async ({ reason }) => {
          try {
            const { error } = await supabase
              .from("reservations")
              .update({
                post_stay_feedback_status: "ignored",
                post_stay_comments: `[Declined Feedback] Alasan: ${reason}`,
              })
              .eq("id", reservationId);

            if (error) throw error;
            return `INFO_SISTEM: Sukses update status menjadi 'ignored'. Mohon ucapkan permohonan maaf telah mengganggu dan ucapan selamat beraktivitas kembali kepada tamu!`;
          } catch (e: unknown) {
            console.error("Error ignoring feedback via AI Tool:", e);
            const reason = e instanceof Error ? e.message : "Unknown error";
            return `INFO_SISTEM: Gagal eksekusi. Alasan: ${reason}`;
          }
        },
      }),
    },
  });

  if (ENABLE_AI_FEEDBACK_DEBUG) {
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
    const looksLikeDirectFeedback =
      /(?:^|\D)([1-5])(?:\D|$)/.test(latestUserText) &&
      latestUserText.trim().length >= 8;

    console.info("[AI Feedback Summary]", {
      reservationId,
      model: AI_MODEL,
      steps: result.steps?.length ?? 0,
      toolCalls: allToolCalls.length,
      toolErrors,
    });

    if (allToolCalls.length === 0 && looksLikeDirectFeedback) {
      console.warn("[AI Feedback Warning]", {
        reservationId,
        reason:
          "No tool call despite user message looking like direct feedback",
      });
    }
  }

  return {
    response: result.text,
  };
}
