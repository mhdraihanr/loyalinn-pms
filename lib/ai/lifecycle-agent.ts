import type { ModelMessage } from "ai";

import { processPostStayLifecycleConversation } from "@/lib/ai/agent";
import {
  type LifecycleLanguage,
  type LifecycleStage,
} from "@/lib/ai/lifecycle-session";
import { processOnStayConversation } from "@/lib/ai/on-stay-agent";
import { processPreArrivalConversation } from "@/lib/ai/pre-arrival-agent";

type ProcessLifecycleGuestMessageParams = {
  stage: LifecycleStage;
  reservationId: string;
  tenantId: string;
  guestId: string;
  guestName: string;
  hotelName: string;
  roomNumber: string;
  messageHistory: ModelMessage[];
  preferredLanguage: LifecycleLanguage;
};

export async function processLifecycleGuestMessage(
  params: ProcessLifecycleGuestMessageParams,
) {
  if (params.stage === "pre-arrival") {
    return processPreArrivalConversation({
      reservationId: params.reservationId,
      tenantId: params.tenantId,
      guestId: params.guestId,
      guestName: params.guestName,
      hotelName: params.hotelName,
      roomNumber: params.roomNumber,
      messageHistory: params.messageHistory,
      preferredLanguage: params.preferredLanguage,
    });
  }

  if (params.stage === "on-stay") {
    return processOnStayConversation({
      reservationId: params.reservationId,
      tenantId: params.tenantId,
      guestId: params.guestId,
      guestName: params.guestName,
      hotelName: params.hotelName,
      roomNumber: params.roomNumber,
      messageHistory: params.messageHistory,
      preferredLanguage: params.preferredLanguage,
    });
  }

  return processPostStayLifecycleConversation(
    params.reservationId,
    params.tenantId,
    params.guestName,
    params.hotelName,
    params.messageHistory,
    params.preferredLanguage,
  );
}
