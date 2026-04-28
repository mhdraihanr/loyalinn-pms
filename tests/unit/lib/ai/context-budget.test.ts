import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";

import {
  buildBudgetedMessageHistory,
  buildTrimmedConversationSummary,
} from "@/lib/ai/context-budget";

describe("buildBudgetedMessageHistory", () => {
  it("returns original history when message count is within budget", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "Halo" },
      { role: "assistant", content: "Halo, ada yang bisa saya bantu?" },
      { role: "user", content: "Tolong handuk tambahan" },
    ];

    const result = buildBudgetedMessageHistory({
      messages,
      maxRecentMessages: 5,
      trimmedSummary: "Ringkasan lama yang tidak boleh dipakai.",
    });

    expect(result).toEqual(messages);
    expect(result).not.toBe(messages);
  });

  it("keeps only the most recent messages when history exceeds budget", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "m1" },
      { role: "assistant", content: "m2" },
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
    ];

    const result = buildBudgetedMessageHistory({
      messages,
      maxRecentMessages: 2,
    });

    expect(result).toEqual([
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
    ]);
  });

  it("prepends a system summary when older messages are trimmed and summary is present", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "m1" },
      { role: "assistant", content: "m2" },
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
    ];

    const result = buildBudgetedMessageHistory({
      messages,
      maxRecentMessages: 2,
      trimmedSummary: "Ringkasan percakapan sebelumnya: tamu sudah meminta bantuan kamar.",
    });

    expect(result).toEqual([
      {
        role: "system",
        content:
          "Ringkasan percakapan sebelumnya: tamu sudah meminta bantuan kamar.",
      },
      { role: "assistant", content: "m4" },
      { role: "user", content: "m5" },
    ]);
  });

  it("ignores blank summaries so empty system messages are not added", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "m1" },
      { role: "assistant", content: "m2" },
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
    ];

    const result = buildBudgetedMessageHistory({
      messages,
      maxRecentMessages: 2,
      trimmedSummary: "   ",
    });

    expect(result).toEqual([
      { role: "user", content: "m3" },
      { role: "assistant", content: "m4" },
    ]);
  });

  it("preserves ordering after trimming and summary injection", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "old-user" },
      { role: "assistant", content: "old-assistant" },
      { role: "user", content: "recent-user-1" },
      { role: "assistant", content: "recent-assistant-1" },
      { role: "user", content: "recent-user-2" },
    ];

    const result = buildBudgetedMessageHistory({
      messages,
      maxRecentMessages: 3,
      trimmedSummary: "Summary of earlier conversation: older context trimmed.",
    });

    expect(result).toEqual([
      {
        role: "system",
        content: "Summary of earlier conversation: older context trimmed.",
      },
      { role: "user", content: "recent-user-1" },
      { role: "assistant", content: "recent-assistant-1" },
      { role: "user", content: "recent-user-2" },
    ]);
  });
});

describe("buildTrimmedConversationSummary", () => {
  it("returns empty string when there are no trimmed messages", () => {
    expect(buildTrimmedConversationSummary({ messages: [], language: "id" })).toBe(
      "",
    );
  });

  it("builds an Indonesian summary from trimmed messages", () => {
    const result = buildTrimmedConversationSummary({
      language: "id",
      messages: [
        { role: "user", content: "Saya sudah minta 2 handuk tadi" },
        { role: "assistant", content: "Baik, kami catat." },
        { role: "user", content: "Kalau bisa cepat ya" },
      ],
    });

    expect(result).toContain("Ringkasan percakapan sebelumnya:");
    expect(result).toContain("Pesan lama dipadatkan");
    expect(result).toContain("user: Saya sudah minta 2 handuk tadi");
  });

  it("builds an English summary from trimmed messages", () => {
    const result = buildTrimmedConversationSummary({
      language: "en",
      messages: [
        { role: "user", content: "I asked for an extra towel earlier" },
        { role: "assistant", content: "Noted, we will assist." },
      ],
    });

    expect(result).toContain("Summary of earlier conversation:");
    expect(result).toContain("Older messages were compacted");
    expect(result).toContain("user: I asked for an extra towel earlier");
  });
});
