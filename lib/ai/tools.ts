import { tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  upsertLifecycleAiSession,
  type LifecycleLanguage,
  type LifecycleStage,
} from "@/lib/ai/lifecycle-session";
import {
  getActiveServiceCatalogForTenant,
  type ServiceCatalogData,
} from "@/lib/data/service-catalog";

type LifecycleToolContext = {
  supabase: SupabaseClient;
  tenantId: string;
  reservationId: string;
  guestId: string;
  roomNumber: string;
  language: LifecycleLanguage;
  stage: LifecycleStage;
  serviceCatalog?: ServiceCatalogData;
};

type CatalogOrderItem = {
  catalog_item_id: string;
  name: string;
  quantity: number;
  notes?: string;
};

function t(language: LifecycleLanguage, idText: string, enText: string) {
  return language === "en" ? enText : idText;
}

function normalizeRoomNumber(roomNumber: string) {
  const trimmed = roomNumber.trim();
  return trimmed.length > 0 ? trimmed : "-";
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function formatMoney(currency: string, amount: number | null) {
  if (amount === null) return null;
  return `${currency} ${amount.toLocaleString("id-ID")}`;
}

function formatPreparationEstimate(language: LifecycleLanguage, minutes: number | null) {
  if (minutes === null) return null;
  return t(language, `sekitar ${minutes} menit`, `about ${minutes} minutes`);
}

function summarizePreparationMinutes(values: Array<number | null | undefined>) {
  const minutes = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (minutes.length === 0) return null;
  return Math.max(...minutes);
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values
    .filter(Boolean)
    .some((value) => normalizeSearchText(value!).includes(normalizedQuery));
}

async function markAction(
  context: LifecycleToolContext,
  input: {
    actionType: string;
    actionPayload: Record<string, unknown>;
    needsHumanFollowUp: boolean;
    sessionStatus?: "active" | "handoff";
  },
) {
  await upsertLifecycleAiSession(context.supabase, {
    tenantId: context.tenantId,
    reservationId: context.reservationId,
    guestId: context.guestId,
    stage: context.stage,
    sessionStatus: input.sessionStatus ?? "active",
    needsHumanFollowUp: input.needsHumanFollowUp,
    lastActionType: input.actionType,
    lastActionPayload: input.actionPayload,
    touchOutboundAt: true,
  });
}

async function insertArrivalRequest(
  context: LifecycleToolContext,
  input: {
    requestType: "arrival_eta" | "early_checkin";
    eta?: string | null;
    requestedTime?: string | null;
    details: Record<string, unknown>;
  },
) {
  const { error } = await context.supabase.from("arrival_requests").insert({
    tenant_id: context.tenantId,
    reservation_id: context.reservationId,
    guest_id: context.guestId,
    room_number: normalizeRoomNumber(context.roomNumber),
    request_type: input.requestType,
    eta: input.eta ?? null,
    requested_time: input.requestedTime ?? null,
    details: input.details,
    status: "pending",
  });

  if (error) {
    throw error;
  }
}

export function createPreArrivalTools(context: LifecycleToolContext) {
  return {
    capture_arrival_eta: tool({
      description:
        "Store guest estimated arrival time (ETA) as a pending arrival request for front office confirmation/review.",
      inputSchema: z.object({
        eta: z.string().min(2).describe("Estimated arrival time from guest."),
        notes: z
          .string()
          .max(500)
          .optional()
          .describe("Optional notes related to guest arrival."),
      }),
      execute: async ({ eta, notes }) => {
        try {
          await insertArrivalRequest(context, {
            requestType: "arrival_eta",
            eta,
            requestedTime: null,
            details: {
              notes: notes ?? null,
            },
          });

          await markAction(context, {
            actionType: "capture_arrival_eta",
            actionPayload: {
              eta,
              notes: notes ?? null,
            },
            needsHumanFollowUp: false,
          });

          return t(
            context.language,
            "INFO_SISTEM: ETA tamu sudah dicatat sebagai catatan pending untuk dikonfirmasi atau ditinjau tim front office.",
            "SYSTEM_INFO: Guest arrival ETA has been recorded as a pending note for front office confirmation or review.",
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal mencatat ETA tamu. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to store guest ETA. Reason: ${detail}`,
          );
        }
      },
    }),

    request_early_checkin: tool({
      description:
        "Record a guest early check-in request for human approval and follow-up only after the guest provides a requested time.",
      inputSchema: z.object({
        requested_time: z
          .string()
          .min(2)
          .describe("Requested early check-in time stated by the guest."),
        reason: z
          .string()
          .max(500)
          .optional()
          .describe("Optional reason stated by the guest."),
      }),
      execute: async ({ requested_time, reason }) => {
        try {
          await insertArrivalRequest(context, {
            requestType: "early_checkin",
            eta: null,
            requestedTime: requested_time,
            details: {
              reason: reason ?? null,
            },
          });

          await markAction(context, {
            actionType: "request_early_checkin",
            actionPayload: {
              requested_time,
              reason: reason ?? null,
            },
            needsHumanFollowUp: true,
          });

          return t(
            context.language,
            "INFO_SISTEM: Permintaan early check-in sudah dicatat sebagai pending dan diteruskan ke tim hotel untuk konfirmasi; belum disetujui otomatis.",
            "SYSTEM_INFO: Early check-in request has been logged as pending and forwarded to hotel staff for confirmation; it is not automatically approved.",
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal mencatat permintaan early check-in. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to store early check-in request. Reason: ${detail}`,
          );
        }
      },
    }),

    escalate_to_human: tool({
      description:
        "Escalate conversation to human staff when issue is sensitive, unclear, or needs manual approval.",
      inputSchema: z.object({
        reason: z.string().min(3).max(500),
        priority: z.enum(["normal", "high"]).default("normal"),
      }),
      execute: async ({ reason, priority }) => {
        try {
          await markAction(context, {
            actionType: "escalate_to_human",
            actionPayload: { reason, priority },
            needsHumanFollowUp: true,
            sessionStatus: "handoff",
          });

          return t(
            context.language,
            "INFO_SISTEM: Staf hotel akan membantu memeriksa permintaan ini sesuai data reservasi tamu.",
            "SYSTEM_INFO: Hotel staff will help check this request against the guest reservation details.",
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal melakukan eskalasi ke staf. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to escalate conversation to staff. Reason: ${detail}`,
          );
        }
      },
    }),
  };
}

export function createOnStayTools(context: LifecycleToolContext) {
  const roomNumber = normalizeRoomNumber(context.roomNumber);
  const getServiceCatalog = () =>
    context.serviceCatalog ??
    getActiveServiceCatalogForTenant(context.tenantId, context.supabase);

  return {
    search_service_catalog: tool({
      description:
        "Search the tenant service catalog for room-service food/drinks, facilities, services, amenities, availability, prices, aliases, and guest-facing notes. Call this before answering menu/facility questions or before creating a room-service order.",
      inputSchema: z.object({
        query: z
          .string()
          .max(120)
          .optional()
          .describe("Guest search text such as menu, drinks, nasi goreng, pool, laundry."),
        catalog_type: z
          .enum(["all", "room_service", "facility"])
          .default("all"),
      }),
      execute: async ({ query, catalog_type }) => {
        try {
          const catalog = await getServiceCatalog();
          const matches = catalog.items.filter((item) => {
            if (catalog_type === "room_service" && item.fulfillment_type !== "room_service") {
              return false;
            }
            if (
              catalog_type === "facility" &&
              !["facility", "service", "amenity"].includes(item.item_type)
            ) {
              return false;
            }

            return includesQuery(
              [
                item.name,
                item.description,
                item.category?.name,
                item.item_type,
                item.availability_status,
                item.fulfillment_type,
                item.location,
                item.guest_notes,
                ...item.aliases,
              ],
              query ?? "",
            );
          });

          if (matches.length === 0) {
            return t(
              context.language,
              "INFO_SISTEM: Tidak ada item catalog aktif yang cocok. Jangan mengarang menu/fasilitas; tawarkan daftar yang tersedia atau eskalasi ke staf.",
              "SYSTEM_INFO: No active catalog items matched. Do not invent menu/facility data; offer available items or escalate to staff.",
            );
          }

          const summary = matches
            .slice(0, 20)
            .map((item) => {
              const price = formatMoney(item.currency, item.price);
              return {
                id: item.id,
                name: item.name,
                type: item.item_type,
                category: item.category?.name ?? null,
                availability: item.availability_status,
                fulfillment: item.fulfillment_type,
                price,
                unit: item.unit,
                hours:
                  item.available_start_time || item.available_end_time
                    ? `${item.available_start_time ?? "?"}-${item.available_end_time ?? "?"}`
                    : null,
                location: item.location,
                aliases: item.aliases,
                preparation_minutes: item.preparation_minutes,
                guest_notes: item.guest_notes,
              };
            });

          return `${t(
            context.language,
            "INFO_SISTEM: Item catalog aktif yang cocok:",
            "SYSTEM_INFO: Matching active catalog items:",
          )}\n${JSON.stringify(summary, null, 2)}`;
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal mencari service catalog. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to search service catalog. Reason: ${detail}`,
          );
        }
      },
    }),

    order_in_room_dining: tool({
      description:
        "Create an in-room dining request in room_service_orders. Only call after selecting exact active, available or limited catalog item IDs from search_service_catalog. Do not use this for unavailable, by-request, unknown, or ambiguous items.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              catalog_item_id: z
                .string()
                .uuid()
                .describe("Exact service_catalog_items.id from search_service_catalog."),
              name: z.string().min(1),
              quantity: z.number().int().min(1),
              notes: z.string().max(250).optional(),
            }),
          )
          .min(1),
      }),
      execute: async ({ items }: { items: CatalogOrderItem[] }) => {
        try {
          const catalog = await getServiceCatalog();
          const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
          const invalidItems = items.filter((item) => {
            const catalogItem = itemsById.get(item.catalog_item_id);
            return (
              !catalogItem ||
              catalogItem.fulfillment_type !== "room_service" ||
              !["available", "limited"].includes(catalogItem.availability_status)
            );
          });

          if (invalidItems.length > 0) {
            return t(
              context.language,
              `INFO_SISTEM: Pesanan tidak dibuat karena ada item yang tidak tersedia/tidak valid: ${invalidItems
                .map((item) => item.name)
                .join(", ")}. Minta tamu memilih item catalog yang tersedia atau eskalasi ke staf.`,
              `SYSTEM_INFO: Order was not created because these items are unavailable/invalid: ${invalidItems
                .map((item) => item.name)
                .join(", ")}. Ask the guest to choose available catalog items or escalate to staff.`,
            );
          }

          const orderItems = items.map((item) => {
            const catalogItem = itemsById.get(item.catalog_item_id)!;
            const unitPrice = catalogItem.price;
            return {
              catalogItemId: catalogItem.id,
              name: catalogItem.name,
              requestedName: item.name,
              quantity: item.quantity,
              unitPrice,
              currency: catalogItem.currency,
              subtotal: unitPrice === null ? null : unitPrice * item.quantity,
              preparationMinutes: catalogItem.preparation_minutes,
              notes: item.notes ?? null,
            };
          });
          const pricedItems = orderItems.filter((item) => item.subtotal !== null);
          const totalAmount = pricedItems.length === orderItems.length
            ? pricedItems.reduce((total, item) => total + Number(item.subtotal), 0)
            : null;
          const currency = orderItems[0]?.currency ?? "IDR";
          const estimatedPreparationMinutes = summarizePreparationMinutes(
            orderItems.map((item) => item.preparationMinutes),
          );
          const preparationEstimate = formatPreparationEstimate(
            context.language,
            estimatedPreparationMinutes,
          );

          const { error } = await context.supabase
            .from("room_service_orders")
            .insert({
              tenant_id: context.tenantId,
              reservation_id: context.reservationId,
              guest_id: context.guestId,
              room_number: roomNumber,
              items: orderItems,
              total_amount: totalAmount,
              currency,
              source_catalog_item_ids: orderItems.map((item) => item.catalogItemId),
              status: "pending",
            });

          if (error) {
            throw error;
          }

          await markAction(context, {
            actionType: "order_in_room_dining",
            actionPayload: {
              items: orderItems,
              total_amount: totalAmount,
              currency,
            },
            needsHumanFollowUp: true,
          });

          return t(
            context.language,
            `INFO_SISTEM: Pesanan room service berdasarkan catalog berhasil dibuat dan diteruskan ke tim operasional.${preparationEstimate ? ` Estimasi waktu penyiapan ${preparationEstimate}.` : ""}`,
            `SYSTEM_INFO: Catalog-backed room service order has been created and forwarded to operations.${preparationEstimate ? ` Estimated preparation time is ${preparationEstimate}.` : ""}`,
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal membuat pesanan room service. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to create room service order. Reason: ${detail}`,
          );
        }
      },
    }),

    request_housekeeping: tool({
      description:
        "Create housekeeping request and store it in housekeeping_requests.",
      inputSchema: z.object({
        request_type: z.enum([
          "cleaning",
          "extra_items",
          "maintenance",
          "other",
        ]),
        details: z.string().min(2).max(1000),
        extra_items: z.array(z.string().min(1)).optional(),
      }),
      execute: async ({ request_type, details, extra_items }) => {
        try {
          const payloadDetails: Record<string, unknown> = {
            details,
          };

          if (extra_items && extra_items.length > 0) {
            payloadDetails.extra_items = extra_items;
          }

          const { error } = await context.supabase
            .from("housekeeping_requests")
            .insert({
              tenant_id: context.tenantId,
              reservation_id: context.reservationId,
              guest_id: context.guestId,
              room_number: roomNumber,
              request_type,
              details: payloadDetails,
              status: "pending",
            });

          if (error) {
            throw error;
          }

          await markAction(context, {
            actionType: "request_housekeeping",
            actionPayload: {
              request_type,
              ...payloadDetails,
            },
            needsHumanFollowUp: true,
          });

          return t(
            context.language,
            "INFO_SISTEM: Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
            "SYSTEM_INFO: Housekeeping request has been created and forwarded to the team.",
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal membuat permintaan housekeeping. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to create housekeeping request. Reason: ${detail}`,
          );
        }
      },
    }),

    escalate_to_human: tool({
      description:
        "Escalate on-stay issue to human staff for urgent or sensitive handling.",
      inputSchema: z.object({
        reason: z.string().min(3).max(500),
        priority: z.enum(["normal", "high"]).default("normal"),
      }),
      execute: async ({ reason, priority }) => {
        try {
          await markAction(context, {
            actionType: "escalate_to_human",
            actionPayload: { reason, priority },
            needsHumanFollowUp: true,
            sessionStatus: "handoff",
          });

          return t(
            context.language,
            "INFO_SISTEM: Staf hotel akan membantu memeriksa dan menindaklanjuti permintaan tamu.",
            "SYSTEM_INFO: Hotel staff will help check and follow up on the guest request.",
          );
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : "unknown";
          return t(
            context.language,
            `INFO_SISTEM: Gagal eskalasi ke staf hotel. Alasan: ${detail}`,
            `SYSTEM_INFO: Failed to escalate to hotel staff. Reason: ${detail}`,
          );
        }
      },
    }),
  };
}
