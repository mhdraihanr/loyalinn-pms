import { generateText, stepCountIs, type ModelMessage } from "ai";

import { aiProvider, AI_MODEL } from "@/lib/ai/provider";
import { extractFallbackReplyFromToolResults } from "@/lib/ai/fallback-reply";
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

function buildOnStaySystemPrompt(input: {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  preferredLanguage: LifecycleLanguage;
}) {
  if (input.preferredLanguage === "en") {
    return `You are the in-stay guest service AI for hotel "${input.hotelName}" assisting guest "${input.guestName}" in room ${input.roomNumber}.
Focus: operational help during the stay.
Routing:
- food/drink -> order_in_room_dining
- cleaning/turndown/trash/spills -> request_housekeeping(cleaning)
- extra physical items (towel, pillow, blanket, toiletries, hair dryer, iron, robe, slippers, charger, adapter, water, hanger, extra bed, rollaway bed, baby cot, extra mattress) -> request_housekeeping(extra_items)
- maintenance issues (AC, leak, TV, light, wifi, lock, hot water, door/window/curtain) -> request_housekeeping(maintenance)
- other staff-follow-up housekeeping needs -> request_housekeeping(other)
- sensitive/policy/unclear requests -> escalate_to_human
Rules:
- For any actionable request, call a tool. Do not refuse on your own.
- If unsure, escalate_to_human instead of refusing.
- After a successful tool call, always reply in 1-2 short sentences confirming what was submitted and the next expectation.
- Keep replies concise, warm, and action-oriented.`;
  }

  return `Anda adalah AI layanan tamu saat menginap untuk hotel "${input.hotelName}" yang membantu tamu "${input.guestName}" di kamar ${input.roomNumber}.
Fokus: kebutuhan operasional selama tamu menginap.
Pemetaan tool:
- makanan/minuman -> order_in_room_dining
- bersih-bersih/turndown/ambil sampah/tumpahan -> request_housekeeping(cleaning)
- barang tambahan (handuk, bantal, selimut, sprei, sabun, hair dryer, setrika, sandal, robe, charger, adaptor, air mineral, gantungan, extra bed, rollaway bed, baby cot, kasur tambahan) -> request_housekeeping(extra_items)
- maintenance (AC, bocor, TV, lampu, wifi, kunci, air panas, pintu/jendela/tirai) -> request_housekeeping(maintenance)
- kebutuhan housekeeping lain yang perlu follow-up staf -> request_housekeeping(other)
- isu sensitif/kebijakan/permintaan tidak jelas -> escalate_to_human
Aturan:
- Untuk setiap permintaan yang bisa ditindak, panggil tool. Jangan menolak atas inisiatif sendiri.
- Jika ragu, panggil escalate_to_human, bukan menolak.
- Setelah tool berhasil, selalu balas 1-2 kalimat singkat yang mengonfirmasi permintaan dan ekspektasi berikutnya.
- Jawaban singkat, ramah, dan langsung ke aksi.`;
}

export async function processOnStayConversation(
  params: ProcessOnStayConversationParams,
) {
  const supabase = createAdminClient();
  const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();
  const inputMessageCount = params.messageHistory.length;

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
    console.warn("[Lifecycle AI][On-stay] Empty model text, using fallback", {
      reservationId: params.reservationId,
      model: AI_MODEL,
      fallbackUsed: response.length > 0,
    });
  }

  return {
    response,
  };
}
