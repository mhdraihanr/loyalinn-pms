import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildIdempotencyKey,
  buildPayloadHash,
} from "@/lib/automation/idempotency";
import { normalizeQloAppsWebhook } from "@/lib/automation/qloapps-normalizer";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const normalizedEvent = normalizeQloAppsWebhook(
    payload as Record<string, string>,
    rawBody,
    payloadHash,
  );
  const idempotencyKey = buildIdempotencyKey({
    bookingId: normalizedEvent.bookingId,
    status: normalizedEvent.status,
    updatedAt: normalizedEvent.updatedAt,
    rawPayload: rawBody,
  });

  const adminClient = createAdminClient();
  const { data: inboundEvent, error: inboundError } = await adminClient
    .from("inbound_events")
    .insert({
      tenant_id: normalizedEvent.tenantId,
      event_id: normalizedEvent.eventId,
      idempotency_key: idempotencyKey,
      event_type: normalizedEvent.eventType,
      source: "qloapps",
      signature_valid: true,
      payload: payload as Record<string, unknown>,
      payload_hash: payloadHash,
    })
    .select("id")
    .single();

  if (inboundError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (inboundError) {
    return NextResponse.json({ error: inboundError.message }, { status: 500 });
  }

  const { error: jobError } = await adminClient.from("automation_jobs").insert({
    tenant_id: normalizedEvent.tenantId,
    job_type: "status-trigger",
    trigger_type: normalizedEvent.status,
    status: "pending",
    payload: {
      inbound_event_id: inboundEvent?.id,
      event_type: normalizedEvent.eventType,
      booking_id: normalizedEvent.bookingId,
      status: normalizedEvent.status,
      updated_at: normalizedEvent.updatedAt ?? null,
    },
  });

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, duplicate: false });
}
