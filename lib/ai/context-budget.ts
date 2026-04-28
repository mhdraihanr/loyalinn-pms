import type { ModelMessage } from "ai";

type BuildBudgetedMessageHistoryParams = {
  messages: ModelMessage[];
  maxRecentMessages: number;
  trimmedSummary?: string;
};

type SummaryLanguage = "id" | "en";

function normalizeSummary(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "";
}

export function buildBudgetedMessageHistory(
  params: BuildBudgetedMessageHistoryParams,
): ModelMessage[] {
  const { messages, maxRecentMessages } = params;

  if (messages.length <= maxRecentMessages) {
    return [...messages];
  }

  const recentMessages = messages.slice(-maxRecentMessages);
  const trimmedSummary = normalizeSummary(params.trimmedSummary);

  if (!trimmedSummary) {
    return recentMessages;
  }

  return [
    {
      role: "system",
      content: trimmedSummary,
    },
    ...recentMessages,
  ];
}

function toMessageSnippet(message: ModelMessage) {
  if (typeof message.content !== "string") {
    return "";
  }

  return message.content.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function buildTrimmedConversationSummary(params: {
  messages: ModelMessage[];
  language: SummaryLanguage;
}) {
  if (params.messages.length === 0) {
    return "";
  }

  const sample = params.messages
    .map((message) => {
      const snippet = toMessageSnippet(message);
      if (!snippet) {
        return "";
      }

      return `${message.role}: ${snippet}`;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");

  const messageCount = params.messages.length;

  if (params.language === "en") {
    return `Summary of earlier conversation: Older messages were compacted (${messageCount} earlier messages). Key context: ${sample}`;
  }

  return `Ringkasan percakapan sebelumnya: Pesan lama dipadatkan (${messageCount} pesan sebelumnya). Konteks penting: ${sample}`;
}
