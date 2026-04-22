import { generateText, stepCountIs, type ModelMessage } from "ai";

import { aiProvider, AI_MODEL } from "@/lib/ai/provider";
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

function buildPreArrivalSystemPrompt(input: {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  preferredLanguage: LifecycleLanguage;
}) {
  if (input.preferredLanguage === "en") {
    return `You are the pre-arrival concierge AI for hotel "${input.hotelName}" assisting guest "${input.guestName}" (room ${input.roomNumber}).
Your focus is check-in preparation and arrival support.
Rules:
- Keep answers concise, warm, and practical.
- Use tools when the guest provides arrival ETA, asks early check-in, or asks for human follow-up.
- For policy decisions or uncertain requests, call escalate_to_human.
- After a successful tool call, confirm briefly and set realistic expectation.`;
  }

  return `Anda adalah AI concierge pre-arrival untuk hotel "${input.hotelName}" yang membantu tamu bernama "${input.guestName}" (kamar ${input.roomNumber}).
Fokus Anda adalah persiapan check-in dan kebutuhan sebelum tamu tiba.
Aturan:
- Jawaban harus ringkas, ramah, dan praktis.
- Gunakan tool ketika tamu memberi ETA kedatangan, meminta early check-in, atau meminta ditindaklanjuti staf.
- Untuk kebijakan yang tidak pasti atau sensitif, gunakan tool escalate_to_human.
- Setelah tool berhasil, konfirmasi singkat beserta ekspektasi tindak lanjut.`;
}

export async function processPreArrivalConversation(
  params: ProcessPreArrivalConversationParams,
) {
  const supabase = createAdminClient();
  const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();

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
      steps: result.steps?.length ?? 0,
      toolCalls: allToolCalls.length,
      toolErrors,
    });
  }

  return {
    response: result.text,
  };
}
