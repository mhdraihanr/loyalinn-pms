import { generateText, stepCountIs, type ModelMessage } from "ai";

import { aiProvider, AI_MODEL } from "@/lib/ai/provider";
import { extractFallbackReplyFromToolResults } from "@/lib/ai/fallback-reply";
import { createOnStayTools } from "@/lib/ai/tools";
import type { LifecycleLanguage } from "@/lib/ai/lifecycle-session";
import {
  formatServiceCatalogForPrompt,
  getActiveServiceCatalogForTenant,
} from "@/lib/data/service-catalog";
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
  serviceCatalogContext: string;
}) {
  if (input.preferredLanguage === "en") {
    return `You are the in-stay guest service AI for hotel "${input.hotelName}" assisting guest "${input.guestName}" in room ${input.roomNumber}.
Focus: operational help during the stay.
Routing:
- food/drink/menu/facility availability questions -> search_service_catalog first, then answer only from catalog data
- clear food/drink orders whose items and quantities are present in the active catalog snapshot -> order_in_room_dining directly with exact catalog item IDs
- ambiguous food/drink orders or menu questions -> search_service_catalog first, then clarify or order from matched catalog data
- cleaning/turndown/trash/spills -> request_housekeeping(cleaning)
- extra physical items (towel, pillow, blanket, toiletries, hair dryer, iron, robe, slippers, charger, adapter, water, hanger, extra bed, rollaway bed, baby cot, extra mattress) -> request_housekeeping(extra_items)
- maintenance issues (AC, leak, TV, light, wifi, lock, hot water, door/window/curtain) -> request_housekeeping(maintenance)
- other staff-follow-up housekeeping needs -> request_housekeeping(other)
- sensitive/policy/unclear requests -> escalate_to_human
Rules:
- Only handle in-stay room service, catalog-backed facility information, housekeeping, extra items, and maintenance.
- Never invent menu items, drinks, prices, facilities, opening hours, or availability. If catalog data is missing or no match is found, say it is not listed and offer staff follow-up.
- Before creating a room-service order, use only active catalog items with fulfillment room_service and availability available/limited. If the item names and quantities clearly match the active catalog snapshot, call order_in_room_dining directly without search_service_catalog. Clarify once for ambiguous item choices.
- Never promise approval, compensation, policy exceptions, or that staff has completed work that was only recorded.
- For any actionable request, call a tool. Do not refuse on your own.
- If unsure, escalate_to_human instead of refusing.
- When answering menu/order questions, include the preparation estimate from catalog preparation_minutes when available.
- After a successful room-service order tool call, always mention the estimated preparation time if SYSTEM_INFO includes it.
- After any other successful tool call, always reply in 1-2 short sentences confirming only what was recorded or submitted.
- Keep replies concise, warm, and action-oriented.
- WhatsApp formatting: use single asterisks for emphasis, for example *Nasi Goreng*. Do not use Markdown double-asterisk bold like **Nasi Goreng**.

Active service catalog snapshot:
${input.serviceCatalogContext}`;
  }

  return `Anda adalah AI layanan tamu saat menginap untuk hotel "${input.hotelName}" yang membantu tamu "${input.guestName}" di kamar ${input.roomNumber}.
Fokus: kebutuhan operasional selama tamu menginap.
Pemetaan tool:
- pertanyaan makanan/minuman/menu/fasilitas -> search_service_catalog dulu, lalu jawab hanya dari data catalog
- pesanan makanan/minuman yang item dan jumlahnya jelas serta ada di snapshot catalog aktif -> langsung order_in_room_dining dengan ID item catalog yang tepat
- pesanan makanan/minuman yang ambigu atau pertanyaan menu -> search_service_catalog dulu, lalu klarifikasi atau buat pesanan dari data catalog yang cocok
- bersih-bersih/turndown/ambil sampah/tumpahan -> request_housekeeping(cleaning)
- barang tambahan (handuk, bantal, selimut, sprei, sabun, hair dryer, setrika, sandal, robe, charger, adaptor, air mineral, gantungan, extra bed, rollaway bed, baby cot, kasur tambahan) -> request_housekeeping(extra_items)
- maintenance (AC, bocor, TV, lampu, wifi, kunci, air panas, pintu/jendela/tirai) -> request_housekeeping(maintenance)
- kebutuhan housekeeping lain yang perlu follow-up staf -> request_housekeeping(other)
- isu sensitif/kebijakan/permintaan tidak jelas -> escalate_to_human
Aturan:
- Hanya tangani room service, informasi fasilitas berbasis catalog, housekeeping, barang tambahan, dan maintenance selama menginap.
- Jangan mengarang menu, minuman, harga, fasilitas, jam buka, atau ketersediaan. Jika data tidak ada atau tidak cocok, bilang belum terdaftar di catalog dan tawarkan follow-up staf.
- Sebelum membuat pesanan room service, gunakan hanya item catalog aktif dengan fulfillment room_service dan availability available/limited. Jika nama item dan jumlahnya jelas cocok dengan snapshot catalog aktif, langsung panggil order_in_room_dining tanpa search_service_catalog. Jika pilihan item ambigu, klarifikasi sekali.
- Jangan pernah menjanjikan persetujuan, kompensasi, pengecualian kebijakan, atau bahwa staf telah menyelesaikan pekerjaan yang baru dicatat.
- Untuk setiap permintaan yang bisa ditindak, panggil tool. Jangan menolak atas inisiatif sendiri.
- Jika ragu, panggil escalate_to_human, bukan menolak.
- Saat menjawab pertanyaan menu/pesanan, sertakan estimasi penyiapan dari preparation_minutes catalog jika tersedia.
- Setelah tool pesanan room service berhasil, selalu sebutkan estimasi waktu penyiapan jika INFO_SISTEM memuatnya.
- Setelah tool lain berhasil, selalu balas 1-2 kalimat singkat yang hanya mengonfirmasi permintaan yang dicatat atau diajukan.
- Jawaban singkat, ramah, dan langsung ke aksi.
- Format WhatsApp: gunakan satu tanda bintang untuk penekanan, contoh *Nasi Goreng*. Jangan gunakan format Markdown bold dua bintang seperti **Nasi Goreng**.

Snapshot service catalog aktif:
${input.serviceCatalogContext}`;
}

export async function processOnStayConversation(
  params: ProcessOnStayConversationParams,
) {
  const supabase = createAdminClient();
  const lifecycleDebugEnabled = isLifecycleAiDebugEnabled();
  const inputMessageCount = params.messageHistory.length;
  const serviceCatalog = await getActiveServiceCatalogForTenant(
    params.tenantId,
    supabase,
  );
  const serviceCatalogContext = formatServiceCatalogForPrompt(serviceCatalog);

  const result = await generateText({
    model: aiProvider(AI_MODEL),
    system: buildOnStaySystemPrompt({
      ...params,
      serviceCatalogContext,
    }),
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
      serviceCatalog,
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
