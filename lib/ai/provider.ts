import { createGoogleGenerativeAI } from "@ai-sdk/google";

function getGeminiApiKey() {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

// Gemini provider via AI SDK Google package.
export const aiProvider = createGoogleGenerativeAI({
  apiKey: getGeminiApiKey(),
});

// Primary Gemini model.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Optional fallback model for retryable provider failures (e.g. 429 rate-limit).
export const AI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "";
