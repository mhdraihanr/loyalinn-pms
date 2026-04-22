import { tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  upsertLifecycleAiSession,
  type LifecycleLanguage,
  type LifecycleStage,
} from "@/lib/ai/lifecycle-session";

type LifecycleToolContext = {
  supabase: SupabaseClient;
  tenantId: string;
  reservationId: string;
  guestId: string;
  roomNumber: string;
  language: LifecycleLanguage;
  stage: LifecycleStage;
};

function t(language: LifecycleLanguage, idText: string, enText: string) {
  return language === "en" ? enText : idText;
}

function normalizeRoomNumber(roomNumber: string) {
  const trimmed = roomNumber.trim();
  return trimmed.length > 0 ? trimmed : "-";
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

export function createPreArrivalTools(context: LifecycleToolContext) {
  return {
    capture_arrival_eta: tool({
      description:
        "Store guest estimated arrival time (ETA) for pre-arrival operations.",
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
            "INFO_SISTEM: ETA tamu berhasil dicatat untuk referensi tim front office.",
            "SYSTEM_INFO: Guest arrival ETA has been recorded for front office reference.",
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
        "Record guest early check-in request for human approval and follow-up.",
      inputSchema: z.object({
        requested_time: z
          .string()
          .min(2)
          .describe("Requested early check-in time."),
        reason: z
          .string()
          .max(500)
          .optional()
          .describe("Optional reason from guest."),
      }),
      execute: async ({ requested_time, reason }) => {
        try {
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
            "INFO_SISTEM: Permintaan early check-in sudah dicatat dan diteruskan ke tim hotel untuk konfirmasi.",
            "SYSTEM_INFO: Early check-in request has been logged and forwarded to hotel staff for confirmation.",
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
            "INFO_SISTEM: Percakapan di-eskalasi ke staf hotel untuk ditangani manual.",
            "SYSTEM_INFO: Conversation escalated to hotel staff for manual follow-up.",
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

  return {
    order_in_room_dining: tool({
      description:
        "Create an in-room dining request and store it in room_service_orders.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().min(1),
              quantity: z.number().int().min(1),
              notes: z.string().max(250).optional(),
            }),
          )
          .min(1),
        total_amount: z
          .number()
          .min(0)
          .optional()
          .describe("Optional estimated total amount."),
      }),
      execute: async ({ items, total_amount }) => {
        try {
          const { error } = await context.supabase
            .from("room_service_orders")
            .insert({
              tenant_id: context.tenantId,
              reservation_id: context.reservationId,
              guest_id: context.guestId,
              room_number: roomNumber,
              items,
              total_amount: total_amount ?? null,
              status: "pending",
            });

          if (error) {
            throw error;
          }

          await markAction(context, {
            actionType: "order_in_room_dining",
            actionPayload: {
              items,
              total_amount: total_amount ?? null,
            },
            needsHumanFollowUp: true,
          });

          return t(
            context.language,
            "INFO_SISTEM: Pesanan room service berhasil dibuat dan diteruskan ke tim operasional.",
            "SYSTEM_INFO: Room service order has been created and forwarded to operations.",
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
            "INFO_SISTEM: Permintaan sudah di-eskalasi ke staf hotel untuk penanganan manual.",
            "SYSTEM_INFO: Request has been escalated to hotel staff for manual handling.",
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
