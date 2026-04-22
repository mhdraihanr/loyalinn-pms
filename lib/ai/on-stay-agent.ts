import { generateText, stepCountIs, type ModelMessage } from "ai";

import { aiProvider, AI_MODEL } from "@/lib/ai/provider";
import { createOnStayTools } from "@/lib/ai/tools";
import type { LifecycleLanguage } from "@/lib/ai/lifecycle-session";
import { createAdminClient } from "@/lib/supabase/admin";

type ProcessOnStayConversationParams = {
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

function buildOnStaySystemPrompt(input: {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  preferredLanguage: LifecycleLanguage;
}) {
  if (input.preferredLanguage === "en") {
    return `You are the in-stay guest service AI for hotel "${input.hotelName}" assisting guest "${input.guestName}" in room ${input.roomNumber}.
Your focus is operational support during stay.
Rules:
- Be concise and action-oriented.
- Use order_in_room_dining for food requests.
- Use request_housekeeping for cleaning, extra item, and maintenance requests.
- If request is unclear, risky, or outside policy, call escalate_to_human.
- Always confirm what was submitted after tool execution.`;
  }

  return `Anda adalah AI layanan tamu saat menginap untuk hotel "${input.hotelName}" yang membantu tamu "${input.guestName}" di kamar ${input.roomNumber}.
Fokus Anda adalah kebutuhan operasional selama tamu menginap.
Aturan:
- Jawaban singkat dan langsung ke aksi.
- Gunakan order_in_room_dining untuk permintaan makanan/minuman.
- Gunakan request_housekeeping untuk cleaning, extra item, atau maintenance.
- Jika permintaan tidak jelas, berisiko, atau di luar kebijakan, gunakan escalate_to_human.
- Setelah tool berhasil, selalu konfirmasi apa yang sudah diajukan.`;
}

export async function processOnStayConversation(
  params: ProcessOnStayConversationParams,
) {
  const supabase = createAdminClient();
  const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();

  const result = await generateText({
    model: aiProvider(AI_MODEL),
    system: buildOnStaySystemPrompt(params),
    messages: params.messageHistory,
    stopWhen: stepCountIs(4),
    onStepFinish: lifecycleDebugEnabled
      ? ({ stepNumber, finishReason, toolCalls, toolResults }) => {
          console.info("[Lifecycle AI][On-stay] Step", {
            reservationId: params.reservationId,
            model: AI_MODEL,
            stepNumber,
            finishReason,
            toolCalls: toolCalls.length,
            toolResults: toolResults.length,
          });
        }
      : undefined,
    tools: createOnStayTools({
      supabase,
      tenantId: params.tenantId,
      reservationId: params.reservationId,
      guestId: params.guestId,
      roomNumber: params.roomNumber,
      language: params.preferredLanguage,
      stage: "on-stay",
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

    console.info("[Lifecycle AI][On-stay] Summary", {
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
