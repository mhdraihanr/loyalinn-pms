import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { buildPayloadHash } from "@/lib/automation/idempotency";
import { normalizeQloAppsWebhook } from "@/lib/automation/qloapps-normalizer";
import { processQloAppsWebhookEvent } from "@/lib/pms/qloapps-webhook-processor";

const MAX_TIMESTAMP_DRIFT_SECONDS = 300;

function isValidSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
) {
  const secret = process.env.PMS_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing PMS_WEBHOOK_SECRET");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  if (expected.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function isFreshTimestamp(timestamp: string) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) {
    return false;
  }

  return (
    Math.abs(Math.floor(Date.now() / 1000) - seconds) <=
    MAX_TIMESTAMP_DRIFT_SECONDS
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-pms-timestamp");
  const signature = request.headers.get("x-pms-signature");

  if (!timestamp || !signature || !isFreshTimestamp(timestamp)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const payloadHash = buildPayloadHash(rawBody);

  let normalizedEvent;
  try {
    normalizedEvent = normalizeQloAppsWebhook(
      payload as Record<string, string>,
      rawBody,
      payloadHash,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await processQloAppsWebhookEvent({
    rawBody,
    payload: payload as Record<string, unknown>,
    payloadHash,
    normalizedEvent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}
