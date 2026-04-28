import { describe, expect, it } from "vitest";

import { extractFallbackReplyFromToolResults } from "@/lib/ai/fallback-reply";

describe("extractFallbackReplyFromToolResults", () => {
  it("returns trimmed model text when it is non-empty", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "  Baik, handuk sudah saya catat.  ",
        steps: [],
      },
      "id",
    );

    expect(reply).toBe("Baik, handuk sudah saya catat.");
  });

  it("synthesises confirmation from last successful tool result when text is empty", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "request_housekeeping",
                output:
                  "INFO_SISTEM: Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
              },
            ],
            content: [],
          },
        ],
      },
      "id",
    );

    expect(reply).toBe(
      "Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
    );
  });

  it("strips SYSTEM_INFO prefix for english tool outputs", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "request_housekeeping",
                output:
                  "SYSTEM_INFO: Housekeeping request has been created and forwarded to the team.",
              },
            ],
            content: [],
          },
        ],
      },
      "en",
    );

    expect(reply).toBe(
      "Housekeeping request has been created and forwarded to the team.",
    );
  });

  it("prefers the most recent successful tool result across multiple steps", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "order_in_room_dining",
                output:
                  "INFO_SISTEM: Pesanan room service berhasil dibuat dan diteruskan ke tim operasional.",
              },
            ],
            content: [],
          },
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "request_housekeeping",
                output:
                  "INFO_SISTEM: Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
              },
            ],
            content: [],
          },
        ],
      },
      "id",
    );

    expect(reply).toBe(
      "Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
    );
  });

  it("skips steps that contain tool-error parts and falls back to earlier successful tool results", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "request_housekeeping",
                output:
                  "INFO_SISTEM: Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
              },
            ],
            content: [],
          },
          {
            toolResults: [],
            content: [{ type: "tool-error" }],
          },
        ],
      },
      "id",
    );

    expect(reply).toBe(
      "Permintaan housekeeping berhasil dibuat dan diteruskan ke tim terkait.",
    );
  });

  it("returns generic handoff message when tool ran but output is not a string", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [
              {
                type: "tool-result",
                toolName: "request_housekeeping",
                output: { ok: true },
              },
            ],
            content: [],
          },
        ],
      },
      "id",
    );

    expect(reply).toBe(
      "Baik, permintaan Anda sudah saya catat dan diteruskan ke tim hotel untuk ditindaklanjuti.",
    );
  });

  it("returns empty string when no text and no successful tool call exists", () => {
    const reply = extractFallbackReplyFromToolResults(
      {
        text: "",
        steps: [
          {
            toolResults: [],
            content: [],
          },
        ],
      },
      "id",
    );

    expect(reply).toBe("");
  });

  it("returns empty string when result has no steps at all", () => {
    const reply = extractFallbackReplyFromToolResults(
      { text: "" },
      "id",
    );

    expect(reply).toBe("");
  });
});
