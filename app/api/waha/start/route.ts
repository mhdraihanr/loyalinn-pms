import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

const DEFAULT_WEBHOOK_EVENTS = ["message.any"];

type WebhookTarget = {
  url: string;
  events: string[];
};

function normalizeWebhookEvents(events: string[]) {
  const uniqueEvents = Array.from(
    new Set(events.map((eventName) => eventName.trim()).filter(Boolean)),
  );

  if (uniqueEvents.includes("message.any")) {
    return uniqueEvents.filter((eventName) => eventName !== "message");
  }

  return uniqueEvents;
}

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

  const parsedEvents = normalizeWebhookEvents(rawEvents.split(","));

  if (parsedEvents.length === 0) {
    return DEFAULT_WEBHOOK_EVENTS;
  }

  return parsedEvents;
}

function isEventCoveredBy(globalEventSet: Set<string>, eventName: string) {
  if (globalEventSet.has(eventName)) {
    return true;
  }

  if (eventName === "message" && globalEventSet.has("message.any")) {
    return true;
  }

  return false;
}

function hasEquivalentGlobalWebhook(target: WebhookTarget) {
  const globalWebhookUrl = process.env.WHATSAPP_HOOK_URL?.trim();
  const rawGlobalEvents = process.env.WHATSAPP_HOOK_EVENTS;

  if (!globalWebhookUrl || !rawGlobalEvents) {
    return false;
  }

  if (globalWebhookUrl !== target.url) {
    return false;
  }

  const globalEvents = normalizeWebhookEvents(rawGlobalEvents.split(","));
  if (globalEvents.length === 0) {
    return false;
  }

  const globalEventSet = new Set(globalEvents);
  return target.events.every((eventName) =>
    isEventCoveredBy(globalEventSet, eventName),
  );
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
    let webhooksConfigured = false;
    let webhooksSkipReason:
      | "auto-config-disabled"
      | "global-webhook-configured"
      | null = null;

    if (shouldAutoConfigureWebhooks) {
      const webhookConfig = buildWebhookConfig();
      const [primaryWebhook] = webhookConfig.webhooks;

      if (primaryWebhook && hasEquivalentGlobalWebhook(primaryWebhook)) {
        webhooksSkipReason = "global-webhook-configured";
      } else {
        await wahaClient.updateSessionConfig(sessionName, webhookConfig);
        webhooksConfigured = true;
      }
    } else {
      webhooksSkipReason = "auto-config-disabled";
    }

    return NextResponse.json({
      ...result,
      session: sessionName,
      webhooksConfigured,
      ...(webhooksSkipReason ? { webhooksSkipReason } : {}),
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
