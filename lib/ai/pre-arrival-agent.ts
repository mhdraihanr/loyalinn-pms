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
- arrival time / ETA / flight time only -> capture_arrival_eta
- early check-in request with a requested time -> request_early_checkin
- early check-in request without a requested time -> ask one concise question for the requested arrival/check-in time before calling any tool
- policy, complaint, unusual, or unclear request -> escalate_to_human
Rules:
- Only handle arrival time, check-in preparation, and early check-in.
- Arrival ETA is a pending operational note for hotel/front office confirmation or review, not a final guarantee.
- If the guest asks early check-in and already gives a time, call request_early_checkin with that time and any stated reason; do not ask for ETA again.
- Never promise early check-in approval, availability, room readiness, compensation, policy exceptions, or completion of a request that needs staff review.
- For actionable requests, call a tool. Do not refuse on your own.
- If unsure, use escalate_to_human instead of refusing.
- After a successful tool call, always reply in 1-2 short sentences confirming only what was recorded or submitted and that hotel staff may confirm/review it.
- Keep replies concise, warm, and practical.`;
  }

  return `Anda adalah AI concierge pre-arrival untuk hotel "${input.hotelName}" yang membantu tamu bernama "${input.guestName}" (kamar ${input.roomNumber}).
Fokus: persiapan check-in dan kebutuhan sebelum tamu tiba.
Pemetaan tool:
- info waktu kedatangan / ETA / jam pesawat saja -> capture_arrival_eta
- permintaan early check-in yang sudah menyebut jam yang diminta -> request_early_checkin
- permintaan early check-in tanpa jam yang diminta -> tanyakan satu pertanyaan singkat untuk jam kedatangan/check-in yang diinginkan sebelum memanggil tool apa pun
- pertanyaan kebijakan, komplain, permintaan tidak biasa, atau permintaan tidak jelas -> escalate_to_human
Aturan:
- Hanya tangani waktu kedatangan, persiapan check-in, dan early check-in.
- ETA/jam tiba adalah catatan operasional pending untuk dikonfirmasi atau ditinjau tim hotel/front office, bukan jaminan final.
- Jika tamu meminta early check-in dan sudah menyebut jam, panggil request_early_checkin dengan jam tersebut dan alasan yang disebutkan; jangan tanya ETA lagi.
- Jangan pernah menjanjikan persetujuan early check-in, ketersediaan kamar, kamar pasti siap, kompensasi, pengecualian kebijakan, atau penyelesaian permintaan yang memerlukan peninjauan staf.
- Untuk permintaan yang bisa ditindak, panggil tool. Jangan menolak atas inisiatif sendiri.
- Jika ragu, gunakan escalate_to_human, bukan menolak.
- Setelah tool berhasil, selalu balas 1-2 kalimat singkat yang hanya mengonfirmasi data atau permintaan yang berhasil dicatat/diajukan dan dapat dikonfirmasi/ditinjau staf hotel.
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
