import { createHash } from "node:crypto";

import type { IdempotencyKeyInput } from "@/lib/automation/types";

export function buildPayloadHash(rawPayload: string): string {
  return createHash("sha256").update(rawPayload).digest("hex");
}

export function buildIdempotencyKey({
  bookingId,
  status,
  updatedAt,
  rawPayload,
}: IdempotencyKeyInput): string {
  if (!updatedAt) {
    if (!rawPayload) {
      throw new Error("rawPayload is required when updatedAt is missing");
    }

    return buildPayloadHash(rawPayload);
  }

  return buildPayloadHash(`${bookingId}:${status}:${updatedAt}`);
}
