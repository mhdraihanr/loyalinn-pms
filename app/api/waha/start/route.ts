import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

const DEFAULT_WEBHOOK_EVENTS = ["message.any"];

function resolveWebhookUrl() {
  const explicitUrl =
    process.env.WAHA_WEBHOOK_URL?.trim() ||
    process.env.WHATSAPP_HOOK_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    return "http://host.docker.internal:3000/api/webhooks/waha";
  }

  try {
    const parsed = new URL(appUrl);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = "host.docker.internal";
    }

    parsed.pathname = "/api/webhooks/waha";
    parsed.search = "";
    parsed.hash = "";

    return parsed.toString();
  } catch {
    return "http://host.docker.internal:3000/api/webhooks/waha";
  }
}

function resolveWebhookEvents() {
  const rawEvents =
    process.env.WAHA_WEBHOOK_EVENTS ||
    process.env.WHATSAPP_HOOK_EVENTS ||
    DEFAULT_WEBHOOK_EVENTS.join(",");

  const parsedEvents = rawEvents
    .split(",")
    .map((eventName) => eventName.trim())
    .filter((eventName) => eventName.length > 0);

  if (parsedEvents.length === 0) {
    return DEFAULT_WEBHOOK_EVENTS;
  }

  return Array.from(new Set(parsedEvents));
}

function buildWebhookConfig() {
  const hmacKey =
    process.env.WAHA_WEBHOOK_SECRET?.trim() ||
    process.env.PMS_WEBHOOK_SECRET?.trim() ||
    "";

  return {
    webhooks: [
      {
        url: resolveWebhookUrl(),
        events: resolveWebhookEvents(),
        ...(hmacKey ? { hmac: { key: hmacKey } } : {}),
        retries: {
          policy: "exponential" as const,
          delaySeconds: 2,
          attempts: 15,
        },
      },
    ],
  };
}

export async function POST() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sessionName = "default";

    // WAHA Core free version only supports 1 session, typically named "default"
    // In a multi-tenant paid setup, this would be userTenant.tenantId
    const result = await wahaClient.startSession(sessionName);

    const shouldAutoConfigureWebhooks =
      process.env.WAHA_AUTO_CONFIGURE_WEBHOOKS !== "false";

    if (shouldAutoConfigureWebhooks) {
      await wahaClient.updateSessionConfig(sessionName, buildWebhookConfig());
    }

    return NextResponse.json({
      ...result,
      session: sessionName,
      webhooksConfigured: shouldAutoConfigureWebhooks,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown WAHA start error";
    console.error("WAHA Start Session Error:", message);
    return NextResponse.json(
      { error: "Failed to start WAHA session", details: message },
      { status: 500 },
    );
  }
}
