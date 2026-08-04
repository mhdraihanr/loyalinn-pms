import type { LifecycleLanguage } from "@/lib/ai/lifecycle-session";

/**
 * Safety net for known Gemini 2.5 Flash behaviour where the model
 * occasionally finishes with `finishReason: "stop"` and empty text
 * immediately after a successful tool call. In that case the guest
 * would never get a WhatsApp reply even though the request was
 * already persisted (e.g. in housekeeping_requests / room_service_orders).
 *
 * See: https://github.com/vercel/ai/issues/13017 and
 *      https://github.com/vercel/ai/issues/7519
 *
 * When that happens we synthesise a reply from the last successful
 * tool result's output string (tools already return a user-friendly
 * confirmation sentence, just prefixed with "INFO_SISTEM:" /
 * "SYSTEM_INFO:" for the model's benefit).
 */

const SYSTEM_INFO_PREFIX_PATTERN = /^\s*(INFO_SISTEM|SYSTEM_INFO)\s*:\s*/i;

type GenerateTextLikeResult = {
  text?: string | null;
  steps?: ReadonlyArray<{
    toolResults?: ReadonlyArray<{
      type?: string;
      toolName?: string;
      output?: unknown;
    }>;
    content?: ReadonlyArray<{
      type?: string;
    }>;
  }>;
};

const GENERIC_HANDOFF_FALLBACK: Record<LifecycleLanguage, string> = {
  id: "Baik, permintaan Anda sudah saya catat dan diteruskan ke tim hotel untuk ditindaklanjuti.",
  en: "Noted, your request has been recorded and forwarded to our hotel team for follow-up.",
};

export function normalizeWhatsAppMarkdown(value: string) {
  return value.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
}

function stripSystemPrefix(value: string) {
  return normalizeWhatsAppMarkdown(
    value.replace(SYSTEM_INFO_PREFIX_PATTERN, "").trim(),
  );
}

function hasStepError(step: { content?: ReadonlyArray<{ type?: string }> }) {
  return (step.content ?? []).some((part) => part?.type === "tool-error");
}

/**
 * Returns a non-empty confirmation reply when `result.text` is empty
 * but a tool was executed successfully in one of the steps. Returns
 * an empty string when there is no salvageable signal.
 */
export function extractFallbackReplyFromToolResults(
  result: GenerateTextLikeResult,
  language: LifecycleLanguage,
): string {
  const directText = typeof result.text === "string" ? result.text.trim() : "";
  if (directText) {
    return normalizeWhatsAppMarkdown(directText);
  }

  const steps = result.steps ?? [];
  let sawSuccessfulToolCall = false;

  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (hasStepError(step)) {
      continue;
    }

    const toolResults = step.toolResults ?? [];
    for (let j = toolResults.length - 1; j >= 0; j--) {
      const entry = toolResults[j];
      if (!entry || entry.type === "tool-error") {
        continue;
      }

      sawSuccessfulToolCall = true;
      const rawOutput = entry.output;
      if (typeof rawOutput !== "string") {
        continue;
      }

      const cleaned = stripSystemPrefix(rawOutput);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return sawSuccessfulToolCall ? GENERIC_HANDOFF_FALLBACK[language] : "";
}
