import { generateText, stepCountIs, type ModelMessage } from "ai";

import { aiProvider, AI_MODEL } from "@/lib/ai/provider";
import { extractFallbackReplyFromToolResults } from "@/lib/ai/fallback-reply";
import { createPreArrivalTools } from "@/lib/ai/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LifecycleLanguage } from "@/lib/ai/lifecycle-session";

type ProcessPreArrivalConversationParams = {
  reservationId: string;
  tenantId: string;
  guestId: string;
  guestName: string;
  hotelName: string;
  roomNumber: string;
  messageHistory: ModelMessage[];
  preferredLanguage: LifecycleLanguage;
};

function isLifecycleAiDebugEnabled() {
  return (
    process.env.LIFECYCLE_AI_DEBUG === "true" ||
    process.env.AI_FEEDBACK_DEBUG === "true"
  );
}

function getUsageSnapshot(result: {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}) {
  return {
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
    totalTokens: result.usage?.totalTokens ?? null,
  };
}

function buildPreArrivalSystemPrompt(input: {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  preferredLanguage: LifecycleLanguage;
}) {
  if (input.preferredLanguage === "en") {
    return `You are the pre-arrival concierge AI for hotel "${input.hotelName}" assisting guest "${input.guestName}" (room ${input.roomNumber}).
Focus: check-in preparation and arrival support.
Routing:
- arrival time / ETA / flight time -> capture_arrival_eta
- early check-in request -> request_early_checkin
- policy, complaint, unusual, or unclear request -> escalate_to_human
Rules:
- For actionable requests, call a tool. Do not refuse on your own.
- If unsure, use escalate_to_human instead of refusing.
- After a successful tool call, always reply in 1-2 short sentences confirming what was submitted and the next expectation.
- Keep replies concise, warm, and practical.`;
  }

  return `Anda adalah AI concierge pre-arrival untuk hotel "${input.hotelName}" yang membantu tamu bernama "${input.guestName}" (kamar ${input.roomNumber}).
Fokus: persiapan check-in dan kebutuhan sebelum tamu tiba.
Pemetaan tool:
- info waktu kedatangan / ETA / jam pesawat -> capture_arrival_eta
- permintaan early check-in -> request_early_checkin
- pertanyaan kebijakan, komplain, permintaan tidak biasa, atau permintaan tidak jelas -> escalate_to_human
Aturan:
- Untuk permintaan yang bisa ditindak, panggil tool. Jangan menolak atas inisiatif sendiri.
- Jika ragu, gunakan escalate_to_human, bukan menolak.
- Setelah tool berhasil, selalu balas 1-2 kalimat singkat yang mengonfirmasi permintaan dan tindak lanjut.
- Jawaban ringkas, ramah, dan praktis.`;
}

export async function processPreArrivalConversation(
  params: ProcessPreArrivalConversationParams,
) {
  const supabase = createAdminClient();
  const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();
  const inputMessageCount = params.messageHistory.length;

  const result = await generateText({
    model: aiProvider(AI_MODEL),
    system: buildPreArrivalSystemPrompt(params),
    messages: params.messageHistory,
    stopWhen: stepCountIs(4),
    onStepFinish: lifecycleDebugEnabled
      ? ({ stepNumber, finishReason, toolCalls, toolResults }) => {
          console.info("[Lifecycle AI][Pre-arrival] Step", {
            reservationId: params.reservationId,
            model: AI_MODEL,
            stepNumber,
            finishReason,
            toolCalls: toolCalls.length,
            toolResults: toolResults.length,
          });
        }
      : undefined,
    tools: createPreArrivalTools({
      supabase,
      tenantId: params.tenantId,
      reservationId: params.reservationId,
      guestId: params.guestId,
      roomNumber: params.roomNumber,
      language: params.preferredLanguage,
      stage: "pre-arrival",
    }),
  });

  if (lifecycleDebugEnabled) {
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

    console.info("[Lifecycle AI][Pre-arrival] Summary", {
      reservationId: params.reservationId,
      model: AI_MODEL,
      inputMessageCount,
      steps: result.steps?.length ?? 0,
      toolCalls: allToolCalls.length,
      toolErrors,
      usage: getUsageSnapshot(result),
    });
  }

  const response = extractFallbackReplyFromToolResults(
    result,
    params.preferredLanguage,
  );

  if (lifecycleDebugEnabled && (!result.text || !result.text.trim())) {
    console.warn(
      "[Lifecycle AI][Pre-arrival] Empty model text, using fallback",
      {
        reservationId: params.reservationId,
        model: AI_MODEL,
        fallbackUsed: response.length > 0,
      },
    );
  }

  return {
    response,
  };
}
